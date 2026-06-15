/**
 * Handles drag-to-reposition for the graph panel's header bar.
 *
 * Dragging the header bar moves the graph's drag-target node (typically the
 * top-level graph node) and toggles `isDraggingProperty` for visual feedback.
 */

import type { BooleanProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { type Node, type Rectangle, RichDragListener } from "scenerystack/scenery";
import { Tandem } from "scenerystack/tandem";
import { OVERLAY_DRAG_SPEED, OVERLAY_SHIFT_DRAG_SPEED } from "../../TrackLabConstants.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";

export interface HeaderDragElements {
  headerBar: Rectangle;
  graphNode: Node;
  /** If provided, this node is moved instead of graphNode. */
  dragTargetNode?: Node | undefined;
}

export default class HeaderDragHandler {
  private readonly headerBar: Rectangle;
  private readonly dragTargetNode: Node;
  private readonly isDraggingProperty: BooleanProperty;

  public constructor(elements: HeaderDragElements, isDraggingProperty: BooleanProperty) {
    this.headerBar = elements.headerBar;
    this.dragTargetNode = elements.dragTargetNode ?? elements.graphNode;
    this.isDraggingProperty = isDraggingProperty;
  }

  /**
   * Attach the header-drag listener.
   * Must be called once after construction.
   */
  public initialize(): void {
    this.setupHeaderDrag();
  }

  // ── Private setup ──────────────────────────────────────────────────────────

  private setupHeaderDrag(): void {
    let dragStartPosition: Vector2 | null = null;
    let dragStartPointerPoint: Vector2 | null = null;

    this.headerBar.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          start: (event) => {
            this.headerBar.focus();
            dragStartPosition = new Vector2(this.dragTargetNode.x, this.dragTargetNode.y);
            dragStartPointerPoint = event.pointer.point.copy();
            this.isDraggingProperty.value = true;
          },

          drag: (event) => {
            if (!(dragStartPosition && dragStartPointerPoint)) {
              return;
            }
            const delta = event.pointer.point.minus(dragStartPointerPoint);
            this.dragTargetNode.x = dragStartPosition.x + delta.x;
            this.dragTargetNode.y = dragStartPosition.y + delta.y;
          },

          end: () => {
            dragStartPosition = null;
            dragStartPointerPoint = null;
            this.isDraggingProperty.value = false;
          },
        },
        keyboardDragListenerOptions: {
          dragSpeed: OVERLAY_DRAG_SPEED,
          shiftDragSpeed: OVERLAY_SHIFT_DRAG_SPEED,
          start: () => {
            this.isDraggingProperty.value = true;
          },
          drag: (_event, listener) => {
            this.dragTargetNode.x += listener.modelDelta.x;
            this.dragTargetNode.y += listener.modelDelta.y;
          },
          end: () => {
            this.isDraggingProperty.value = false;
          },
        },
        tandem: Tandem.OPT_OUT,
      }),
    );
  }
}

TrackLabNamespace.register("HeaderDragHandler", HeaderDragHandler);
