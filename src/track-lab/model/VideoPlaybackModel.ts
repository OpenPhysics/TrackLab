/**
 * VideoPlaybackModel.ts
 *
 * Reactive state for video playback: current time, duration, frame rate,
 * playback speed, display dimensions, and the video-layer transform
 * (translate + uniform scale). Extracted from TrackLabModel to keep playback
 * concerns separate from track management and video source management.
 */

import { BooleanProperty, DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { Dimension2, Matrix3, Range, Vector2 } from "scenerystack/dot";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../../TrackLabConstants.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";

// ── Frame rate options ─────────────────────────────────────────────────────
export const FRAME_RATE_OPTIONS = [15, 24, 25, 29.97, 30, 50, 60] as const;
export const DEFAULT_FRAME_RATE = 30;
export const FRAME_RATE_RANGE = new Range(1, 120);

// ── Playback speed multiplier ──────────────────────────────────────────────
// Stores the actual rate multiplier (1 = normal, 0.5 = slow, 2 = fast).
// The view maps a TimeSpeed enum to one of these values; the model never
// imports scenery-phet, so it only sees the numeric rate.
export const DEFAULT_PLAYBACK_RATE = 1;
export const PLAYBACK_RATE_RANGE = new Range(0.1, 4);

/**
 * Owns all reactive state related to video playback: timing, frame rate,
 * playback speed, display dimensions, and the video-layer transform.
 */
export class VideoPlaybackModel {
  public readonly isPlayingProperty = new BooleanProperty(false);
  public readonly currentTimeProperty = new NumberProperty(0, {
    range: new Range(0, Number.MAX_VALUE),
  });
  public readonly durationProperty = new Property<number>(0);

  // ── Frame rate (user-settable, default 30 fps) ─────────────────────────
  public readonly frameRateProperty = new NumberProperty(DEFAULT_FRAME_RATE, {
    range: FRAME_RATE_RANGE,
  });

  // ── Playback speed multiplier (1 = normal, 0.5 = slow, 2 = fast) ────────
  public readonly playbackRateProperty = new NumberProperty(DEFAULT_PLAYBACK_RATE, {
    range: PLAYBACK_RATE_RANGE,
  });

  // ── Exact frame count when known (0 = unknown; derive from duration × fps) ──
  public readonly totalFrameCountProperty = new NumberProperty(0, {
    range: new Range(0, Number.MAX_VALUE),
  });

  // Derived frame duration for convenience
  public readonly frameDurationProperty: TReadOnlyProperty<number> = new DerivedProperty(
    [this.frameRateProperty],
    (fps) => 1 / fps,
  );

  // Derived current frame index: Math.round(currentTime * frameRate)
  // Multiply by frame rate directly rather than dividing by frameDuration
  // (1/fps) to avoid cascading floating-point error at non-integer fps values
  // like 29.97, which could cause adjacent timestamps to map to the same frame.
  public readonly currentFrameProperty: TReadOnlyProperty<number> = new DerivedProperty(
    [this.currentTimeProperty, this.frameRateProperty],
    (time, fps) => Math.round(time * fps),
  );

  // ── Actual display dimensions of the loaded video ─────────────────────
  // Updated in VideoPlayerNode once loadedmetadata fires.  Starts at the
  // max dimensions; overlays and the OpenCV canvas react to changes.
  public readonly videoDimensionsProperty = new Property<Dimension2>(new Dimension2(VIDEO_WIDTH, VIDEO_HEIGHT));

  // ── Video display transform (translate + uniform scale) ───────────────
  // Applied to the video content layer so the video and all overlays
  // (tools, digitized points) can be dragged and magnified together while
  // keeping the same aspect ratio.
  public readonly videoScaleProperty = new NumberProperty(1, {
    range: new Range(0.5, 4),
  });
  public readonly videoOffsetProperty = new Property<Vector2>(Vector2.ZERO);
  public readonly videoTransformProperty: TReadOnlyProperty<Matrix3> = new DerivedProperty(
    [this.videoScaleProperty, this.videoOffsetProperty],
    (scale, offset) => Matrix3.translationFromVector(offset).timesMatrix(Matrix3.scaling(scale)),
  );

  // ── Video loaded (true once a finite-duration video is loaded) ───────────
  public readonly videoLoadedProperty: TReadOnlyProperty<boolean> = new DerivedProperty(
    [this.durationProperty],
    (d) => d > 0,
  );

  // ── Video panel position in TrackLabScreenView coordinates (top-left of VideoPlayerNode) ──
  // Default is Vector2.ZERO; TrackLabScreenView sets the initial position on first layout.
  public readonly panelPositionProperty = new Property<Vector2>(Vector2.ZERO);

  // ── Uniform scale applied to the video content wrapper (not source controls) ──
  // Range 0.25–1.5; 1.0 = default (native video display size).
  public readonly panelSizeScaleProperty = new NumberProperty(1, {
    range: new Range(0.5, 1.5),
  });

  /**
   * Convert a continuous time value to a discrete frame index.
   * Multiply by frame rate directly rather than dividing by frameDuration
   * (1/fps) to avoid cascading floating-point error at non-integer fps values
   * like 29.97.
   */
  public timeToFrame(time: number): number {
    return Math.round(time * this.frameRateProperty.value);
  }

  /**
   * Pause playback and seek to the very beginning of the video.
   * The view is responsible for syncing videoElement.currentTime = 0 afterward.
   */
  public seekToStart(): void {
    this.isPlayingProperty.value = false;
    this.currentTimeProperty.value = 0;
  }

  /**
   * Pause playback and advance or retreat by exactly one frame in the given
   * direction (+1 = forward, -1 = backward). Updates currentTimeProperty;
   * the view is responsible for syncing videoElement.currentTime afterward.
   */
  public seekByFrames(direction: number): void {
    this.isPlayingProperty.value = false;
    const duration = this.durationProperty.value;
    if (!(duration > 0)) {
      return;
    }
    const raw = this.currentTimeProperty.value + direction * this.frameDurationProperty.value;
    const clamped = Math.max(0, Math.min(raw, duration));
    if (!Number.isFinite(clamped)) {
      return;
    }
    this.currentTimeProperty.value = clamped;
  }

  public reset(): void {
    this.isPlayingProperty.reset();
    this.currentTimeProperty.reset();
    this.durationProperty.reset();
    this.frameRateProperty.reset();
    this.playbackRateProperty.reset();
    this.totalFrameCountProperty.reset();
    this.videoDimensionsProperty.reset();
    this.videoScaleProperty.reset();
    this.videoOffsetProperty.reset();
    // panelPositionProperty is intentionally NOT reset here — TrackLabScreenView
    // restores the initial layout position via the ResetAllButton listener.
    this.panelSizeScaleProperty.reset();
  }
}

TrackLabNamespace.register("VideoPlaybackModel", VideoPlaybackModel);
