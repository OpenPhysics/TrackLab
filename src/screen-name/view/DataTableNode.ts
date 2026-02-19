/**
 * DataTableNode.ts
 *
 * Panel displaying an Excel-like spreadsheet of all digitized track data.
 *
 * Layout: Grid with columns:
 *   Frame | Time | x(A) | y(A) | x(B) | y(B) | ...
 *
 * Features:
 *   - Scrollable both horizontally and vertically using DOM-based scrolling
 *   - Export button to download data as CSV (export1.csv, export2.csv, ...)
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { DOM, HBox, Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { ButtonNode, Panel, RectangularPushButton } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";
import type { Track } from "../model/Track.js";

// ── Grid geometry ────────────────────────────────────────────────────────────
const MAX_TABLE_WIDTH = 300;
const MAX_TABLE_HEIGHT = 200;

// ── Fonts ────────────────────────────────────────────────────────────────────
const TITLE_FONT = new PhetFont({ size: 12, weight: "bold" });
const TABLE_FONT_SIZE = 11; // HTML table font size in px
const EXPORT_BUTTON_FONT_SIZE = 9;

// ── Precision ─────────────────────────────────────────────────────────────────
const CSV_DECIMAL_PLACES = 4; // decimal places for CSV time and position columns
const CELL_DECIMAL_PLACES = 3; // decimal places shown in on-screen table cells
const MIN_EMPTY_COL_COUNT = 4; // minimum columns (Frame, Time, x, y) when no tracks exist

// ── Panel layout ──────────────────────────────────────────────────────────────
const PANEL_X_MARGIN = 10;
const PANEL_Y_MARGIN = 10;
const CONTENT_SPACING = 6; // gap between title row and table DOM node
const TITLE_ROW_SPACING = 8; // gap between title label and export button
const EXPORT_BUTTON_X_MARGIN = 5;
const EXPORT_BUTTON_Y_MARGIN = 3;
const EXPORT_BUTTON_ICON_SPACING = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

type DataRow = {
  frame: number;
  time: number;
  values: Map<string, { x: number; y: number }>; // track id -> position
};

/**
 * Collect all unique frames across all tracks and build rows of data.
 */
function buildDataRows(tracks: readonly Track[]): DataRow[] {
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

  // Sort by frame number
  return Array.from(frameMap.values()).sort((a, b) => a.frame - b.frame);
}

/**
 * Generate CSV content from tracks.
 */
function generateCSV(
  tracks: readonly Track[],
  unit: string,
  labels: TableLabels,
): string {
  const dataRows = buildDataRows(tracks);

  // Header row
  const headers = [labels.frame, labels.timeSeconds];
  for (const track of tracks) {
    headers.push(`${track.symbol}_x (${unit})`, `${track.symbol}_y (${unit})`);
  }

  const lines = [headers.join(",")];

  // Data rows
  for (const row of dataRows) {
    const cells: string[] = [
      String(row.frame),
      row.time.toFixed(CSV_DECIMAL_PLACES),
    ];
    for (const track of tracks) {
      const val = row.values.get(track.id);
      if (val) {
        cells.push(
          val.x.toFixed(CSV_DECIMAL_PLACES),
          val.y.toFixed(CSV_DECIMAL_PLACES),
        );
      } else {
        cells.push("", "");
      }
    }
    lines.push(cells.join(","));
  }

  return lines.join("\n");
}

// Localized label strings for the HTML table
type TableLabels = {
  frame: string;
  timeSeconds: string;
  noData: string;
};

// Color values for HTML table (cached CSS strings)
type TableColors = {
  headerBg: string;
  headerText: string;
  rowOdd: string;
  rowEven: string;
  gridStroke: string;
  emptyText: string;
  symbolShadow: string;
  background: string;
};

/**
 * Build an HTML table element for the data.
 */
function buildHTMLTable(
  tracks: readonly Track[],
  unit: string,
  colors: TableColors,
  labels: TableLabels,
): HTMLDivElement {
  const dataRows = buildDataRows(tracks);

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    overflow: auto;
    max-width: ${MAX_TABLE_WIDTH}px;
    max-height: ${MAX_TABLE_HEIGHT}px;
    border: 1px solid ${colors.gridStroke};
    border-radius: 3px;
    background: ${colors.background};
  `;

  const table = document.createElement("table");
  table.style.cssText = `
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: ${TABLE_FONT_SIZE}px;
    white-space: nowrap;
  `;

  // ── Header row ─────────────────────────────────────────────────────────────
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const headerStyle = `
    background: ${colors.headerBg};
    color: ${colors.headerText};
    font-weight: bold;
    padding: 4px 8px;
    border: 1px solid ${colors.gridStroke};
    text-align: center;
    position: sticky;
    top: 0;
    z-index: 1;
  `;

  const addHeaderCell = (content: string | HTMLElement) => {
    const th = document.createElement("th");
    if (typeof content === "string") {
      th.textContent = content;
    } else {
      th.appendChild(content);
    }
    th.style.cssText = headerStyle;
    headerRow.appendChild(th);
  };

  /**
   * Create a header cell with colored track symbol.
   * Format: "A x(m)" where A is colored with the track color
   */
  const makeTrackHeader = (varName: string, track: Track): HTMLElement => {
    const span = document.createElement("span");

    // Colored symbol first
    const symbolSpan = document.createElement("span");
    symbolSpan.textContent = track.symbol;
    symbolSpan.style.cssText = `
      color: ${track.color};
      font-weight: bold;
      text-shadow: 0 0 2px ${colors.symbolShadow};
    `;
    span.appendChild(symbolSpan);

    // Variable name and unit
    const varText = document.createTextNode(` ${varName}(${unit})`);
    span.appendChild(varText);

    return span;
  };

  addHeaderCell(labels.frame);
  addHeaderCell(labels.timeSeconds);

  if (tracks.length === 0) {
    // Placeholder columns when no tracks exist
    addHeaderCell(`x (${unit})`);
    addHeaderCell(`y (${unit})`);
  } else {
    for (const track of tracks) {
      addHeaderCell(makeTrackHeader("x", track));
      addHeaderCell(makeTrackHeader("y", track));
    }
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ── Data rows ──────────────────────────────────────────────────────────────
  const tbody = document.createElement("tbody");

  if (dataRows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    // Always at least MIN_EMPTY_COL_COUNT columns: Frame, Time, x, y
    td.colSpan = Math.max(MIN_EMPTY_COL_COUNT, 2 + tracks.length * 2);
    td.textContent = labels.noData;
    td.style.cssText = `
      padding: 8px 16px;
      text-align: center;
      color: ${colors.emptyText};
      font-style: italic;
    `;
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const tr = document.createElement("tr");
      tr.style.background = i % 2 === 0 ? colors.rowOdd : colors.rowEven;

      const cellStyle = `
        padding: 3px 6px;
        border: 1px solid ${colors.gridStroke};
        text-align: center;
      `;

      const addCell = (text: string) => {
        const td = document.createElement("td");
        td.textContent = text;
        td.style.cssText = cellStyle;
        tr.appendChild(td);
      };

      addCell(String(row.frame));
      addCell(row.time.toFixed(CELL_DECIMAL_PLACES));

      for (const track of tracks) {
        const val = row.values.get(track.id);
        if (val) {
          addCell(val.x.toFixed(CELL_DECIMAL_PLACES));
          addCell(val.y.toFixed(CELL_DECIMAL_PLACES));
        } else {
          addCell("—");
          addCell("—");
        }
      }

      tbody.appendChild(tr);
    }
  }

  table.appendChild(tbody);
  wrapper.appendChild(table);

  return wrapper;
}

/**
 * Download icon (simple arrow pointing down).
 */
function makeDownloadIcon(): Node {
  // Simple text-based icon
  return new Text("⬇", {
    font: new PhetFont({ size: 11 }),
    fill: TrackLabColors.textOnDarkProperty,
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export class DataTableNode extends Panel {
  private exportCounter = 1;
  private tableWrapper: HTMLDivElement;
  private tableDOMNode: DOM;

  public constructor(
    model: SimModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    unitProperty: TReadOnlyProperty<string>,
  ) {
    const dataTableStrings = StringManager.getInstance().getDataTable();

    const getLabels = (): TableLabels => ({
      frame: dataTableStrings.frameStringProperty.value,
      timeSeconds: dataTableStrings.timeSecondsStringProperty.value,
      noData: dataTableStrings.noDataStringProperty.value,
    });

    // Helper to get current table colors from properties
    const getTableColors = (): TableColors => ({
      headerBg: TrackLabColors.tableHeaderBackgroundProperty.value.toCSS(),
      headerText: TrackLabColors.tableHeaderTextProperty.value.toCSS(),
      rowOdd: TrackLabColors.tableRowOddProperty.value.toCSS(),
      rowEven: TrackLabColors.tableRowEvenProperty.value.toCSS(),
      gridStroke: TrackLabColors.tableGridStrokeProperty.value.toCSS(),
      emptyText: TrackLabColors.tableEmptyTextProperty.value.toCSS(),
      symbolShadow: TrackLabColors.tableSymbolShadowProperty.value.toCSS(),
      background: TrackLabColors.tableBackgroundProperty.value.toCSS(),
    });

    // ── Create scrollable HTML table ─────────────────────────────────────────
    const tableWrapper = buildHTMLTable([], "m", getTableColors(), getLabels());
    const tableDOMNode = new DOM(tableWrapper, { allowInput: true });

    // ── Export button ────────────────────────────────────────────────────────
    const exportButton = new RectangularPushButton({
      content: new HBox({
        children: [
          makeDownloadIcon(),
          new Text(dataTableStrings.csvStringProperty, {
            font: new PhetFont({ size: EXPORT_BUTTON_FONT_SIZE, weight: "bold" }),
            fill: TrackLabColors.textOnDarkProperty,
          }),
        ],
        spacing: EXPORT_BUTTON_ICON_SPACING,
      }),
      baseColor: TrackLabColors.exportButtonProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      xMargin: EXPORT_BUTTON_X_MARGIN,
      yMargin: EXPORT_BUTTON_Y_MARGIN,
      listener: () => {
        const tracks = model.tracksProperty.value;
        const unit = unitProperty.value;
        const csv = generateCSV(tracks, unit, getLabels());

        // Create download
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `export${this.exportCounter}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.exportCounter++;
      },
    });

    // ── Title row ────────────────────────────────────────────────────────────
    const titleLabel = new Text(dataTableStrings.titleStringProperty, {
      font: TITLE_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });

    const titleRow = new HBox({
      children: [titleLabel, exportButton],
      spacing: TITLE_ROW_SPACING,
      align: "center",
    });

    // ── Main content ─────────────────────────────────────────────────────────
    const content = new VBox({
      children: [titleRow, tableDOMNode],
      spacing: CONTENT_SPACING,
      align: "left",
    });

    super(content, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: PANEL_CORNER_RADIUS,
      xMargin: PANEL_X_MARGIN,
      yMargin: PANEL_Y_MARGIN,
      visible: false,
    });

    this.tableWrapper = tableWrapper;
    this.tableDOMNode = tableDOMNode;

    // ── Rebuild table function ───────────────────────────────────────────────
    const rebuildTable = () => {
      const tracks = model.tracksProperty.value;
      const unit = unitProperty.value;

      // Build new table with current colors and labels
      const newWrapper = buildHTMLTable(
        tracks,
        unit,
        getTableColors(),
        getLabels(),
      );

      // Replace the content
      this.tableWrapper.innerHTML = "";
      this.tableWrapper.appendChild(newWrapper.firstChild!);

      // Copy styles
      this.tableWrapper.style.cssText = newWrapper.style.cssText;
    };

    // ── Reactive updates ─────────────────────────────────────────────────────
    model.tracksProperty.link(rebuildTable);
    unitProperty.link(rebuildTable);

    // Rebuild table when color profile or locale changes
    TrackLabColors.tableHeaderBackgroundProperty.lazyLink(rebuildTable);
    dataTableStrings.frameStringProperty.lazyLink(rebuildTable);

    videoLoadedProperty.link((loaded) => {
      this.visible = loaded;
    });
  }
}
