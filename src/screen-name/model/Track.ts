/**
 * Track.ts
 *
 * Data types for manual particle-tracking tracks.
 * Each Track belongs to one particle; each TrackPoint records
 * the frame number and timestamp at which the user tagged it.
 */

export type TrackPoint = {
  frame: number;
  time: number; // seconds
  x: number; // model x-coordinate
  y: number; // model y-coordinate
};

export type Track = {
  id: string;
  symbol: string; // single uppercase letter: 'A', 'B', 'C', ...
  colorIndex: number; // index into TRACK_COLORS array
  points: readonly TrackPoint[];
};

/**
 * Computed kinematic data for a single point.
 * Velocity values are computed from position differences between adjacent points.
 * Acceleration values are computed from velocity differences.
 * Values are null when they cannot be computed (e.g., first point has no velocity).
 */
export type KinematicPoint = {
  frame: number;
  time: number;
  x: number;
  y: number;
  vx: number | null; // x-velocity (model units per second)
  vy: number | null; // y-velocity (model units per second)
  speed: number | null; // magnitude of velocity vector
  ax: number | null; // x-acceleration (model units per second²)
  ay: number | null; // y-acceleration (model units per second²)
  accelerationMagnitude: number | null; // magnitude of acceleration vector
};

/**
 * Complete kinematic data for a track, including computed velocities and accelerations.
 */
export type TrackKinematics = {
  id: string;
  symbol: string;
  colorIndex: number;
  points: readonly KinematicPoint[];
};
