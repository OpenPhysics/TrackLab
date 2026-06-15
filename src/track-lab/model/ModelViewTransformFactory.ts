/**
 * ModelViewTransformFactory.ts
 *
 * Builds the Transform3 that maps between real-world model coordinates and
 * video-pixel (screen) coordinates.  Pure function — no Axon Properties,
 * no SceneryStack UI dependencies.
 */

import { Matrix3, Transform3, type Vector2 } from "scenerystack/dot";
import { MIN_CALIB_DISTANCE, MIN_PIXEL_DISTANCE } from "../../TrackLabConstants.js";

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
export function buildModelViewTransform(
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
