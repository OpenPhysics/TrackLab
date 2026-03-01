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
 *
 * ## Architecture
 *
 * All HTML DOM construction and incremental-update state live in `TableRenderer`.
 * This class focuses on SceneryStack integration: Panel, drag listeners, resize
 * handles, and reactive property wiring.
 */

import { BooleanProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { DOM, DragListener, HBox, Node, Rectangle, RichDragListener, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Panel } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import { createTrackLabButton, makeDownloadIcon } from "../../TrackLabButton.js";
import TrackLabColors from "../../TrackLabColors.js";
import { OVERLAY_DRAG_SPEED, OVERLAY_SHIFT_DRAG_SPEED, PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import { generateCsv } from "../model/TrackExporter.js";
import type { TrackingModel } from "../model/TrackingModel.js";
import { type A11yLabels, type TableColors, type TableLabels, TableRenderer } from "./TableRenderer.js";

// ── Fonts ────────────────────────────────────────────────────────────────────
const TITLE_FONT = new PhetFont({ size: 12, weight: "bold" });
const EXPORT_BUTTON_FONT_SIZE = 9;

// ── Panel layout ──────────────────────────────────────────────────────────────
const PANEL_X_MARGIN = 10;
const PANEL_Y_MARGIN = 10;
const CONTENT_SPACING = 6;
const TITLE_ROW_SPACING = 8;
const EXPORT_BUTTON_ICON_SPACING = 3;

// ── Resize handle geometry ────────────────────────────────────────────────────
const HANDLE_SIZE = 12;
const HANDLE_OFFSET = -6;
const RESIZE_TOUCH_DILATION = 6;
const RESIZE_MOUSE_DILATION = 4;
const MIN_TABLE_RESIZE_WIDTH = 200;
const MIN_TABLE_RESIZE_HEIGHT = 80;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTableColors(): TableColors {
  return {
    headerBg: TrackLabColors.tableHeaderBackgroundProperty.value.toCSS(),
    headerText: TrackLabColors.tableHeaderTextProperty.value.toCSS(),
    rowOdd: TrackLabColors.tableRowOddProperty.value.toCSS(),
    rowEven: TrackLabColors.tableRowEvenProperty.value.toCSS(),
    gridStroke: TrackLabColors.tableGridStrokeProperty.value.toCSS(),
    emptyText: TrackLabColors.tableEmptyTextProperty.value.toCSS(),
    symbolShadow: TrackLabColors.tableSymbolShadowProperty.value.toCSS(),
    background: TrackLabColors.tableBackgroundProperty.value.toCSS(),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export class DataTableNode extends Node {
  private exportCounter = 1;
  private readonly tableRenderer: TableRenderer;
  private readonly disposeDataTable: () => void;

  // ── Resize state ──────────────────────────────────────────────────────────
  private readonly panel: Panel;
  private readonly isResizingProperty = new BooleanProperty(false);
  private readonly resizeHandles: Rectangle[] = [];

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

    // ── TableRenderer owns all DOM and incremental-update state ───────────────
    const tableRenderer = new TableRenderer(getTableColors(), getLabels(), getA11yLabels());

    const tableDomNode = new DOM(tableRenderer.wrapper, { allowInput: true });

    // Notify Scenery whenever the wrapper's layout dimensions change so the
    // Panel reflows to match the growing/shrinking table content.
    const resizeObserver = new ResizeObserver(() => {
      tableDomNode.invalidateDOM();
    });
    resizeObserver.observe(tableRenderer.wrapper);

    // ── Export button ─────────────────────────────────────────────────────────
    const exportButton = createTrackLabButton(
      new HBox({
        children: [
          makeDownloadIcon(),
          new Text(dataTableStrings.csvStringProperty, {
            font: new PhetFont({ size: EXPORT_BUTTON_FONT_SIZE, weight: "bold" }),
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

    // ── Title row ─────────────────────────────────────────────────────────────
    const titleLabel = new Text(dataTableStrings.titleStringProperty, {
      font: TITLE_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });

    const titleRow = new HBox({
      children: [titleLabel, exportButton],
      spacing: TITLE_ROW_SPACING,
      align: "center",
    });

    // ── Main content ──────────────────────────────────────────────────────────
    const content = new VBox({
      children: [titleRow, tableDomNode],
      spacing: CONTENT_SPACING,
      align: "left",
    });

    const panel = new Panel(content, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: PANEL_CORNER_RADIUS,
      xMargin: PANEL_X_MARGIN,
      yMargin: PANEL_Y_MARGIN,
    });

    super({ visible: false });
    this.panel = panel;
    this.tableRenderer = tableRenderer;
    this.addChild(panel);

    // ── Reactive updates ──────────────────────────────────────────────────────
    const runUpdate = () => {
      tableRenderer.update(
        tracking.tracksProperty.value,
        unitProperty.value,
        getTableColors(),
        getLabels(),
        getA11yLabels(),
      );
    };

    const runRebuild = () => {
      tableRenderer.rebuild(
        tracking.tracksProperty.value,
        unitProperty.value,
        getTableColors(),
        getLabels(),
        getA11yLabels(),
      );
    };

    const tracksListener = () => runUpdate();
    tracking.tracksProperty.link(tracksListener);

    const unitListener = () => runUpdate();
    unitProperty.link(unitListener);

    // Color-theme and locale changes require a full rebuild because cell colours
    // and label strings are baked into the DOM.
    const tableHeaderBgListener = () => runRebuild();
    TrackLabColors.tableHeaderBackgroundProperty.lazyLink(tableHeaderBgListener);

    const frameStringListener = () => runRebuild();
    dataTableStrings.frameStringProperty.lazyLink(frameStringListener);

    const videoLoadedListener = (loaded: boolean) => {
      this.visible = loaded;
    };
    videoLoadedProperty.link(videoLoadedListener);

    // ── Resize handles ────────────────────────────────────────────────────────
    const resizeCorners = [
      { cursor: "nwse-resize", accessibleName: a11yStrings.tableResizeTopLeftStringProperty },
      { cursor: "nesw-resize", accessibleName: a11yStrings.tableResizeTopRightStringProperty },
      { cursor: "nesw-resize", accessibleName: a11yStrings.tableResizeBottomLeftStringProperty },
      { cursor: "nwse-resize", accessibleName: a11yStrings.tableResizeBottomRightStringProperty },
    ] as const;

    resizeCorners.forEach(({ cursor, accessibleName }, cornerIndex) => {
      const handle = new Rectangle(0, 0, HANDLE_SIZE, HANDLE_SIZE, 2, 2, {
        fill: TrackLabColors.controlPanelFillProperty,
        stroke: TrackLabColors.controlPanelStrokeProperty,
        lineWidth: 2,
        cursor,
        tagName: "div",
        focusable: true,
        accessibleName,
      });
      handle.touchArea = handle.localBounds.dilated(RESIZE_TOUCH_DILATION);
      handle.mouseArea = handle.localBounds.dilated(RESIZE_MOUSE_DILATION);

      let dragStartState: { maxWidth: number; maxHeight: number; nodeX: number; nodeY: number } | null = null;
      let dragStartPointerPoint: Vector2 | null = null;

      const applyIncrementalResize = (dx: number, dy: number) => {
        let newMaxWidth = this.tableRenderer.getMaxWidth();
        let newMaxHeight = this.tableRenderer.getMaxHeight();
        let deltaX = 0;
        let deltaY = 0;

        switch (cornerIndex) {
          case 0: // Top-left
            newMaxWidth = Math.max(MIN_TABLE_RESIZE_WIDTH, newMaxWidth - dx);
            newMaxHeight = Math.max(MIN_TABLE_RESIZE_HEIGHT, newMaxHeight - dy);
            deltaX = this.tableRenderer.getMaxWidth() - newMaxWidth;
            deltaY = this.tableRenderer.getMaxHeight() - newMaxHeight;
            break;
          case 1: // Top-right
            newMaxWidth = Math.max(MIN_TABLE_RESIZE_WIDTH, newMaxWidth + dx);
            newMaxHeight = Math.max(MIN_TABLE_RESIZE_HEIGHT, newMaxHeight - dy);
            deltaY = this.tableRenderer.getMaxHeight() - newMaxHeight;
            break;
          case 2: // Bottom-left
            newMaxWidth = Math.max(MIN_TABLE_RESIZE_WIDTH, newMaxWidth - dx);
            newMaxHeight = Math.max(MIN_TABLE_RESIZE_HEIGHT, newMaxHeight + dy);
            deltaX = this.tableRenderer.getMaxWidth() - newMaxWidth;
            break;
          case 3: // Bottom-right
            newMaxWidth = Math.max(MIN_TABLE_RESIZE_WIDTH, newMaxWidth + dx);
            newMaxHeight = Math.max(MIN_TABLE_RESIZE_HEIGHT, newMaxHeight + dy);
            break;
        }

        this.tableRenderer.applyDimensions(newMaxWidth, newMaxHeight);

        if (deltaX !== 0 || deltaY !== 0) {
          this.x += deltaX;
          this.y += deltaY;
        }
      };

      handle.addInputListener(
        new RichDragListener({
          dragListenerOptions: {
            start: (event) => {
              handle.focus();
              dragStartState = {
                maxWidth: this.tableRenderer.getMaxWidth(),
                maxHeight: this.tableRenderer.getMaxHeight(),
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

              this.tableRenderer.applyDimensions(newMaxWidth, newMaxHeight);

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
          },
          keyboardDragListenerOptions: {
            dragSpeed: OVERLAY_DRAG_SPEED,
            shiftDragSpeed: OVERLAY_SHIFT_DRAG_SPEED,
            start: () => {
              this.isResizingProperty.value = true;
            },
            drag: (_event, listener) => {
              applyIncrementalResize(listener.modelDelta.x, listener.modelDelta.y);
            },
            end: () => {
              this.isResizingProperty.value = false;
            },
          },
          tandem: Tandem.OPT_OUT,
        }),
      );

      this.resizeHandles.push(handle);
      this.addChild(handle);
    });

    this.updateResizeHandlePositions();

    const localBoundsListener = () => {
      this.updateResizeHandlePositions();
    };
    panel.localBoundsProperty.lazyLink(localBoundsListener);

    const isResizingListener = (isResizing: boolean) => {
      this.opacity = isResizing ? 0.8 : 1.0;
    };
    this.isResizingProperty.link(isResizingListener);

    // ── Pan drag ──────────────────────────────────────────────────────────────
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

    this.disposeDataTable = () => {
      resizeObserver.disconnect();
      tracking.tracksProperty.unlink(tracksListener);
      unitProperty.unlink(unitListener);
      TrackLabColors.tableHeaderBackgroundProperty.unlink(tableHeaderBgListener);
      dataTableStrings.frameStringProperty.unlink(frameStringListener);
      videoLoadedProperty.unlink(videoLoadedListener);
      exportButton.dispose();
      panel.localBoundsProperty.unlink(localBoundsListener);
      this.isResizingProperty.unlink(isResizingListener);
      this.isResizingProperty.dispose();
    };
  }

  private updateResizeHandlePositions(): void {
    if (this.resizeHandles.length === 0) {
      return;
    }
    const b = this.panel.localBounds;
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
