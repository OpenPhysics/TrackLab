/**
 * Handles per-axis gesture interactions for the configurable graph.
 *
 * Gestures supported (identical for both axes, transposed as needed):
 *  - Single-finger touch drag  → pan that axis only
 *  - Two-finger touch pinch    → zoom that axis only, centered on the pinch midpoint
 *  - Mouse drag on axis label  → pan that axis only
 *  - Mouse wheel on axis label → zoom that axis only, centered on the pointer
 *
 * Sign convention for pan deltas:
 *  - Touch pan: negate the screen delta so content follows the finger on both axes.
 *  - Mouse drag Y: keep positive — screen Y is inverted from model Y so the signs cancel.
 *  - Mouse drag X: negate — screen X and model X share direction, so negation makes
 *    content follow the drag.
 */

import type { ChartRectangle, ChartTransform } from "scenerystack/bamboo";
import { Range, Vector2 } from "scenerystack/dot";
import { DragListener, type Pointer, type Rectangle } from "scenerystack/scenery";
import { GRAPH_ZOOM_FACTOR } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import type GraphDataManager from "./GraphDataManager.js";
import type { ChartConfig, GraphDimensions } from "./GraphInteractionHandler.js";

/**
 * The two axis-interaction regions the handler needs access to.
 */
export interface AxisInteractionRegions {
  xAxisInteractionRegion: Rectangle;
  yAxisInteractionRegion: Rectangle;
}

export default class AxisGestureHandler {
  private readonly chartTransform: ChartTransform;
  private readonly chartRectangle: ChartRectangle;
  private readonly dataManager: GraphDataManager;
  private readonly xAxisInteractionRegion: Rectangle;
  private readonly yAxisInteractionRegion: Rectangle;

  private graphWidth: number;
  private graphHeight: number;

  public constructor(chartConfig: ChartConfig, regions: AxisInteractionRegions, dimensions: GraphDimensions) {
    this.chartTransform = chartConfig.chartTransform;
    this.chartRectangle = chartConfig.chartRectangle;
    this.dataManager = chartConfig.dataManager;
    this.xAxisInteractionRegion = regions.xAxisInteractionRegion;
    this.yAxisInteractionRegion = regions.yAxisInteractionRegion;
    this.graphWidth = dimensions.width;
    this.graphHeight = dimensions.height;
  }

  /**
   * Attach all axis-specific input listeners.
   * Must be called once after construction.
   */
  public initialize(): void {
    this.setupAxisControls("y");
    this.setupAxisControls("x");
  }

  /**
   * Update stored graph dimensions (called when the graph is resized).
   */
  public updateDimensions(width: number, height: number): void {
    this.graphWidth = width;
    this.graphHeight = height;
  }

  // ── Private setup ──────────────────────────────────────────────────────────

  private setupAxisControls(axis: "x" | "y"): void {
    const isX = axis === "x";
    const region = isX ? this.xAxisInteractionRegion : this.yAxisInteractionRegion;

    // Read the current model range for this axis.
    const getRange = (): Range => (isX ? this.chartTransform.modelXRange : this.chartTransform.modelYRange);

    // Apply a new range for this axis via the data manager (sets isManuallyZoomed,
    // updates chartTransform, and updates tick spacing atomically).
    const setRange = (range: Range): void => {
      if (isX) {
        this.dataManager.setRange(range, this.chartTransform.modelYRange);
      } else {
        this.dataManager.setRange(this.chartTransform.modelXRange, range);
      }
    };

    // Extract the scalar coordinate relevant to this axis from a 2-D point.
    const coord = (p: Vector2): number => (isX ? p.x : p.y);

    this.setupAxisTouchControls(region, isX, getRange, setRange, coord);
    this.setupAxisMouseDrag(region, isX, getRange, setRange, coord);
    this.setupAxisMouseWheel(region, isX, getRange, setRange, coord);

    region.pickable = true;
    region.cursor = isX ? "ew-resize" : "ns-resize";
  }

  // ── Touch controls ─────────────────────────────────────────────────────────

  private setupAxisTouchControls(
    region: Rectangle,
    isX: boolean,
    getRange: () => Range,
    setRange: (range: Range) => void,
    coord: (p: Vector2) => number,
  ): void {
    const activePointers = new Map<Pointer, Vector2>();
    let initialPinchDistance: number | null = null;
    let initialPinchMidpoint: number | null = null;
    let initialRange: Range | null = null;
    let singleTouchStart: number | null = null;

    region.addInputListener({
      down: (event) => {
        if (event.pointer.type !== "touch") {
          return;
        }
        const pt = event.pointer.point;
        activePointers.set(event.pointer, pt);

        if (activePointers.size === 1) {
          singleTouchStart = coord(pt);
          initialRange = getRange().copy();
        } else if (activePointers.size === 2) {
          const [p0, p1] = activePointers.values();
          if (p0 && p1) {
            initialPinchDistance = Math.abs(coord(p0) - coord(p1));
            initialPinchMidpoint = (coord(p0) + coord(p1)) / 2;
            initialRange = getRange().copy();
            singleTouchStart = null;
          }
        }
      },

      move: (event) => {
        if (event.pointer.type !== "touch" || !activePointers.has(event.pointer)) {
          return;
        }
        const pt = event.pointer.point;
        activePointers.set(event.pointer, pt);

        if (activePointers.size === 1 && singleTouchStart !== null && initialRange) {
          // Single touch: pan. Negate so content follows the finger on both axes.
          const axisSize = isX ? this.graphWidth : this.graphHeight;
          const modelDelta = -(coord(pt) - singleTouchStart) * (initialRange.getLength() / axisSize);
          setRange(new Range(initialRange.min + modelDelta, initialRange.max + modelDelta));
        } else if (activePointers.size === 2 && initialPinchDistance && initialPinchMidpoint !== null && initialRange) {
          // Two-finger pinch: zoom this axis only, centered on the pinch midpoint.
          const points = Array.from(activePointers.values());
          const p0 = points[0];
          const p1 = points[1];
          if (!(p0 && p1)) {
            return;
          }

          const zoomFactor = initialPinchDistance / Math.abs(coord(p0) - coord(p1));

          // Build a view midpoint at the pinch centre; use the graph centre on
          // the perpendicular axis so the localToModel conversion is correct.
          const viewMidpoint = isX
            ? new Vector2(initialPinchMidpoint, this.graphHeight / 2)
            : new Vector2(this.graphWidth / 2, initialPinchMidpoint);
          const localMidpoint = this.chartRectangle.globalToLocalPoint(viewMidpoint);
          const modelPos = this.chartTransform.viewToModelPosition(localMidpoint);
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
        if (event.pointer.type !== "touch") {
          return;
        }
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
        if (event.pointer.type !== "touch") {
          return;
        }
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
  }

  // ── Mouse drag ─────────────────────────────────────────────────────────────

  private setupAxisMouseDrag(
    region: Rectangle,
    isX: boolean,
    getRange: () => Range,
    setRange: (range: Range) => void,
    coord: (p: Vector2) => number,
  ): void {
    let mouseDragStart: number | null = null;
    let mouseDragInitialRange: Range | null = null;

    const dragListener = new DragListener({
      start: (event) => {
        mouseDragStart = coord(event.pointer.point);
        mouseDragInitialRange = getRange().copy();
      },

      drag: (event) => {
        if (mouseDragStart === null || !mouseDragInitialRange) {
          return;
        }
        const axisSize = isX ? this.graphWidth : this.graphHeight;
        const delta = coord(event.pointer.point) - mouseDragStart;
        // X: negate (screen X and model X share direction; negation makes content follow drag).
        // Y: keep positive (screen Y is inverted from model Y; signs cancel, content follows drag).
        const modelDelta = (isX ? -1 : 1) * delta * (mouseDragInitialRange.getLength() / axisSize);
        setRange(new Range(mouseDragInitialRange.min + modelDelta, mouseDragInitialRange.max + modelDelta));
      },

      end: () => {
        mouseDragStart = null;
        mouseDragInitialRange = null;
      },
    });

    region.addInputListener(dragListener);
  }

  // ── Mouse wheel ────────────────────────────────────────────────────────────

  private setupAxisMouseWheel(
    region: Rectangle,
    isX: boolean,
    getRange: () => Range,
    setRange: (range: Range) => void,
    coord: (p: Vector2) => number,
  ): void {
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
        const localMidpoint = this.chartRectangle.globalToLocalPoint(viewMidpoint);
        const modelPos = this.chartTransform.viewToModelPosition(localMidpoint);
        const modelCenter = isX ? modelPos.x : modelPos.y;

        const currentRange = getRange();
        const zoomFactor = delta < 0 ? GRAPH_ZOOM_FACTOR : 1 / GRAPH_ZOOM_FACTOR;

        setRange(
          new Range(
            modelCenter - (modelCenter - currentRange.min) / zoomFactor,
            modelCenter + (currentRange.max - modelCenter) / zoomFactor,
          ),
        );
      },
    });
  }
}

trackLab.register("AxisGestureHandler", AxisGestureHandler);
