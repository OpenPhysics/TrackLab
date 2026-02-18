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
  x: number;   // model x-coordinate
  y: number;   // model y-coordinate
};

export type Track = {
  id: string;
  symbol: string;          // single uppercase letter: 'A', 'B', 'C', ...
  color: string;           // CSS hex color
  points: readonly TrackPoint[];
};
