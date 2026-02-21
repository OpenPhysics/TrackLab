/**
 * Handles all user interactions for the configurable graph including:
 * - Zoom controls (mouse wheel, touch pinch)
 * - Pan controls (drag)
 * - Touch controls for X/Y axes
 * - Header drag functionality
 * - Resize handles
 */

import type { BooleanProperty } from "scenerystack/axon";
import type {
  ChartRectangle,
  ChartTransform,
  TickLabelSet,
} from "scenerystack/bamboo";
import { Range, Vector2 } from "scenerystack/dot";
import {
  DragListener,
  type Node,
  type Pointer,
  Rectangle,
} from "scenerystack/scenery";
import TrackLabColors from "../../TrackLabColors.js";
import trackLab from "../../TrackLabNamespace.js";
import type GraphDataManager from "./GraphDataManager.js";

/**
 * Configuration for the chart and its data management
 */
export interface ChartConfig {
  chartTransform: ChartTransform;
  chartRectangle: ChartRectangle;
  dataManager: GraphDataManager;
}

/**
 * UI state properties for graph interactions
 */
export interface GraphUIState {
  isDraggingProperty: BooleanProperty;
  isResizingProperty: BooleanProperty;
}

/**
 * UI elements that the interaction handler needs to reference
 */
export interface GraphUIElements {
  headerBar: Rectangle;
  graphNode: Node;
  /** Optional node to move when dragging. If not provided, graphNode is moved. */
  dragTargetNode?: Node;
  xTickLabelSet: TickLabelSet;
  yTickLabelSet: TickLabelSet;
  xAxisInteractionRegion: Rectangle;
  yAxisInteractionRegion: Rectangle;
}

/**
 * Graph dimensions
 */
export interface GraphDimensions {
  width: number;
  height: number;
}

/**
 * Handles all pointer, touch, and keyboard interactions for a ConfigurableGraph.
 *
 * Responsibilities:
 * - Mouse-wheel and pinch-to-zoom (preserving the zoom center point)
 * - Two-finger and single-axis touch pan
 * - Independent X-axis and Y-axis touch controls (tap the axis label to pan/scale that axis only)
 * - Header-bar drag to reposition the graph panel
 * - Corner resize handles
 * - `zoomIn()` / `zoomOut()` / `pan()` methods called by keyboard shortcuts and toolbar buttons
 *
 * Manual zoom is tracked via `GraphDataManager.setManuallyZoomed()`. When set, auto-rescaling
 * is suppressed so the user's zoom is preserved as new data arrives.
 *
 * Call `initialize()` once after construction to attach all input listeners.
 */
export default class GraphInteractionHandler {
  private readonly chartTransform: ChartTransform;
  private readonly chartRectangle: ChartRectangle;
  private readonly dataManager: GraphDataManager;
  private readonly zoomFactor: number = 1.1; // 10% zoom per wheel tick

  // For header drag
  private readonly headerBar: Rectangle;
  private readonly graphNode: Node;
  private readonly dragTargetNode: Node;
  private readonly isDraggingProperty: BooleanProperty;

  // For resize
  private readonly resizeHandles: Rectangle[] = [];
  private readonly isResizingProperty: BooleanProperty;
  private readonly onResize: (width: number, height: number) => void;

  // For axis controls
  private readonly xAxisInteractionRegion: Rectangle;
  private readonly yAxisInteractionRegion: Rectangle;
  private graphWidth: number;
  private graphHeight: number;

  /**
   * @param chartConfig - Chart transform, chart rectangle, and data manager
   * @param uiState - Observable flags for drag/resize in-progress state
   * @param uiElements - The visual nodes that receive input listeners
   * @param dimensions - Initial graph width/height in view coordinates
   * @param onResize - Callback invoked with the new (width, height) after a resize drag
   */
  public constructor(
    chartConfig: ChartConfig,
    uiState: GraphUIState,
    uiElements: GraphUIElements,
    dimensions: GraphDimensions,
    onResize: (width: number, height: number) => void,
  ) {
    this.chartTransform = chartConfig.chartTransform;
    this.chartRectangle = chartConfig.chartRectangle;
    this.dataManager = chartConfig.dataManager;
    this.headerBar = uiElements.headerBar;
    this.graphNode = uiElements.graphNode;
    this.dragTargetNode = uiElements.dragTargetNode ?? uiElements.graphNode;
    this.isDraggingProperty = uiState.isDraggingProperty;
    this.isResizingProperty = uiState.isResizingProperty;
    this.xAxisInteractionRegion = uiElements.xAxisInteractionRegion;
    this.yAxisInteractionRegion = uiElements.yAxisInteractionRegion;
    this.graphWidth = dimensions.width;
    this.graphHeight = dimensions.height;
    this.onResize = onResize;
  }

  /**
   * Initialize all interaction handlers
   */
  public initialize(): void {
    this.setupZoomControls();
    this.setupPanControls();
    this.setupTouchZoomControls();
    this.setupAxisControls("y");
    this.setupAxisControls("x");
    this.setupHeaderDrag();
  }

  /**
   * Setup non-intrusive zoom controls using mouse wheel and keyboard
   */
  private setupZoomControls(): void {
    // Mouse wheel zoom on the chart area
    this.chartRectangle.addInputListener({
      wheel: (event) => {
        event.handle();
        const delta = event.domEvent?.deltaY ?? 0;

        // Get mouse position relative to chart
        const pointerPoint = this.chartRectangle.globalToLocalPoint(
          event.pointer.point,
        );

        // Zoom in or out
        if (delta < 0) {
          this.zoom(this.zoomFactor, pointerPoint);
        } else {
          this.zoom(1 / this.zoomFactor, pointerPoint);
        }
      },
    });

    // Double-click to reset to auto-scale
    this.chartRectangle.addInputListener({
      down: (event) => {
        if (event.domEvent && event.domEvent.detail === 2) {
          // Double click detected
          event.handle();
          this.resetZoom();
        }
      },
    });

    // Make chart rectangle pickable so it can receive input
    this.chartRectangle.pickable = true;
  }

  /**
   * Setup pan controls using drag
   */
  private setupPanControls(): void {
    let dragStartModelPoint: Vector2 | null = null;
    let dragStartXRange: Range | null = null;
    let dragStartYRange: Range | null = null;

    const dragListener = new DragListener({
      start: (event) => {
        // Record the starting point in model coordinates
        const viewPoint = this.chartRectangle.globalToLocalPoint(
          event.pointer.point,
        );
        dragStartModelPoint =
          this.chartTransform.viewToModelPosition(viewPoint);
        dragStartXRange = this.chartTransform.modelXRange.copy();
        dragStartYRange = this.chartTransform.modelYRange.copy();

        // Mark as manually zoomed so auto-scaling doesn't interfere
        this.dataManager.setManuallyZoomed(true);
      },

      drag: (event) => {
        if (dragStartModelPoint && dragStartXRange && dragStartYRange) {
          // Get current point in model coordinates
          const viewPoint = this.chartRectangle.globalToLocalPoint(
            event.pointer.point,
          );
          const currentModelPoint =
            this.chartTransform.viewToModelPosition(viewPoint);

          // Calculate the delta in model coordinates
          const deltaX = dragStartModelPoint.x - currentModelPoint.x;
          const deltaY = dragStartModelPoint.y - currentModelPoint.y;

          // Translate the ranges by the delta
          const newXRange = new Range(
            dragStartXRange.min + deltaX,
            dragStartXRange.max + deltaX,
          );
          const newYRange = new Range(
            dragStartYRange.min + deltaY,
            dragStartYRange.max + deltaY,
          );

          // Update the chart transform
          this.chartTransform.setModelXRange(newXRange);
          this.chartTransform.setModelYRange(newYRange);

          // Update tick spacing
          this.dataManager.updateTickSpacing(newXRange, newYRange);
        }
      },

      end: () => {
        // Clean up
        dragStartModelPoint = null;
        dragStartXRange = null;
        dragStartYRange = null;
      },
    });

    this.chartRectangle.addInputListener(dragListener);
    this.chartRectangle.cursor = "move";
  }

  /**
   * Setup touch-based pinch-to-zoom on the chart area
   */
  private setupTouchZoomControls(): void {
    // Track active touch pointers
    const activePointers = new Map<Pointer, Vector2>();
    let initialDistance: number | null = null;
    let initialMidpoint: Vector2 | null = null;
    let initialXRange: Range | null = null;
    let initialYRange: Range | null = null;

    this.chartRectangle.addInputListener({
      down: (event) => {
        // Only track touch events (not mouse)
        if (event.pointer.type === "touch") {
          const localPoint = this.chartRectangle.globalToLocalPoint(
            event.pointer.point,
          );
          activePointers.set(event.pointer, localPoint);

          // If we now have exactly 2 touches, start pinch gesture
          if (activePointers.size === 2) {
            const points = Array.from(activePointers.values());
            const point0 = points[0];
            const point1 = points[1];
            if (point0 && point1) {
              initialDistance = point0.distance(point1);
              initialMidpoint = point0.average(point1);
              initialXRange = this.chartTransform.modelXRange.copy();
              initialYRange = this.chartTransform.modelYRange.copy();
              this.dataManager.setManuallyZoomed(true);
            }
          }
        }
      },

      move: (event) => {
        // Only handle touch events
        if (
          event.pointer.type === "touch" &&
          activePointers.has(event.pointer)
        ) {
          const localPoint = this.chartRectangle.globalToLocalPoint(
            event.pointer.point,
          );
          activePointers.set(event.pointer, localPoint);

          // If we have exactly 2 touches, perform pinch zoom
          if (
            activePointers.size === 2 &&
            initialDistance &&
            initialMidpoint &&
            initialXRange &&
            initialYRange
          ) {
            const points = Array.from(activePointers.values());
            const point0 = points[0];
            const point1 = points[1];
            if (!point0 || !point1) return;
            const currentDistance = point0.distance(point1);

            // Calculate zoom factor from distance ratio
            const zoomFactor = initialDistance / currentDistance;

            // Convert initial midpoint to model coordinates
            const initialModelCenter =
              this.chartTransform.viewToModelPosition(initialMidpoint);

            // Calculate new ranges centered on the initial midpoint
            const xMin =
              initialModelCenter.x -
              (initialModelCenter.x - initialXRange.min) * zoomFactor;
            const xMax =
              initialModelCenter.x +
              (initialXRange.max - initialModelCenter.x) * zoomFactor;
            const yMin =
              initialModelCenter.y -
              (initialModelCenter.y - initialYRange.min) * zoomFactor;
            const yMax =
              initialModelCenter.y +
              (initialYRange.max - initialModelCenter.y) * zoomFactor;

            // Apply the zoom
            this.chartTransform.setModelXRange(new Range(xMin, xMax));
            this.chartTransform.setModelYRange(new Range(yMin, yMax));

            // Update tick spacing
            this.dataManager.updateTickSpacing(
              this.chartTransform.modelXRange,
              this.chartTransform.modelYRange,
            );
          }
        }
      },

      up: (event) => {
        // Remove this pointer from tracking
        if (event.pointer.type === "touch") {
          activePointers.delete(event.pointer);

          // Reset pinch state if we no longer have 2 touches
          if (activePointers.size < 2) {
            initialDistance = null;
            initialMidpoint = null;
            initialXRange = null;
            initialYRange = null;
          }
        }
      },

      cancel: (event) => {
        // Handle cancelled touches (e.g., when gesture is interrupted)
        if (event.pointer.type === "touch") {
          activePointers.delete(event.pointer);
          if (activePointers.size < 2) {
            initialDistance = null;
            initialMidpoint = null;
            initialXRange = null;
            initialYRange = null;
          }
        }
      },
    });
  }

  /**
   * Setup touch, mouse-drag, and mouse-wheel controls for one axis.
   *
   * Gestures supported (identical for both axes, just transposed):
   *  - Single-finger touch drag  → pan the axis range
   *  - Two-finger touch pinch    → zoom the axis range around the pinch midpoint
   *  - Mouse drag on axis label  → pan the axis range
   *  - Mouse wheel on axis label → zoom the axis range around the pointer
   *
   * Sign convention for pan deltas
   *  - Touch pan: negate the screen delta so content follows the finger on both axes.
   *  - Mouse drag Y: keep positive — screen Y is inverted from model Y so the signs
   *    cancel and content still follows the drag.
   *  - Mouse drag X: negate — screen X and model X share the same direction, so
   *    negation is required to make content follow the drag.
   */
  private setupAxisControls(axis: "x" | "y"): void {
    const isX = axis === "x";
    const region = isX
      ? this.xAxisInteractionRegion
      : this.yAxisInteractionRegion;

    // Read the current model range for this axis.
    const getRange = (): Range =>
      isX
        ? this.chartTransform.modelXRange
        : this.chartTransform.modelYRange;

    // Apply a new range for this axis and update tick spacing.
    const setRange = (range: Range): void => {
      if (isX) {
        this.chartTransform.setModelXRange(range);
        this.dataManager.updateTickSpacing(
          range,
          this.chartTransform.modelYRange,
        );
      } else {
        this.chartTransform.setModelYRange(range);
        this.dataManager.updateTickSpacing(
          this.chartTransform.modelXRange,
          range,
        );
      }
    };

    // Extract the scalar coordinate relevant to this axis from a 2-D point.
    const coord = (p: Vector2): number => (isX ? p.x : p.y);

    // ── Touch controls ──────────────────────────────────────────────────────
    const activePointers = new Map<Pointer, Vector2>();
    let initialPinchDistance: number | null = null;
    let initialPinchMidpoint: number | null = null;
    let initialRange: Range | null = null;
    let singleTouchStart: number | null = null;

    region.addInputListener({
      down: (event) => {
        if (event.pointer.type !== "touch") return;
        const pt = event.pointer.point;
        activePointers.set(event.pointer, pt);

        if (activePointers.size === 1) {
          singleTouchStart = coord(pt);
          initialRange = getRange().copy();
          this.dataManager.setManuallyZoomed(true);
        } else if (activePointers.size === 2) {
          const points = Array.from(activePointers.values());
          const p0 = points[0];
          const p1 = points[1];
          if (p0 && p1) {
            initialPinchDistance = Math.abs(coord(p0) - coord(p1));
            initialPinchMidpoint = (coord(p0) + coord(p1)) / 2;
            initialRange = getRange().copy();
            singleTouchStart = null;
            this.dataManager.setManuallyZoomed(true);
          }
        }
      },

      move: (event) => {
        if (
          event.pointer.type !== "touch" ||
          !activePointers.has(event.pointer)
        )
          return;
        const pt = event.pointer.point;
        activePointers.set(event.pointer, pt);

        if (activePointers.size === 1 && singleTouchStart !== null && initialRange) {
          // Single touch: pan. Negate so content follows the finger on both axes.
          const axisSize = isX ? this.graphWidth : this.graphHeight;
          const modelDelta =
            -(coord(pt) - singleTouchStart) *
            (initialRange.getLength() / axisSize);
          setRange(
            new Range(
              initialRange.min + modelDelta,
              initialRange.max + modelDelta,
            ),
          );
        } else if (
          activePointers.size === 2 &&
          initialPinchDistance &&
          initialPinchMidpoint !== null &&
          initialRange
        ) {
          // Two-finger pinch: zoom this axis only, centered on the pinch midpoint.
          const points = Array.from(activePointers.values());
          const p0 = points[0];
          const p1 = points[1];
          if (!p0 || !p1) return;
          const zoomFactor =
            initialPinchDistance / Math.abs(coord(p0) - coord(p1));

          // Build a view midpoint at the pinch centre; use the graph centre on
          // the perpendicular axis so the localToModel conversion is correct.
          const viewMidpoint = isX
            ? new Vector2(initialPinchMidpoint, this.graphHeight / 2)
            : new Vector2(this.graphWidth / 2, initialPinchMidpoint);
          const localMidpoint =
            this.chartRectangle.globalToLocalPoint(viewMidpoint);
          const modelPos =
            this.chartTransform.viewToModelPosition(localMidpoint);
          const modelCenter = isX ? modelPos.x : modelPos.y;

          setRange(
            new Range(
              modelCenter - (modelCenter - initialRange.min) * zoomFactor,
              modelCenter + (initialRange.max - modelCenter) * zoomFactor,
            ),
          );
        }
      },

      up: (event) => {
        if (event.pointer.type !== "touch") return;
        activePointers.delete(event.pointer);
        if (activePointers.size < 2) {
          initialPinchDistance = null;
          initialPinchMidpoint = null;
        }
        if (activePointers.size === 0) {
          singleTouchStart = null;
          initialRange = null;
        }
      },

      cancel: (event) => {
        if (event.pointer.type !== "touch") return;
        activePointers.delete(event.pointer);
        if (activePointers.size < 2) {
          initialPinchDistance = null;
          initialPinchMidpoint = null;
        }
        if (activePointers.size === 0) {
          singleTouchStart = null;
          initialRange = null;
        }
      },
    });

    // ── Mouse drag ──────────────────────────────────────────────────────────
    let mouseDragStart: number | null = null;
    let mouseDragInitialRange: Range | null = null;

    const mouseDragListener = new DragListener({
      start: (event) => {
        mouseDragStart = coord(event.pointer.point);
        mouseDragInitialRange = getRange().copy();
        this.dataManager.setManuallyZoomed(true);
      },

      drag: (event) => {
        if (mouseDragStart === null || !mouseDragInitialRange) return;
        const axisSize = isX ? this.graphWidth : this.graphHeight;
        const delta = coord(event.pointer.point) - mouseDragStart;
        // X: negate (screen X and model X share direction; negation makes content follow drag).
        // Y: keep positive (screen Y is inverted from model Y; signs cancel, content follows drag).
        const modelDelta =
          (isX ? -1 : 1) * delta * (mouseDragInitialRange.getLength() / axisSize);
        setRange(
          new Range(
            mouseDragInitialRange.min + modelDelta,
            mouseDragInitialRange.max + modelDelta,
          ),
        );
      },

      end: () => {
        mouseDragStart = null;
        mouseDragInitialRange = null;
      },
    });

    region.addInputListener(mouseDragListener);
    region.pickable = true;
    region.cursor = isX ? "ew-resize" : "ns-resize";

    // ── Mouse wheel ─────────────────────────────────────────────────────────
    region.addInputListener({
      wheel: (event) => {
        event.handle();
        const delta = event.domEvent?.deltaY ?? 0;
        const mouseCoord = coord(event.pointer.point);

        // Place the zoom anchor at the pointer position on this axis, centred
        // on the perpendicular axis so the localToModel lookup is accurate.
        const viewMidpoint = isX
          ? new Vector2(mouseCoord, this.graphHeight / 2)
          : new Vector2(this.graphWidth / 2, mouseCoord);
        const localMidpoint =
          this.chartRectangle.globalToLocalPoint(viewMidpoint);
        const modelPos =
          this.chartTransform.viewToModelPosition(localMidpoint);
        const modelCenter = isX ? modelPos.x : modelPos.y;

        const currentRange = getRange();
        const zoomFactor = delta < 0 ? this.zoomFactor : 1 / this.zoomFactor;

        setRange(
          new Range(
            modelCenter - (modelCenter - currentRange.min) / zoomFactor,
            modelCenter + (currentRange.max - modelCenter) / zoomFactor,
          ),
        );
        this.dataManager.setManuallyZoomed(true);
      },
    });
  }

  /**
   * Setup drag functionality for the header bar to move the entire graph
   */
  private setupHeaderDrag(): void {
    let dragStartPosition: Vector2 | null = null;
    let dragStartPointerPoint: Vector2 | null = null;

    const dragListener = new DragListener({
      start: (event) => {
        // Record the starting position of the drag target and pointer
        dragStartPosition = new Vector2(
          this.dragTargetNode.x,
          this.dragTargetNode.y,
        );
        dragStartPointerPoint = event.pointer.point.copy();
        this.isDraggingProperty.value = true;
      },

      drag: (event) => {
        if (dragStartPosition && dragStartPointerPoint) {
          // Move the drag target node
          const delta = event.pointer.point.minus(dragStartPointerPoint);
          this.dragTargetNode.x = dragStartPosition.x + delta.x;
          this.dragTargetNode.y = dragStartPosition.y + delta.y;
        }
      },

      end: () => {
        dragStartPosition = null;
        dragStartPointerPoint = null;
        this.isDraggingProperty.value = false;
      },
    });

    this.headerBar.addInputListener(dragListener);
  }

  /**
   * Create and return resize handles for the graph corners
   */
  public createResizeHandles(): Rectangle[] {
    const handleSize = 12;
    const handleOffset = -6; // Center the handle on the corner

    // Define corner positions and cursors
    const corners = [
      { x: 0, y: 0, cursor: "nwse-resize" }, // Top-left
      { x: this.graphWidth, y: 0, cursor: "nesw-resize" }, // Top-right
      { x: 0, y: this.graphHeight, cursor: "nesw-resize" }, // Bottom-left
      { x: this.graphWidth, y: this.graphHeight, cursor: "nwse-resize" }, // Bottom-right
    ];

    corners.forEach((corner, index) => {
      const handle = new Rectangle(
        corner.x + handleOffset,
        corner.y + handleOffset,
        handleSize,
        handleSize,
        2,
        2,
        {
          fill: TrackLabColors.controlPanelFillProperty,
          stroke: TrackLabColors.controlPanelStrokeProperty,
          lineWidth: 2,
          cursor: corner.cursor,
        },
      );

      this.resizeHandles.push(handle);
      this.setupResizeHandleDrag(handle, index);
    });

    return this.resizeHandles;
  }

  /**
   * Setup drag listener for a resize handle
   */
  private setupResizeHandleDrag(handle: Rectangle, cornerIndex: number): void {
    let dragStartGraphBounds: {
      width: number;
      height: number;
      x: number;
      y: number;
    } | null = null;
    let dragStartPointerPoint: Vector2 | null = null;

    const dragListener = new DragListener({
      start: (event) => {
        dragStartGraphBounds = {
          width: this.graphWidth,
          height: this.graphHeight,
          x: this.graphNode.x,
          y: this.graphNode.y,
        };
        dragStartPointerPoint = event.pointer.point.copy();
        this.isResizingProperty.value = true;
      },

      drag: (event) => {
        if (!dragStartGraphBounds || !dragStartPointerPoint) return;

        const delta = event.pointer.point.minus(dragStartPointerPoint);
        let newWidth = dragStartGraphBounds.width;
        let newHeight = dragStartGraphBounds.height;
        let deltaX = 0;
        let deltaY = 0;

        // Minimum graph size
        const minWidth = 200;
        const minHeight = 150;

        // Handle different corners
        switch (cornerIndex) {
          case 0: // Top-left
            newWidth = Math.max(minWidth, dragStartGraphBounds.width - delta.x);
            newHeight = Math.max(
              minHeight,
              dragStartGraphBounds.height - delta.y,
            );
            deltaX = dragStartGraphBounds.width - newWidth;
            deltaY = dragStartGraphBounds.height - newHeight;
            break;
          case 1: // Top-right
            newWidth = Math.max(minWidth, dragStartGraphBounds.width + delta.x);
            newHeight = Math.max(
              minHeight,
              dragStartGraphBounds.height - delta.y,
            );
            deltaY = dragStartGraphBounds.height - newHeight;
            break;
          case 2: // Bottom-left
            newWidth = Math.max(minWidth, dragStartGraphBounds.width - delta.x);
            newHeight = Math.max(
              minHeight,
              dragStartGraphBounds.height + delta.y,
            );
            deltaX = dragStartGraphBounds.width - newWidth;
            break;
          case 3: // Bottom-right
            newWidth = Math.max(minWidth, dragStartGraphBounds.width + delta.x);
            newHeight = Math.max(
              minHeight,
              dragStartGraphBounds.height + delta.y,
            );
            break;
        }

        // Call the resize callback with new dimensions
        this.onResize(newWidth, newHeight);

        // Update position if needed (for top-left and bottom-left corners)
        if (deltaX !== 0 || deltaY !== 0) {
          this.graphNode.x = dragStartGraphBounds.x + deltaX;
          this.graphNode.y = dragStartGraphBounds.y + deltaY;
        }
      },

      end: () => {
        dragStartGraphBounds = null;
        dragStartPointerPoint = null;
        this.isResizingProperty.value = false;
      },
    });

    handle.addInputListener(dragListener);
  }

  /**
   * Update graph dimensions (called when graph is resized)
   */
  public updateDimensions(width: number, height: number): void {
    this.graphWidth = width;
    this.graphHeight = height;
  }

  /**
   * Update resize handle positions after a resize
   */
  public updateResizeHandlePositions(): void {
    const handleOffset = -6;
    const corners = [
      { x: 0, y: 0 },
      { x: this.graphWidth, y: 0 },
      { x: 0, y: this.graphHeight },
      { x: this.graphWidth, y: this.graphHeight },
    ];

    this.resizeHandles.forEach((handle, index) => {
      const corner = corners[index];
      if (corner) {
        handle.setRect(
          corner.x + handleOffset,
          corner.y + handleOffset,
          12,
          12,
        );
      }
    });
  }

  /**
   * Zoom the graph by a given factor, centered on a point
   * @param factor - Zoom factor (>1 zooms in, <1 zooms out)
   * @param centerPoint - Point to zoom around (in view coordinates)
   * @param setManualFlag - Whether to set the manual zoom flag (default: true)
   */
  private zoom(
    factor: number,
    centerPoint: Vector2,
    setManualFlag: boolean = true,
  ): void {
    if (setManualFlag) {
      this.dataManager.setManuallyZoomed(true);
    }

    const currentXRange = this.chartTransform.modelXRange;
    const currentYRange = this.chartTransform.modelYRange;

    // Convert center point from view to model coordinates
    const modelCenter = this.chartTransform.viewToModelPosition(centerPoint);

    // Calculate new ranges centered on the mouse position
    const xMin = modelCenter.x - (modelCenter.x - currentXRange.min) / factor;
    const xMax = modelCenter.x + (currentXRange.max - modelCenter.x) / factor;
    const yMin = modelCenter.y - (modelCenter.y - currentYRange.min) / factor;
    const yMax = modelCenter.y + (currentYRange.max - modelCenter.y) / factor;

    const newXRange = new Range(xMin, xMax);
    const newYRange = new Range(yMin, yMax);

    // Update chart transform
    this.chartTransform.setModelXRange(newXRange);
    this.chartTransform.setModelYRange(newYRange);

    // Update tick spacing
    this.dataManager.updateTickSpacing(newXRange, newYRange);
  }

  /**
   * Reset zoom to auto-scale mode
   */
  private resetZoom(): void {
    this.dataManager.setManuallyZoomed(false);

    // Recalculate axis ranges based on current data
    if (this.dataManager.getDataPointCount() > 1) {
      this.dataManager.updateAxisRanges();
    }
  }

  /**
   * Zoom in centered on the graph
   * Note: Does not disable auto-rescaling, allowing the graph to continue adjusting to new data
   */
  public zoomIn(): void {
    // Zoom centered on the middle of the chart; set manual flag so auto-rescale won't override.
    const centerPoint = new Vector2(this.graphWidth / 2, this.graphHeight / 2);
    this.zoom(this.zoomFactor, centerPoint, true);
  }

  /**
   * Zoom out centered on the graph
   */
  public zoomOut(): void {
    // Zoom out centered on the middle of the chart; set manual flag so auto-rescale won't override.
    const centerPoint = new Vector2(this.graphWidth / 2, this.graphHeight / 2);
    this.zoom(1 / this.zoomFactor, centerPoint, true);
  }

  /**
   * Pan the graph in a given direction by 10% of the current range
   * Note: Does not disable auto-rescaling, allowing the graph to continue adjusting to new data
   */
  public pan(direction: "left" | "right" | "up" | "down"): void {
    const currentXRange = this.chartTransform.modelXRange;
    const currentYRange = this.chartTransform.modelYRange;

    // Pan by 10% of the current range
    const xDelta = (currentXRange.max - currentXRange.min) * 0.1;
    const yDelta = (currentYRange.max - currentYRange.min) * 0.1;

    let newXRange = currentXRange;
    let newYRange = currentYRange;

    switch (direction) {
      case "left":
        newXRange = new Range(
          currentXRange.min - xDelta,
          currentXRange.max - xDelta,
        );
        break;
      case "right":
        newXRange = new Range(
          currentXRange.min + xDelta,
          currentXRange.max + xDelta,
        );
        break;
      case "up":
        newYRange = new Range(
          currentYRange.min + yDelta,
          currentYRange.max + yDelta,
        );
        break;
      case "down":
        newYRange = new Range(
          currentYRange.min - yDelta,
          currentYRange.max - yDelta,
        );
        break;
    }

    // Update the chart transform
    this.chartTransform.setModelXRange(newXRange);
    this.chartTransform.setModelYRange(newYRange);

    // Update tick spacing
    this.dataManager.updateTickSpacing(newXRange, newYRange);
  }
}

// Register with namespace for debugging accessibility
trackLab.register("GraphInteractionHandler", GraphInteractionHandler);
