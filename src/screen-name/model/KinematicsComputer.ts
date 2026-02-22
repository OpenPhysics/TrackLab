/**
 * KinematicsComputer.ts
 *
 * Pure functions for computing velocity and acceleration from digitized track
 * points via finite differences.  All inputs and outputs are plain data types
 * from Track.ts — no Axon Properties, no SceneryStack dependencies.
 */

import type { Track, TrackKinematics, KinematicPoint } from "./Track.js";

/**
 * Scalar finite difference at index i within an array of n values.
 *
 * Uses forward difference at the first point, backward difference at the last,
 * and central differences for all interior points.  Returns null if the array
 * has fewer than 2 elements, if the time interval is non-positive, or if
 * either endpoint value is null.
 *
 * @param getValue  Returns the scalar quantity at index j (null = unknown).
 * @param getTime   Returns the time stamp at index j.
 * @param i         Index to differentiate at.
 * @param n         Total number of elements.
 */
function finiteDifference(
  getValue: (j: number) => number | null,
  getTime: (j: number) => number,
  i: number,
  n: number,
): number | null {
  if (n < 2) return null;
  const [prevIdx, nextIdx] =
    i === 0 ? [0, 1] : i === n - 1 ? [n - 2, n - 1] : [i - 1, i + 1];
  const prev = getValue(prevIdx);
  const next = getValue(nextIdx);
  const dt = getTime(nextIdx) - getTime(prevIdx);
  if (prev === null || next === null || dt <= 0) return null;
  return (next - prev) / dt;
}

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
export function computeTrackKinematics(track: Track): TrackKinematics {
  const { points } = track;
  const n = points.length;

  if (n === 0) {
    return { ...track, points: [] };
  }

  const getTime = (j: number) => points[j]?.time ?? 0;
  const getX = (j: number) => points[j]?.x ?? null;
  const getY = (j: number) => points[j]?.y ?? null;

  // First pass: velocities via finite difference of position
  const vxArr = points.map((_, i) => finiteDifference(getX, getTime, i, n));
  const vyArr = points.map((_, i) => finiteDifference(getY, getTime, i, n));

  // Second pass: accelerations via finite difference of velocity
  const axArr = points.map((_, i) =>
    finiteDifference((j) => vxArr[j] ?? null, getTime, i, n),
  );
  const ayArr = points.map((_, i) =>
    finiteDifference((j) => vyArr[j] ?? null, getTime, i, n),
  );

  const kinematicPoints: KinematicPoint[] = points.map((pt, i) => {
    const vx = vxArr[i] ?? null;
    const vy = vyArr[i] ?? null;
    const ax = axArr[i] ?? null;
    const ay = ayArr[i] ?? null;
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
