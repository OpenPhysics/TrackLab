/**
 * Typed façade over the OpenCV.js WASM module.
 * Only covers the API surface used by OpenCVTracker so that version-bump
 * breakage is caught by the TypeScript compiler rather than at runtime.
 */

/** Opaque handle for an OpenCV Mat allocated on the WASM heap. */
interface CvMat {
  readonly rows: number;
  readonly cols: number;
  roi(rect: CvRect): CvMat;
  clone(): CvMat;
  delete(): void;
}

/** OpenCV Rect value. Created with `new cv.Rect()`, passed to `CvMat.roi()`. */
interface CvRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface MinMaxLocResult {
  minVal: number;
  maxVal: number;
  minLoc: { x: number; y: number };
  maxLoc: { x: number; y: number };
}

/** Typed surface of the OpenCV.js module used by this tracker. */
interface CV {
  // Constructors
  readonly Mat: new () => CvMat;
  readonly Rect: new (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => CvRect;

  // Factory from browser ImageData
  matFromImageData(imageData: ImageData): CvMat;

  // Color conversion
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  readonly COLOR_RGBA2GRAY: number;

  // Template matching
  matchTemplate(
    image: CvMat,
    templ: CvMat,
    result: CvMat,
    method: number,
  ): void;
  minMaxLoc(src: CvMat): MinMaxLocResult;
  readonly TM_CCOEFF_NORMED: number;

  // WASM lifecycle callback set by caller, invoked when Emscripten is ready
  onRuntimeInitialized?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

let cvPromise: Promise<CV> | null = null;

const CV_LOAD_TIMEOUT_MS = 30_000;

function loadCV(): Promise<CV> {
  if (!cvPromise) {
    cvPromise = import("@techstark/opencv-js").then(async (mod) => {
      // Single escape hatch at the WASM module boundary: the package ships no
      // TypeScript typings, so we extract the runtime object as `unknown` and
      // cast to `CV` only after confirming it is initialised.
      // biome-ignore lint/suspicious/noExplicitAny: OpenCV.js WASM has no TypeScript typings
      let cv: unknown = (mod as any).default ?? mod;

      // The default export may itself be a Promise (v4.12.0+).
      if (cv instanceof Promise) {
        cv = await cv;
      }

      // WASM may already be ready (e.g. in test environments).
      if (typeof (cv as { Mat?: unknown }).Mat === "function") {
        return cv as CV;
      }

      // Wait for the Emscripten runtime to initialise, with a timeout so we
      // never hang indefinitely.
      return new Promise<CV>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("OpenCV WASM initialisation timed out"));
        }, CV_LOAD_TIMEOUT_MS);

        (cv as CV).onRuntimeInitialized = () => {
          clearTimeout(timer);
          resolve(cv as CV);
        };
      });
    });

    // If loading fails, clear the cached promise so the next attempt can retry.
    cvPromise.catch(() => {
      cvPromise = null;
    });
  }
  return cvPromise;
}

export type TrackerRegion = { x: number; y: number; w: number; h: number };

/**
 * Tracks a user-selected object across video frames using OpenCV template matching.
 * The template is captured once from the user's selection and then matched against
 * each subsequent frame using normalised cross-correlation (TM_CCOEFF_NORMED).
 */
export class OpenCVTracker {
  private cv: CV | null = null;
  private templateMat: CvMat | null = null;
  private readonly offscreen: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  public constructor(videoWidth: number, videoHeight: number) {
    this.offscreen = document.createElement("canvas");
    this.offscreen.width = videoWidth;
    this.offscreen.height = videoHeight;
    const ctx = this.offscreen.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context from offscreen canvas");
    this.ctx = ctx;
  }

  public get ready(): boolean {
    return this.cv !== null && this.templateMat !== null;
  }

  /**
   * Draw a video frame onto the offscreen canvas and read back the pixels.
   * Throws a descriptive Error (wrapping the original SecurityError) if the
   * video is cross-origin and has no CORS headers, instead of letting the
   * SecurityError propagate uncaught.
   */
  private captureFrame(video: HTMLVideoElement): ImageData {
    this.ctx.drawImage(video, 0, 0);
    try {
      return this.ctx.getImageData(
        0,
        0,
        this.offscreen.width,
        this.offscreen.height,
      );
    } catch (e) {
      const err = new Error(
        "Cannot read video pixels: the video source may be cross-origin without CORS headers.",
      );
      throw Object.assign(err, { cause: e });
    }
  }

  /**
   * Capture the template from the currently visible video frame inside `region`,
   * loading OpenCV (WASM) on first call.
   */
  public async initFromVideo(
    video: HTMLVideoElement,
    region: TrackerRegion,
  ): Promise<void> {
    // Capture into a local const so TypeScript can narrow CV through the
    // subsequent captureFrame() call (class fields can't be narrowed across
    // method calls).
    const cv = (this.cv = await loadCV());

    const imageData = this.captureFrame(video);
    const frame = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    try {
      cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

      if (this.templateMat) this.templateMat.delete();

      // Clamp the origin first, then use the clamped values when bounding the
      // width and height.  Without this, a negative region.x / region.y makes
      // `offscreen.width - region.x` larger than the canvas, causing OpenCV to
      // read outside the source image and crash.
      const clampedX = Math.round(Math.max(0, region.x));
      const clampedY = Math.round(Math.max(0, region.y));
      const roi = new cv.Rect(
        clampedX,
        clampedY,
        Math.round(Math.min(region.w, this.offscreen.width - clampedX)),
        Math.round(Math.min(region.h, this.offscreen.height - clampedY)),
      );
      this.templateMat = gray.roi(roi).clone();
    } finally {
      frame.delete();
      gray.delete();
    }
  }

  /**
   * Match the stored template against the current video frame.
   * Returns the center of the best match in video-pixel coordinates, or null if not ready.
   */
  public track(video: HTMLVideoElement): { x: number; y: number } | null {
    // Capture into local consts so TypeScript narrows both to non-null for the
    // remainder of the method (class fields can't be narrowed across calls).
    const cv = this.cv;
    const templateMat = this.templateMat;
    if (!cv || !templateMat) return null;

    let imageData: ImageData;
    try {
      imageData = this.captureFrame(video);
    } catch {
      // Cross-origin video — silently skip this frame rather than crashing.
      return null;
    }
    const frame = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    const result = new cv.Mat();
    try {
      cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
      cv.matchTemplate(gray, templateMat, result, cv.TM_CCOEFF_NORMED);
      const { maxLoc } = cv.minMaxLoc(result);

      return {
        x: maxLoc.x + templateMat.cols / 2,
        y: maxLoc.y + templateMat.rows / 2,
      };
    } finally {
      frame.delete();
      gray.delete();
      result.delete();
    }
  }

  public dispose(): void {
    if (this.templateMat) {
      this.templateMat.delete();
      this.templateMat = null;
    }
  }
}
