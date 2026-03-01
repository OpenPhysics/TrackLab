/**
 * CoordinateSystemNode.ts
 *
 * Draggable and rotatable coordinate system axes overlay for defining the origin
 * and orientation of the real-world coordinate frame in the video.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Matrix3, type Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Circle, Node, RichDragListener, Text } from "scenerystack/scenery";
import { ArrowNode, PhetFont } from "scenerystack/scenery-phet";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import trackLab from "../../TrackLabNamespace.js";
import type { OverlayToolsModel } from "../model/OverlayToolsModel.js";
import { DigitizingAwareOverlayNode } from "./DigitizingAwareOverlayNode.js";

const ARROW_LENGTH = 120;
const HANDLE_FRACTION = 1 / 3;
const FONT = new PhetFont({ size: 14, weight: "bold" });

const ARROW_HEAD_WIDTH = 12;
const ARROW_HEAD_HEIGHT = 10;
const ARROW_TAIL_WIDTH = 3;
const SHADOW_ARROW_HEAD_WIDTH = 16; // wider shadow for contrast outline
const SHADOW_ARROW_HEAD_HEIGHT = 14;
const SHADOW_ARROW_TAIL_WIDTH = 7;
const LABEL_OFFSET_X = 6; // gap between arrow tip and axis label
const LABEL_OFFSET_Y = 4; // gap between arrow tip and axis label
const LABEL_STROKE_WIDTH = 0.6; // outline width for axis label text
const HANDLE_RADIUS = 8; // rotation handle disk radius
const HANDLE_TOUCH_DILATION = 10;
const HANDLE_MOUSE_DILATION = 4;
const HANDLE_LINE_WIDTH = 1.5;
const ORIGIN_RADIUS = 5; // origin marker circle radius
const ORIGIN_SHADOW_LINE_WIDTH = 4; // wider outline for contrast
const AXIS_TOUCH_WIDTH = 16; // half-width of the touch area along axes
const AXIS_MOUSE_WIDTH = 8; // half-width of the mouse area along axes
const ORIGIN_LINE_WIDTH = 1;
const TRANSLATE_DRAG_SPEED = 300; // pixels/s for normal keyboard drag
const TRANSLATE_SHIFT_DRAG_SPEED = 50; // pixels/s for shift-key keyboard drag
const ROTATE_DRAG_SPEED = 100; // degrees/s (converted to radians) for keyboard rotation
const ROTATE_SHIFT_DRAG_SPEED = 20;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Draggable and rotatable XY-axis overlay rendered on top of the video.
 *
 * The origin can be dragged anywhere on screen; a small disk on the X axis
 * controls rotation by pointer angle. Both gestures write directly to
 * `overlayTools.coordOriginProperty` and `overlayTools.coordAngleProperty`, keeping the
 * model-view transform in sync. Keyboard drag is supported via RichDragListener.
 * Hidden until a video is loaded.
 */
export class CoordinateSystemNode extends DigitizingAwareOverlayNode {
  private readonly disposeCoordinateSystemNode: () => void;

  /**
   * @param videoLoadedProperty - Controls visibility; node is hidden until a video is loaded.
   * @param overlayTools - Provides and receives coordOriginProperty / coordAngleProperty.
   * @param activeTrackIdProperty - When non-null, dims and locks the axes to prevent accidental moves while digitizing.
   */
  public constructor(
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    overlayTools: OverlayToolsModel,
    activeTrackIdProperty: TReadOnlyProperty<string | null>,
  ) {
    super(videoLoadedProperty, activeTrackIdProperty);

    const coordStrings = StringManager.getInstance().getCoordSystem();

    // ── Rotating node: axes + rotation handle ─────────────────────────────
    const rotatingNode = new Node();

    // ── Shadow arrows (rendered first, underneath) for contrast on all backgrounds
    rotatingNode.addChild(
      new ArrowNode(0, 0, ARROW_LENGTH, 0, {
        fill: TrackLabColors.coordShadowStrokeProperty,
        stroke: null,
        headWidth: SHADOW_ARROW_HEAD_WIDTH,
        headHeight: SHADOW_ARROW_HEAD_HEIGHT,
        tailWidth: SHADOW_ARROW_TAIL_WIDTH,
      }),
    );
    rotatingNode.addChild(
      new ArrowNode(0, 0, 0, -ARROW_LENGTH, {
        fill: TrackLabColors.coordShadowStrokeProperty,
        stroke: null,
        headWidth: SHADOW_ARROW_HEAD_WIDTH,
        headHeight: SHADOW_ARROW_HEAD_HEIGHT,
        tailWidth: SHADOW_ARROW_TAIL_WIDTH,
      }),
    );

    // ── Main axis arrows (rendered on top of shadows)
    // X axis arrow (horizontal, pointing right)
    rotatingNode.addChild(
      new ArrowNode(0, 0, ARROW_LENGTH, 0, {
        fill: TrackLabColors.axisXColorProperty,
        stroke: null,
        headWidth: ARROW_HEAD_WIDTH,
        headHeight: ARROW_HEAD_HEIGHT,
        tailWidth: ARROW_TAIL_WIDTH,
      }),
    );

    // Y axis arrow (vertical, pointing up — negative Y in screen coords)
    rotatingNode.addChild(
      new ArrowNode(0, 0, 0, -ARROW_LENGTH, {
        fill: TrackLabColors.axisYColorProperty,
        stroke: null,
        headWidth: ARROW_HEAD_WIDTH,
        headHeight: ARROW_HEAD_HEIGHT,
        tailWidth: ARROW_TAIL_WIDTH,
      }),
    );

    // ── Axis labels with outline stroke for contrast
    rotatingNode.addChild(
      new Text(coordStrings.xAxisLabelStringProperty, {
        font: FONT,
        fill: TrackLabColors.axisXColorProperty,
        stroke: TrackLabColors.coordShadowStrokeProperty,
        lineWidth: LABEL_STROKE_WIDTH,
        left: ARROW_LENGTH + LABEL_OFFSET_X,
        centerY: 0,
      }),
    );

    rotatingNode.addChild(
      new Text(coordStrings.yAxisLabelStringProperty, {
        font: FONT,
        fill: TrackLabColors.axisYColorProperty,
        stroke: TrackLabColors.coordShadowStrokeProperty,
        lineWidth: LABEL_STROKE_WIDTH,
        centerX: 0,
        bottom: -ARROW_LENGTH - LABEL_OFFSET_Y,
      }),
    );

    // Small disk at 1/3 of the way along the x-axis; dragging it rotates the system
    const handleDisk = new Circle(HANDLE_RADIUS, {
      x: ARROW_LENGTH * HANDLE_FRACTION,
      y: 0,
      fill: TrackLabColors.calibrationHandleProperty,
      stroke: TrackLabColors.textOnDarkProperty,
      lineWidth: HANDLE_LINE_WIDTH,
      cursor: "crosshair",
      tagName: "div",
      focusable: true,
      accessibleName: coordStrings.rotationHandleStringProperty,
    });
    handleDisk.touchArea = Shape.circle(0, 0, HANDLE_RADIUS + HANDLE_TOUCH_DILATION);
    handleDisk.mouseArea = Shape.circle(0, 0, HANDLE_RADIUS + HANDLE_MOUSE_DILATION);
    rotatingNode.addChild(handleDisk);

    // ── Origin marker with shadow outline for contrast ──────────────────
    const originShadow = new Circle(ORIGIN_RADIUS, {
      stroke: TrackLabColors.coordShadowStrokeProperty,
      lineWidth: ORIGIN_SHADOW_LINE_WIDTH,
      fill: "transparent",
    });
    const originMarker = new Circle(ORIGIN_RADIUS, {
      fill: TrackLabColors.originFillProperty,
      stroke: TrackLabColors.originStrokeProperty,
      lineWidth: ORIGIN_LINE_WIDTH,
    });

    // ── Position wrapper: translates with overlayTools.coordOriginProperty ───────
    const positionNode = new Node({
      children: [rotatingNode, originShadow, originMarker],
      cursor: "move",
      tagName: "div",
      focusable: true,
      accessibleName: coordStrings.coordinateSystemStringProperty,
    });

    // Create a cross-shaped hit area that follows the axes rather than a huge rectangle.
    // This ensures the user must be close to an axis or the origin to drag.
    // Note: no circle is included here — Shape.transformed() cannot reliably transform
    // arc segments across browsers (Scenery asserts on this), and the overlapping
    // rectangles already provide adequate coverage at the origin.
    const createAxisHitArea = (halfWidth: number): Shape => {
      const shape = new Shape();
      // X axis rectangle (from origin to arrow tip)
      shape.rect(-halfWidth, -halfWidth, ARROW_LENGTH + halfWidth * 2, halfWidth * 2);
      // Y axis rectangle (from origin upward to arrow tip)
      shape.rect(-halfWidth, -ARROW_LENGTH - halfWidth, halfWidth * 2, ARROW_LENGTH + halfWidth * 2);
      return shape;
    };

    this.addChild(positionNode);

    // Track disposal so pending microtask callbacks become no-ops after the
    // node is removed from the scene.
    let isDisposed = false;

    // ── Property → scene-graph linkage ────────────────────────────────────
    // Scene-graph mutations are deferred to a microtask (executes before the
    // next browser repaint but after the current synchronous task completes).
    // This prevents "reentry detected" assertions that arise because Scenery
    // synchronously flushes its internal event queue whenever a node's transform
    // or hit-area changes — which can dispatch a Reset-button mouse-up (or a
    // second drag event) while Property._notifyListeners is still on the stack.
    const onOriginChange = (pos: Vector2) => {
      queueMicrotask(() => {
        if (isDisposed) {
          return;
        }
        positionNode.translation = pos;
      });
    };
    overlayTools.coordOriginProperty.link(onOriginChange);

    const onAngleChange = (angle: number) => {
      queueMicrotask(() => {
        if (isDisposed) {
          return;
        }
        rotatingNode.rotation = angle;
        // Rotate the hit areas to match the visual axes so the user cannot grab
        // a "phantom" axis at its original unrotated position.
        const m = Matrix3.rotation2(angle);
        positionNode.touchArea = createAxisHitArea(AXIS_TOUCH_WIDTH).transformed(m);
        positionNode.mouseArea = createAxisHitArea(AXIS_MOUSE_WIDTH).transformed(m);
      });
    };
    overlayTools.coordAngleProperty.link(onAngleChange);

    // ── Drag: translate the entire coordinate system ──────────────────────
    positionNode.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          start: () => {
            positionNode.focus();
          },
          drag: (_event, listener) => {
            const newPos = listener.parentPoint;
            overlayTools.coordOriginProperty.value = overlayTools.clampCoordOrigin(newPos);
          },
        },
        keyboardDragListenerOptions: {
          dragSpeed: TRANSLATE_DRAG_SPEED,
          shiftDragSpeed: TRANSLATE_SHIFT_DRAG_SPEED,
          drag: (_event, listener) => {
            const currentPos = overlayTools.coordOriginProperty.value;
            const newPos = currentPos.plus(listener.modelDelta);
            overlayTools.coordOriginProperty.value = overlayTools.clampCoordOrigin(newPos);
          },
        },
        tandem: Tandem.OPT_OUT,
      }),
    );

    // ── Drag: rotate around origin ────────────────────────────────────────
    // Dragging the handle disk updates the rotation angle based on the
    // pointer's angle relative to the coordinate-system origin.
    handleDisk.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          start: () => {
            handleDisk.focus();
          },
          drag: (event) => {
            const p = positionNode.globalToLocalPoint(event.pointer.point);
            overlayTools.coordAngleProperty.value = Math.atan2(p.y, p.x);
          },
        },
        keyboardDragListenerOptions: {
          keyboardDragDirection: "leftRight",
          dragSpeed: ROTATE_DRAG_SPEED,
          shiftDragSpeed: ROTATE_SHIFT_DRAG_SPEED,
          drag: (_event, listener) => {
            overlayTools.coordAngleProperty.value += listener.modelDelta.x * DEG_TO_RAD;
          },
        },
        tandem: Tandem.OPT_OUT,
      }),
    );

    this.disposeCoordinateSystemNode = () => {
      isDisposed = true;
      overlayTools.coordOriginProperty.unlink(onOriginChange);
      overlayTools.coordAngleProperty.unlink(onAngleChange);
    };
  }

  public override dispose(): void {
    this.disposeCoordinateSystemNode();
    super.dispose();
  }
}

trackLab.register("CoordinateSystemNode", CoordinateSystemNode);
