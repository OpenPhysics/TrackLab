import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FRAME_RATE, VideoPlaybackModel } from "../../../src/track-lab/model/VideoPlaybackModel.js";

describe("VideoPlaybackModel frame derivation", () => {
  let model: VideoPlaybackModel;

  beforeEach(() => {
    model = new VideoPlaybackModel();
  });

  it("derives the current frame by rounding time x frame rate", () => {
    model.currentTimeProperty.value = 1;
    expect(model.currentFrameProperty.value).toBe(DEFAULT_FRAME_RATE);
  });

  it("keeps adjacent timestamps on distinct frames at 29.97 fps", () => {
    model.frameRateProperty.value = 29.97;
    const frameDuration = 1 / 29.97;

    // Ten consecutive frame boundaries must map to ten distinct indices; this is
    // what multiplying by fps (rather than dividing by 1/fps) protects.
    const derived = new Set<number>();
    for (let i = 0; i < 10; i++) {
      model.currentTimeProperty.value = i * frameDuration;
      derived.add(model.currentFrameProperty.value);
    }

    expect(derived.size).toBe(10);
  });

  it("agrees with timeToFrame()", () => {
    model.frameRateProperty.value = 25;
    model.currentTimeProperty.value = 3.44;

    expect(model.timeToFrame(3.44)).toBe(model.currentFrameProperty.value);
  });
});

describe("VideoPlaybackModel seeking", () => {
  let model: VideoPlaybackModel;

  beforeEach(() => {
    model = new VideoPlaybackModel();
    model.durationProperty.value = 10;
  });

  it("advances by exactly one frame duration", () => {
    model.seekByFrames(1);
    expect(model.currentTimeProperty.value).toBeCloseTo(1 / DEFAULT_FRAME_RATE);
  });

  it("clamps at the start of the video", () => {
    model.seekByFrames(-1);
    expect(model.currentTimeProperty.value).toBe(0);
  });

  it("clamps at the end of the video", () => {
    model.currentTimeProperty.value = 10;
    model.seekByFrames(1);
    expect(model.currentTimeProperty.value).toBe(10);
  });

  it("does nothing when no video is loaded", () => {
    const empty = new VideoPlaybackModel();
    empty.seekByFrames(1);
    expect(empty.currentTimeProperty.value).toBe(0);
  });

  it("pauses playback when stepping", () => {
    model.isPlayingProperty.value = true;
    model.seekByFrames(1);
    expect(model.isPlayingProperty.value).toBe(false);
  });

  it("seekToStart pauses and rewinds", () => {
    model.currentTimeProperty.value = 5;
    model.isPlayingProperty.value = true;

    model.seekToStart();

    expect(model.currentTimeProperty.value).toBe(0);
    expect(model.isPlayingProperty.value).toBe(false);
  });
});
