/**
 * TableRenderer — owns all HTML DOM construction and incremental update state
 * for the kinematics data table.
 *
 * Extracted from DataTableNode so that the SceneryStack node stays focused on
 * framework integration (Panel, drag listeners, resize handles) while this
 * class handles the messy DOM details.
 *
 * ## Responsibilities
 *   - Build the initial scrollable wrapper + `<table>` DOM structure
 *   - Decide on each update whether a full structural rebuild is needed or
 *     whether only new rows need to be appended (incremental path)
 *   - Own the state that tracks that decision: lastTrackIds, lastUnit,
 *     tableBodyRef, frameRowMap, maxRenderedFrame
 *   - Apply user-set max-width / max-height dimensions to the wrapper CSS
 *
 * ## Update strategy
 *
 * `update()` is called ~30 times/s during auto-tracking, so the incremental
 * path (appending only new `<tr>` elements) is critical for performance.
 * A full rebuild is triggered only when the table's structure changes:
 * tracks added/removed, unit change, color-theme change, or locale change.
 */

import { toFixed } from "scenerystack/dot";
import { TRACK_COLORS } from "../../TrackLabColors.js";
import { DATA_DECIMAL_PLACES } from "../../TrackLabConstants.js";
import type { Track } from "../model/Track.js";
import { buildDataRows, type DataRow } from "../model/TrackExporter.js";

// ── Grid geometry ─────────────────────────────────────────────────────────────
export const MAX_TABLE_WIDTH = 400;
export const MIN_TABLE_HEIGHT = 100;
export const MAX_TABLE_HEIGHT = 220;

// ── Precision ─────────────────────────────────────────────────────────────────
const MIN_EMPTY_COL_COUNT = 4;

// ── CSS dimensions ────────────────────────────────────────────────────────────
const TABLE_FONT_SIZE = 11;
const TABLE_WRAPPER_BORDER_RADIUS = 3;
const TABLE_HEADER_PADDING_Y = 4;
const TABLE_HEADER_PADDING_X = 8;
const TABLE_EMPTY_CELL_PADDING_Y = 8;
const TABLE_EMPTY_CELL_PADDING_X = 16;
const TABLE_CELL_PADDING_Y = 3;
const TABLE_CELL_PADDING_X = 6;

// ── Public types re-exported for DataTableNode ────────────────────────────────

export type TableColors = {
  headerBg: string;
  headerText: string;
  rowOdd: string;
  rowEven: string;
  gridStroke: string;
  emptyText: string;
  symbolShadow: string;
  background: string;
};

export type TableLabels = {
  frame: string;
  timeSeconds: string;
  noData: string;
};

export type A11yLabels = {
  tableCaption: string;
};

// ── Private helpers ───────────────────────────────────────────────────────────

function makeCellStyle(colors: TableColors): string {
  return `padding: ${TABLE_CELL_PADDING_Y}px ${TABLE_CELL_PADDING_X}px; border: 1px solid ${colors.gridStroke}; text-align: center;`;
}

function buildHtmlTable(
  tracks: readonly Track[],
  unit: string,
  colors: TableColors,
  labels: TableLabels,
  a11y: A11yLabels,
  maxWidth: number,
  maxHeight: number,
): HTMLDivElement {
  const dataRows = buildDataRows(tracks);

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    overflow: auto;
    width: max-content;
    max-width: ${maxWidth}px;
    min-height: ${MIN_TABLE_HEIGHT}px;
    max-height: ${maxHeight}px;
    border: 1px solid ${colors.gridStroke};
    border-radius: ${TABLE_WRAPPER_BORDER_RADIUS}px;
    background: ${colors.background};
  `;

  const table = document.createElement("table");
  table.style.cssText = `
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: ${TABLE_FONT_SIZE}px;
    white-space: nowrap;
  `;

  // Accessible caption (visually hidden)
  const caption = document.createElement("caption");
  caption.textContent = a11y.tableCaption;
  caption.style.cssText =
    "position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;";
  table.appendChild(caption);

  // ── Header ────────────────────────────────────────────────────────────────
  const headerStyle = `
    background: ${colors.headerBg};
    color: ${colors.headerText};
    font-weight: bold;
    padding: ${TABLE_HEADER_PADDING_Y}px ${TABLE_HEADER_PADDING_X}px;
    border: 1px solid ${colors.gridStroke};
    text-align: center;
    position: sticky;
    top: 0;
    z-index: 1;
  `;

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const addHeaderCell = (content: string | HTMLElement, fullLabel?: string) => {
    const th = document.createElement("th");
    th.scope = "col";
    if (typeof content === "string") {
      th.textContent = content;
    } else {
      th.appendChild(content);
      if (fullLabel) {
        th.setAttribute("aria-label", fullLabel);
      }
    }
    th.style.cssText = headerStyle;
    headerRow.appendChild(th);
  };

  const makeTrackHeader = (varName: string, track: Track): HTMLElement => {
    const span = document.createElement("span");
    span.appendChild(document.createTextNode(varName));
    const sub = document.createElement("sub");
    const symbolSpan = document.createElement("span");
    symbolSpan.textContent = track.symbol;
    symbolSpan.style.cssText = `
      color: ${TRACK_COLORS[track.colorIndex]?.toCSS() ?? "#000000"};
      font-weight: bold;
      text-shadow: 0 0 2px ${colors.symbolShadow};
    `;
    sub.appendChild(symbolSpan);
    span.appendChild(sub);
    span.appendChild(document.createTextNode(`(${unit})`));
    return span;
  };

  addHeaderCell(labels.frame);
  addHeaderCell(labels.timeSeconds);
  if (tracks.length === 0) {
    addHeaderCell(`x (${unit})`);
    addHeaderCell(`y (${unit})`);
  } else {
    for (const track of tracks) {
      addHeaderCell(makeTrackHeader("x", track), `x_${track.symbol} (${unit})`);
      addHeaderCell(makeTrackHeader("y", track), `y_${track.symbol} (${unit})`);
    }
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ── Data rows ─────────────────────────────────────────────────────────────
  const tbody = document.createElement("tbody");
  if (dataRows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = Math.max(MIN_EMPTY_COL_COUNT, 2 + tracks.length * 2);
    td.textContent = labels.noData;
    td.style.cssText = `
      padding: ${TABLE_EMPTY_CELL_PADDING_Y}px ${TABLE_EMPTY_CELL_PADDING_X}px;
      text-align: center;
      color: ${colors.emptyText};
      font-style: italic;
    `;
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row) {
        continue;
      }
      tbody.appendChild(buildDataRow(row, tracks, makeCellStyle(colors), i % 2 !== 0, colors));
    }
  }
  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function buildDataRow(
  row: DataRow,
  tracks: readonly Track[],
  cellStyle: string,
  isEven: boolean,
  colors: TableColors,
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.style.background = isEven ? colors.rowEven : colors.rowOdd;

  const addCell = (text: string) => {
    const td = document.createElement("td");
    td.textContent = text;
    td.style.cssText = cellStyle;
    tr.appendChild(td);
  };

  addCell(String(row.frame));
  addCell(toFixed(row.time, DATA_DECIMAL_PLACES));
  for (const track of tracks) {
    const val = row.values.get(track.id);
    if (val) {
      addCell(toFixed(val.x, DATA_DECIMAL_PLACES));
      addCell(toFixed(val.y, DATA_DECIMAL_PLACES));
    } else {
      addCell("—");
      addCell("—");
    }
  }
  return tr;
}

// ── TableRenderer ─────────────────────────────────────────────────────────────

export class TableRenderer {
  /** The scrollable wrapper div — embed this in a Scenery DOM node. */
  public readonly wrapper: HTMLDivElement;

  // ── Incremental-update state ───────────────────────────────────────────────
  private lastTrackIds: string[] = [];
  private lastUnit: string = "";
  private tableBodyRef: HTMLTableSectionElement | null = null;
  private readonly frameRowMap: Map<number, HTMLTableRowElement> = new Map();
  private maxRenderedFrame: number = -Infinity;

  // ── Dimension state ────────────────────────────────────────────────────────
  private currentMaxWidth: number;
  private currentMaxHeight: number;

  public constructor(initialColors: TableColors, initialLabels: TableLabels, initialA11y: A11yLabels) {
    this.currentMaxWidth = MAX_TABLE_WIDTH;
    this.currentMaxHeight = MAX_TABLE_HEIGHT;
    this.wrapper = buildHtmlTable(
      [],
      "m",
      initialColors,
      initialLabels,
      initialA11y,
      this.currentMaxWidth,
      this.currentMaxHeight,
    );
  }

  /** Apply user-set max-width / max-height to the wrapper CSS. */
  public applyDimensions(maxWidth: number, maxHeight: number): void {
    this.currentMaxWidth = maxWidth;
    this.currentMaxHeight = maxHeight;
    this.wrapper.style.maxWidth = `${maxWidth}px`;
    this.wrapper.style.maxHeight = `${maxHeight}px`;
  }

  /** Current user-set max width. */
  public getMaxWidth(): number {
    return this.currentMaxWidth;
  }

  /** Current user-set max height. */
  public getMaxHeight(): number {
    return this.currentMaxHeight;
  }

  /**
   * Full structural rebuild — replaces the entire table DOM.
   * Must be called when tracks are added/removed, unit changes,
   * color theme changes, or locale changes.
   */
  public rebuild(
    tracks: readonly Track[],
    unit: string,
    colors: TableColors,
    labels: TableLabels,
    a11y: A11yLabels,
  ): void {
    const newWrapper = buildHtmlTable(tracks, unit, colors, labels, a11y, this.currentMaxWidth, this.currentMaxHeight);

    this.wrapper.innerHTML = "";
    if (newWrapper.firstChild) {
      this.wrapper.appendChild(newWrapper.firstChild);
    }
    // Copy styles (including dynamic height), then restore user-resized dimensions.
    this.wrapper.style.cssText = newWrapper.style.cssText;
    this.wrapper.style.maxWidth = `${this.currentMaxWidth}px`;
    this.wrapper.style.maxHeight = `${this.currentMaxHeight}px`;

    // Rebuild cached references from the new DOM.
    const tbody = this.wrapper.querySelector("tbody");
    this.tableBodyRef = tbody instanceof HTMLTableSectionElement ? tbody : null;
    this.frameRowMap.clear();
    this.maxRenderedFrame = -Infinity;

    if (this.tableBodyRef) {
      const dataRows = buildDataRows(tracks);
      const trs = Array.from(this.tableBodyRef.querySelectorAll("tr"));
      dataRows.forEach((row, i) => {
        const tr = trs[i];
        if (tr instanceof HTMLTableRowElement) {
          this.frameRowMap.set(row.frame, tr);
          if (row.frame > this.maxRenderedFrame) {
            this.maxRenderedFrame = row.frame;
          }
        }
      });
    }

    this.lastTrackIds = tracks.map((t) => t.id);
    this.lastUnit = unit;
  }

  /**
   * Smart update — performs a full rebuild on structural changes
   * (track added/removed, unit or colour change) and an incremental
   * row-append on data-only changes (new points on existing tracks).
   *
   * During auto-tracking this is called ~30 times/s, so avoiding
   * unnecessary full DOM rebuilds is critical.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: intentionally complex — must handle structural and incremental updates efficiently
  public update(
    tracks: readonly Track[],
    unit: string,
    colors: TableColors,
    labels: TableLabels,
    a11y: A11yLabels,
  ): void {
    const trackIds = tracks.map((t) => t.id);

    const isStructural =
      unit !== this.lastUnit ||
      trackIds.length !== this.lastTrackIds.length ||
      trackIds.some((id, i) => id !== this.lastTrackIds[i]);

    if (isStructural || !this.tableBodyRef) {
      this.rebuild(tracks, unit, colors, labels, a11y);
      return;
    }

    // ── Incremental path: same track structure, only new points ──────────────
    const dataRows = buildDataRows(tracks);

    // If any new row precedes the last rendered frame the sort order breaks;
    // fall back to full rebuild (rare: out-of-order manual digitizing).
    const hasOutOfOrder = dataRows.some((row) => !this.frameRowMap.has(row.frame) && row.frame < this.maxRenderedFrame);
    if (hasOutOfOrder) {
      this.rebuild(tracks, unit, colors, labels, a11y);
      return;
    }

    const cellStyle = makeCellStyle(colors);

    // Remove the "no data" placeholder row when the first real rows arrive.
    if (this.frameRowMap.size === 0 && dataRows.length > 0) {
      this.tableBodyRef.innerHTML = "";
    }

    for (const row of dataRows) {
      const tr = this.frameRowMap.get(row.frame);
      if (tr !== undefined) {
        // Update cells in an existing row (a second track filled in this frame).
        const cells = tr.querySelectorAll("td");
        let cellIdx = 2; // skip Frame and Time
        for (const track of tracks) {
          const val = row.values.get(track.id);
          const xCell = cells[cellIdx];
          const yCell = cells[cellIdx + 1];
          if (xCell) {
            xCell.textContent = val ? toFixed(val.x, DATA_DECIMAL_PLACES) : "—";
          }
          if (yCell) {
            yCell.textContent = val ? toFixed(val.y, DATA_DECIMAL_PLACES) : "—";
          }
          cellIdx += 2;
        }
      } else {
        // Append a brand-new row.
        const rowIndex = this.frameRowMap.size;
        const newRow = buildDataRow(row, tracks, cellStyle, rowIndex % 2 !== 0, colors);
        this.tableBodyRef.appendChild(newRow);
        this.frameRowMap.set(row.frame, newRow);
        if (row.frame > this.maxRenderedFrame) {
          this.maxRenderedFrame = row.frame;
        }
      }
    }
  }
}
