/**
 * SimModel.ts
 *
 * Holds all reactive state for the physics video analysis simulation including
 * video playback, coordinate system, calibration, tracks, and auto-tracking configuration.
 */

import { BooleanProperty, DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { Dimension2, Matrix3, Range, type Transform3, Vector2 } from "scenerystack/dot";
import { TRACK_COLORS } from "../../TrackLabColors.js";
import {
  CALIB_HALF_LENGTH,
  MAX_TRACKS,
  TRACK_SYMBOL_FIRST_CODE,
  TRACK_SYMBOL_LAST_CODE,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../../TrackLabConstants.js";
import { OpenCVTracker, type TrackerRegion } from "../../tracking/OpenCVTracker.js";
import { computeTrackKinematics } from "./KinematicsComputer.js";
import { buildModelViewTransform } from "./ModelViewTransformFactory.js";
import type { Track, TrackKinematics, TrackPoint } from "./Track.js";

// ── Calibration unit type ──────────────────────────────────────────────────
export const CALIBRATION_UNITS = ["mm", "cm", "m", "km", "in", "ft"] as const;
export type CalibrationUnit = (typeof CALIBRATION_UNITS)[number];
export const CALIBRATION_DISTANCE_RANGE = new Range(0.001, 100000);

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

// ── Video-local coordinate helpers ──────────────────────────────────────────
// All tool positions are in video-local coordinates: (0,0) = top-left of the
// video element, (VIDEO_WIDTH, VIDEO_HEIGHT) = bottom-right.  This ensures
// every overlay shares the same coordinate space as the video and can be
// uniformly transformed (scaled/translated) via videoTransformProperty.
const VIDEO_LOCAL_CENTER_X = VIDEO_WIDTH / 2;
const VIDEO_LOCAL_CENTER_Y = VIDEO_HEIGHT / 2;

// ── Initial tool positions (video-local coordinates) ───────────────────────
const COORD_ORIGIN_INITIAL = new Vector2(VIDEO_WIDTH / 4, VIDEO_LOCAL_CENTER_Y);
const CALIB_CENTER_INITIAL = new Vector2(VIDEO_LOCAL_CENTER_X, (VIDEO_HEIGHT * 3) / 4);
const CALIB_P1_INITIAL = CALIB_CENTER_INITIAL.plusXY(-CALIB_HALF_LENGTH, 0);
const CALIB_P2_INITIAL = CALIB_CENTER_INITIAL.plusXY(CALIB_HALF_LENGTH, 0);

// ── Initial measuring tape positions (video-local coordinates) ─────────────
const TAPE_P1_INITIAL = new Vector2(VIDEO_LOCAL_CENTER_X - 90, VIDEO_LOCAL_CENTER_Y + 100);
const TAPE_P2_INITIAL = new Vector2(VIDEO_LOCAL_CENTER_X + 90, VIDEO_LOCAL_CENTER_Y + 100);

// ── Initial angle tool positions (video-local coordinates) ─────────────────
const ANGLE_VERTEX_INITIAL = new Vector2(VIDEO_LOCAL_CENTER_X, VIDEO_LOCAL_CENTER_Y + 80);
const ANGLE_ARM1_INITIAL = new Vector2(VIDEO_LOCAL_CENTER_X + 90, VIDEO_LOCAL_CENTER_Y + 20);
const ANGLE_ARM2_INITIAL = new Vector2(VIDEO_LOCAL_CENTER_X + 90, VIDEO_LOCAL_CENTER_Y + 140);

// ── Bounds for clamping the coordinate-system origin ─────────────────────────
// The origin must stay within the video area so the axes are always visible.
// Bounds are in video-local coordinates.
const COORD_ORIGIN_BOUNDS_MIN_X = 0;
const COORD_ORIGIN_BOUNDS_MAX_X = VIDEO_WIDTH;
const COORD_ORIGIN_BOUNDS_MIN_Y = 0;
const COORD_ORIGIN_BOUNDS_MAX_Y = VIDEO_HEIGHT;

// ── Webcam recording entry ────────────────────────────────────────────────
export type WebcamRecording = {
  id: string;
  blob: Blob;
  label: string;
  duration: number;
  fps: number;
  timestamp: number;
};

// ── Uploaded video entry ─────────────────────────────────────────────────
export type UploadedVideo = {
  id: string;
  blob: Blob;
  label: string;
  duration: number;
  fps: number;
  /** Actual frame count from countWebmFrames / getAnimatedWebPInfo, or undefined if unknown. */
  frameCount?: number;
  timestamp: number;
};

export class SimModel {
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

  // ── Overlay visibility ────────────────────────────────────────────────
  public readonly axesVisibleProperty = new BooleanProperty(true);
  public readonly calibrationVisibleProperty = new BooleanProperty(true);

  // ── Future features (not yet implemented) ────────────────────────────
  public readonly magnifyVideoProperty = new BooleanProperty(false);
  public readonly autoTrackingProperty = new BooleanProperty(false);

  // ── Measurement tools visibility ──────────────────────────────────────
  public readonly measuringTapeVisibleProperty = new BooleanProperty(false);
  public readonly angleToolVisibleProperty = new BooleanProperty(false);

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

  // ── Measuring tape endpoint positions (view / pixel space) ────────────
  public readonly tapPoint1Property = new Property<Vector2>(TAPE_P1_INITIAL.copy());
  public readonly tapPoint2Property = new Property<Vector2>(TAPE_P2_INITIAL.copy());

  // ── Angle tool positions (view / pixel space) ─────────────────────────
  public readonly angleVertexProperty = new Property<Vector2>(ANGLE_VERTEX_INITIAL.copy());
  public readonly angleArm1Property = new Property<Vector2>(ANGLE_ARM1_INITIAL.copy());
  public readonly angleArm2Property = new Property<Vector2>(ANGLE_ARM2_INITIAL.copy());

  // ── Coordinate system tool state (view / pixel space) ─────────────────
  public readonly coordOriginProperty = new Property<Vector2>(COORD_ORIGIN_INITIAL.copy());
  public readonly coordAngleProperty = new NumberProperty(0);

  // ── Calibration tool state ────────────────────────────────────────────
  public readonly calibPoint1Property = new Property<Vector2>(CALIB_P1_INITIAL.copy());
  public readonly calibPoint2Property = new Property<Vector2>(CALIB_P2_INITIAL.copy());
  public readonly calibDistanceProperty = new NumberProperty(1, {
    range: CALIBRATION_DISTANCE_RANGE,
  });
  public readonly calibUnitProperty = new Property<CalibrationUnit>("m");

  // ── Derived unit strings (for display in graphs and tables) ────────────
  public readonly distanceUnitProperty: TReadOnlyProperty<string> = new DerivedProperty(
    [this.calibUnitProperty],
    (unit) => unit,
  );

  public readonly velocityUnitProperty: TReadOnlyProperty<string> = new DerivedProperty(
    [this.calibUnitProperty],
    (unit) => `${unit}/s`,
  );

  public readonly accelerationUnitProperty: TReadOnlyProperty<string> = new DerivedProperty(
    [this.calibUnitProperty],
    (unit) => `${unit}/s²`,
  );

  // ── Model-view transform (derived; the view never writes to this) ─────
  public readonly modelViewTransformProperty: TReadOnlyProperty<Transform3> = new DerivedProperty(
    [
      this.coordOriginProperty,
      this.coordAngleProperty,
      this.calibPoint1Property,
      this.calibPoint2Property,
      this.calibDistanceProperty,
    ],
    (origin, angle, p1, p2, dist) => buildModelViewTransform(origin, angle, p1, p2, dist),
  );

  // When coord system or calibration changes, recompute track points so they
  // stay at the same pixel positions on the video (invariant under MVT changes).
  private prevModelViewTransform: Transform3 | null = null;

  // ── Video loaded (true once a finite-duration video is loaded) ───────────
  public readonly videoLoadedProperty: TReadOnlyProperty<boolean> = new DerivedProperty(
    [this.durationProperty],
    (d) => d > 0,
  );

  // ── Manual particle tracks ────────────────────────────────────────────
  // INVARIANT: every TrackPoint's (x, y) is expressed in the coordinate
  // system defined by the *current* modelViewTransformProperty.  Whenever the
  // MVT changes (user drags the coord-system origin/angle or adjusts the
  // calibration ruler), retransformTrackPoints() re-expresses every stored
  // point in the new coordinate system so that each point remains visually
  // anchored to the same pixel on the video.
  //
  // ⚠️  Direct writes to tracksProperty must preserve this invariant.
  //     Never write raw pixel coordinates or coordinates from a different MVT
  //     into this property.  All externally-sourced positions (digitizing
  //     clicks, auto-tracker output) must first be converted with
  //     pixelToModelCoords() before storage.
  public readonly tracksProperty = new Property<readonly Track[]>([]);
  public readonly activeTrackIdProperty = new Property<string | null>(null);
  public readonly canAddTrackProperty: TReadOnlyProperty<boolean> = new DerivedProperty(
    [this.tracksProperty],
    (tracks) => tracks.length < MAX_TRACKS,
  );

  // ── Derived kinematics for all tracks ───────────────────────────────────
  // Cache keyed by track ID; only recomputes kinematics for tracks whose
  // point array reference has changed since the last derivation.  Because
  // addPointToTrack() always creates a new points array, reference equality
  // is sufficient to detect modifications.
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
  // after a track is removed.  Stable, unique symbols matter for data export
  // and user recognition: re-issuing "A" to a new track after the original "A"
  // is deleted would be confusing.  The practical limit is 26 tracks per session.
  private nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;

  public constructor() {
    this.modelViewTransformProperty.lazyLink((newMvt) => {
      if (this.prevModelViewTransform !== null) {
        this.retransformTrackPoints(this.prevModelViewTransform, newMvt);
      }
      this.prevModelViewTransform = newMvt;
    });
  }

  /**
   * Clamps a position to keep the coordinate system origin within video bounds.
   * Used by drag listeners to constrain the origin to the visible video area.
   */
  public clampCoordOrigin(pos: Vector2): Vector2 {
    const clampedX = Math.max(COORD_ORIGIN_BOUNDS_MIN_X, Math.min(COORD_ORIGIN_BOUNDS_MAX_X, pos.x));
    const clampedY = Math.max(COORD_ORIGIN_BOUNDS_MIN_Y, Math.min(COORD_ORIGIN_BOUNDS_MAX_Y, pos.y));
    return new Vector2(clampedX, clampedY);
  }

  /**
   * Re-expresses every stored track point in the coordinate system of `newMVT`,
   * preserving the pixel-space position of each point on the video.
   *
   * ## Why this exists — the pixel-anchor invariant
   *
   * Track points are stored in *model coordinates* (real-world units defined by
   * the current coordinate system and calibration).  When the user moves the
   * coord-system origin, rotates the axes, or changes the calibration distance,
   * `modelViewTransformProperty` emits a new Transform3.  Without correction,
   * every stored point would appear to jump to a wrong location on the video,
   * because the same (x, y) model coordinates now map to a different pixel.
   *
   * This method fixes that: for each point it computes the pixel it occupied
   * under `prevMVT`, then inverts the new transform to find the model
   * coordinates that land on the same pixel under `newMVT`.
   *
   * ## Algorithm (per point)
   *
   *   pixelPos    = prevMVT.transformPosition2( modelPt )   // model → pixel
   *   newModelPt  = newMVT.inversePosition2( pixelPos )     // pixel → new model
   *
   * ## Warning — do not bypass this
   *
   * Any code that writes to `tracksProperty` must store positions in the
   * coordinate system of the *current* MVT.  Positions coming from outside
   * (digitizing clicks, auto-tracker pixel output) must be converted with
   * `pixelToModelCoords()` before storage.  Writing raw pixel coordinates or
   * stale model coordinates directly into `tracksProperty` will silently
   * corrupt the track data.
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
   * unique color. Does nothing if the track limit or symbol limit is reached.
   */
  public addTrack(): void {
    if (this.tracksProperty.value.length >= MAX_TRACKS || this.nextSymbolCode > TRACK_SYMBOL_LAST_CODE) {
      return;
    }
    const symbol = String.fromCharCode(this.nextSymbolCode);
    const colorIndex = (this.nextSymbolCode - TRACK_SYMBOL_FIRST_CODE) % TRACK_COLORS.length;
    const trackColor = TRACK_COLORS[colorIndex];
    const color = trackColor ? trackColor.toCSS() : "#000000";
    this.nextSymbolCode++;

    const track: Track = {
      id: `track-${symbol}`,
      symbol,
      color,
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
   * All externally-sourced positions (digitizing clicks, auto-tracker output)
   * **must** go through this method before being stored in `tracksProperty`.
   * Calling `modelViewTransformProperty.value.inversePosition2()` directly
   * bypasses this contract and risks storing coordinates in the wrong space
   * if the MVT is ever replaced by a subclass or indirection.
   *
   * @param pixelPoint - A point in scene/pixel coordinate space.
   * @returns The equivalent position in model (real-world) coordinates.
   */
  public pixelToModelCoords(pixelPoint: Vector2): Vector2 {
    return this.modelViewTransformProperty.value.inversePosition2(pixelPoint);
  }

  /**
   * Record a digitized position for `frame` on the track identified by `id`.
   * If a point at the same frame already exists it is replaced (update
   * semantics), preventing duplicate-frame corruption in the kinematics
   * calculation. Coordinates are in model space (real-world units).
   *
   * @param id - ID of the target track.
   * @param frame - Integer frame index (derived from `time * frameRate`).
   * @param time - Video timestamp in seconds.
   * @param x - Horizontal position in model coordinates.
   * @param y - Vertical position in model coordinates.
   */
  public addPointToTrack(id: string, frame: number, time: number, x: number, y: number): void {
    const tracks = this.tracksProperty.value.map((track) => {
      if (track.id !== id) {
        return track;
      }

      // If the user re-digitizes a point at the same frame (e.g. to correct a
      // misclick), replace the existing coordinates rather than silently
      // discarding the new position.  Adding a second point at the same frame
      // would corrupt kinematics, so replacement is the only safe update path.
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
  // intermediate state is visible to subscribers (e.g. isWebcamVideo true but
  // frameRateProperty still stale from the previous video).

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
    const totalSec = Math.round(duration);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const durationStr = `${m}:${s.toString().padStart(2, "0")}`;
    const recording: WebcamRecording = {
      id: `recording-${num}`,
      blob,
      label: `Recording ${num}  (${durationStr})`,
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
    // Strip extension and truncate long names for the dropdown label
    const baseName = name.replace(/\.[^.]+$/, "");
    const displayName = baseName.length > 25 ? `${baseName.substring(0, 22)}...` : baseName;
    const totalSec = Math.round(duration);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const durationStr = `${m}:${s.toString().padStart(2, "0")}`;
    const upload: UploadedVideo = {
      id: `upload-${num}`,
      blob,
      label: `${displayName}  (${durationStr})`,
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
    this.axesVisibleProperty.reset();
    this.calibrationVisibleProperty.reset();
    this.magnifyVideoProperty.reset();
    this.autoTrackingProperty.reset();
    this.measuringTapeVisibleProperty.reset();
    this.angleToolVisibleProperty.reset();
    this.videoScaleProperty.reset();
    this.videoOffsetProperty.reset();
    this.tapPoint1Property.reset();
    this.tapPoint2Property.reset();
    this.angleVertexProperty.reset();
    this.angleArm1Property.reset();
    this.angleArm2Property.reset();
    this.coordOriginProperty.reset();
    this.coordAngleProperty.reset();
    this.calibPoint1Property.reset();
    this.calibPoint2Property.reset();
    this.calibDistanceProperty.reset();
    this.calibUnitProperty.reset();
    this.tracksProperty.value = [];
    this.activeTrackIdProperty.value = null;
    this.nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;
    this.tracker.dispose();
  }

  public step(_dt: number): void {
    // video playback is driven by the HTML video element; no model stepping needed
  }
}
