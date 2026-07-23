/**
 * Manages corner resize handles for the graph panel.
 *
 * Responsibilities:
 * - Create the four corner Rectangle handles via `createResizeHandles()`
 * - Attach drag listeners that enforce minimum graph dimensions and invoke
 *   the `onResize` callback with the new (width, height)
 * - Reposition handles after a resize via `updateResizeHandlePositions()`
 */

import type { BooleanProperty, TReadOnlyProperty } from "scenerystack/axon";
import type { Vector2 } from "scenerystack/dot";
import { type Node, Rectangle, RichDragListener } from "scenerystack/scenery";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import {
  OVERLAY_DRAG_SPEED,
  OVERLAY_SHIFT_DRAG_SPEED,
  RESIZE_HANDLE_CORNER_RADIUS,
  RESIZE_HANDLE_LINE_WIDTH,
  RESIZE_HANDLE_MOUSE_DILATION,
  RESIZE_HANDLE_OFFSET,
  RESIZE_HANDLE_SIZE,
  RESIZE_HANDLE_TOUCH_DILATION,
} from "../../TrackLabConstants.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";
import type { GraphDimensions } from "./GraphInteractionHandler.js";

// Minimum graph dimensions enforced while resizing (px).
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
   *
   * @param cornerA11yNames - accessible names for [top-left, top-right, bottom-left, bottom-right]
   */
  public createResizeHandles(
    cornerA11yNames: [
      TReadOnlyProperty<string>,
      TReadOnlyProperty<string>,
      TReadOnlyProperty<string>,
      TReadOnlyProperty<string>,
    ],
  ): Rectangle[] {
    const corners: Array<{ x: number; y: number; cursor: string }> = [
      { x: 0, y: 0, cursor: "nwse-resize" },
      { x: this.graphWidth, y: 0, cursor: "nesw-resize" },
      { x: 0, y: this.graphHeight, cursor: "nesw-resize" },
      { x: this.graphWidth, y: this.graphHeight, cursor: "nwse-resize" },
    ];

    corners.forEach((corner, index) => {
      const handle = new Rectangle(
        corner.x + RESIZE_HANDLE_OFFSET,
        corner.y + RESIZE_HANDLE_OFFSET,
        RESIZE_HANDLE_SIZE,
        RESIZE_HANDLE_SIZE,
        RESIZE_HANDLE_CORNER_RADIUS,
        RESIZE_HANDLE_CORNER_RADIUS,
        {
          fill: TrackLabColors.controlPanelFillProperty,
          stroke: TrackLabColors.controlPanelStrokeProperty,
          lineWidth: RESIZE_HANDLE_LINE_WIDTH,
          cursor: corner.cursor,
          tagName: "div",
          focusable: true,
          accessibleName: cornerA11yNames[index as 0 | 1 | 2 | 3],
        },
      );

      handle.touchArea = handle.localBounds.dilated(RESIZE_HANDLE_TOUCH_DILATION);
      handle.mouseArea = handle.localBounds.dilated(RESIZE_HANDLE_MOUSE_DILATION);

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
        handle.setRect(
          corner.x + RESIZE_HANDLE_OFFSET,
          corner.y + RESIZE_HANDLE_OFFSET,
          RESIZE_HANDLE_SIZE,
          RESIZE_HANDLE_SIZE,
        );
        handle.touchArea = handle.localBounds.dilated(RESIZE_HANDLE_TOUCH_DILATION);
        handle.mouseArea = handle.localBounds.dilated(RESIZE_HANDLE_MOUSE_DILATION);
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

    /**
     * Apply a resize delta from the *current* stored dimensions.
     * Used by keyboard drag (incremental per-frame deltas).
     */
    const applyIncrementalResize = (dx: number, dy: number) => {
      let newWidth = this.graphWidth;
      let newHeight = this.graphHeight;
      let nodeDeltaX = 0;
      let nodeDeltaY = 0;

      switch (cornerIndex) {
        case 0: // Top-left
          newWidth = Math.max(MIN_WIDTH, this.graphWidth - dx);
          newHeight = Math.max(MIN_HEIGHT, this.graphHeight - dy);
          nodeDeltaX = this.graphWidth - newWidth;
          nodeDeltaY = this.graphHeight - newHeight;
          break;
        case 1: // Top-right
          newWidth = Math.max(MIN_WIDTH, this.graphWidth + dx);
          newHeight = Math.max(MIN_HEIGHT, this.graphHeight - dy);
          nodeDeltaY = this.graphHeight - newHeight;
          break;
        case 2: // Bottom-left
          newWidth = Math.max(MIN_WIDTH, this.graphWidth - dx);
          newHeight = Math.max(MIN_HEIGHT, this.graphHeight + dy);
          nodeDeltaX = this.graphWidth - newWidth;
          break;
        case 3: // Bottom-right
          newWidth = Math.max(MIN_WIDTH, this.graphWidth + dx);
          newHeight = Math.max(MIN_HEIGHT, this.graphHeight + dy);
          break;
      }

      this.onResize(newWidth, newHeight);

      if (nodeDeltaX !== 0 || nodeDeltaY !== 0) {
        this.graphNode.x += nodeDeltaX;
        this.graphNode.y += nodeDeltaY;
      }
    };

    handle.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          start: (event) => {
            handle.focus();
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
            // Pointer drag: snapshot-based for accuracy (no drift).
            const delta = event.pointer.point.minus(dragStartPointerPoint);
            let newWidth = dragStartGraphBounds.width;
            let newHeight = dragStartGraphBounds.height;
            let deltaX = 0;
            let deltaY = 0;

            switch (cornerIndex) {
              case 0:
                newWidth = Math.max(MIN_WIDTH, dragStartGraphBounds.width - delta.x);
                newHeight = Math.max(MIN_HEIGHT, dragStartGraphBounds.height - delta.y);
                deltaX = dragStartGraphBounds.width - newWidth;
                deltaY = dragStartGraphBounds.height - newHeight;
                break;
              case 1:
                newWidth = Math.max(MIN_WIDTH, dragStartGraphBounds.width + delta.x);
                newHeight = Math.max(MIN_HEIGHT, dragStartGraphBounds.height - delta.y);
                deltaY = dragStartGraphBounds.height - newHeight;
                break;
              case 2:
                newWidth = Math.max(MIN_WIDTH, dragStartGraphBounds.width - delta.x);
                newHeight = Math.max(MIN_HEIGHT, dragStartGraphBounds.height + delta.y);
                deltaX = dragStartGraphBounds.width - newWidth;
                break;
              case 3:
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
  }
}

TrackLabNamespace.register("ResizeGestureHandler", ResizeGestureHandler);
