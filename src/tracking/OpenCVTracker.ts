// cv type is 'any' — the OpenCV.js WASM API is dynamic and not fully typed.
// biome-ignore lint/suspicious/noExplicitAny: OpenCV.js WASM has no TypeScript typings
let cvPromise: Promise<any> | null = null;

const CV_LOAD_TIMEOUT_MS = 30_000;

// biome-ignore lint/suspicious/noExplicitAny: OpenCV.js WASM has no TypeScript typings
function loadCV(): Promise<any> {
  if (!cvPromise) {
    cvPromise = import("@techstark/opencv-js").then(async (mod) => {
      // biome-ignore lint/suspicious/noExplicitAny: OpenCV.js WASM has no TypeScript typings
      let cv = (mod as any).default ?? mod;

      // The default export may itself be a Promise (v4.12.0+).
      if (cv instanceof Promise) {
        cv = await cv;
      }

      // WASM may already be ready (e.g. in test environments).
      if (typeof cv.Mat === "function") {
        return cv;
      }

      // Wait for the Emscripten runtime to initialise, with a timeout so we
      // never hang indefinitely.
      // biome-ignore lint/suspicious/noExplicitAny: OpenCV.js WASM has no TypeScript typings
      return new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("OpenCV WASM initialisation timed out"));
        }, CV_LOAD_TIMEOUT_MS);

        cv.onRuntimeInitialized = () => {
          clearTimeout(timer);
          resolve(cv);
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
  // biome-ignore lint/suspicious/noExplicitAny: OpenCV.js WASM has no TypeScript typings
  private cv: any = null;
  // biome-ignore lint/suspicious/noExplicitAny: OpenCV.js WASM has no TypeScript typings
  private templateMat: any = null;
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
      return this.ctx.getImageData(0, 0, this.offscreen.width, this.offscreen.height);
    } catch (e) {
      throw new Error(
        "Cannot read video pixels: the video source may be cross-origin without CORS headers.",
        { cause: e },
      );
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
    this.cv = await loadCV();

    const imageData = this.captureFrame(video);
    const frame = this.cv.matFromImageData(imageData);
    const gray = new this.cv.Mat();
    try {
      this.cv.cvtColor(frame, gray, this.cv.COLOR_RGBA2GRAY);

      if (this.templateMat) this.templateMat.delete();

      // Clamp the origin first, then use the clamped values when bounding the
      // width and height.  Without this, a negative region.x / region.y makes
      // `offscreen.width - region.x` larger than the canvas, causing OpenCV to
      // read outside the source image and crash.
      const clampedX = Math.round(Math.max(0, region.x));
      const clampedY = Math.round(Math.max(0, region.y));
      const roi = new this.cv.Rect(
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
    if (!this.ready) return null;

    let imageData: ImageData;
    try {
      imageData = this.captureFrame(video);
    } catch {
      // Cross-origin video — silently skip this frame rather than crashing.
      return null;
    }
    const frame = this.cv.matFromImageData(imageData);
    const gray = new this.cv.Mat();
    const result = new this.cv.Mat();
    try {
      this.cv.cvtColor(frame, gray, this.cv.COLOR_RGBA2GRAY);
      this.cv.matchTemplate(
        gray,
        this.templateMat,
        result,
        this.cv.TM_CCOEFF_NORMED,
      );
      const { maxLoc } = this.cv.minMaxLoc(result);

      return {
        x: maxLoc.x + this.templateMat.cols / 2,
        y: maxLoc.y + this.templateMat.rows / 2,
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
