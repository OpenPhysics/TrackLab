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
import type { Track, TrackPoint } from "./Track.js";

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
    new DerivedProperty(
      [this.frameRateProperty],
      (fps) => 1 / fps,
    );

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

  // ── Video loaded (true once a finite-duration video is loaded) ───────────
  public readonly videoLoadedProperty: TReadOnlyProperty<boolean> =
    new DerivedProperty([this.durationProperty], (d) => d > 0);

  // ── Manual particle tracks ────────────────────────────────────────────
  public readonly tracksProperty = new Property<readonly Track[]>([]);
  public readonly activeTrackIdProperty = new Property<string | null>(null);
  public readonly canAddTrackProperty = new BooleanProperty(true);
  // Symbols are assigned sequentially (A → Z) and intentionally not reused
  // after a track is removed.  Stable, unique symbols matter for data export
  // and user recognition: re-issuing "A" to a new track after the original "A"
  // is deleted would be confusing.  The practical limit is 26 tracks per session.
  private nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;

  public addTrack(): void {
    if (this.nextSymbolCode > TRACK_SYMBOL_LAST_CODE) return; // 'Z' is the last allowed symbol
    const symbol = String.fromCharCode(this.nextSymbolCode);
    const color =
      TRACK_COLORS[
        (this.nextSymbolCode - TRACK_SYMBOL_FIRST_CODE) % TRACK_COLORS.length
      ];
    this.nextSymbolCode++;
    this.canAddTrackProperty.value = this.nextSymbolCode <= TRACK_SYMBOL_LAST_CODE;

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

      const point: TrackPoint = { frame, time, x, y };
      const updated: Track = { ...track, points: [...track.points, point] };
      return updated;
    });
    this.tracksProperty.value = tracks;
  }

  public reset(): void {
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
