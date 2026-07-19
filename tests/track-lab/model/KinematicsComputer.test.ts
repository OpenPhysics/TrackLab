import { describe, expect, it } from "vitest";
import { computeTrackKinematics } from "../../../src/track-lab/model/KinematicsComputer.js";
import type { Track } from "../../../src/track-lab/model/Track.js";

describe("KinematicsComputer", () => {
  it("computes constant vx for uniform motion along x", () => {
    const vx = 3;
    const track: Track = {
      id: "uniform",
      symbol: "A",
      colorIndex: 0,
      points: [
        { frame: 0, time: 0, x: 0, y: 0 },
        { frame: 1, time: 1, x: vx, y: 0 },
        { frame: 2, time: 2, x: 2 * vx, y: 0 },
        { frame: 3, time: 3, x: 3 * vx, y: 0 },
      ],
    };

    const kinematics = computeTrackKinematics(track);

    for (const point of kinematics.points) {
      expect(point.vx).toBeCloseTo(vx, 6);
      expect(point.vy).toBeCloseTo(0, 6);
    }
  });

  it("returns null velocities for a single-point track", () => {
    const track: Track = {
      id: "lonely",
      symbol: "B",
      colorIndex: 1,
      points: [{ frame: 0, time: 0, x: 1, y: 2 }],
    };

    const kinematics = computeTrackKinematics(track);

    expect(kinematics.points).toHaveLength(1);
    expect(kinematics.points[0]?.vx).toBeNull();
    expect(kinematics.points[0]?.vy).toBeNull();
    expect(kinematics.points[0]?.ax).toBeNull();
    expect(kinematics.points[0]?.ay).toBeNull();
  });
});
