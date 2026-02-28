/**
 * Handles pan interactions for the configurable graph:
 * - Mouse/touch drag on the chart area to pan both axes simultaneously
 * - Programmatic pan() (used by toolbar buttons and keyboard shortcuts)
 */

import type { ChartRectangle, ChartTransform } from "scenerystack/bamboo";
import { Range, type Vector2 } from "scenerystack/dot";
import { DragListener } from "scenerystack/scenery";
import trackLab from "../../TrackLabNamespace.js";
import type GraphDataManager from "./GraphDataManager.js";
import type { ChartConfig } from "./GraphInteractionHandler.js";

export default class PanGestureHandler {
  private readonly chartTransform: ChartTransform;
  private readonly chartRectangle: ChartRectangle;
  private readonly dataManager: GraphDataManager;

  public constructor(chartConfig: ChartConfig) {
    this.chartTransform = chartConfig.chartTransform;
    this.chartRectangle = chartConfig.chartRectangle;
    this.dataManager = chartConfig.dataManager;
  }

  /**
   * Attach the drag-to-pan listener to the chart rectangle.
   * Must be called once after construction.
   */
  public initialize(): void {
    this.setupDragPan();
    this.chartRectangle.cursor = "move";
  }

  // ── Public programmatic API ────────────────────────────────────────────────

  /**
   * Pan the chart by 10% of the current range in the given direction.
   */
  public pan(direction: "left" | "right" | "up" | "down"): void {
    const currentXRange = this.chartTransform.modelXRange;
    const currentYRange = this.chartTransform.modelYRange;

    const xDelta = currentXRange.getLength() * 0.1;
    const yDelta = currentYRange.getLength() * 0.1;

    let newXRange = currentXRange;
    let newYRange = currentYRange;

    switch (direction) {
      case "left":
        newXRange = new Range(currentXRange.min - xDelta, currentXRange.max - xDelta);
        break;
      case "right":
        newXRange = new Range(currentXRange.min + xDelta, currentXRange.max + xDelta);
        break;
      case "up":
        newYRange = new Range(currentYRange.min + yDelta, currentYRange.max + yDelta);
        break;
      case "down":
        newYRange = new Range(currentYRange.min - yDelta, currentYRange.max - yDelta);
        break;
    }

    this.dataManager.setRange(newXRange, newYRange);
  }

  // ── Private setup helpers ──────────────────────────────────────────────────

  private setupDragPan(): void {
    let dragStartModelPoint: Vector2 | null = null;
    let dragStartXRange: Range | null = null;
    let dragStartYRange: Range | null = null;

    const dragListener = new DragListener({
      start: (event) => {
        const viewPoint = this.chartRectangle.globalToLocalPoint(event.pointer.point);
        dragStartModelPoint = this.chartTransform.viewToModelPosition(viewPoint);
        dragStartXRange = this.chartTransform.modelXRange.copy();
        dragStartYRange = this.chartTransform.modelYRange.copy();
      },

      drag: (event) => {
        if (!(dragStartModelPoint && dragStartXRange && dragStartYRange)) {
          return;
        }

        const viewPoint = this.chartRectangle.globalToLocalPoint(event.pointer.point);
        const currentModelPoint = this.chartTransform.viewToModelPosition(viewPoint);

        const deltaX = dragStartModelPoint.x - currentModelPoint.x;
        const deltaY = dragStartModelPoint.y - currentModelPoint.y;

        const newXRange = new Range(dragStartXRange.min + deltaX, dragStartXRange.max + deltaX);
        const newYRange = new Range(dragStartYRange.min + deltaY, dragStartYRange.max + deltaY);

        this.dataManager.setRange(newXRange, newYRange);
      },

      end: () => {
        dragStartModelPoint = null;
        dragStartXRange = null;
        dragStartYRange = null;
      },
    });

    this.chartRectangle.addInputListener(dragListener);
  }
}

trackLab.register("PanGestureHandler", PanGestureHandler);
