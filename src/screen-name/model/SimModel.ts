import {
  BooleanProperty,
  DerivedProperty,
  NumberProperty,
  Property,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import { Matrix3, Range, Transform3, Vector2 } from "scenerystack/dot";
import { TRACK_COLORS } from "../../TrackLabColors.js";
import {
  MIN_CALIB_DISTANCE,
  MIN_PIXEL_DISTANCE,
  TRACK_SYMBOL_FIRST_CODE,
  TRACK_SYMBOL_LAST_CODE,
} from "../../TrackLabConstants.js";
import { OpenCVTracker } from "../../tracking/OpenCVTracker.js";
import type {
  KinematicPoint,
  Track,
  TrackKinematics,
  TrackPoint,
} from "./Track.js";

// Video display dimensions (used by tracker and views)
export const VIDEO_WIDTH = 640;
export const VIDEO_HEIGHT = 360;

// ── Calibration unit type ──────────────────────────────────────────────────
export const CALIBRATION_UNITS = ["mm", "cm", "m", "km", "in", "ft"] as const;
export type CalibrationUnit = (typeof CALIBRATION_UNITS)[number];
export const CALIBRATION_DISTANCE_RANGE = new Range(0.001, 100000);

// ── Frame rate options ─────────────────────────────────────────────────────
export const FRAME_RATE_OPTIONS = [15, 24, 25, 29.97, 30, 50, 60] as const;
export const DEFAULT_FRAME_RATE = 30;
export const FRAME_RATE_RANGE = new Range(1, 120);

// ── Layout constants ───────────────────────────────────────────────────────
// SceneryStack's ScreenView.DEFAULT_LAYOUT_BOUNDS = Bounds2(0, 0, 1024, 618).
// The VideoPlayerNode is centered at layoutBounds.center + (0, -20).
const LAYOUT_CENTER_X = 512; // 1024 / 2
const LAYOUT_CENTER_Y = 309; // 618 / 2
const VIDEO_CENTER_X = LAYOUT_CENTER_X; // 512
const VIDEO_CENTER_Y = LAYOUT_CENTER_Y - 20; // 289
const CALIB_HALF_LEN = 100; // pixels from center to each calibration endpoint

// Initial tool positions (view / pixel space)
const COORD_ORIGIN_INITIAL = new Vector2(
  VIDEO_CENTER_X - VIDEO_WIDTH / 4,
  VIDEO_CENTER_Y,
);
const CALIB_CENTER_INITIAL = new Vector2(
  VIDEO_CENTER_X,
  VIDEO_CENTER_Y + VIDEO_HEIGHT / 4,
);
const CALIB_P1_INITIAL = CALIB_CENTER_INITIAL.plusXY(-CALIB_HALF_LEN, 0);
const CALIB_P2_INITIAL = CALIB_CENTER_INITIAL.plusXY(CALIB_HALF_LEN, 0);

// ── Model-view transform builder ───────────────────────────────────────────
/**
 * Builds a Transform3 from the coordinate-system tool and calibration tool.
 *
 * Composed as:  T(origin) · R(θ) · S(s, −s)
 *
 *   S(s, −s)  — scale model units to pixels, flip Y (model +y points up)
 *   R(θ)      — rotate by the coord-system angle (clockwise on screen)
 *   T(origin) — translate so model origin lands on the coord-system view position
 *
 * where s = |p2 − p1| / calibrationDistance  (pixels per model unit).
 * Returns the identity transform when the calibration segment has zero length.
 */
function buildModelViewTransform(
  origin: Vector2,
  angle: number,
  p1: Vector2,
  p2: Vector2,
  dist: number,
): Transform3 {
  const pixelDist = p1.distance(p2);
  if (pixelDist < MIN_PIXEL_DISTANCE || dist < MIN_CALIB_DISTANCE) {
    return new Transform3(Matrix3.IDENTITY);
  }
  const s = pixelDist / dist; // pixels per model unit

  const matrix = Matrix3.translationFromVector(origin)
    .timesMatrix(Matrix3.rotation2(angle))
    .timesMatrix(Matrix3.scaling(s, -s));

  return new Transform3(matrix);
}

// ── Kinematics computation ───────────────────────────────────────────────
/**
 * Computes velocity and acceleration for each point in a track.
 * Uses central differences where possible for better accuracy.
 *
 * Velocity at point i:
 *   - If only one point: null
 *   - Otherwise: (position[i+1] - position[i-1]) / (time[i+1] - time[i-1])
 *     (falls back to forward/backward difference at endpoints)
 *
 * Acceleration at point i:
 *   - Computed from velocities using the same differencing approach
 */
function computeTrackKinematics(track: Track): TrackKinematics {
  const { points } = track;
  const n = points.length;

  if (n === 0) {
    return { ...track, points: [] };
  }

  // Helper to safely get a point (returns undefined if out of bounds)
  const getPoint = (idx: number): TrackPoint | undefined => points[idx];

  // Compute velocity at index i using finite differences
  const computeVelocity = (
    i: number,
  ): { vx: number | null; vy: number | null } => {
    if (n < 2) {
      return { vx: null, vy: null };
    }

    const curr = getPoint(i);
    if (!curr) return { vx: null, vy: null };

    if (i === 0) {
      // Forward difference for first point
      const next = getPoint(1);
      if (!next) return { vx: null, vy: null };
      const dt = next.time - curr.time;
      if (dt <= 0) return { vx: null, vy: null };
      return {
        vx: (next.x - curr.x) / dt,
        vy: (next.y - curr.y) / dt,
      };
    }

    if (i === n - 1) {
      // Backward difference for last point
      const prev = getPoint(n - 2);
      if (!prev) return { vx: null, vy: null };
      const dt = curr.time - prev.time;
      if (dt <= 0) return { vx: null, vy: null };
      return {
        vx: (curr.x - prev.x) / dt,
        vy: (curr.y - prev.y) / dt,
      };
    }

    // Central difference for interior points
    const prev = getPoint(i - 1);
    const next = getPoint(i + 1);
    if (!prev || !next) return { vx: null, vy: null };
    const dt = next.time - prev.time;
    if (dt <= 0) return { vx: null, vy: null };
    return {
      vx: (next.x - prev.x) / dt,
      vy: (next.y - prev.y) / dt,
    };
  };

  // First pass: compute velocities
  const velocities = points.map((_, i) => computeVelocity(i));

  // Helper to safely get velocity
  const getVelocity = (
    idx: number,
  ): { vx: number | null; vy: number | null } | undefined => velocities[idx];

  // Compute acceleration at index i using finite differences on velocities
  const computeAcceleration = (
    i: number,
  ): { ax: number | null; ay: number | null } => {
    if (n < 2) {
      return { ax: null, ay: null };
    }

    const curr = getPoint(i);
    if (!curr) return { ax: null, ay: null };

    if (i === 0) {
      // Forward difference
      const v0 = getVelocity(0);
      const v1 = getVelocity(1);
      const next = getPoint(1);
      if (!v0 || !v1 || !next) return { ax: null, ay: null };
      if (
        v0.vx === null ||
        v1.vx === null ||
        v0.vy === null ||
        v1.vy === null
      ) {
        return { ax: null, ay: null };
      }
      const dt = next.time - curr.time;
      if (dt <= 0) return { ax: null, ay: null };
      return {
        ax: (v1.vx - v0.vx) / dt,
        ay: (v1.vy - v0.vy) / dt,
      };
    }

    if (i === n - 1) {
      // Backward difference
      const vPrev = getVelocity(n - 2);
      const vCurr = getVelocity(n - 1);
      const prev = getPoint(n - 2);
      if (!vPrev || !vCurr || !prev) return { ax: null, ay: null };
      if (
        vPrev.vx === null ||
        vCurr.vx === null ||
        vPrev.vy === null ||
        vCurr.vy === null
      ) {
        return { ax: null, ay: null };
      }
      const dt = curr.time - prev.time;
      if (dt <= 0) return { ax: null, ay: null };
      return {
        ax: (vCurr.vx - vPrev.vx) / dt,
        ay: (vCurr.vy - vPrev.vy) / dt,
      };
    }

    // Central difference
    const vPrev = getVelocity(i - 1);
    const vNext = getVelocity(i + 1);
    const prev = getPoint(i - 1);
    const next = getPoint(i + 1);
    if (!vPrev || !vNext || !prev || !next) return { ax: null, ay: null };
    if (
      vPrev.vx === null ||
      vNext.vx === null ||
      vPrev.vy === null ||
      vNext.vy === null
    ) {
      return { ax: null, ay: null };
    }
    const dt = next.time - prev.time;
    if (dt <= 0) return { ax: null, ay: null };
    return {
      ax: (vNext.vx - vPrev.vx) / dt,
      ay: (vNext.vy - vPrev.vy) / dt,
    };
  };

  // Second pass: compute accelerations
  const accelerations = points.map((_, i) => computeAcceleration(i));

  // Combine all data into KinematicPoints
  const kinematicPoints: KinematicPoint[] = points.map((pt, i) => {
    const vel = velocities[i];
    const acc = accelerations[i];
    const vx = vel?.vx ?? null;
    const vy = vel?.vy ?? null;
    const ax = acc?.ax ?? null;
    const ay = acc?.ay ?? null;

    return {
      frame: pt.frame,
      time: pt.time,
      x: pt.x,
      y: pt.y,
      vx,
      vy,
      speed: vx !== null && vy !== null ? Math.sqrt(vx * vx + vy * vy) : null,
      ax,
      ay,
      accelerationMagnitude:
        ax !== null && ay !== null ? Math.sqrt(ax * ax + ay * ay) : null,
    };
  });

  return {
    id: track.id,
    symbol: track.symbol,
    color: track.color,
    points: kinematicPoints,
  };
}

export class SimModel {
  public readonly isPlayingProperty = new BooleanProperty(false);
  public readonly currentTimeProperty = new Property<number>(0);
  public readonly durationProperty = new Property<number>(0);

  // ── Frame rate (user-settable, default 30 fps) ─────────────────────────
  public readonly frameRateProperty = new NumberProperty(DEFAULT_FRAME_RATE, {
    range: FRAME_RATE_RANGE,
  });

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
  public readonly tracksProperty = new Property<readonly Track[]>([]);
  public readonly activeTrackIdProperty = new Property<string | null>(null);
  public readonly canAddTrackProperty = new BooleanProperty(true);

  // ── Derived kinematics for all tracks ───────────────────────────────────
  // Automatically computes velocity and acceleration from position data
  public readonly trackKinematicsProperty: TReadOnlyProperty<
    readonly TrackKinematics[]
  > = new DerivedProperty([this.tracksProperty], (tracks) =>
    tracks.map((track) => computeTrackKinematics(track)),
  );
  // Symbols are assigned sequentially (A → Z) and intentionally not reused
  // after a track is removed.  Stable, unique symbols matter for data export
  // and user recognition: re-issuing "A" to a new track after the original "A"
  // is deleted would be confusing.  The practical limit is 26 tracks per session.
  private nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;

  public constructor() {
    this.modelViewTransformProperty.lazyLink((newMVT) => {
      if (this.prevModelViewTransform === null) {
        this.prevModelViewTransform = newMVT;
        return;
      }
      const prevMVT = this.prevModelViewTransform;
      const tracks = this.tracksProperty.value;
      if (tracks.length === 0) {
        this.prevModelViewTransform = newMVT;
        return;
      }
      const updatedTracks = tracks.map((track) => {
        const updatedPoints = track.points.map((pt) => {
          const pixelPos = prevMVT.transformPosition2(new Vector2(pt.x, pt.y));
          const newModelPt = newMVT.inversePosition2(pixelPos);
          return { ...pt, x: newModelPt.x, y: newModelPt.y };
        });
        return { ...track, points: updatedPoints };
      });
      this.tracksProperty.value = updatedTracks;
      this.prevModelViewTransform = newMVT;
    });
  }

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
    tracks.sort((a, b) => a.symbol.localeCompare(b.symbol));
    this.tracksProperty.value = tracks;
  }

  public removeTrack(id: string): void {
    if (this.activeTrackIdProperty.value === id) {
      this.activeTrackIdProperty.value = null;
    }
    this.tracksProperty.value = this.tracksProperty.value.filter(
      (t) => t.id !== id,
    );
  }

  public addPointToTrack(
    id: string,
    frame: number,
    time: number,
    x: number,
    y: number,
  ): void {
    const tracks = this.tracksProperty.value.map((track) => {
      if (track.id !== id) return track;

      // Reject duplicate frames.  Without this guard a second click on the
      // same frame (manual digitizing) or a repeated timeupdate event would
      // add a second point at the same frame index, corrupting kinematics.
      if (track.points.some((p) => p.frame === frame)) return track;

      const point: TrackPoint = { frame, time, x, y };
      const updated: Track = { ...track, points: [...track.points, point] };
      return updated;
    });
    this.tracksProperty.value = tracks;
  }

  public reset(): void {
    this.prevModelViewTransform = null;
    this.isPlayingProperty.reset();
    this.currentTimeProperty.reset();
    this.durationProperty.reset();
    this.frameRateProperty.reset();
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public step(_dt: number): void {
    // video playback is driven by the HTML video element; no model stepping needed
  }
}
