import {
  BooleanProperty,
  DerivedProperty,
  NumberProperty,
  Property,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import { Range, type Transform3, Vector2 } from "scenerystack/dot";
import { TRACK_COLORS } from "../../TrackLabColors.js";
import {
  CALIB_HALF_LENGTH,
  TRACK_SYMBOL_FIRST_CODE,
  TRACK_SYMBOL_LAST_CODE,
  VIDEO_CENTER_X,
  VIDEO_CENTER_Y,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../../TrackLabConstants.js";
import { OpenCVTracker } from "../../tracking/OpenCVTracker.js";
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

// ── Initial tool positions (view / pixel space) ───────────────────────────
// These default positions are computed from the shared video layout constants.
const COORD_ORIGIN_INITIAL = new Vector2(
  VIDEO_CENTER_X - VIDEO_WIDTH / 4,
  VIDEO_CENTER_Y,
);
const CALIB_CENTER_INITIAL = new Vector2(
  VIDEO_CENTER_X,
  VIDEO_CENTER_Y + VIDEO_HEIGHT / 4,
);
const CALIB_P1_INITIAL = CALIB_CENTER_INITIAL.plusXY(-CALIB_HALF_LENGTH, 0);
const CALIB_P2_INITIAL = CALIB_CENTER_INITIAL.plusXY(CALIB_HALF_LENGTH, 0);

// ── Bounds for clamping the coordinate-system origin ─────────────────────────
// The origin must stay within the video area so the axes are always visible.
// These are layout / pixel-space bounds, matching the view-layer video rectangle.
const COORD_ORIGIN_BOUNDS_MIN_X = VIDEO_CENTER_X - VIDEO_WIDTH / 2;
const COORD_ORIGIN_BOUNDS_MAX_X = VIDEO_CENTER_X + VIDEO_WIDTH / 2;
const COORD_ORIGIN_BOUNDS_MIN_Y = VIDEO_CENTER_Y - VIDEO_HEIGHT / 2;
const COORD_ORIGIN_BOUNDS_MAX_Y = VIDEO_CENTER_Y + VIDEO_HEIGHT / 2;

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

  // ── Playback speed multiplier (1 = normal, 0.5 = slow, 2 = fast) ────────
  // The view maps its TimeSpeed enum to this value; the model stays free of
  // any scenery-phet dependency.
  public readonly playbackRateProperty = new NumberProperty(
    DEFAULT_PLAYBACK_RATE,
    {
      range: PLAYBACK_RATE_RANGE,
    },
  );

  // Derived frame duration for convenience
  public readonly frameDurationProperty: TReadOnlyProperty<number> =
    new DerivedProperty([this.frameRateProperty], (fps) => 1 / fps);

  // ── OpenCV Tracker (computational service) ────────────────────────────
  public readonly tracker = new OpenCVTracker(VIDEO_WIDTH, VIDEO_HEIGHT);

  // ── Overlay visibility ────────────────────────────────────────────────
  public readonly axesVisibleProperty = new BooleanProperty(true);
  public readonly calibrationVisibleProperty = new BooleanProperty(true);

  // ── Future features (not yet implemented) ────────────────────────────
  public readonly magnifyVideoProperty = new BooleanProperty(false);
  public readonly autoTrackingProperty = new BooleanProperty(false);

  // ── Coordinate system tool state (view / pixel space) ─────────────────
  public readonly coordOriginProperty = new Property<Vector2>(
    COORD_ORIGIN_INITIAL.copy(),
  );
  public readonly coordAngleProperty = new NumberProperty(0);

  // ── Calibration tool state ────────────────────────────────────────────
  public readonly calibPoint1Property = new Property<Vector2>(
    CALIB_P1_INITIAL.copy(),
  );
  public readonly calibPoint2Property = new Property<Vector2>(
    CALIB_P2_INITIAL.copy(),
  );
  public readonly calibDistanceProperty = new NumberProperty(1, {
    range: CALIBRATION_DISTANCE_RANGE,
  });
  public readonly calibUnitProperty = new Property<CalibrationUnit>("m");

  // ── Derived unit strings (for display in graphs and tables) ────────────
  public readonly distanceUnitProperty: TReadOnlyProperty<string> =
    new DerivedProperty([this.calibUnitProperty], (unit) => unit);

  public readonly velocityUnitProperty: TReadOnlyProperty<string> =
    new DerivedProperty([this.calibUnitProperty], (unit) => `${unit}/s`);

  public readonly accelerationUnitProperty: TReadOnlyProperty<string> =
    new DerivedProperty([this.calibUnitProperty], (unit) => `${unit}/s²`);

  // ── Model-view transform (derived; the view never writes to this) ─────
  public readonly modelViewTransformProperty: TReadOnlyProperty<Transform3> =
    new DerivedProperty(
      [
        this.coordOriginProperty,
        this.coordAngleProperty,
        this.calibPoint1Property,
        this.calibPoint2Property,
        this.calibDistanceProperty,
      ],
      (origin, angle, p1, p2, dist) =>
        buildModelViewTransform(origin, angle, p1, p2, dist),
    );

  // When coord system or calibration changes, recompute track points so they
  // stay at the same pixel positions on the video (invariant under MVT changes).
  private prevModelViewTransform: Transform3 | null = null;

  // ── Video loaded (true once a finite-duration video is loaded) ───────────
  public readonly videoLoadedProperty: TReadOnlyProperty<boolean> =
    new DerivedProperty([this.durationProperty], (d) => d > 0);

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
  //     modelViewTransformProperty.value.inversePosition2() before storage.
  public readonly tracksProperty = new Property<readonly Track[]>([]);
  public readonly activeTrackIdProperty = new Property<string | null>(null);
  public readonly canAddTrackProperty = new BooleanProperty(true);

  // ── Derived kinematics for all tracks ───────────────────────────────────
  // Cache keyed by track ID; only recomputes kinematics for tracks whose
  // point array reference has changed since the last derivation.  Because
  // addPointToTrack() always creates a new points array, reference equality
  // is sufficient to detect modifications.
  private readonly kinematicsCache = new Map<
    string,
    { points: Track["points"]; kinematics: TrackKinematics }
  >();

  public readonly trackKinematicsProperty: TReadOnlyProperty<
    readonly TrackKinematics[]
  > = new DerivedProperty([this.tracksProperty], (tracks) =>
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
    // ── Clamp coord origin to the video area ────────────────────────────────
    // Validation lives here rather than in the view so that any writer of
    // coordOriginProperty (drag listener, programmatic reset, etc.) benefits
    // from the constraint without needing per-call clamping logic.
    // The guard `if (clampedX !== pos.x || clampedY !== pos.y)` prevents
    // infinite recursion: after the clamped value is written, the listener
    // fires again but finds the condition false and exits.
    this.coordOriginProperty.lazyLink((pos) => {
      const clampedX = Math.max(
        COORD_ORIGIN_BOUNDS_MIN_X,
        Math.min(COORD_ORIGIN_BOUNDS_MAX_X, pos.x),
      );
      const clampedY = Math.max(
        COORD_ORIGIN_BOUNDS_MIN_Y,
        Math.min(COORD_ORIGIN_BOUNDS_MAX_Y, pos.y),
      );
      if (clampedX !== pos.x || clampedY !== pos.y) {
        this.coordOriginProperty.value = pos.copy().setXY(clampedX, clampedY);
      }
    });

    this.modelViewTransformProperty.lazyLink((newMVT) => {
      if (this.prevModelViewTransform !== null) {
        this.retransformTrackPoints(this.prevModelViewTransform, newMVT);
      }
      this.prevModelViewTransform = newMVT;
    });
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
   * `modelViewTransformProperty.value.inversePosition2()` before storage.
   * Writing raw pixel coordinates or stale model coordinates directly into
   * `tracksProperty` will silently corrupt the track data.
   */
  private retransformTrackPoints(
    prevMVT: Transform3,
    newMVT: Transform3,
  ): void {
    const tracks = this.tracksProperty.value;
    if (tracks.length === 0) return;

    this.tracksProperty.value = tracks.map((track) => ({
      ...track,
      points: track.points.map((pt) => {
        const pixelPos = prevMVT.transformPosition2(new Vector2(pt.x, pt.y));
        const newModelPt = newMVT.inversePosition2(pixelPos);
        return { ...pt, x: newModelPt.x, y: newModelPt.y };
      }),
    }));
  }

  /**
   * Create a new track labelled with the next available letter (A–Z) and a
   * unique color. Does nothing once all 26 letter slots are exhausted.
   */
  public addTrack(): void {
    if (this.nextSymbolCode > TRACK_SYMBOL_LAST_CODE) return; // 'Z' is the last allowed symbol
    const symbol = String.fromCharCode(this.nextSymbolCode);
    const colorIndex =
      (this.nextSymbolCode - TRACK_SYMBOL_FIRST_CODE) % TRACK_COLORS.length;
    const trackColor = TRACK_COLORS[colorIndex];
    const color = trackColor ? trackColor.toCSS() : "#000000";
    this.nextSymbolCode++;
    this.canAddTrackProperty.value =
      this.nextSymbolCode <= TRACK_SYMBOL_LAST_CODE;

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
    this.tracksProperty.value = this.tracksProperty.value.filter(
      (t) => t.id !== id,
    );
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
  public addPointToTrack(
    id: string,
    frame: number,
    time: number,
    x: number,
    y: number,
  ): void {
    const tracks = this.tracksProperty.value.map((track) => {
      if (track.id !== id) return track;

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

  public reset(): void {
    this.prevModelViewTransform = null;
    this.kinematicsCache.clear();
    this.isPlayingProperty.reset();
    this.currentTimeProperty.reset();
    this.durationProperty.reset();
    this.frameRateProperty.reset();
    this.isWebcamVideoProperty.reset();
    this.playbackRateProperty.reset();
    this.axesVisibleProperty.reset();
    this.calibrationVisibleProperty.reset();
    this.magnifyVideoProperty.reset();
    this.autoTrackingProperty.reset();
    this.coordOriginProperty.reset();
    this.coordAngleProperty.reset();
    this.calibPoint1Property.reset();
    this.calibPoint2Property.reset();
    this.calibDistanceProperty.reset();
    this.calibUnitProperty.reset();
    this.tracksProperty.value = [];
    this.activeTrackIdProperty.value = null;
    this.canAddTrackProperty.value = true;
    this.nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;
    this.tracker.dispose();
  }

  public step(_dt: number): void {
    // video playback is driven by the HTML video element; no model stepping needed
  }
}
