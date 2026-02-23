/**
 * AngleToolNode.ts
 *
 * A custom angle measurement overlay for video analysis. Three draggable
 * handles — a vertex and two arm endpoints — define two rays. An arc drawn at
 * the vertex shows the enclosed angle, and a label displays the value in degrees.
 *
 * The vertex is drawn as a slightly larger filled circle; arm endpoints are
 * smaller open circles. All three handles are independently draggable.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Multilink } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Circle, Line, Node, Path, RichDragListener, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Panel } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import type { SimModel } from "../model/SimModel.js";

// ── Visual constants ──────────────────────────────────────────────────────────
const ARM_COLOR = "rgb(170, 100, 255)";
const ARM_SHADOW_COLOR = "rgba(0, 0, 0, 0.45)";
const ARM_LINE_WIDTH = 2.5;
const ARM_SHADOW_WIDTH = 5;
const ARM_DASH: number[] = [8, 4];

const ARC_RADIUS = 28;
const ARC_LINE_WIDTH = 2;

const VERTEX_RADIUS = 7;
const ENDPOINT_RADIUS = 5;
const TOUCH_DILATION = 12;

const FONT = new PhetFont({ size: 12, weight: "bold" });
const LABEL_OFFSET = ARC_RADIUS + 20; // distance from vertex to label centre

const DRAG_SPEED = 200;
const SHIFT_DRAG_SPEED = 40;

// Minimum arm length below which the arc and label are hidden to avoid
// degenerate geometry (zero-length arm → atan2 is undefined).
const MIN_ARM_LENGTH = 5;

/**
 * Three-handle angle tool. Drag the vertex to reposition the whole tool's
 * origin; drag each arm tip to change the angle measured.
 */
export class AngleToolNode extends Node {
  private readonly disposeAngleToolNode: () => void;

  public constructor(visibleProperty: TReadOnlyProperty<boolean>, model: SimModel) {
    super();

    // ── Arm shadow lines ──────────────────────────────────────────────────
    const shadow1 = new Line(0, 0, 0, 0, {
      stroke: ARM_SHADOW_COLOR,
      lineWidth: ARM_SHADOW_WIDTH,
    });
    const shadow2 = new Line(0, 0, 0, 0, {
      stroke: ARM_SHADOW_COLOR,
      lineWidth: ARM_SHADOW_WIDTH,
    });
    this.addChild(shadow1);
    this.addChild(shadow2);

    // ── Arm lines ─────────────────────────────────────────────────────────
    const arm1Line = new Line(0, 0, 0, 0, {
      stroke: ARM_COLOR,
      lineWidth: ARM_LINE_WIDTH,
      lineDash: ARM_DASH,
    });
    const arm2Line = new Line(0, 0, 0, 0, {
      stroke: ARM_COLOR,
      lineWidth: ARM_LINE_WIDTH,
      lineDash: ARM_DASH,
    });
    this.addChild(arm1Line);
    this.addChild(arm2Line);

    // ── Arc at vertex ─────────────────────────────────────────────────────
    const arcPath = new Path(null, {
      stroke: ARM_COLOR,
      lineWidth: ARC_LINE_WIDTH,
    });
    this.addChild(arcPath);

    // ── Vertex handle ─────────────────────────────────────────────────────
    const vertexNode = new Circle(VERTEX_RADIUS, {
      fill: ARM_COLOR,
      stroke: "rgba(0, 0, 0, 0.65)",
      lineWidth: 1.5,
      cursor: "grab",
      tagName: "div",
      focusable: true,
      accessibleName: "Angle tool vertex",
    });
    const vertexTouchArea = Shape.circle(0, 0, VERTEX_RADIUS + TOUCH_DILATION);
    vertexNode.mouseArea = vertexTouchArea;
    vertexNode.touchArea = vertexTouchArea;
    this.addChild(vertexNode);

    // ── Arm endpoint handles ──────────────────────────────────────────────
    const makeArmEndpoint = (accessibleName: string) => {
      const node = new Circle(ENDPOINT_RADIUS, {
        fill: "transparent",
        stroke: ARM_COLOR,
        lineWidth: 2,
        cursor: "crosshair",
        tagName: "div",
        focusable: true,
        accessibleName,
      });
      const touchArea = Shape.circle(0, 0, ENDPOINT_RADIUS + TOUCH_DILATION);
      node.mouseArea = touchArea;
      node.touchArea = touchArea;
      return node;
    };
    const arm1Node = makeArmEndpoint("Angle arm 1");
    const arm2Node = makeArmEndpoint("Angle arm 2");
    this.addChild(arm1Node);
    this.addChild(arm2Node);

    // ── Angle label ───────────────────────────────────────────────────────
    const angleText = new Text("---", {
      font: FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });
    const labelPanel = new Panel(angleText, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: 4,
      xMargin: 6,
      yMargin: 3,
    });
    labelPanel.setScaleMagnitude(0.8);
    this.addChild(labelPanel);

    // ── Geometry multilink ────────────────────────────────────────────────
    const geometryMultilink = Multilink.multilink(
      [model.angleVertexProperty, model.angleArm1Property, model.angleArm2Property],
      (vertex, arm1, arm2) => {
        // Lines
        shadow1.setLine(vertex.x, vertex.y, arm1.x, arm1.y);
        shadow2.setLine(vertex.x, vertex.y, arm2.x, arm2.y);
        arm1Line.setLine(vertex.x, vertex.y, arm1.x, arm1.y);
        arm2Line.setLine(vertex.x, vertex.y, arm2.x, arm2.y);

        // Handle positions
        vertexNode.translation = vertex;
        arm1Node.translation = arm1;
        arm2Node.translation = arm2;

        // Arm vectors relative to vertex
        const v1 = arm1.minus(vertex);
        const v2 = arm2.minus(vertex);
        const len1 = v1.magnitude;
        const len2 = v2.magnitude;

        if (len1 < MIN_ARM_LENGTH || len2 < MIN_ARM_LENGTH) {
          arcPath.shape = null;
          labelPanel.visible = false;
          return;
        }

        labelPanel.visible = true;

        // Arc spanning from arm1 direction to arm2 direction (shorter arc)
        const a1 = Math.atan2(v1.y, v1.x);
        const a2 = Math.atan2(v2.y, v2.x);
        let diff = a2 - a1;
        // Normalise diff to [-π, π] so we always draw the interior angle
        while (diff > Math.PI) {
          diff -= 2 * Math.PI;
        }
        while (diff < -Math.PI) {
          diff += 2 * Math.PI;
        }

        const anticlockwise = diff < 0;
        arcPath.shape = new Shape().arc(vertex.x, vertex.y, ARC_RADIUS, a1, a2, anticlockwise);

        // Angle value
        const angleDeg = (Math.abs(diff) * 180) / Math.PI;
        angleText.string = `${angleDeg.toFixed(1)}\u00b0`;

        // Label along the bisector, outside the arc
        const bisectorAngle = a1 + diff / 2;
        labelPanel.centerX = vertex.x + LABEL_OFFSET * Math.cos(bisectorAngle);
        labelPanel.centerY = vertex.y + LABEL_OFFSET * Math.sin(bisectorAngle);
      },
    );

    // ── Drag listeners ────────────────────────────────────────────────────
    vertexNode.addInputListener(
      new RichDragListener({
        positionProperty: model.angleVertexProperty,
        keyboardDragListenerOptions: { dragSpeed: DRAG_SPEED, shiftDragSpeed: SHIFT_DRAG_SPEED },
        tandem: Tandem.OPT_OUT,
      }),
    );
    arm1Node.addInputListener(
      new RichDragListener({
        positionProperty: model.angleArm1Property,
        keyboardDragListenerOptions: { dragSpeed: DRAG_SPEED, shiftDragSpeed: SHIFT_DRAG_SPEED },
        tandem: Tandem.OPT_OUT,
      }),
    );
    arm2Node.addInputListener(
      new RichDragListener({
        positionProperty: model.angleArm2Property,
        keyboardDragListenerOptions: { dragSpeed: DRAG_SPEED, shiftDragSpeed: SHIFT_DRAG_SPEED },
        tandem: Tandem.OPT_OUT,
      }),
    );

    // ── Visibility ────────────────────────────────────────────────────────
    const visibleListener = (visible: boolean) => {
      this.visible = visible;
    };
    visibleProperty.link(visibleListener);

    this.disposeAngleToolNode = () => {
      geometryMultilink.dispose();
      visibleProperty.unlink(visibleListener);
    };
  }

  public override dispose(): void {
    this.disposeAngleToolNode();
    super.dispose();
  }
}
