/**
 * DataTableNode.ts
 *
 * Panel displaying an Excel-like spreadsheet of all digitized track data.
 *
 * Layout: Grid with columns:
 *   Frame | Time | x_A(m) | y_A(m) | x_B(m) | y_B(m) | ...
 *
 * Features:
 *   - Scrollable both horizontally and vertically using DOM-based scrolling
 *   - Export button to download data as CSV (export1.csv, export2.csv, ...)
 */

import { BooleanProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { DOM, DragListener, HBox, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Panel } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import { createTrackLabButton, makeDownloadIcon } from "../../TrackLabButton.js";
import TrackLabColors, { TRACK_COLORS } from "../../TrackLabColors.js";
import { PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import type { Track } from "../model/Track.js";
import { buildDataRows, type DataRow, generateCsv } from "../model/TrackExporter.js";
import type { TrackingModel } from "../model/TrackingModel.js";

// ── Accessibility ─────────────────────────────────────────────────────────────
// The HTML table gets a <caption> element for screen readers. The caption text
// is supplied by the caller so it can be localized.
type A11yLabels = {
  tableCaption: string;
};

// ── Grid geometry ────────────────────────────────────────────────────────────
// Scroll kicks in once the table exceeds these dimensions:
//   width  → beyond track B columns (Frame, Time, x(A), y(A), x(B), y(B))
//   height → beyond 10 data rows
const MAX_TABLE_WIDTH = 400; // px — approx. 6 columns before horizontal scroll
const MIN_TABLE_HEIGHT = 100; // Minimum height when little data
const MAX_TABLE_HEIGHT = 220; // px — approx. 10 rows before vertical scroll

// ── Fonts ────────────────────────────────────────────────────────────────────
const TITLE_FONT = new PhetFont({ size: 12, weight: "bold" });
const TABLE_FONT_SIZE = 11; // HTML table font size in px
const EXPORT_BUTTON_FONT_SIZE = 9;

// ── Precision ─────────────────────────────────────────────────────────────────
// Both values are kept equal so exported CSV data matches what users see on screen.
const CELL_DECIMAL_PLACES = 4; // decimal places shown in on-screen table cells
const MIN_EMPTY_COL_COUNT = 4; // minimum columns (Frame, Time, x, y) when no tracks exist

// ── Panel layout ──────────────────────────────────────────────────────────────
const PANEL_X_MARGIN = 10;
const PANEL_Y_MARGIN = 10;
const CONTENT_SPACING = 6; // gap between title row and table DOM node
const TITLE_ROW_SPACING = 8; // gap between title label and export button
const EXPORT_BUTTON_ICON_SPACING = 3;

// ── Resize handle geometry ────────────────────────────────────────────────────
const HANDLE_SIZE = 12;
const HANDLE_OFFSET = -6; // centers the 12px handle on each corner
const RESIZE_TOUCH_DILATION = 6;
const RESIZE_MOUSE_DILATION = 4;
const MIN_TABLE_RESIZE_WIDTH = 200; // minimum table max-width during resize
const MIN_TABLE_RESIZE_HEIGHT = 80; // minimum table max-height during resize

// ── HTML table CSS dimensions ─────────────────────────────────────────────────
const TABLE_WRAPPER_BORDER_RADIUS = 3; // px, border-radius on the scroll wrapper
const TABLE_HEADER_PADDING_Y = 4; // px, vertical padding in header cells
const TABLE_HEADER_PADDING_X = 8; // px, horizontal padding in header cells
const TABLE_EMPTY_CELL_PADDING_Y = 8; // px, vertical padding in the "no data" placeholder cell
const TABLE_EMPTY_CELL_PADDING_X = 16; // px, horizontal padding in the "no data" placeholder cell
const TABLE_CELL_PADDING_Y = 3; // px, vertical padding in data cells
const TABLE_CELL_PADDING_X = 6; // px, horizontal padding in data cells

// ── Helpers ──────────────────────────────────────────────────────────────────
// DataRow, buildDataRows, and generateCsv are imported from TrackExporter.

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
 * Height adjusts based on row count, with min/max constraints.
 */
function buildHtmlTable(
  tracks: readonly Track[],
  unit: string,
  colors: TableColors,
  labels: TableLabels,
  a11y: A11yLabels,
): HTMLDivElement {
  const dataRows = buildDataRows(tracks);

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    overflow: auto;
    width: max-content;
    max-width: ${MAX_TABLE_WIDTH}px;
    min-height: ${MIN_TABLE_HEIGHT}px;
    max-height: ${MAX_TABLE_HEIGHT}px;
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

  // ── Accessible caption (visually hidden but read by screen readers) ────────
  const caption = document.createElement("caption");
  caption.textContent = a11y.tableCaption;
  caption.style.cssText =
    "position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;";
  table.appendChild(caption);

  // ── Header row ─────────────────────────────────────────────────────────────
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

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

  const addHeaderCell = (content: string | HTMLElement, fullLabel?: string) => {
    const th = document.createElement("th");
    th.scope = "col";
    if (typeof content === "string") {
      th.textContent = content;
    } else {
      th.appendChild(content);
      // Provide a plain-text aria-label when the header content is HTML (colored symbol)
      if (fullLabel) {
        th.setAttribute("aria-label", fullLabel);
      }
    }
    th.style.cssText = headerStyle;
    headerRow.appendChild(th);
  };

  /**
   * Create a header cell with colored track symbol as a subscript.
   * Format: "x_A(m)" where _A is rendered as a <sub> colored with the track color.
   */
  const makeTrackHeader = (varName: string, track: Track): HTMLElement => {
    const span = document.createElement("span");

    // Variable name first
    span.appendChild(document.createTextNode(varName));

    // Colored subscript symbol
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

    // Unit
    span.appendChild(document.createTextNode(`(${unit})`));

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
      addHeaderCell(makeTrackHeader("x", track), `x_${track.symbol} (${unit})`);
      addHeaderCell(makeTrackHeader("y", track), `y_${track.symbol} (${unit})`);
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
      const tr = document.createElement("tr");
      tr.style.background = i % 2 === 0 ? colors.rowOdd : colors.rowEven;

      const cellStyle = `
        padding: ${TABLE_CELL_PADDING_Y}px ${TABLE_CELL_PADDING_X}px;
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
 * Build a single `<tr>` for a data row.
 * Used by the incremental-update path to avoid rebuilding the whole table.
 */
function buildSingleDataRow(
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

  return tr;
}

// ── Component ────────────────────────────────────────────────────────────────

export class DataTableNode extends Panel {
  private exportCounter = 1;
  private tableWrapper: HTMLDivElement;
  private readonly disposeDataTable: () => void;

  // ── Resize state ─────────────────────────────────────────────────────────
  private currentMaxWidth = MAX_TABLE_WIDTH;
  private currentMaxHeight = MAX_TABLE_HEIGHT;
  private readonly isResizingProperty = new BooleanProperty(false);
  private readonly resizeHandles: Rectangle[] = [];

  // ── Incremental-update state ─────────────────────────────────────────────
  // Tracks whether the table needs a full structural rebuild or just new rows.
  private lastTrackIds: string[] = [];
  private lastUnit: string = "";
  private tableBodyRef: HTMLTableSectionElement | null = null;
  private readonly frameRowMap: Map<number, HTMLTableRowElement> = new Map();
  private maxRenderedFrame: number = -Infinity;

  public constructor(
    tracking: TrackingModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    unitProperty: TReadOnlyProperty<string>,
  ) {
    const dataTableStrings = StringManager.getInstance().getDataTable();
    const a11yStrings = StringManager.getInstance().getA11y();

    const getLabels = (): TableLabels => ({
      frame: dataTableStrings.frameStringProperty.value,
      timeSeconds: dataTableStrings.timeSecondsStringProperty.value,
      noData: dataTableStrings.noDataStringProperty.value,
    });

    const getA11yLabels = (): A11yLabels => ({
      tableCaption: a11yStrings.dataTableStringProperty.value,
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
    const tableWrapper = buildHtmlTable([], "m", getTableColors(), getLabels(), getA11yLabels());
    const tableDomNode = new DOM(tableWrapper, { allowInput: true });

    // Notify Scenery whenever the wrapper's layout dimensions change so the
    // Panel reflows to match the growing/shrinking table content.
    const resizeObserver = new ResizeObserver(() => {
      tableDomNode.invalidateDOM();
    });
    resizeObserver.observe(tableWrapper);

    // ── Export button ────────────────────────────────────────────────────────
    const exportButton = createTrackLabButton(
      new HBox({
        children: [
          makeDownloadIcon(),
          new Text(dataTableStrings.csvStringProperty, {
            font: new PhetFont({
              size: EXPORT_BUTTON_FONT_SIZE,
              weight: "bold",
            }),
            fill: TrackLabColors.textOnDarkProperty,
          }),
        ],
        spacing: EXPORT_BUTTON_ICON_SPACING,
      }),
      {
        accessibleName: a11yStrings.exportCSVStringProperty,
        baseColor: TrackLabColors.exportButtonProperty,
        listener: () => {
          const tracks = tracking.tracksProperty.value;
          const unit = unitProperty.value;
          const csv = generateCsv(tracks, unit, getLabels());

          // Create download — no DOM insertion needed in modern browsers.
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `export${this.exportCounter}.csv`;
          link.click();
          URL.revokeObjectURL(url);

          this.exportCounter++;
        },
      },
    );

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
      children: [titleRow, tableDomNode],
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

    // ── Full rebuild helper ──────────────────────────────────────────────────
    // Replaces the entire table DOM and refreshes cached references.
    const doFullRebuild = (tracks: readonly Track[], unit: string) => {
      const colors = getTableColors();
      const newWrapper = buildHtmlTable(tracks, unit, colors, getLabels(), getA11yLabels());

      this.tableWrapper.innerHTML = "";
      if (newWrapper.firstChild) {
        this.tableWrapper.appendChild(newWrapper.firstChild);
      }
      // Copy all styles including the dynamic height
      this.tableWrapper.style.cssText = newWrapper.style.cssText;
      // Restore user-resized dimensions (cssText above resets them to the defaults)
      this.tableWrapper.style.maxWidth = `${this.currentMaxWidth}px`;
      this.tableWrapper.style.maxHeight = `${this.currentMaxHeight}px`;

      // Cache <tbody> reference and rebuild the frame→row map.
      const tbody = this.tableWrapper.querySelector("tbody");
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
    };

    // ── Rebuild table function ───────────────────────────────────────────────
    // Performs a full rebuild on structural changes (track added/removed, unit
    // or colour change) and an incremental row-append on data-only changes
    // (new points added to existing tracks).  During auto-tracking this fires
    // ~30 times/s, so avoiding unnecessary full DOM rebuilds is critical.
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: intentionally complex — must handle structural and incremental updates efficiently
    const rebuildTable = () => {
      const tracks = tracking.tracksProperty.value;
      const unit = unitProperty.value;
      const trackIds = tracks.map((t) => t.id);

      const isStructural =
        unit !== this.lastUnit ||
        trackIds.length !== this.lastTrackIds.length ||
        trackIds.some((id, i) => id !== this.lastTrackIds[i]);

      if (isStructural || !this.tableBodyRef) {
        doFullRebuild(tracks, unit);
        return;
      }

      // ── Incremental path: same track structure, only new points ────────────
      const dataRows = buildDataRows(tracks);

      // If any new row would be inserted before an already-rendered row the
      // sort order of the table would break; fall back to full rebuild in that
      // rare case (out-of-order manual digitizing on an earlier frame).
      const hasOutOfOrder = dataRows.some(
        (row) => !this.frameRowMap.has(row.frame) && row.frame < this.maxRenderedFrame,
      );
      if (hasOutOfOrder) {
        doFullRebuild(tracks, unit);
        return;
      }

      const colors = getTableColors();
      const cellStyle = `padding: ${TABLE_CELL_PADDING_Y}px ${TABLE_CELL_PADDING_X}px; border: 1px solid ${colors.gridStroke}; text-align: center;`;

      // Remove the "no data" placeholder row when the first real rows arrive.
      if (this.frameRowMap.size === 0 && dataRows.length > 0) {
        this.tableBodyRef.innerHTML = "";
      }

      for (const row of dataRows) {
        const tr = this.frameRowMap.get(row.frame);
        if (tr !== undefined) {
          // Update cells in an existing row (a second track filled in this frame).
          const cells = tr.querySelectorAll("td");
          let cellIdx = 2; // skip Frame and Time columns
          for (const track of tracks) {
            const val = row.values.get(track.id);
            const xCell = cells[cellIdx];
            const yCell = cells[cellIdx + 1];
            if (xCell) {
              xCell.textContent = val ? val.x.toFixed(CELL_DECIMAL_PLACES) : "—";
            }
            if (yCell) {
              yCell.textContent = val ? val.y.toFixed(CELL_DECIMAL_PLACES) : "—";
            }
            cellIdx += 2;
          }
        } else {
          // Append a brand-new row at the bottom.
          const rowIndex = this.frameRowMap.size; // 0-based index of this row
          const newRow = buildSingleDataRow(
            row,
            tracks,
            cellStyle,
            rowIndex % 2 !== 0, // isEven flag: index 0 → rowOdd, index 1 → rowEven, …
            colors,
          );
          this.tableBodyRef.appendChild(newRow);
          this.frameRowMap.set(row.frame, newRow);
          if (row.frame > this.maxRenderedFrame) {
            this.maxRenderedFrame = row.frame;
          }
        }
      }
    };

    // ── Reactive updates ─────────────────────────────────────────────────────
    const tracksListener = () => rebuildTable();
    tracking.tracksProperty.link(tracksListener);

    const unitListener = () => rebuildTable();
    unitProperty.link(unitListener);

    // Colour profile and locale changes require a full rebuild because cell
    // colours and label strings are baked into the DOM; they are not captured
    // by the track-ID / unit structural-change check above.
    const fullRebuild = () => doFullRebuild(tracking.tracksProperty.value, unitProperty.value);

    const tableHeaderBgListener = () => fullRebuild();
    TrackLabColors.tableHeaderBackgroundProperty.lazyLink(tableHeaderBgListener);

    const frameStringListener = () => fullRebuild();
    dataTableStrings.frameStringProperty.lazyLink(frameStringListener);

    const videoLoadedListener = (loaded: boolean) => {
      this.visible = loaded;
    };
    videoLoadedProperty.link(videoLoadedListener);

    // ── Resize handles ────────────────────────────────────────────────────────
    // Four corner handles styled and positioned to match the graph resize handles.
    const resizeCursors = ["nwse-resize", "nesw-resize", "nesw-resize", "nwse-resize"] as const;
    resizeCursors.forEach((cursor, cornerIndex) => {
      const handle = new Rectangle(0, 0, HANDLE_SIZE, HANDLE_SIZE, 2, 2, {
        fill: TrackLabColors.controlPanelFillProperty,
        stroke: TrackLabColors.controlPanelStrokeProperty,
        lineWidth: 2,
        cursor,
      });
      handle.touchArea = handle.localBounds.dilated(RESIZE_TOUCH_DILATION);
      handle.mouseArea = handle.localBounds.dilated(RESIZE_MOUSE_DILATION);

      let dragStartState: { maxWidth: number; maxHeight: number; nodeX: number; nodeY: number } | null = null;
      let dragStartPointerPoint: Vector2 | null = null;

      handle.addInputListener(
        new DragListener({
          start: (event) => {
            dragStartState = {
              maxWidth: this.currentMaxWidth,
              maxHeight: this.currentMaxHeight,
              nodeX: this.x,
              nodeY: this.y,
            };
            dragStartPointerPoint = event.pointer.point.copy();
            this.isResizingProperty.value = true;
          },
          drag: (event) => {
            if (!(dragStartState && dragStartPointerPoint)) {
              return;
            }
            const delta = event.pointer.point.minus(dragStartPointerPoint);
            let newMaxWidth = dragStartState.maxWidth;
            let newMaxHeight = dragStartState.maxHeight;
            let deltaX = 0;
            let deltaY = 0;

            switch (cornerIndex) {
              case 0: // Top-left
                newMaxWidth = Math.max(MIN_TABLE_RESIZE_WIDTH, dragStartState.maxWidth - delta.x);
                newMaxHeight = Math.max(MIN_TABLE_RESIZE_HEIGHT, dragStartState.maxHeight - delta.y);
                deltaX = dragStartState.maxWidth - newMaxWidth;
                deltaY = dragStartState.maxHeight - newMaxHeight;
                break;
              case 1: // Top-right
                newMaxWidth = Math.max(MIN_TABLE_RESIZE_WIDTH, dragStartState.maxWidth + delta.x);
                newMaxHeight = Math.max(MIN_TABLE_RESIZE_HEIGHT, dragStartState.maxHeight - delta.y);
                deltaY = dragStartState.maxHeight - newMaxHeight;
                break;
              case 2: // Bottom-left
                newMaxWidth = Math.max(MIN_TABLE_RESIZE_WIDTH, dragStartState.maxWidth - delta.x);
                newMaxHeight = Math.max(MIN_TABLE_RESIZE_HEIGHT, dragStartState.maxHeight + delta.y);
                deltaX = dragStartState.maxWidth - newMaxWidth;
                break;
              case 3: // Bottom-right
                newMaxWidth = Math.max(MIN_TABLE_RESIZE_WIDTH, dragStartState.maxWidth + delta.x);
                newMaxHeight = Math.max(MIN_TABLE_RESIZE_HEIGHT, dragStartState.maxHeight + delta.y);
                break;
            }

            this.currentMaxWidth = newMaxWidth;
            this.currentMaxHeight = newMaxHeight;
            this.applyTableDimensions();

            if (deltaX !== 0 || deltaY !== 0) {
              this.x = dragStartState.nodeX + deltaX;
              this.y = dragStartState.nodeY + deltaY;
            }
          },
          end: () => {
            dragStartState = null;
            dragStartPointerPoint = null;
            this.isResizingProperty.value = false;
          },
        }),
      );

      this.resizeHandles.push(handle);
      this.addChild(handle);
    });

    this.updateResizeHandlePositions();

    // Reposition handles whenever the panel reflows (table content or font changes)
    const localBoundsListener = () => {
      this.updateResizeHandlePositions();
    };
    this.localBoundsProperty.lazyLink(localBoundsListener);

    // Dim the panel while resizing for visual feedback
    const isResizingListener = (isResizing: boolean) => {
      this.opacity = isResizing ? 0.8 : 1.0;
    };
    this.isResizingProperty.link(isResizingListener);

    // ── Pan drag: lets the user freely reposition the panel ──────────────────
    let panStartPosition: Vector2 | null = null;
    let panStartPointerPoint: Vector2 | null = null;
    this.cursor = "grab";
    this.addInputListener(
      new DragListener({
        start: (event) => {
          panStartPosition = new Vector2(this.x, this.y);
          panStartPointerPoint = event.pointer.point.copy();
        },
        drag: (event) => {
          if (!(panStartPosition && panStartPointerPoint)) {
            return;
          }
          const delta = event.pointer.point.minus(panStartPointerPoint);
          this.x = panStartPosition.x + delta.x;
          this.y = panStartPosition.y + delta.y;
        },
        end: () => {
          panStartPosition = null;
          panStartPointerPoint = null;
        },
      }),
    );

    // Store cleanup function
    this.disposeDataTable = () => {
      resizeObserver.disconnect();
      tracking.tracksProperty.unlink(tracksListener);
      unitProperty.unlink(unitListener);
      TrackLabColors.tableHeaderBackgroundProperty.unlink(tableHeaderBgListener);
      dataTableStrings.frameStringProperty.unlink(frameStringListener);
      videoLoadedProperty.unlink(videoLoadedListener);
      exportButton.dispose();
      this.localBoundsProperty.unlink(localBoundsListener);
      this.isResizingProperty.unlink(isResizingListener);
      this.isResizingProperty.dispose();
    };
  }

  /**
   * Apply the current max dimensions to the table wrapper's CSS.
   * Called during resize drags and after full rebuilds to restore user-set sizes.
   */
  private applyTableDimensions(): void {
    this.tableWrapper.style.maxWidth = `${this.currentMaxWidth}px`;
    this.tableWrapper.style.maxHeight = `${this.currentMaxHeight}px`;
  }

  /**
   * Reposition the four corner resize handles to match the current panel bounds.
   * Called after any resize or panel reflow.
   */
  private updateResizeHandlePositions(): void {
    if (this.resizeHandles.length === 0) {
      return;
    }
    const b = this.localBounds;
    const corners = [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.minX, y: b.maxY },
      { x: b.maxX, y: b.maxY },
    ];
    this.resizeHandles.forEach((handle, index) => {
      const corner = corners[index];
      if (corner) {
        handle.setRect(corner.x + HANDLE_OFFSET, corner.y + HANDLE_OFFSET, HANDLE_SIZE, HANDLE_SIZE);
        handle.touchArea = handle.localBounds.dilated(RESIZE_TOUCH_DILATION);
        handle.mouseArea = handle.localBounds.dilated(RESIZE_MOUSE_DILATION);
      }
    });
  }

  public override dispose(): void {
    this.disposeDataTable();
    super.dispose();
  }
}

trackLab.register("DataTableNode", DataTableNode);
