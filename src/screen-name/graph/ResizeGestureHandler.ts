/**
 * Manages corner resize handles for the graph panel.
 *
 * Responsibilities:
 * - Create the four corner Rectangle handles via `createResizeHandles()`
 * - Attach drag listeners that enforce minimum graph dimensions and invoke
 *   the `onResize` callback with the new (width, height)
 * - Reposition handles after a resize via `updateResizeHandlePositions()`
 */

import type { BooleanProperty } from "scenerystack/axon";
import type { Vector2 } from "scenerystack/dot";
import { DragListener, type Node, Rectangle } from "scenerystack/scenery";
import TrackLabColors from "../../TrackLabColors.js";
import trackLab from "../../TrackLabNamespace.js";
import type { GraphDimensions } from "./GraphInteractionHandler.js";

const HANDLE_SIZE = 12;
const HANDLE_OFFSET = -6; // centers the 12px handle on each corner
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

export default class ResizeGestureHandler {
  private readonly graphNode: Node;
  private readonly isResizingProperty: BooleanProperty;
  private readonly onResize: (width: number, height: number) => void;
  private readonly handles: Rectangle[] = [];

  private graphWidth: number;
  private graphHeight: number;

  public constructor(
    graphNode: Node,
    isResizingProperty: BooleanProperty,
    dimensions: GraphDimensions,
    onResize: (width: number, height: number) => void,
  ) {
    this.graphNode = graphNode;
    this.isResizingProperty = isResizingProperty;
    this.graphWidth = dimensions.width;
    this.graphHeight = dimensions.height;
    this.onResize = onResize;
  }

  /**
   * Update stored graph dimensions (called when the graph is resized).
   */
  public updateDimensions(width: number, height: number): void {
    this.graphWidth = width;
    this.graphHeight = height;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Create and return the four corner resize handles.
   * Each handle already has a drag listener attached.
   * The caller is responsible for adding the handles to the scene graph.
   */
  public createResizeHandles(): Rectangle[] {
    const corners: Array<{ x: number; y: number; cursor: string }> = [
      { x: 0, y: 0, cursor: "nwse-resize" },
      { x: this.graphWidth, y: 0, cursor: "nesw-resize" },
      { x: 0, y: this.graphHeight, cursor: "nesw-resize" },
      { x: this.graphWidth, y: this.graphHeight, cursor: "nwse-resize" },
    ];

    corners.forEach((corner, index) => {
      const handle = new Rectangle(corner.x + HANDLE_OFFSET, corner.y + HANDLE_OFFSET, HANDLE_SIZE, HANDLE_SIZE, 2, 2, {
        fill: TrackLabColors.controlPanelFillProperty,
        stroke: TrackLabColors.controlPanelStrokeProperty,
        lineWidth: 2,
        cursor: corner.cursor,
      });

      this.handles.push(handle);
      this.attachDragListener(handle, index);
    });

    return this.handles;
  }

  /**
   * Reposition all four corner handles to match current graph dimensions.
   * Call this after every resize.
   */
  public updateResizeHandlePositions(): void {
    const corners = [
      { x: 0, y: 0 },
      { x: this.graphWidth, y: 0 },
      { x: 0, y: this.graphHeight },
      { x: this.graphWidth, y: this.graphHeight },
    ];

    this.handles.forEach((handle, index) => {
      const corner = corners[index];
      if (corner) {
        handle.setRect(corner.x + HANDLE_OFFSET, corner.y + HANDLE_OFFSET, HANDLE_SIZE, HANDLE_SIZE);
      }
    });
  }

  // ── Private setup ──────────────────────────────────────────────────────────

  private attachDragListener(handle: Rectangle, cornerIndex: number): void {
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
        if (!(dragStartGraphBounds && dragStartPointerPoint)) {
          return;
        }

        const delta = event.pointer.point.minus(dragStartPointerPoint);
        let newWidth = dragStartGraphBounds.width;
        let newHeight = dragStartGraphBounds.height;
        let deltaX = 0;
        let deltaY = 0;

        switch (cornerIndex) {
          case 0: // Top-left
            newWidth = Math.max(MIN_WIDTH, dragStartGraphBounds.width - delta.x);
            newHeight = Math.max(MIN_HEIGHT, dragStartGraphBounds.height + delta.y);
            deltaX = dragStartGraphBounds.width - newWidth;
            deltaY = dragStartGraphBounds.height - newHeight;
            break;
          case 1: // Top-right
            newWidth = Math.max(MIN_WIDTH, dragStartGraphBounds.width + delta.x);
            newHeight = Math.max(MIN_HEIGHT, dragStartGraphBounds.height + delta.y);
            deltaY = dragStartGraphBounds.height - newHeight;
            break;
          case 2: // Bottom-left
            newWidth = Math.max(MIN_WIDTH, dragStartGraphBounds.width - delta.x);
            newHeight = Math.max(MIN_HEIGHT, dragStartGraphBounds.height + delta.y);
            deltaX = dragStartGraphBounds.width - newWidth;
            break;
          case 3: // Bottom-right
            newWidth = Math.max(MIN_WIDTH, dragStartGraphBounds.width + delta.x);
            newHeight = Math.max(MIN_HEIGHT, dragStartGraphBounds.height + delta.y);
            break;
        }

        this.onResize(newWidth, newHeight);

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
}

trackLab.register("ResizeGestureHandler", ResizeGestureHandler);
