/**
 * MeasuringTapeNode.ts
 *
 * A custom measuring tape overlay for video analysis. Two draggable endpoints
 * connected by a tape-styled line; a label at the midpoint displays the
 * real-world distance computed via the current model-view transform.
 *
 * Both endpoints are intentionally symmetric in appearance and interaction.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Multilink } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Circle, Line, Node, RichDragListener, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Panel } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import type { SimModel } from "../model/SimModel.js";

// ── Visual constants ──────────────────────────────────────────────────────────
const TAPE_COLOR = "rgb(240, 185, 55)";
const TAPE_SHADOW_COLOR = "rgba(0, 0, 0, 0.45)";
const TAPE_LINE_WIDTH = 4;
const TAPE_SHADOW_WIDTH = 7;
const TAPE_DASH: number[] = [10, 5];

const ENDPOINT_RADIUS = 7;
const TOUCH_DILATION = 12;

const FONT = new PhetFont({ size: 12, weight: "bold" });
const LABEL_Y_OFFSET = 16; // pixels above the midpoint

const DRAG_SPEED = 200;
const SHIFT_DRAG_SPEED = 40;

/**
 * Two-endpoint measuring tape overlay. Both endpoints are independently draggable.
 * A real-world distance label sits above the midpoint of the tape.
 */
export class MeasuringTapeNode extends Node {
  private readonly disposeMeasuringTapeNode: () => void;

  public constructor(visibleProperty: TReadOnlyProperty<boolean>, model: SimModel) {
    super();

    // ── Shadow line (contrast on any background) ──────────────────────────
    const shadowLine = new Line(0, 0, 0, 0, {
      stroke: TAPE_SHADOW_COLOR,
      lineWidth: TAPE_SHADOW_WIDTH,
    });
    this.addChild(shadowLine);

    // ── Main tape line ────────────────────────────────────────────────────
    const tapeLine = new Line(0, 0, 0, 0, {
      stroke: TAPE_COLOR,
      lineWidth: TAPE_LINE_WIDTH,
      lineDash: TAPE_DASH,
    });
    this.addChild(tapeLine);

    const makeEndpoint = (accessibleName: string) => {
      const endpointCircle = new Circle(ENDPOINT_RADIUS, {
        fill: TAPE_COLOR,
        stroke: "rgba(0, 0, 0, 0.65)",
        lineWidth: 1.5,
      });
      const endpointDot = new Circle(2.5, { fill: "rgba(0, 0, 0, 0.65)" });
      const endpointNode = new Node({
        children: [endpointCircle, endpointDot],
        cursor: "grab",
        tagName: "div",
        focusable: true,
        accessibleName,
      });
      const endpointTouchArea = Shape.circle(0, 0, ENDPOINT_RADIUS + TOUCH_DILATION);
      endpointNode.mouseArea = endpointTouchArea;
      endpointNode.touchArea = endpointTouchArea;
      return endpointNode;
    };

    // ── Symmetric endpoints ────────────────────────────────────────────────
    const endpoint1Node = makeEndpoint("Measuring tape base");
    const endpoint2Node = makeEndpoint("Measuring tape tip");
    this.addChild(endpoint1Node);
    this.addChild(endpoint2Node);

    // ── Distance label ────────────────────────────────────────────────────
    const distanceText = new Text("---", {
      font: FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });
    const labelPanel = new Panel(distanceText, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: 4,
      xMargin: 6,
      yMargin: 3,
    });
    labelPanel.setScaleMagnitude(0.8);
    this.addChild(labelPanel);

    // ── Geometry + label multilinks ───────────────────────────────────────
    const geometryMultilink = Multilink.multilink([model.tapPoint1Property, model.tapPoint2Property], (p1, p2) => {
      shadowLine.setLine(p1.x, p1.y, p2.x, p2.y);
      tapeLine.setLine(p1.x, p1.y, p2.x, p2.y);
      endpoint1Node.translation = p1;
      endpoint2Node.translation = p2;
      const mid = p1.blend(p2, 0.5);
      labelPanel.centerX = mid.x;
      labelPanel.bottom = mid.y - LABEL_Y_OFFSET;
    });

    const labelMultilink = Multilink.multilink(
      [model.tapPoint1Property, model.tapPoint2Property, model.modelViewTransformProperty, model.calibUnitProperty],
      (p1, p2, mvt, unit) => {
        const m1 = mvt.inversePosition2(p1);
        const m2 = mvt.inversePosition2(p2);
        distanceText.string = `${m1.distance(m2).toFixed(2)} ${unit}`;
      },
    );

    // ── Drag listeners ────────────────────────────────────────────────────
    endpoint1Node.addInputListener(
      new RichDragListener({
        positionProperty: model.tapPoint1Property,
        keyboardDragListenerOptions: { dragSpeed: DRAG_SPEED, shiftDragSpeed: SHIFT_DRAG_SPEED },
        tandem: Tandem.OPT_OUT,
      }),
    );
    endpoint2Node.addInputListener(
      new RichDragListener({
        positionProperty: model.tapPoint2Property,
        keyboardDragListenerOptions: { dragSpeed: DRAG_SPEED, shiftDragSpeed: SHIFT_DRAG_SPEED },
        tandem: Tandem.OPT_OUT,
      }),
    );

    // ── Visibility ────────────────────────────────────────────────────────
    const visibleListener = (visible: boolean) => {
      this.visible = visible;
    };
    visibleProperty.link(visibleListener);

    this.disposeMeasuringTapeNode = () => {
      geometryMultilink.dispose();
      labelMultilink.dispose();
      visibleProperty.unlink(visibleListener);
    };
  }

  public override dispose(): void {
    this.disposeMeasuringTapeNode();
    super.dispose();
  }
}
