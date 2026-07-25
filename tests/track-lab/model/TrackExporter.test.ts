import { describe, expect, it } from "vitest";
import type { Track } from "../../../src/track-lab/model/Track.js";
import { buildDataRows, generateCsv } from "../../../src/track-lab/model/TrackExporter.js";

const LABELS = { frame: "Frame", timeSeconds: "t (s)" };

function track(id: string, symbol: string, points: Array<[number, number, number, number]>): Track {
  return {
    id,
    symbol,
    colorIndex: 0,
    points: points.map(([frame, time, x, y]) => ({ frame, time, x, y })),
  };
}

describe("buildDataRows", () => {
  it("returns no rows when there are no tracks", () => {
    expect(buildDataRows([])).toEqual([]);
  });

  it("returns no rows when tracks carry no points", () => {
    expect(buildDataRows([track("track-A", "A", [])])).toEqual([]);
  });

  it("sorts rows ascending by frame regardless of insertion order", () => {
    const a = track("track-A", "A", [
      [5, 0.5, 1, 1],
      [0, 0, 2, 2],
      [3, 0.3, 3, 3],
    ]);

    expect(buildDataRows([a]).map((r) => r.frame)).toEqual([0, 3, 5]);
  });

  it("merges two tracks that share a frame into one row", () => {
    const a = track("track-A", "A", [[2, 0.2, 1, 1]]);
    const b = track("track-B", "B", [[2, 0.2, 9, 9]]);

    const rows = buildDataRows([a, b]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.values.get("track-A")).toEqual({ x: 1, y: 1 });
    expect(rows[0]?.values.get("track-B")).toEqual({ x: 9, y: 9 });
  });

  it("keeps frames that only one track recorded", () => {
    const a = track("track-A", "A", [
      [0, 0, 1, 1],
      [1, 0.1, 2, 2],
    ]);
    const b = track("track-B", "B", [[1, 0.1, 8, 8]]);

    const rows = buildDataRows([a, b]);

    expect(rows.map((r) => r.frame)).toEqual([0, 1]);
    expect(rows[0]?.values.has("track-B")).toBe(false);
  });
});

describe("generateCsv", () => {
  it("emits a header per track and one line per frame", () => {
    const a = track("track-A", "A", [
      [0, 0, 1, 2],
      [1, 0.5, 3, 4],
    ]);

    const lines = generateCsv([a], "m", LABELS).split("\n");

    expect(lines[0]).toBe("Frame,t (s),x_A (m),y_A (m)");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("0,0.0000,1.0000,2.0000");
  });

  it("leaves cells empty for a track with no point at that frame", () => {
    const a = track("track-A", "A", [[0, 0, 1, 2]]);
    const b = track("track-B", "B", [[1, 0.5, 3, 4]]);

    const lines = generateCsv([a, b], "cm", LABELS).split("\n");

    // Frame 0: track A has data, track B does not.
    expect(lines[1]).toBe("0,0.0000,1.0000,2.0000,,");
    // Frame 1: the reverse.
    expect(lines[2]).toBe("1,0.5000,,,3.0000,4.0000");
  });

  it("emits only the header row when there is no data", () => {
    expect(generateCsv([], "m", LABELS)).toBe("Frame,t (s)");
  });
});
