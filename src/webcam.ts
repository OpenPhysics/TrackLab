/**
 * WebcamRecorder class for camera access, preview, and recording.
 * Handles MediaStream, MediaRecorder, and device enumeration.
 */

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
  if (!track) return null;
  const settings = track.getSettings();
  const rate = settings.frameRate;
  return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
}

/**
 * Get frame rate capabilities from a MediaStream's video track.
 * Returns null if no video track or capabilities are not available.
 */
export function getFrameRateCapabilitiesFromStream(
  stream: MediaStream,
): FrameRateCapabilities | null {
  const track = stream.getVideoTracks()[0];
  if (!track) return null;
  const caps = track.getCapabilities();
  const fr = caps.frameRate;
  if (!fr || typeof fr.min !== "number" || typeof fr.max !== "number")
    return null;
  return { min: fr.min, max: fr.max };
}

/**
 * Get a supported MIME type for MediaRecorder.
 * Prioritizes WebM formats for best browser support, falls back to MP4.
 */
export function getSupportedMimeType(): string {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

/**
 * Fix WebM blob duration by seeking to the end to force browser to calculate it.
 * WebM files from MediaRecorder often have Infinity duration until seeked.
 */
export function fixWebmDuration(
  blob: Blob,
): Promise<{ blob: Blob; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    const blobUrl = URL.createObjectURL(blob);
    video.src = blobUrl;

    // Shared cleanup: cancel the timeout and revoke the blob URL.
    // Called exactly once from whichever path settles the promise first.
    const cleanup = (timeoutId: ReturnType<typeof setTimeout>) => {
      clearTimeout(timeoutId);
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
  async requestPermission(): Promise<boolean> {
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
    } catch (err) {
      console.error("Camera permission denied:", err);
      return false;
    }
  }

  /**
   * Get a list of available video input devices (cameras).
   */
  async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  }

  /**
   * Start the camera preview on the specified video element.
   * @param previewEl - The video element to display the preview
   * @param deviceId - Optional device ID to use a specific camera
   * @param frameRate - Optional frame rate constraints (e.g. { ideal: 60, max: 60 })
   */
  async startPreview(
    previewEl: HTMLVideoElement,
    deviceId?: string,
    frameRate?: FrameRateConstraints,
  ): Promise<void> {
    // Stop any existing stream first
    this.stopPreview();

    const videoConstraints: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : {};
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
  stopPreview(): void {
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
  startRecording(): void {
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
  stopRecording(): Promise<Blob> {
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
  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  /**
   * Check if preview is active.
   */
  isPreviewActive(): boolean {
    return this.stream?.active ?? false;
  }

  /**
   * Get the actual/configured frame rate from the active video track.
   * Uses track.getSettings() which returns the negotiated hardware settings.
   * Returns null if no stream or no video track.
   */
  getFrameRate(): number | null {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return null;
    const settings = track.getSettings();
    const rate = settings.frameRate;
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
  }

  /**
   * Get the frame rate capabilities supported by the hardware.
   * Returns { min, max } or null if no stream or no video track.
   */
  getFrameRateCapabilities(): FrameRateCapabilities | null {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return null;
    const caps = track.getCapabilities();
    const fr = caps.frameRate;
    if (!fr || typeof fr.min !== "number" || typeof fr.max !== "number")
      return null;
    return { min: fr.min, max: fr.max };
  }

  /**
   * Get the current device ID being used.
   */
  getCurrentDeviceId(): string | null {
    return this.currentDeviceId;
  }

  /**
   * Get the current MediaStream (active or recently stopped).
   * Returns null if no stream was ever created.
   */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Clean up all resources.
   */
  cleanup(): void {
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
export function measureEmpiricalFrameRate(
  video: HTMLVideoElement,
  durationMs: number = 1000,
): Promise<number> {
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
    const streamFPS = getFrameRateFromStream(stream);
    if (streamFPS && streamFPS > 0) {
      return {
        fps: Math.round(streamFPS),
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
    const empiricalFPS = await measureEmpiricalFrameRate(video, 1000);

    // Determine confidence based on how close to common frame rates
    const commonRates = [15, 24, 25, 29.97, 30, 50, 60];
    const roundedFPS = Math.round(empiricalFPS);
    const closestCommon = commonRates.reduce((prev, curr) =>
      Math.abs(curr - empiricalFPS) < Math.abs(prev - empiricalFPS)
        ? curr
        : prev,
    );

    const deviation = Math.abs(empiricalFPS - closestCommon);
    let confidence: "high" | "medium" | "low" = "medium";

    if (deviation < 1) {
      confidence = "high";
    } else if (deviation < 3) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    return {
      fps: roundedFPS,
      confidence,
      method: "empirical measurement",
    };
  } catch (error) {
    console.warn("Failed to measure empirical frame rate:", error);
  }

  // Method 3: Fallback to default assumption
  return {
    fps: 30,
    confidence: "low",
    method: "default assumption",
  };
}
