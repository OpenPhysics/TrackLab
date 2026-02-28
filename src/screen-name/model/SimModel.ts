/**
 * SimModel.ts
 *
 * Thin coordinator that composes four focused sub-models:
 *
 *   model.playback      – VideoPlaybackModel:  timing, frame rate, display transform
 *   model.sources       – VideoSourceModel:    webcam recordings, uploads, active blob
 *   model.tracking      – TrackingModel:       particle tracks, kinematics, OpenCV facade
 *   model.overlayTools  – OverlayToolsModel:   axes, calibration, measurement tools
 *
 * SimModel itself handles cross-cutting orchestration only:
 *   - activating a video source (coordinates sources + playback properties)
 *   - converting pixel → model coordinates (uses overlayTools MVT)
 *   - re-expressing track points when the model-view transform changes
 */

import type { Vector2 } from "scenerystack/dot";
import trackLab from "../../TrackLabNamespace.js";
import { OverlayToolsModel } from "./OverlayToolsModel.js";
import { TrackingModel } from "./TrackingModel.js";
import { VideoPlaybackModel } from "./VideoPlaybackModel.js";
import { type UploadedVideo, VideoSourceModel, type WebcamRecording } from "./VideoSourceModel.js";

// ── Re-export constants so existing imports from SimModel continue to work ─
// biome-ignore lint/performance/noBarrelFile: intentional re-export for API compatibility
export {
  DEFAULT_FRAME_RATE,
  DEFAULT_PLAYBACK_RATE,
  FRAME_RATE_OPTIONS,
  FRAME_RATE_RANGE,
  PLAYBACK_RATE_RANGE,
} from "./VideoPlaybackModel.js";
export type { UploadedVideo, WebcamRecording } from "./VideoSourceModel.js";

export class SimModel {
  // ── Composed sub-models ───────────────────────────────────────────────
  public readonly overlayTools = new OverlayToolsModel();
  public readonly playback = new VideoPlaybackModel();
  public readonly sources = new VideoSourceModel();
  public readonly tracking = new TrackingModel();

  public constructor() {
    // Whenever the model-view transform changes, re-express all stored track
    // points in the new coordinate system so they remain visually anchored to
    // the same pixel on the video.
    this.overlayTools.modelViewTransformProperty.lazyLink((newMvt, oldMvt) => {
      this.tracking.retransformTrackPoints(oldMvt, newMvt);
    });
  }

  /**
   * Convert a point from pixel/scene space to model coordinates using the
   * current model-view transform.
   */
  public pixelToModelCoords(pixelPoint: Vector2): Vector2 {
    return this.overlayTools.modelViewTransformProperty.value.inversePosition2(pixelPoint);
  }

  /**
   * Record a digitized point on the given track at the current playback position.
   *
   * The view passes raw inputs (track id + pixel position); this method
   * coordinates all sub-model interactions so the view does not need to reach
   * into playback or overlayTools directly.
   */
  public recordTrackPoint(trackId: string, pixelPoint: Vector2): void {
    const time = this.playback.currentTimeProperty.value;
    const frame = Math.round(time * this.playback.frameRateProperty.value);
    const modelPt = this.overlayTools.modelViewTransformProperty.value.inversePosition2(pixelPoint);
    this.tracking.addPointToTrack(trackId, frame, time, modelPt.x, modelPt.y);
  }

  // ── Video source activation ─────────────────────────────────────────────
  // Each method sets all affected sub-model properties atomically so that no
  // intermediate state is visible to subscribers.

  /** Activate a webcam recording as the current video source. */
  public activateRecording(recording: WebcamRecording): void {
    this.sources.isUserVideoProperty.value = true;
    this.playback.frameRateProperty.value = recording.fps;
    this.playback.totalFrameCountProperty.value = 0;
    this.sources.currentWebcamBlobProperty.value = recording.blob;
  }

  /** Activate an uploaded video as the current video source. */
  public activateUpload(upload: UploadedVideo): void {
    this.sources.isUserVideoProperty.value = true;
    this.playback.frameRateProperty.value = upload.fps;
    this.playback.totalFrameCountProperty.value = upload.frameCount ?? 0;
    this.sources.currentWebcamBlobProperty.value = upload.blob;
  }

  /** Activate a bundled (sample) video as the current video source. */
  public activateBundledVideo(frameCount: number, fps: number): void {
    this.sources.isUserVideoProperty.value = false;
    this.sources.currentWebcamBlobProperty.value = null;
    this.playback.totalFrameCountProperty.value = frameCount;
    this.playback.frameRateProperty.value = fps;
  }

  public reset(): void {
    this.playback.reset();
    this.sources.reset();
    this.tracking.reset();
    this.overlayTools.reset();
  }

  public step(_dt: number): void {
    // Video playback is driven by the HTML video element; no model stepping needed.
  }
}

trackLab.register("SimModel", SimModel);
