/**
 * Handles zoom interactions for the configurable graph:
 * - Mouse-wheel zoom (preserving the pointer as the zoom center)
 * - Pinch-to-zoom on touch devices (preserving the pinch midpoint)
 * - Double-click to reset to auto-scale
 * - Programmatic zoomIn() / zoomOut() (used by toolbar buttons and keyboard shortcuts)
 */

import type { ChartRectangle, ChartTransform } from "scenerystack/bamboo";
import { Range, Vector2 } from "scenerystack/dot";
import type { Pointer } from "scenerystack/scenery";
import { GRAPH_ZOOM_FACTOR } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import type GraphDataManager from "./GraphDataManager.js";
import type { ChartConfig, GraphDimensions } from "./GraphInteractionHandler.js";

export default class ZoomGestureHandler {
  private readonly chartTransform: ChartTransform;
  private readonly chartRectangle: ChartRectangle;
  private readonly dataManager: GraphDataManager;

  private graphWidth: number;
  private graphHeight: number;

  public constructor(chartConfig: ChartConfig, dimensions: GraphDimensions) {
    this.chartTransform = chartConfig.chartTransform;
    this.chartRectangle = chartConfig.chartRectangle;
    this.dataManager = chartConfig.dataManager;
    this.graphWidth = dimensions.width;
    this.graphHeight = dimensions.height;
  }

  /**
   * Attach all zoom-related input listeners to the chart rectangle.
   * Must be called once after construction.
   */
  public initialize(): void {
    this.setupWheelZoom();
    this.setupDoubleClickReset();
    this.setupPinchZoom();

    // Make chart rectangle pickable so it can receive input
    this.chartRectangle.pickable = true;
  }

  /**
   * Update stored graph dimensions (called when the graph is resized).
   */
  public updateDimensions(width: number, height: number): void {
    this.graphWidth = width;
    this.graphHeight = height;
  }

  // ── Public programmatic API ────────────────────────────────────────────────

  /**
   * Zoom in by one step, centered on the graph midpoint.
   */
  public zoomIn(): void {
    const center = new Vector2(this.graphWidth / 2, this.graphHeight / 2);
    this.zoom(GRAPH_ZOOM_FACTOR, center);
  }

  /**
   * Zoom out by one step, centered on the graph midpoint.
   */
  public zoomOut(): void {
    const center = new Vector2(this.graphWidth / 2, this.graphHeight / 2);
    this.zoom(1 / GRAPH_ZOOM_FACTOR, center);
  }

  // ── Private setup helpers ──────────────────────────────────────────────────

  private setupWheelZoom(): void {
    this.chartRectangle.addInputListener({
      wheel: (event) => {
        event.handle();
        const delta = event.domEvent?.deltaY ?? 0;
        const pointerPoint = this.chartRectangle.globalToLocalPoint(event.pointer.point);

        if (delta < 0) {
          this.zoom(GRAPH_ZOOM_FACTOR, pointerPoint);
        } else {
          this.zoom(1 / GRAPH_ZOOM_FACTOR, pointerPoint);
        }
      },
    });
  }

  private setupDoubleClickReset(): void {
    this.chartRectangle.addInputListener({
      down: (event) => {
        if (event.domEvent && event.domEvent.detail === 2) {
          event.handle();
          this.resetZoom();
        }
      },
    });
  }

  private setupPinchZoom(): void {
    const activePointers = new Map<Pointer, Vector2>();
    let initialDistance: number | null = null;
    let initialMidpoint: Vector2 | null = null;
    let initialXRange: Range | null = null;
    let initialYRange: Range | null = null;

    this.chartRectangle.addInputListener({
      down: (event) => {
        if (event.pointer.type !== "touch") {
          return;
        }
        const localPoint = this.chartRectangle.globalToLocalPoint(event.pointer.point);
        activePointers.set(event.pointer, localPoint);

        if (activePointers.size === 2) {
          const [point0, point1] = activePointers.values();
          if (point0 && point1) {
            initialDistance = point0.distance(point1);
            initialMidpoint = point0.average(point1);
            initialXRange = this.chartTransform.modelXRange.copy();
            initialYRange = this.chartTransform.modelYRange.copy();
          }
        }
      },

      move: (event) => {
        if (event.pointer.type !== "touch" || !activePointers.has(event.pointer)) {
          return;
        }

        const localPoint = this.chartRectangle.globalToLocalPoint(event.pointer.point);
        activePointers.set(event.pointer, localPoint);

        if (activePointers.size === 2 && initialDistance && initialMidpoint && initialXRange && initialYRange) {
          const points = Array.from(activePointers.values());
          const point0 = points[0];
          const point1 = points[1];
          if (!(point0 && point1)) {
            return;
          }

          const currentDistance = point0.distance(point1);
          const zoomFactor = initialDistance / currentDistance;
          const initialModelCenter = this.chartTransform.viewToModelPosition(initialMidpoint);

          const xMin = initialModelCenter.x - (initialModelCenter.x - initialXRange.min) * zoomFactor;
          const xMax = initialModelCenter.x + (initialXRange.max - initialModelCenter.x) * zoomFactor;
          const yMin = initialModelCenter.y - (initialModelCenter.y - initialYRange.min) * zoomFactor;
          const yMax = initialModelCenter.y + (initialYRange.max - initialModelCenter.y) * zoomFactor;

          this.dataManager.setRange(new Range(xMin, xMax), new Range(yMin, yMax));
        }
      },

      up: (event) => {
        if (event.pointer.type !== "touch") {
          return;
        }
        activePointers.delete(event.pointer);
        if (activePointers.size < 2) {
          initialDistance = null;
          initialMidpoint = null;
          initialXRange = null;
          initialYRange = null;
        }
      },

      cancel: (event) => {
        if (event.pointer.type !== "touch") {
          return;
        }
        activePointers.delete(event.pointer);
        if (activePointers.size < 2) {
          initialDistance = null;
          initialMidpoint = null;
          initialXRange = null;
          initialYRange = null;
        }
      },
    });
  }

  // ── Core zoom primitive ────────────────────────────────────────────────────

  /**
   * Zoom the chart by `factor`, keeping `centerPoint` (view coordinates) fixed.
   *
   * @param factor - >1 zooms in, <1 zooms out
   * @param centerPoint - Zoom anchor in local view coordinates
   */
  public zoom(factor: number, centerPoint: Vector2): void {
    const currentXRange = this.chartTransform.modelXRange;
    const currentYRange = this.chartTransform.modelYRange;
    const modelCenter = this.chartTransform.viewToModelPosition(centerPoint);

    const xMin = modelCenter.x - (modelCenter.x - currentXRange.min) / factor;
    const xMax = modelCenter.x + (currentXRange.max - modelCenter.x) / factor;
    const yMin = modelCenter.y - (modelCenter.y - currentYRange.min) / factor;
    const yMax = modelCenter.y + (currentYRange.max - modelCenter.y) / factor;

    this.dataManager.setRange(new Range(xMin, xMax), new Range(yMin, yMax));
  }

  private resetZoom(): void {
    this.dataManager.setManuallyZoomed(false);
    if (this.dataManager.getDataPointCount() > 1) {
      this.dataManager.updateAxisRanges();
    }
  }
}

trackLab.register("ZoomGestureHandler", ZoomGestureHandler);
