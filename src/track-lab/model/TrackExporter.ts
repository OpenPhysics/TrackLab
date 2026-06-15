/**
 * TrackExporter.ts
 *
 * Pure functions for building CSV exports from digitized track data.
 * Extracted from DataTableNode so the export logic lives in the model layer
 * and can be reused independently of the view.
 */

import { toFixed } from "scenerystack/dot";
import type { Track } from "./Track.js";

const CSV_DECIMAL_PLACES = 4;

export type DataRow = {
  frame: number;
  time: number;
  values: Map<string, { x: number; y: number }>; // track id → position
};

export type CsvLabels = {
  frame: string;
  timeSeconds: string;
};

/**
 * Collect all unique frames across all tracks and build rows of data,
 * sorted ascending by frame number.
 */
export function buildDataRows(tracks: readonly Track[]): DataRow[] {
  const frameMap = new Map<number, DataRow>();

  for (const track of tracks) {
    for (const pt of track.points) {
      let row = frameMap.get(pt.frame);
      if (!row) {
        row = { frame: pt.frame, time: pt.time, values: new Map() };
        frameMap.set(pt.frame, row);
      }
      row.values.set(track.id, { x: pt.x, y: pt.y });
    }
  }

  return Array.from(frameMap.values()).sort((a, b) => a.frame - b.frame);
}

/**
 * Generate CSV text from tracks.
 *
 * @param tracks - All tracks to include.
 * @param unit - Display unit string (e.g. "m", "cm") for column headers.
 * @param labels - Localized column header strings.
 */
export function generateCsv(tracks: readonly Track[], unit: string, labels: CsvLabels): string {
  const dataRows = buildDataRows(tracks);

  const headers = [labels.frame, labels.timeSeconds];
  for (const track of tracks) {
    headers.push(`x_${track.symbol} (${unit})`, `y_${track.symbol} (${unit})`);
  }

  const lines = [headers.join(",")];

  for (const row of dataRows) {
    const cells: string[] = [String(row.frame), toFixed(row.time, CSV_DECIMAL_PLACES)];
    for (const track of tracks) {
      const val = row.values.get(track.id);
      if (val) {
        cells.push(toFixed(val.x, CSV_DECIMAL_PLACES), toFixed(val.y, CSV_DECIMAL_PLACES));
      } else {
        cells.push("", "");
      }
    }
    lines.push(cells.join(","));
  }

  return lines.join("\n");
}
