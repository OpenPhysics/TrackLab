/**
 * Handles drag-to-reposition for the graph panel's header bar.
 *
 * Dragging the header bar moves the graph's drag-target node (typically the
 * top-level graph node) and toggles `isDraggingProperty` for visual feedback.
 */

import type { BooleanProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { DragListener, type Node, type Rectangle } from "scenerystack/scenery";
import trackLab from "../../TrackLabNamespace.js";

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

    const dragListener = new DragListener({
      start: (event) => {
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
    });

    this.headerBar.addInputListener(dragListener);
  }
}

trackLab.register("HeaderDragHandler", HeaderDragHandler);
