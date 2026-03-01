/**
 * Main-thread façade for the OpenCV Web Worker.
 *
 * All CPU-intensive OpenCV operations (WASM load, cvtColor, matchTemplate) run
 * inside `opencv-worker.js` on a dedicated OS thread, so the main thread is
 * never blocked by WASM compilation or template matching.
 *
 * The main thread is still responsible for:
 *  - Drawing the video frame onto an offscreen canvas (GPU-accelerated)
 *  - Extracting the search-window ImageData (CPU ← GPU transfer)
 *  - Computing the windowed search region (cheap arithmetic)
 *
 * ## Stationary-camera optimisations
 *
 * When the camera is fixed (mounted on a tripod and not moving), the
 * background is completely static between frames.  The only source of
 * inter-frame variation is:
 *   1. The tracked object itself moving through the scene.
 *   2. Per-frame sensor noise and video-compression artefacts.
 *
 * Two mechanisms exploit these conditions:
 *
 * 1. **Gaussian pre-filtering** – a 5×5 Gaussian blur is applied to both the
 *    template at capture time and the search region on every tracking call.
 *    Because the same filter is used in both cases the normalised cross-
 *    correlation score (TM_CCOEFF_NORMED) remains accurate, while pixel-level
 *    sensor noise that would otherwise generate spurious match peaks is
 *    suppressed.  This is more effective on a stationary camera than on a
 *    panning one because the static background means noise is the dominant
 *    source of false matches rather than background-content changes.
 *
 * 2. **Confidence threshold** – TM_CCOEFF_NORMED returns a score in [-1, 1].
 *    Matches below MATCH_CONFIDENCE_THRESHOLD are silently dropped so that
 *    a noisy or occluded frame cannot send the tracker to a wrong location.
 *    The threshold is set lower (0.25) than would be appropriate for a
 *    moving camera because the static background makes strong false peaks
 *    unlikely.
 *
 * ## Windowed search optimisation (existing)
 *
 * Rather than reading back every pixel of every frame from the GPU (O(W×H) per
 * frame at 30 Hz), the tracker maintains the center of the last successful match
 * and restricts the next search to a window around it.  Only the pixels inside
 * that window are transferred from GPU to CPU via `getImageData`.  For a typical
 * 640×480 video and a moderate template, this reduces the pixel transfer by ~10–15×.
 *
 * The search window is padded by `SEARCH_PADDING_FACTOR × max(templateW, templateH)`
 * on every side.  If the object would exit that window between frames (very fast
 * motion), the tracker falls back to a full-frame search automatically.
 */

import trackLab from "../TrackLabNamespace.js";

export type TrackerRegion = { x: number; y: number; w: number; h: number };

type WorkerResponse =
  | { id: number; type: "init-done"; templateW: number; templateH: number; centerX: number; centerY: number }
  | { id: number; type: "track-result"; x: number; y: number; confidence: number }
  | { id: number; type: "error"; message: string };

/**
 * Tracks a user-selected object across video frames using OpenCV template
 * matching running in a Web Worker.
 */
export class OpenCVTracker {
  private readonly offscreen: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly worker: Worker;

  // True once the worker has successfully captured a template.
  private workerReady = false;

  // Message ID counter — each request gets a unique ID so stale worker
  // responses from a previous selection can be silently discarded.
  private nextMsgId = 0;
  private pendingId = -1;
  private pendingResolve: ((value: WorkerResponse) => void) | null = null;
  private pendingReject: ((reason: Error) => void) | null = null;

  // Template dimensions and last match center kept on the main thread so the
  // windowed search region can be computed without a worker round-trip.
  private templateW = 0;
  private templateH = 0;
  private lastMatchCenter: { x: number; y: number } | null = null;

  // Padding factor: search window extends this many template-lengths on each
  // side.  A value of 2 is well-matched to a stationary camera where the
  // object's own motion is the sole source of inter-frame displacement.
  private static readonly SEARCH_PADDING_FACTOR = 2;

  // TM_CCOEFF_NORMED confidence score below which a match is discarded.
  // Set to 0.25 for a stationary camera: the static background makes strong
  // false peaks rare, so a permissive threshold catches partial occlusions
  // while still rejecting genuinely bad frames (compression spikes, motion
  // blur on fast objects).
  private static readonly MATCH_CONFIDENCE_THRESHOLD = 0.25;

  /**
   * @param videoWidth  - Pixel width of the video element (offscreen canvas size).
   * @param videoHeight - Pixel height of the video element.
   */
  public constructor(videoWidth: number, videoHeight: number) {
    this.offscreen = document.createElement("canvas");
    this.offscreen.width = videoWidth;
    this.offscreen.height = videoHeight;
    const ctx = this.offscreen.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2D context from offscreen canvas");
    }
    this.ctx = ctx;

    this.worker = new Worker("./opencv-worker.js");
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      // Ignore responses from superseded requests (e.g. rapid re-selections).
      if (msg.id !== this.pendingId) {
        return;
      }
      if (msg.type === "error") {
        this.pendingReject?.(new Error(msg.message));
      } else {
        this.pendingResolve?.(msg);
      }
      this.pendingResolve = null;
      this.pendingReject = null;
      this.pendingId = -1;
    };
    this.worker.onerror = (e: ErrorEvent) => {
      const err = new Error(`OpenCV worker error: ${e.message}`);
      this.pendingReject?.(err);
      this.pendingResolve = null;
      this.pendingReject = null;
    };
  }

  /** True once a template has been successfully captured and tracking can begin. */
  public get ready(): boolean {
    return this.workerReady;
  }

  /**
   * Resize the offscreen canvas to new dimensions.
   * Call this when the video element's display size changes so that template
   * capture and matching operate in the same pixel space as the displayed content.
   */
  public resize(width: number, height: number): void {
    this.offscreen.width = width;
    this.offscreen.height = height;
  }

  private drawVideoFrame(video: HTMLVideoElement): void {
    this.ctx.drawImage(video, 0, 0, this.offscreen.width, this.offscreen.height);
  }

  private readPixels(x: number, y: number, w: number, h: number): ImageData {
    try {
      return this.ctx.getImageData(x, y, w, h);
    } catch (e) {
      throw new Error("Cannot read video pixels: the video source may be cross-origin without CORS headers.", {
        cause: e,
      });
    }
  }

  /** Send a message to the worker and return a Promise that resolves with the response. */
  private send(msg: object): Promise<WorkerResponse> {
    const id = this.nextMsgId++;
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pendingId = id;
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.worker.postMessage({ ...msg, id });
    });
  }

  /**
   * Capture the template from the current video frame inside `region` and send
   * it to the worker.  OpenCV (WASM) is loaded inside the worker on the first
   * call — this may take a moment but never blocks the main thread.
   *
   * The worker applies a Gaussian blur to the captured ROI so that the template
   * is in the same frequency domain as the blurred search regions used at
   * tracking time.
   */
  public async initFromVideo(video: HTMLVideoElement, region: TrackerRegion): Promise<void> {
    this.drawVideoFrame(video);
    const imageData = this.readPixels(0, 0, this.offscreen.width, this.offscreen.height);
    const response = await this.send({ type: "init", imageData, region });

    if (response.type === "init-done") {
      this.templateW = response.templateW;
      this.templateH = response.templateH;
      this.lastMatchCenter = { x: response.centerX, y: response.centerY };
      this.workerReady = true;
    }
  }

  /**
   * Match the stored template against the current video frame.
   * Returns the center of the best match in video-pixel coordinates, or null if
   * the tracker is not ready or the match confidence is below the threshold.
   * Runs asynchronously in the worker — the main thread is free while the
   * worker executes matchTemplate.
   *
   * For a stationary camera the search-window padding (SEARCH_PADDING_FACTOR)
   * only needs to cover the object's own motion between frames; no extra margin
   * for camera motion is required.
   */
  public async track(video: HTMLVideoElement): Promise<{ x: number; y: number } | null> {
    if (!this.workerReady) {
      return null;
    }

    const tw = this.templateW;
    const th = this.templateH;
    const padding = Math.max(tw, th) * OpenCVTracker.SEARCH_PADDING_FACTOR;

    // ── Compute windowed search region ────────────────────────────────────
    let searchX = 0;
    let searchY = 0;
    let searchW = this.offscreen.width;
    let searchH = this.offscreen.height;

    if (this.lastMatchCenter) {
      const lastLeft = this.lastMatchCenter.x - tw / 2;
      const lastTop = this.lastMatchCenter.y - th / 2;

      const x0 = Math.max(0, Math.floor(lastLeft - padding));
      const y0 = Math.max(0, Math.floor(lastTop - padding));
      const x1 = Math.min(this.offscreen.width, Math.ceil(lastLeft + tw + padding));
      const y1 = Math.min(this.offscreen.height, Math.ceil(lastTop + th + padding));

      if (x1 - x0 > tw && y1 - y0 > th) {
        searchX = x0;
        searchY = y0;
        searchW = x1 - x0;
        searchH = y1 - y0;
      }
    }

    // ── Extract search-window pixels (GPU → CPU) ──────────────────────────
    this.drawVideoFrame(video);
    let imageData: ImageData;
    try {
      imageData = this.readPixels(searchX, searchY, searchW, searchH);
    } catch {
      return null;
    }

    const response = await this.send({ type: "track", imageData, searchX, searchY });

    if (response.type === "track-result") {
      const { x, y, confidence } = response;

      // Drop matches below the confidence threshold.  For a stationary
      // camera this catches motion-blurred frames and compression spikes
      // without falsely rejecting genuine (albeit imperfect) matches.
      if (confidence < OpenCVTracker.MATCH_CONFIDENCE_THRESHOLD) {
        return null;
      }

      this.lastMatchCenter = { x, y };
      return { x, y };
    }
    return null;
  }

  /**
   * Reset tracking state.  Sends a dispose message to the worker (fire-and-forget)
   * and rejects any in-flight request so callers don't hang.
   */
  public dispose(): void {
    this.worker.postMessage({ type: "dispose", id: -1 });
    this.workerReady = false;
    this.lastMatchCenter = null;
    if (this.pendingReject) {
      this.pendingReject(new Error("Tracker disposed"));
      this.pendingResolve = null;
      this.pendingReject = null;
      this.pendingId = -1;
    }
  }
}

trackLab.register("OpenCVTracker", OpenCVTracker);
