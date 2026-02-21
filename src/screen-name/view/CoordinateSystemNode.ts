import type { TReadOnlyProperty } from "scenerystack/axon";
import type { Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Circle, Node, RichDragListener, Text } from "scenerystack/scenery";
import { ArrowNode, PhetFont } from "scenerystack/scenery-phet";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import type { SimModel } from "../model/SimModel.js";
const ARROW_LENGTH = 120;
const HANDLE_FRACTION = 1 / 3;
const FONT = new PhetFont({ size: 14, weight: "bold" });

const ARROW_HEAD_WIDTH = 12;
const ARROW_HEAD_HEIGHT = 10;
const ARROW_TAIL_WIDTH = 3;
const LABEL_OFFSET_X = 6; // gap between arrow tip and axis label
const LABEL_OFFSET_Y = 4; // gap between arrow tip and axis label
const HANDLE_RADIUS = 8; // rotation handle disk radius
const HANDLE_TOUCH_DILATION = 12; // extra pixels for easier pickup (mouseArea/touchArea)
const HANDLE_LINE_WIDTH = 1.5;
const ORIGIN_RADIUS = 5; // origin marker circle radius
const ORIGIN_TOUCH_DILATION = 12; // extra pixels for easier pickup (mouseArea/touchArea)
const ORIGIN_LINE_WIDTH = 1;
const TRANSLATE_DRAG_SPEED = 300; // pixels/s for normal keyboard drag
const TRANSLATE_SHIFT_DRAG_SPEED = 50; // pixels/s for shift-key keyboard drag
const ROTATE_DRAG_SPEED = 100; // degrees/s (converted to radians) for keyboard rotation
const ROTATE_SHIFT_DRAG_SPEED = 20;
const DEG_TO_RAD = Math.PI / 180;

export class CoordinateSystemNode extends Node {
  private readonly disposeCoordinateSystemNode: () => void;

  public constructor(
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    model: SimModel,
  ) {
    super();

    const coordStrings = StringManager.getInstance().getCoordSystem();

    // ── Rotating node: axes + rotation handle ─────────────────────────────
    const rotatingNode = new Node();

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

    rotatingNode.addChild(
      new Text(coordStrings.xAxisLabelStringProperty, {
        font: FONT,
        fill: TrackLabColors.axisXColorProperty,
        left: ARROW_LENGTH + LABEL_OFFSET_X,
        centerY: 0,
      }),
    );

    rotatingNode.addChild(
      new Text(coordStrings.yAxisLabelStringProperty, {
        font: FONT,
        fill: TrackLabColors.axisYColorProperty,
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
      accessibleName: "Rotation Handle",
    });
    const handleTouchArea = Shape.circle(
      0,
      0,
      HANDLE_RADIUS + HANDLE_TOUCH_DILATION,
    );
    handleDisk.mouseArea = handleTouchArea;
    handleDisk.touchArea = handleTouchArea;
    rotatingNode.addChild(handleDisk);

    // ── Origin marker ─────────────────────────────────────────────────────
    const originMarker = new Circle(ORIGIN_RADIUS, {
      fill: TrackLabColors.originFillProperty,
      stroke: TrackLabColors.originStrokeProperty,
      lineWidth: ORIGIN_LINE_WIDTH,
    });

    // ── Position wrapper: translates with model.coordOriginProperty ───────
    const positionNode = new Node({
      children: [rotatingNode, originMarker],
      cursor: "move",
      tagName: "div",
      focusable: true,
      accessibleName: "Coordinate System",
    });
    // Expand touch/mouse area for easier pickup (origin + axes region)
    positionNode.boundsProperty.lazyLink(() => {
      const dilated = positionNode.localBounds.dilatedXY(
        ORIGIN_TOUCH_DILATION,
        ORIGIN_TOUCH_DILATION,
      );
      positionNode.mouseArea = dilated;
      positionNode.touchArea = dilated;
    });
    this.addChild(positionNode);

    // ── Property → scene-graph linkage ────────────────────────────────────
    const onOriginChange = (pos: Vector2) => {
      positionNode.translation = pos;
    };
    model.coordOriginProperty.link(onOriginChange);

    const onAngleChange = (angle: number) => {
      rotatingNode.rotation = angle;
    };
    model.coordAngleProperty.link(onAngleChange);

    // ── Drag: translate the entire coordinate system ──────────────────────
    positionNode.addInputListener(
      new RichDragListener({
        positionProperty: model.coordOriginProperty,
        keyboardDragListenerOptions: {
          dragSpeed: TRANSLATE_DRAG_SPEED,
          shiftDragSpeed: TRANSLATE_SHIFT_DRAG_SPEED,
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
          drag: (event) => {
            const p = positionNode.globalToLocalPoint(event.pointer.point);
            model.coordAngleProperty.value = Math.atan2(p.y, p.x);
          },
        },
        keyboardDragListenerOptions: {
          keyboardDragDirection: "leftRight",
          dragSpeed: ROTATE_DRAG_SPEED,
          shiftDragSpeed: ROTATE_SHIFT_DRAG_SPEED,
          drag: (_event, listener) => {
            model.coordAngleProperty.value +=
              listener.modelDelta.x * DEG_TO_RAD;
          },
        },
        tandem: Tandem.OPT_OUT,
      }),
    );

    // ── Visibility: only shown once a video with a finite duration is loaded
    const onVideoLoaded = (loaded: boolean) => {
      this.visible = loaded;
    };
    videoLoadedProperty.link(onVideoLoaded);

    this.disposeCoordinateSystemNode = () => {
      model.coordOriginProperty.unlink(onOriginChange);
      model.coordAngleProperty.unlink(onAngleChange);
      videoLoadedProperty.unlink(onVideoLoaded);
    };
  }

  public override dispose(): void {
    this.disposeCoordinateSystemNode();
    super.dispose();
  }
}
