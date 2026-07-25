/**
 * Regression tests for frame-index retiming.
 *
 * TrackPoint.time is authoritative (captured from the video element) while
 * TrackPoint.frame is a derived index that has to stay consistent with
 * VideoPlaybackModel.currentFrameProperty. Changing the frame rate renumbers
 * the current frame, so stored points must be renumbered in the same step.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { TrackingModel } from "../../../src/track-lab/model/TrackingModel.js";
import { TrackLabModel } from "../../../src/track-lab/model/TrackLabModel.js";

function frames(model: TrackingModel, trackId = "track-A"): number[] {
  const track = model.tracksProperty.value.find((t) => t.id === trackId);
  return (track?.points ?? []).map((p) => p.frame);
}

describe("TrackingModel.retimeTrackPoints", () => {
  let model: TrackingModel;

  beforeEach(() => {
    model = new TrackingModel();
    model.addTrack();
  });

  it("re-derives frame indices from timestamps", () => {
    // Digitized at 30 fps: frames 0, 30, 60 at t = 0 s, 1 s, 2 s.
    model.addOrReplacePointOnTrack("track-A", 0, 0, 1, 1);
    model.addOrReplacePointOnTrack("track-A", 30, 1, 2, 2);
    model.addOrReplacePointOnTrack("track-A", 60, 2, 3, 3);

    model.retimeTrackPoints(60);

    expect(frames(model)).toEqual([0, 60, 120]);
  });

  it("leaves timestamps and coordinates untouched", () => {
    model.addOrReplacePointOnTrack("track-A", 30, 1, 4, 5);

    model.retimeTrackPoints(15);

    const point = model.tracksProperty.value[0]?.points[0];
    expect(point?.frame).toBe(15);
    expect(point?.time).toBe(1);
    expect(point?.x).toBe(4);
    expect(point?.y).toBe(5);
  });

  it("keeps frames unique when a lower rate collides two points", () => {
    // At 30 fps these are distinct frames; at 2 fps both round to frame 0.
    model.addOrReplacePointOnTrack("track-A", 0, 0, 1, 1);
    model.addOrReplacePointOnTrack("track-A", 3, 0.1, 2, 2);

    model.retimeTrackPoints(2);

    // First-wins, matching addPointToTrack()'s dedup policy.
    expect(frames(model)).toEqual([0]);
    expect(model.tracksProperty.value[0]?.points[0]?.time).toBe(0);
  });

  it("keeps points sorted ascending by frame", () => {
    for (let i = 0; i < 5; i++) {
      model.addOrReplacePointOnTrack("track-A", i * 30, i, i, i);
    }

    model.retimeTrackPoints(24);

    const result = frames(model);
    expect(result).toEqual([...result].sort((a, b) => a - b));
  });

  it("retimes the undo stash so a restored point lands on the right frame", () => {
    model.addOrReplacePointOnTrack("track-A", 30, 1, 7, 7);
    model.removePointFromTrack("track-A", 30);

    model.retimeTrackPoints(60);
    model.restoreLastDeletedPoint();

    expect(frames(model)).toEqual([60]);
  });

  it("ignores a non-positive frame rate", () => {
    model.addOrReplacePointOnTrack("track-A", 30, 1, 1, 1);

    model.retimeTrackPoints(0);

    expect(frames(model)).toEqual([30]);
  });
});

describe("TrackLabModel frame-rate wiring", () => {
  it("retimes stored points so they stay aligned with the current frame", () => {
    const model = new TrackLabModel();
    model.tracking.addTrack();

    // Park the video at t = 1 s and digitize there at the default 30 fps.
    model.playback.currentTimeProperty.value = 1;
    const frameAtDigitize = model.playback.currentFrameProperty.value;
    model.tracking.addOrReplacePointOnTrack("track-A", frameAtDigitize, 1, 5, 5);
    expect(model.tracking.hasPointAtFrame("track-A", model.playback.currentFrameProperty.value)).toBe(true);

    // Switching frame rate renumbers currentFrameProperty; the stored point has
    // to follow, or the erase button silently targets nothing.
    model.playback.frameRateProperty.value = 60;

    expect(model.playback.currentFrameProperty.value).toBe(60);
    expect(model.tracking.hasPointAtFrame("track-A", model.playback.currentFrameProperty.value)).toBe(true);
  });
});
