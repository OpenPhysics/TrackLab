/**
 * WebcamRecorder class for camera access, preview, and recording.
 * Handles MediaStream, MediaRecorder, and device enumeration.
 */

import trackLab from "./TrackLabNamespace.js";

/** Frame rate constraints for getUserMedia. */
export interface FrameRateConstraints {
  ideal?: number;
  min?: number;
  max?: number;
}

/** Hardware capabilities for frame rate (min/max supported). */
export interface FrameRateCapabilities {
  min: number;
  max: number;
}

/**
 * Get the configured frame rate from a MediaStream's video track.
 * Returns null if no video track or frameRate is not available.
 */
export function getFrameRateFromStream(stream: MediaStream): number | null {
  const track = stream.getVideoTracks()[0];
  if (!track) {
    return null;
  }
  const settings = track.getSettings();
  const rate = settings.frameRate;
  return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
}

/**
 * Get frame rate capabilities from a MediaStream's video track.
 * Returns null if no video track or capabilities are not available.
 */
export function getFrameRateCapabilitiesFromStream(stream: MediaStream): FrameRateCapabilities | null {
  const track = stream.getVideoTracks()[0];
  if (!track) {
    return null;
  }
  const caps = track.getCapabilities();
  const fr = caps.frameRate;
  if (!fr || typeof fr.min !== "number" || typeof fr.max !== "number") {
    return null;
  }
  return { min: fr.min, max: fr.max };
}

/**
 * Get a supported MIME type for MediaRecorder.
 * Prioritizes WebM formats for best browser support, falls back to MP4.
 */
export function getSupportedMimeType(): string {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

/**
 * Count the total number of frames in a WebM video by playing it through at
 * maximum speed and tracking presented frames via requestVideoFrameCallback.
 * Also resolves the true duration for WebM blobs that initially report Infinity.
 *
 * Returns frameCount=0 when requestVideoFrameCallback is unavailable; callers
 * should fall back to a duration-based frame estimate in that case.
 */
export function countWebmFrames(blob: Blob): Promise<{ frameCount: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;

    const blobUrl = URL.createObjectURL(blob);
    video.src = blobUrl;

    let lastPresentedFrames = 0;
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Timeout counting WebM frames"));
      }
    }, 60000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(blobUrl);
    };

    video.addEventListener("ended", () => {
      if (settled) {
        return;
      }
      settled = true;
      const duration = video.duration;
      cleanup();
      if (Number.isFinite(duration) && duration > 0) {
        resolve({ frameCount: lastPresentedFrames, duration });
      } else {
        reject(new Error("Could not determine video duration"));
      }
    });

    video.onerror = () => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("Failed to load video for frame counting"));
      }
    };

    video.addEventListener("loadedmetadata", () => {
      (async () => {
        // Fix Infinity duration (WebM recordings from MediaRecorder start with Infinity)
        if (!Number.isFinite(video.duration)) {
          await new Promise<void>((res) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              res();
            };
            video.addEventListener("seeked", onSeeked);
            video.currentTime = Number.MAX_SAFE_INTEGER;
          });
          // Seek back to the beginning before counting frames
          await new Promise<void>((res) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              res();
            };
            video.addEventListener("seeked", onSeeked);
            video.currentTime = 0;
          });
        }

        video.playbackRate = 16;

        if ("requestVideoFrameCallback" in video) {
          const onFrame = (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
            lastPresentedFrames = metadata.presentedFrames;
            if (!video.ended) {
              video.requestVideoFrameCallback(onFrame);
            }
          };
          video.requestVideoFrameCallback(onFrame);
        }

        await video.play();
      })().catch(() => undefined);
    });
  });
}

/**
 * Fix WebM blob duration by seeking to the end to force browser to calculate it.
 * WebM files from MediaRecorder often have Infinity duration until seeked.
 */
export function fixWebmDuration(blob: Blob): Promise<{ blob: Blob; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    const blobUrl = URL.createObjectURL(blob);
    video.src = blobUrl;

    // Shared cleanup: cancel the timeout and revoke the blob URL.
    // Called exactly once from whichever path settles the promise first.
    const cleanup = (tid: ReturnType<typeof setTimeout>) => {
      clearTimeout(tid);
      URL.revokeObjectURL(blobUrl);
    };

    // Start the timeout *before* assigning event handlers so the ID is
    // available inside the handlers through the closure.
    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("Timeout while fixing video duration"));
    }, 10000);

    video.onloadedmetadata = () => {
      // If duration is already valid, return immediately
      if (Number.isFinite(video.duration) && video.duration > 0) {
        cleanup(timeoutId);
        resolve({ blob, duration: video.duration });
        return;
      }

      // Seek to a very large time to force duration calculation
      video.currentTime = Number.MAX_SAFE_INTEGER;
    };

    video.onseeked = () => {
      // Now duration should be available
      const duration = video.duration;
      video.currentTime = 0; // Reset to beginning
      cleanup(timeoutId);

      if (Number.isFinite(duration) && duration > 0) {
        resolve({ blob, duration });
      } else {
        reject(new Error("Could not determine video duration"));
      }
    };

    video.onerror = () => {
      cleanup(timeoutId);
      reject(new Error("Failed to load video for duration fix"));
    };
  });
}

export class WebcamRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private previewElement: HTMLVideoElement | null = null;
  private currentDeviceId: string | null = null;

  /**
   * Request camera permission and get available devices.
   * Returns true if permission was granted.
   */
  public async requestPermission(): Promise<boolean> {
    try {
      // Request a temporary stream to trigger permission prompt
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      // Stop the temporary stream
      for (const track of tempStream.getTracks()) {
        track.stop();
      }
      return true;
    } catch (_err) {
      return false;
    }
  }

  /**
   * Get a list of available video input devices (cameras).
   */
  public async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  }

  /**
   * Start the camera preview on the specified video element.
   * @param previewEl - The video element to display the preview
   * @param deviceId - Optional device ID to use a specific camera
   * @param frameRate - Optional frame rate constraints (e.g. { ideal: 60, max: 60 })
   */
  public async startPreview(
    previewEl: HTMLVideoElement,
    deviceId?: string,
    frameRate?: FrameRateConstraints,
  ): Promise<void> {
    // Stop any existing stream first
    this.stopPreview();

    const videoConstraints: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId } } : {};
    if (frameRate) {
      videoConstraints.frameRate = frameRate;
    }

    const constraints: MediaStreamConstraints = {
      video: Object.keys(videoConstraints).length > 0 ? videoConstraints : true,
      audio: false,
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.previewElement = previewEl;
    this.previewElement.srcObject = this.stream;
    this.currentDeviceId = deviceId || null;

    await this.previewElement.play();
  }

  /**
   * Stop the camera preview and release the stream.
   */
  public stopPreview(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.previewElement) {
      this.previewElement.srcObject = null;
    }
  }

  /**
   * Start recording from the current stream.
   * Must call startPreview first.
   */
  public startRecording(): void {
    if (!this.stream) {
      throw new Error("No active stream. Call startPreview first.");
    }

    this.recordedChunks = [];
    const mimeType = getSupportedMimeType();

    const options: MediaRecorderOptions = {};
    if (mimeType) {
      options.mimeType = mimeType;
    }

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms
  }

  /**
   * Stop recording and return the recorded video as a Blob.
   */
  public stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recording."));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "video/webm";
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.recordedChunks = [];
        resolve(blob);
      };

      this.mediaRecorder.onerror = (event) => {
        reject(event);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Check if currently recording.
   */
  public isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  /**
   * Check if preview is active.
   */
  public isPreviewActive(): boolean {
    return this.stream?.active ?? false;
  }

  /**
   * Get the actual/configured frame rate from the active video track.
   * Uses track.getSettings() which returns the negotiated hardware settings.
   * Returns null if no stream or no video track.
   */
  public getFrameRate(): number | null {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) {
      return null;
    }
    const settings = track.getSettings();
    const rate = settings.frameRate;
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
  }

  /**
   * Get the frame rate capabilities supported by the hardware.
   * Returns { min, max } or null if no stream or no video track.
   */
  public getFrameRateCapabilities(): FrameRateCapabilities | null {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) {
      return null;
    }
    const caps = track.getCapabilities();
    const fr = caps.frameRate;
    if (!fr || typeof fr.min !== "number" || typeof fr.max !== "number") {
      return null;
    }
    return { min: fr.min, max: fr.max };
  }

  /**
   * Get the current device ID being used.
   */
  public getCurrentDeviceId(): string | null {
    return this.currentDeviceId;
  }

  /**
   * Get the current MediaStream (active or recently stopped).
   * Returns null if no stream was ever created.
   */
  public getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Clean up all resources.
   */
  public cleanup(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }
    this.stopPreview();
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }
}

/**
 * Measure the empirical frame rate by counting frames rendered to a video element.
 * Uses requestAnimationFrame to count frames over the given duration.
 * Note: This measures what's actually rendered, which can be limited by display refresh rate (e.g. 60 Hz).
 *
 * @param video - The video element playing the stream
 * @param durationMs - Duration to measure in ms (default 1000)
 * @returns Promise resolving to the measured FPS
 */
export function measureEmpiricalFrameRate(video: HTMLVideoElement, durationMs: number = 1000): Promise<number> {
  return new Promise((resolve, reject) => {
    if (video.readyState < 2) {
      reject(new Error("Video must be playing and have enough data"));
      return;
    }

    let frameCount = 0;
    const startTime = performance.now();

    function countFrames(): void {
      frameCount++;
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        const fps = (frameCount / elapsed) * 1000;
        resolve(fps);
        return;
      }
      requestAnimationFrame(countFrames);
    }

    requestAnimationFrame(countFrames);
  });
}

export type FPSEstimate = {
  fps: number;
  confidence: "high" | "medium" | "low";
  method: string;
};

/**
 * Estimate the frame rate of a recorded video with confidence level.
 * Tries multiple methods and returns the best estimate with confidence.
 *
 * @param video - Video element with the recorded blob loaded
 * @param stream - Optional MediaStream used during recording
 * @returns Promise with FPS estimate, confidence, and method used
 */
export async function estimateVideoFrameRate(
  video: HTMLVideoElement,
  stream?: MediaStream | null,
): Promise<FPSEstimate> {
  // Method 1: Try to get FPS from the stream settings (most reliable for webcam)
  if (stream) {
    const streamFps = getFrameRateFromStream(stream);
    if (streamFps && streamFps > 0) {
      return {
        fps: Math.round(streamFps),
        confidence: "high",
        method: "stream settings",
      };
    }
  }

  // Method 2: Measure empirical frame rate from playback
  try {
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) {
        resolve();
      } else {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
      }
    });

    // Ensure video is playing
    if (video.paused) {
      await video.play();
    }

    // Measure for 1 second
    const empiricalFps = await measureEmpiricalFrameRate(video, 1000);

    // Determine confidence based on how close to common frame rates
    const commonRates = [15, 24, 25, 29.97, 30, 50, 60];
    const roundedFps = Math.round(empiricalFps);
    const closestCommon = commonRates.reduce((prev, curr) =>
      Math.abs(curr - empiricalFps) < Math.abs(prev - empiricalFps) ? curr : prev,
    );

    const deviation = Math.abs(empiricalFps - closestCommon);
    let confidence: "high" | "medium" | "low" = "medium";

    if (deviation < 1) {
      confidence = "high";
    } else if (deviation < 3) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    return {
      fps: roundedFps,
      confidence,
      method: "empirical measurement",
    };
  } catch (_error) {
    /* measurement failed — fall through to default */
  }

  // Method 3: Fallback to default assumption
  return {
    fps: 30,
    confidence: "low",
    method: "default assumption",
  };
}

// ── Animated WebP frame detection ────────────────────────────────────────────

const WEBP_DEFAULT_FPS = 30;

/**
 * Returns frame count, total duration (seconds), and average fps for an
 * animated WebP image using the ImageDecoder API (Chrome 94+).
 * Resolves to null if the API is unavailable or the file is not a valid
 * animated WebP.
 */
export async function getAnimatedWebPInfo(
  blob: Blob,
): Promise<{ frameCount: number; duration: number; fps: number } | null> {
  if (typeof ImageDecoder === "undefined") {
    return null;
  }
  try {
    const decoder = new ImageDecoder({
      data: blob.stream(),
      type: "image/webp",
      preferAnimation: true,
    });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    if (!track) {
      decoder.close();
      return null;
    }
    const frameCount = track.frameCount;
    if (frameCount <= 0) {
      decoder.close();
      return null;
    }
    // Sum per-frame durations (microseconds) to get total duration in seconds.
    let totalMicroseconds = 0;
    for (let i = 0; i < frameCount; i++) {
      const result = await decoder.decode({ frameIndex: i });
      totalMicroseconds += result.image.duration ?? 0;
      result.image.close();
    }
    decoder.close();
    const duration = totalMicroseconds / 1_000_000;
    const fps = duration > 0 ? frameCount / duration : WEBP_DEFAULT_FPS;
    return { frameCount, duration, fps };
  } catch {
    // Not a valid animated WebP or ImageDecoder threw — fall back gracefully.
    return null;
  }
}

trackLab.register("WebcamRecorder", WebcamRecorder);

// ── Video file metadata extraction ────────────────────────────────────────────

export type VideoFileMetadata = {
  duration: number;
  fps: number;
  /** Exact frame count when known; undefined when only duration is available. */
  frameCount?: number;
};

/**
 * Extract duration, fps, and frame count from an uploaded video or animated-WebP
 * file.  Handles three cases:
 *
 *  1. Animated WebP – uses ImageDecoder to count frames and sum per-frame durations.
 *  2. WebM video   – plays through at high speed via requestVideoFrameCallback to
 *     count exact frames and resolve the true duration (fixes MediaRecorder Infinity).
 *  3. All other video formats – probes duration via a temporary HTMLVideoElement.
 *
 * @param file       - The File (or Blob with a `name`) to probe.
 * @param defaultFps - Frame rate to use when it cannot be derived from the file.
 */
export async function extractVideoFileMetadata(file: File, defaultFps: number): Promise<VideoFileMetadata> {
  if (file.type === "image/webp") {
    const info = await getAnimatedWebPInfo(file);
    return {
      duration: info?.duration ?? 0,
      fps: info?.fps ?? defaultFps,
      frameCount: (info?.frameCount ?? 0) > 0 ? info?.frameCount : undefined,
    };
  }

  if (file.type === "video/webm" || file.name.toLowerCase().endsWith(".webm")) {
    try {
      const { frameCount, duration } = await countWebmFrames(file);
      return {
        duration,
        fps: frameCount > 0 && duration > 0 ? frameCount / duration : defaultFps,
        frameCount: frameCount > 0 ? frameCount : undefined,
      };
    } catch {
      // Frame counting failed (timeout or unsupported API) — load with unknown duration.
      return { duration: 0, fps: defaultFps };
    }
  }

  // Generic video: probe duration via a temporary video element.
  return new Promise<VideoFileMetadata>((resolve) => {
    const tempUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.src = tempUrl;
    const cleanup = () => URL.revokeObjectURL(tempUrl);
    tempVideo.addEventListener(
      "loadedmetadata",
      () => {
        const duration = Number.isFinite(tempVideo.duration) ? tempVideo.duration : 0;
        cleanup();
        resolve({ duration, fps: defaultFps });
      },
      { once: true },
    );
    tempVideo.addEventListener(
      "error",
      () => {
        cleanup();
        resolve({ duration: 0, fps: defaultFps });
      },
      { once: true },
    );
  });
}
