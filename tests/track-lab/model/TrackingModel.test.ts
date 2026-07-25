import { beforeEach, describe, expect, it } from "vitest";
import { computeTrackKinematics } from "../../../src/track-lab/model/KinematicsComputer.js";
import type { TrackPoint } from "../../../src/track-lab/model/Track.js";
import { TrackingModel } from "../../../src/track-lab/model/TrackingModel.js";

/** Frames of the first (and usually only) track, in stored order. */
function frames(model: TrackingModel, trackId = "track-A"): number[] {
  const track = model.tracksProperty.value.find((t) => t.id === trackId);
  return (track?.points ?? []).map((p) => p.frame);
}

function pointAt(model: TrackingModel, frame: number, trackId = "track-A"): TrackPoint | undefined {
  const track = model.tracksProperty.value.find((t) => t.id === trackId);
  return track?.points.find((p) => p.frame === frame);
}

/** Digitize frames 0..count-1, one model unit apart along x, at 1 s intervals. */
function digitize(model: TrackingModel, count: number, trackId = "track-A"): void {
  for (let frame = 0; frame < count; frame++) {
    model.addOrReplacePointOnTrack(trackId, frame, frame, frame, 0);
  }
}

describe("TrackingModel point deletion", () => {
  let model: TrackingModel;

  beforeEach(() => {
    model = new TrackingModel();
    model.addTrack();
  });

  it("removes the point at the given frame and leaves the rest intact", () => {
    digitize(model, 4);

    model.removePointFromTrack("track-A", 2);

    expect(frames(model)).toEqual([0, 1, 3]);
  });

  it("removes the first and the last point", () => {
    digitize(model, 3);

    model.removePointFromTrack("track-A", 0);
    expect(frames(model)).toEqual([1, 2]);

    model.removePointFromTrack("track-A", 2);
    expect(frames(model)).toEqual([1]);
  });

  it("removes the only point, leaving an empty track", () => {
    digitize(model, 1);

    model.removePointFromTrack("track-A", 0);

    expect(frames(model)).toEqual([]);
    expect(model.tracksProperty.value).toHaveLength(1);
  });

  it("is a no-op for a frame with no point, and for an unknown track", () => {
    digitize(model, 2);
    const before = model.tracksProperty.value;

    model.removePointFromTrack("track-A", 99);
    model.removePointFromTrack("track-Z", 0);

    expect(model.tracksProperty.value).toBe(before);
    expect(model.canRestorePointProperty.value).toBe(false);
  });

  it("replaces the points array so the kinematics cache invalidates", () => {
    digitize(model, 3);
    const before = model.trackKinematicsProperty.value[0];

    model.removePointFromTrack("track-A", 1);
    const after = model.trackKinematicsProperty.value[0];

    expect(after).not.toBe(before);
    expect(after?.points.map((p) => p.frame)).toEqual([0, 2]);
  });

  it("recomputes velocity across the gap left by a deleted point", () => {
    digitize(model, 3);

    model.removePointFromTrack("track-A", 1);

    // Two points 2 s apart, 2 units apart → 1 unit/s, computed from the
    // recorded timestamps rather than an assumed constant frame interval.
    const track = model.tracksProperty.value[0];
    expect(track).toBeDefined();
    if (!track) {
      return;
    }
    const kinematics = computeTrackKinematics(track);
    expect(kinematics.points[0]?.vx).toBeCloseTo(1, 6);
    expect(kinematics.points[1]?.vx).toBeCloseTo(1, 6);
  });
});

describe("TrackingModel restore last deleted point", () => {
  let model: TrackingModel;

  beforeEach(() => {
    model = new TrackingModel();
    model.addTrack();
  });

  it("round-trips a deleted interior point back into frame order", () => {
    digitize(model, 4);

    model.removePointFromTrack("track-A", 1);
    expect(model.canRestorePointProperty.value).toBe(true);

    model.restoreLastDeletedPoint();

    // Restored in sorted position, not appended — KinematicsComputer
    // differentiates by array index and assumes time increases along it.
    expect(frames(model)).toEqual([0, 1, 2, 3]);
    expect(model.canRestorePointProperty.value).toBe(false);
  });

  it("restores the point's original coordinates", () => {
    model.addOrReplacePointOnTrack("track-A", 5, 0.5, 12.5, -3.25);

    model.removePointFromTrack("track-A", 5);
    model.restoreLastDeletedPoint();

    expect(pointAt(model, 5)).toEqual({ frame: 5, time: 0.5, x: 12.5, y: -3.25 });
  });

  it("only remembers the most recent deletion", () => {
    digitize(model, 3);

    model.removePointFromTrack("track-A", 0);
    model.removePointFromTrack("track-A", 1);
    model.restoreLastDeletedPoint();

    expect(frames(model)).toEqual([1, 2]);
    expect(model.canRestorePointProperty.value).toBe(false);
  });

  it("drops the stash when the point's track is removed", () => {
    digitize(model, 2);

    model.removePointFromTrack("track-A", 0);
    expect(model.canRestorePointProperty.value).toBe(true);

    model.removeTrack("track-A");

    expect(model.canRestorePointProperty.value).toBe(false);
    model.restoreLastDeletedPoint();
    expect(model.tracksProperty.value).toHaveLength(0);
  });

  it("clears the stash on reset", () => {
    digitize(model, 1);
    model.removePointFromTrack("track-A", 0);

    model.reset();

    expect(model.canRestorePointProperty.value).toBe(false);
  });
});

describe("TrackingModel point insertion policies", () => {
  let model: TrackingModel;

  beforeEach(() => {
    model = new TrackingModel();
    model.addTrack();
  });

  it("keeps the first position when auto-tracking re-reports a frame", () => {
    model.addPointToTrack("track-A", 0, 0, 1, 1);
    model.addPointToTrack("track-A", 0, 0, 9, 9);

    expect(pointAt(model, 0)).toMatchObject({ x: 1, y: 1 });
  });

  it("overwrites the position when the user re-digitizes a frame", () => {
    model.addOrReplacePointOnTrack("track-A", 0, 0, 1, 1);
    model.addOrReplacePointOnTrack("track-A", 0, 0, 9, 9);

    expect(pointAt(model, 0)).toMatchObject({ x: 9, y: 9 });
    expect(frames(model)).toEqual([0]);
  });

  it("stores points in frame order when digitized out of order", () => {
    model.addOrReplacePointOnTrack("track-A", 4, 4, 0, 0);
    model.addOrReplacePointOnTrack("track-A", 1, 1, 0, 0);
    model.addPointToTrack("track-A", 2, 2, 0, 0);

    expect(frames(model)).toEqual([1, 2, 4]);
  });

  it("leaves other tracks untouched", () => {
    model.addTrack();
    digitize(model, 2, "track-A");
    digitize(model, 2, "track-B");

    model.removePointFromTrack("track-A", 0);

    expect(frames(model, "track-A")).toEqual([1]);
    expect(frames(model, "track-B")).toEqual([0, 1]);
  });
});
