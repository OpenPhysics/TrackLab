/**
 * OverlayToolsModel.ts
 *
 * Reactive state for all measurement and coordinate-system overlay tools:
 * axes, calibration ruler, measuring tape, angle tool, and their derived
 * model-view transform. Extracted from TrackLabModel to keep video-playback and
 * track-management state separate from geometric tool state.
 */

import { BooleanProperty, DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { Range, type Transform3, Vector2 } from "scenerystack/dot";
import { CALIB_HALF_LENGTH, VIDEO_HEIGHT, VIDEO_WIDTH } from "../../TrackLabConstants.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";
import { buildModelViewTransform } from "./ModelViewTransformFactory.js";

// ── Calibration unit type ──────────────────────────────────────────────────
export const CALIBRATION_UNITS = ["mm", "cm", "m", "km", "in", "ft"] as const;
export type CalibrationUnit = (typeof CALIBRATION_UNITS)[number];
/** Velocity unit derived from the calibration unit (e.g. `"m/s"`). */
export type VelocityUnit = `${CalibrationUnit}/s`;
/** Acceleration unit derived from the calibration unit (e.g. `"m/s²"`). */
export type AccelerationUnit = `${CalibrationUnit}/s²`;
export const CALIBRATION_DISTANCE_RANGE = new Range(0.001, 100000);

// ── Video-local coordinate helpers ──────────────────────────────────────────
// All tool positions are in video-local coordinates: (0,0) = top-left of the
// video element, (VIDEO_WIDTH, VIDEO_HEIGHT) = bottom-right.
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
const COORD_ORIGIN_BOUNDS_MIN_X = 0;
const COORD_ORIGIN_BOUNDS_MAX_X = VIDEO_WIDTH;
const COORD_ORIGIN_BOUNDS_MIN_Y = 0;
const COORD_ORIGIN_BOUNDS_MAX_Y = VIDEO_HEIGHT;

/**
 * Owns all reactive state for the geometric overlay tools: coordinate system,
 * calibration ruler, measuring tape, and angle tool. Also provides the
 * derived model-view transform and unit-string properties used for display.
 */
export class OverlayToolsModel {
  // ── Overlay visibility ────────────────────────────────────────────────────
  public readonly videoContentVisibleProperty = new BooleanProperty(true);
  public readonly axesVisibleProperty = new BooleanProperty(true);
  public readonly calibrationVisibleProperty = new BooleanProperty(true);
  public readonly magnifyVideoProperty = new BooleanProperty(false);
  public readonly autoTrackingProperty = new BooleanProperty(false);
  public readonly measuringTapeVisibleProperty = new BooleanProperty(false);
  public readonly angleToolVisibleProperty = new BooleanProperty(false);

  // ── Measuring tape endpoint positions (video-local coordinates) ────────────
  public readonly tapPoint1Property = new Property<Vector2>(TAPE_P1_INITIAL.copy());
  public readonly tapPoint2Property = new Property<Vector2>(TAPE_P2_INITIAL.copy());

  // ── Angle tool positions (video-local coordinates) ─────────────────────────
  public readonly angleVertexProperty = new Property<Vector2>(ANGLE_VERTEX_INITIAL.copy());
  public readonly angleArm1Property = new Property<Vector2>(ANGLE_ARM1_INITIAL.copy());
  public readonly angleArm2Property = new Property<Vector2>(ANGLE_ARM2_INITIAL.copy());

  // ── Coordinate system tool state (video-local coordinates) ────────────────
  public readonly coordOriginProperty = new Property<Vector2>(COORD_ORIGIN_INITIAL.copy());
  public readonly coordAngleProperty = new NumberProperty(0);

  // ── Calibration tool state ─────────────────────────────────────────────────
  public readonly calibPoint1Property = new Property<Vector2>(CALIB_P1_INITIAL.copy());
  public readonly calibPoint2Property = new Property<Vector2>(CALIB_P2_INITIAL.copy());
  public readonly calibDistanceProperty = new NumberProperty(1, {
    range: CALIBRATION_DISTANCE_RANGE,
  });
  public readonly calibUnitProperty = new Property<CalibrationUnit>("m");

  // ── Derived unit strings (for display in graphs and tables) ───────────────
  public readonly velocityUnitProperty: TReadOnlyProperty<VelocityUnit> = new DerivedProperty(
    [this.calibUnitProperty],
    (unit): VelocityUnit => `${unit}/s`,
  );
  public readonly accelerationUnitProperty: TReadOnlyProperty<AccelerationUnit> = new DerivedProperty(
    [this.calibUnitProperty],
    (unit): AccelerationUnit => `${unit}/s²`,
  );

  // ── Model-view transform (derived; the view never writes to this) ─────────
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

  /**
   * Clamps a position to keep the coordinate system origin within video bounds.
   * Used by drag listeners to constrain the origin to the visible video area.
   */
  public clampCoordOrigin(pos: Vector2): Vector2 {
    const clampedX = Math.max(COORD_ORIGIN_BOUNDS_MIN_X, Math.min(COORD_ORIGIN_BOUNDS_MAX_X, pos.x));
    const clampedY = Math.max(COORD_ORIGIN_BOUNDS_MIN_Y, Math.min(COORD_ORIGIN_BOUNDS_MAX_Y, pos.y));
    return new Vector2(clampedX, clampedY);
  }

  public reset(): void {
    this.videoContentVisibleProperty.reset();
    this.axesVisibleProperty.reset();
    this.calibrationVisibleProperty.reset();
    this.magnifyVideoProperty.reset();
    this.autoTrackingProperty.reset();
    this.measuringTapeVisibleProperty.reset();
    this.angleToolVisibleProperty.reset();
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
  }
}

TrackLabNamespace.register("OverlayToolsModel", OverlayToolsModel);
