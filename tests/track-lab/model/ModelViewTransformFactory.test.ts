import { type Transform3, Vector2 } from "scenerystack/dot";
import { describe, expect, it } from "vitest";
import { buildModelViewTransform } from "../../../src/track-lab/model/ModelViewTransformFactory.js";
import { TrackingModel } from "../../../src/track-lab/model/TrackingModel.js";

/** 100 px maps to 1 model unit, origin at (100, 100), no rotation. */
function standardTransform(): Transform3 {
  return buildModelViewTransform(new Vector2(100, 100), 0, new Vector2(0, 0), new Vector2(100, 0), 1);
}

describe("buildModelViewTransform", () => {
  it("places the model origin at the coordinate-system position", () => {
    const mvt = standardTransform();
    const pixel = mvt.transformPosition2(new Vector2(0, 0));

    expect(pixel.x).toBeCloseTo(100);
    expect(pixel.y).toBeCloseTo(100);
  });

  it("scales model units to pixels using the calibration length", () => {
    const mvt = standardTransform();
    const pixel = mvt.transformPosition2(new Vector2(2, 0));

    expect(pixel.x).toBeCloseTo(300); // 100 px origin + 2 units x 100 px/unit
  });

  it("flips y so that model +y points up the screen", () => {
    const mvt = standardTransform();
    const pixel = mvt.transformPosition2(new Vector2(0, 1));

    // Screen y grows downward, so a positive model y lands above the origin.
    expect(pixel.y).toBeCloseTo(0);
  });

  it("round-trips a pixel through inverse and forward transforms", () => {
    const mvt = buildModelViewTransform(new Vector2(37, 91), 0.7, new Vector2(10, 20), new Vector2(150, 60), 2.5);
    const pixel = new Vector2(400, 250);

    const roundTripped = mvt.transformPosition2(mvt.inversePosition2(pixel));

    expect(roundTripped.x).toBeCloseTo(pixel.x);
    expect(roundTripped.y).toBeCloseTo(pixel.y);
  });

  it("returns identity when the calibration segment has zero length", () => {
    const mvt = buildModelViewTransform(new Vector2(50, 50), 0, new Vector2(10, 10), new Vector2(10, 10), 1);
    const pixel = mvt.transformPosition2(new Vector2(7, 8));

    expect(pixel.x).toBeCloseTo(7);
    expect(pixel.y).toBeCloseTo(8);
  });

  it("returns identity when the calibration distance is degenerate", () => {
    const mvt = buildModelViewTransform(new Vector2(50, 50), 0, new Vector2(0, 0), new Vector2(100, 0), 0);
    const pixel = mvt.transformPosition2(new Vector2(7, 8));

    expect(pixel.x).toBeCloseTo(7);
    expect(pixel.y).toBeCloseTo(8);
  });
});

describe("retransformTrackPoints", () => {
  it("keeps every digitized point pinned to the same video pixel", () => {
    const model = new TrackingModel();
    model.addTrack();

    const oldMvt = standardTransform();
    // Digitize three points expressed in the OLD transform's model coordinates.
    const originalPixels = [new Vector2(150, 120), new Vector2(300, 400), new Vector2(20, 60)];
    originalPixels.forEach((pixel, i) => {
      const modelPt = oldMvt.inversePosition2(pixel);
      model.addOrReplacePointOnTrack("track-A", i, i, modelPt.x, modelPt.y);
    });

    // Move the origin, rotate the axes, and rescale the calibration.
    const newMvt = buildModelViewTransform(new Vector2(250, 60), 0.4, new Vector2(0, 0), new Vector2(37, 0), 3);
    model.retransformTrackPoints(oldMvt, newMvt);

    const points = model.tracksProperty.value[0]?.points ?? [];
    expect(points).toHaveLength(3);
    points.forEach((pt, i) => {
      const pixel = newMvt.transformPosition2(new Vector2(pt.x, pt.y));
      expect(pixel.x).toBeCloseTo(originalPixels[i]?.x ?? Number.NaN);
      expect(pixel.y).toBeCloseTo(originalPixels[i]?.y ?? Number.NaN);
    });
  });

  it("leaves frame and time untouched", () => {
    const model = new TrackingModel();
    model.addTrack();
    model.addOrReplacePointOnTrack("track-A", 7, 0.25, 1, 1);

    model.retransformTrackPoints(
      standardTransform(),
      buildModelViewTransform(new Vector2(0, 0), 1, new Vector2(0, 0), new Vector2(50, 0), 1),
    );

    const point = model.tracksProperty.value[0]?.points[0];
    expect(point?.frame).toBe(7);
    expect(point?.time).toBe(0.25);
  });
});
