/**
 * SimModel.ts
 *
 * Holds all reactive state for the physics video analysis simulation including
 * video playback, tracks, and auto-tracking configuration. Overlay tool state
 * (coordinate system, calibration, measuring tape, angle tool) is delegated
 * to OverlayToolsModel.
 */

import { BooleanProperty, DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { Dimension2, Matrix3, Range, type Transform3, Vector2 } from "scenerystack/dot";
import { TRACK_COLORS } from "../../TrackLabColors.js";
import {
  MAX_TRACKS,
  TRACK_SYMBOL_FIRST_CODE,
  TRACK_SYMBOL_LAST_CODE,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../../TrackLabConstants.js";
import { OpenCVTracker, type TrackerRegion } from "../../tracking/OpenCVTracker.js";
import { computeTrackKinematics } from "./KinematicsComputer.js";
import {
  CALIBRATION_DISTANCE_RANGE,
  CALIBRATION_UNITS,
  type CalibrationUnit,
  OverlayToolsModel,
} from "./OverlayToolsModel.js";
import type { Track, TrackKinematics, TrackPoint } from "./Track.js";

// Re-export calibration constants so existing importers need not change.
export { CALIBRATION_DISTANCE_RANGE, CALIBRATION_UNITS, type CalibrationUnit } from "./OverlayToolsModel.js";

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

// ── Webcam recording entry ────────────────────────────────────────────────
export type WebcamRecording = {
  id: string;
  blob: Blob;
  num: number;
  duration: number;
  fps: number;
  timestamp: number;
};

// ── Uploaded video entry ─────────────────────────────────────────────────
export type UploadedVideo = {
  id: string;
  blob: Blob;
  num: number;
  name: string;
  duration: number;
  fps: number;
  /** Actual frame count from countWebmFrames / getAnimatedWebPInfo, or undefined if unknown. */
  frameCount?: number;
  timestamp: number;
};

export class SimModel {
  // ── Overlay tools (coordinate system, calibration, measuring tape, angle) ──
  public readonly overlayTools = new OverlayToolsModel();

  public readonly isPlayingProperty = new BooleanProperty(false);
  public readonly currentTimeProperty = new NumberProperty(0, {
    range: new Range(0, Number.MAX_VALUE),
  });
  public readonly durationProperty = new Property<number>(0);

  // ── Frame rate (user-settable, default 30 fps) ─────────────────────────
  public readonly frameRateProperty = new NumberProperty(DEFAULT_FRAME_RATE, {
    range: FRAME_RATE_RANGE,
  });

  // Track whether the current video is from webcam (allows FPS editing)
  public readonly isWebcamVideoProperty = new BooleanProperty(false);

  // ── Webcam recordings storage ──────────────────────────────────────────
  public readonly webcamRecordingsProperty = new Property<readonly WebcamRecording[]>([]);
  public readonly currentWebcamBlobProperty = new Property<Blob | null>(null);
  private nextRecordingNumber = 1;

  // ── Uploaded videos storage ────────────────────────────────────────────
  public readonly uploadedVideosProperty = new Property<readonly UploadedVideo[]>([]);
  private nextUploadNumber = 1;

  // ── Playback speed multiplier (1 = normal, 0.5 = slow, 2 = fast) ────────
  // The view maps its TimeSpeed enum to this value; the model stays free of
  // any scenery-phet dependency.
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

  // ── Actual display dimensions of the loaded video ─────────────────────
  // Updated in VideoPlayerNode once loadedmetadata fires.  Starts at the
  // max dimensions; overlays and the OpenCV canvas react to changes.
  public readonly videoDimensionsProperty = new Property<Dimension2>(new Dimension2(VIDEO_WIDTH, VIDEO_HEIGHT));

  // ── OpenCV Tracker (computational service) ────────────────────────────
  private readonly tracker = new OpenCVTracker(VIDEO_WIDTH, VIDEO_HEIGHT);

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

  // ── Manual particle tracks ────────────────────────────────────────────
  // INVARIANT: every TrackPoint's (x, y) is expressed in the coordinate
  // system defined by the *current* overlayTools.modelViewTransformProperty.
  // Whenever the MVT changes, retransformTrackPoints() re-expresses every stored
  // point in the new coordinate system so that each point remains visually
  // anchored to the same pixel on the video.
  public readonly tracksProperty = new Property<readonly Track[]>([]);
  public readonly activeTrackIdProperty = new Property<string | null>(null);
  public readonly canAddTrackProperty: TReadOnlyProperty<boolean> = new DerivedProperty(
    [this.tracksProperty],
    (tracks) => tracks.length < MAX_TRACKS,
  );

  // ── Derived kinematics for all tracks ───────────────────────────────────
  // Cache keyed by track ID; only recomputes kinematics for tracks whose
  // point array reference has changed since the last derivation.
  private readonly kinematicsCache = new Map<string, { points: Track["points"]; kinematics: TrackKinematics }>();

  public readonly trackKinematicsProperty: TReadOnlyProperty<readonly TrackKinematics[]> = new DerivedProperty(
    [this.tracksProperty],
    (tracks) =>
      tracks.map((track) => {
        const cached = this.kinematicsCache.get(track.id);
        if (cached && cached.points === track.points) {
          return cached.kinematics;
        }
        const kinematics = computeTrackKinematics(track);
        this.kinematicsCache.set(track.id, { points: track.points, kinematics });
        return kinematics;
      }),
  );
  // Symbols are assigned sequentially (A → Z) and intentionally not reused
  // after a track is removed.
  private nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;

  // Cache the previous MVT to compute retransforms when it changes.
  private prevModelViewTransform: Transform3 | null = null;

  public constructor() {
    this.overlayTools.modelViewTransformProperty.lazyLink((newMvt) => {
      if (this.prevModelViewTransform !== null) {
        this.retransformTrackPoints(this.prevModelViewTransform, newMvt);
      }
      this.prevModelViewTransform = newMvt;
    });
  }

  /**
   * Re-expresses every stored track point in the coordinate system of `newMVT`,
   * preserving the pixel-space position of each point on the video.
   */
  private retransformTrackPoints(prevMvt: Transform3, newMvt: Transform3): void {
    const tracks = this.tracksProperty.value;
    if (tracks.length === 0) {
      return;
    }

    this.tracksProperty.value = tracks.map((track) => ({
      ...track,
      points: track.points.map((pt) => {
        const pixelPos = prevMvt.transformPosition2(new Vector2(pt.x, pt.y));
        const newModelPt = newMvt.inversePosition2(pixelPos);
        return { ...pt, x: newModelPt.x, y: newModelPt.y };
      }),
    }));
  }

  /**
   * Create a new track labelled with the next available letter (A–Z) and a
   * unique color index. Does nothing if the track limit or symbol limit is reached.
   */
  public addTrack(): void {
    if (this.tracksProperty.value.length >= MAX_TRACKS || this.nextSymbolCode > TRACK_SYMBOL_LAST_CODE) {
      return;
    }
    const symbol = String.fromCharCode(this.nextSymbolCode);
    const colorIndex = (this.nextSymbolCode - TRACK_SYMBOL_FIRST_CODE) % TRACK_COLORS.length;
    this.nextSymbolCode++;

    const track: Track = {
      id: `track-${symbol}`,
      symbol,
      colorIndex,
      points: [],
    };

    const tracks = [...this.tracksProperty.value, track];
    tracks.sort((a, b) => a.symbol.charCodeAt(0) - b.symbol.charCodeAt(0));
    this.tracksProperty.value = tracks;
  }

  /**
   * Remove the track with the given `id`. If that track is currently active,
   * `activeTrackIdProperty` is cleared to null first.
   */
  public removeTrack(id: string): void {
    if (this.activeTrackIdProperty.value === id) {
      this.activeTrackIdProperty.value = null;
    }
    this.tracksProperty.value = this.tracksProperty.value.filter((t) => t.id !== id);
  }

  /**
   * Convert a point from pixel/scene space to model coordinates using the
   * current model-view transform.
   *
   * @param pixelPoint - A point in scene/pixel coordinate space.
   * @returns The equivalent position in model (real-world) coordinates.
   */
  public pixelToModelCoords(pixelPoint: Vector2): Vector2 {
    return this.overlayTools.modelViewTransformProperty.value.inversePosition2(pixelPoint);
  }

  /**
   * Record a digitized position for `frame` on the track identified by `id`.
   */
  public addPointToTrack(id: string, frame: number, time: number, x: number, y: number): void {
    const tracks = this.tracksProperty.value.map((track) => {
      if (track.id !== id) {
        return track;
      }

      const existingIndex = track.points.findIndex((p) => p.frame === frame);
      if (existingIndex !== -1) {
        const updatedPoints = [...track.points];
        updatedPoints[existingIndex] = { frame, time, x, y };
        return { ...track, points: updatedPoints };
      }

      const point: TrackPoint = { frame, time, x, y };
      const updated: Track = { ...track, points: [...track.points, point] };
      return updated;
    });
    this.tracksProperty.value = tracks;
  }

  // ── Tracker facade ──────────────────────────────────────────────────────
  // Views interact with the tracker exclusively through these methods so that
  // the tracker implementation stays encapsulated inside the model layer.

  /** True once a template has been captured and frame-to-frame tracking can begin. */
  public get isTrackerReady(): boolean {
    return this.tracker.ready;
  }

  /** Reset tracking state. Cancels any in-flight operation and clears the template. */
  public resetTracker(): void {
    this.tracker.dispose();
  }

  /**
   * Resize the tracker's offscreen canvas to match the video element's display dimensions.
   * Must be called whenever the displayed video size changes.
   */
  public resizeTracker(width: number, height: number): void {
    this.tracker.resize(width, height);
  }

  /**
   * Capture the tracking template from the current video frame within `region`.
   * Resolves when the worker has processed the template and is ready to track.
   */
  public async initTracker(video: HTMLVideoElement, region: TrackerRegion): Promise<void> {
    await this.tracker.initFromVideo(video, region);
  }

  /**
   * Match the stored template against the current video frame.
   * Returns the center of the best match in video-pixel coordinates, or null.
   */
  public async trackFrame(video: HTMLVideoElement): Promise<{ x: number; y: number } | null> {
    return this.tracker.track(video);
  }

  // ── Track helpers ───────────────────────────────────────────────────────

  /**
   * Create a new track and immediately make it the active track.
   * Does nothing if the track limit or symbol limit has been reached.
   */
  public addTrackAndActivate(): void {
    this.addTrack();
    const newest = this.tracksProperty.value.at(-1);
    if (newest) {
      this.activeTrackIdProperty.value = newest.id;
    }
  }

  // ── Video source activation ─────────────────────────────────────────────
  // Each method sets all affected model properties in one call so that no
  // intermediate state is visible to subscribers.

  /**
   * Activate a webcam recording as the current video source.
   * Sets all related properties atomically.
   */
  public activateRecording(recording: WebcamRecording): void {
    this.isWebcamVideoProperty.value = true;
    this.frameRateProperty.value = recording.fps;
    this.totalFrameCountProperty.value = 0;
    this.currentWebcamBlobProperty.value = recording.blob;
  }

  /**
   * Activate an uploaded video as the current video source.
   * Sets all related properties atomically.
   */
  public activateUpload(upload: UploadedVideo): void {
    this.isWebcamVideoProperty.value = true;
    this.frameRateProperty.value = upload.fps;
    this.totalFrameCountProperty.value = upload.frameCount ?? 0;
    this.currentWebcamBlobProperty.value = upload.blob;
  }

  /**
   * Activate a bundled (sample) video as the current video source.
   * Sets all related properties atomically.
   */
  public activateBundledVideo(frameCount: number, fps: number): void {
    this.isWebcamVideoProperty.value = false;
    this.currentWebcamBlobProperty.value = null;
    this.totalFrameCountProperty.value = frameCount;
    this.frameRateProperty.value = fps;
  }

  public addWebcamRecording(blob: Blob, duration: number, fps: number): WebcamRecording {
    const num = this.nextRecordingNumber;
    this.nextRecordingNumber++;
    const recording: WebcamRecording = {
      id: `recording-${num}`,
      blob,
      num,
      duration,
      fps,
      timestamp: Date.now(),
    };
    this.webcamRecordingsProperty.value = [...this.webcamRecordingsProperty.value, recording];
    return recording;
  }

  public addUploadedVideo(
    blob: Blob,
    name: string,
    duration: number,
    fps = DEFAULT_FRAME_RATE,
    frameCount?: number,
  ): UploadedVideo {
    const num = this.nextUploadNumber;
    this.nextUploadNumber++;
    const upload: UploadedVideo = {
      id: `upload-${num}`,
      blob,
      num,
      name,
      duration,
      fps,
      ...(frameCount !== undefined ? { frameCount } : {}),
      timestamp: Date.now(),
    };
    this.uploadedVideosProperty.value = [...this.uploadedVideosProperty.value, upload];
    return upload;
  }

  public reset(): void {
    this.prevModelViewTransform = null;
    this.kinematicsCache.clear();
    this.isPlayingProperty.reset();
    this.currentTimeProperty.reset();
    this.durationProperty.reset();
    this.frameRateProperty.reset();
    this.totalFrameCountProperty.reset();
    this.isWebcamVideoProperty.reset();
    this.webcamRecordingsProperty.value = [];
    this.currentWebcamBlobProperty.value = null;
    this.nextRecordingNumber = 1;
    this.uploadedVideosProperty.value = [];
    this.nextUploadNumber = 1;
    this.playbackRateProperty.reset();
    this.videoScaleProperty.reset();
    this.videoOffsetProperty.reset();
    this.tracksProperty.value = [];
    this.activeTrackIdProperty.value = null;
    this.nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;
    this.tracker.dispose();
    this.overlayTools.reset();
  }

  public step(_dt: number): void {
    // video playback is driven by the HTML video element; no model stepping needed
  }
}
