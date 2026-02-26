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
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import {
  LABEL_PANEL_CORNER_RADIUS,
  LABEL_PANEL_SCALE,
  LABEL_PANEL_X_MARGIN,
  LABEL_PANEL_Y_MARGIN,
  OVERLAY_DRAG_SPEED,
  OVERLAY_SHIFT_DRAG_SPEED,
  OVERLAY_TOUCH_DILATION,
} from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import type { OverlayToolsModel } from "../model/OverlayToolsModel.js";

// ── Visual constants ──────────────────────────────────────────────────────────
const ARM_LINE_WIDTH = 2.5;
const ARM_SHADOW_WIDTH = 5;
const ARM_DASH: number[] = [8, 4];

const ARC_RADIUS = 28;
const ARC_LINE_WIDTH = 2;

const VERTEX_RADIUS = 7;
const ENDPOINT_RADIUS = 5;
const VERTEX_OUTLINE_WIDTH = 1.5;
const ARM_ENDPOINT_LINE_WIDTH = 2;

const FONT = new PhetFont({ size: 12, weight: "bold" });
const LABEL_OFFSET = ARC_RADIUS + 20; // distance from vertex to label centre

// Minimum arm length below which the arc and label are hidden to avoid
// degenerate geometry (zero-length arm → atan2 is undefined).
const MIN_ARM_LENGTH = 5;
const ANGLE_DECIMAL_PLACES = 1;

/**
 * Three-handle angle tool. Drag the vertex to reposition the whole tool's
 * origin; drag each arm tip to change the angle measured.
 */
export class AngleToolNode extends Node {
  private readonly disposeAngleToolNode: () => void;

  public constructor(visibleProperty: TReadOnlyProperty<boolean>, model: OverlayToolsModel) {
    super();

    const a11yStrings = StringManager.getInstance().getA11y();

    // ── Arm shadow lines ──────────────────────────────────────────────────
    const shadow1 = new Line(0, 0, 0, 0, {
      stroke: TrackLabColors.angleToolShadowProperty,
      lineWidth: ARM_SHADOW_WIDTH,
    });
    const shadow2 = new Line(0, 0, 0, 0, {
      stroke: TrackLabColors.angleToolShadowProperty,
      lineWidth: ARM_SHADOW_WIDTH,
    });
    this.addChild(shadow1);
    this.addChild(shadow2);

    // ── Arm lines ─────────────────────────────────────────────────────────
    const arm1Line = new Line(0, 0, 0, 0, {
      stroke: TrackLabColors.angleToolColorProperty,
      lineWidth: ARM_LINE_WIDTH,
      lineDash: ARM_DASH,
    });
    const arm2Line = new Line(0, 0, 0, 0, {
      stroke: TrackLabColors.angleToolColorProperty,
      lineWidth: ARM_LINE_WIDTH,
      lineDash: ARM_DASH,
    });
    this.addChild(arm1Line);
    this.addChild(arm2Line);

    // ── Arc at vertex ─────────────────────────────────────────────────────
    const arcPath = new Path(null, {
      stroke: TrackLabColors.angleToolColorProperty,
      lineWidth: ARC_LINE_WIDTH,
    });
    this.addChild(arcPath);

    // ── Vertex handle ─────────────────────────────────────────────────────
    const vertexNode = new Circle(VERTEX_RADIUS, {
      fill: TrackLabColors.angleToolColorProperty,
      stroke: TrackLabColors.overlayHandleOutlineProperty,
      lineWidth: VERTEX_OUTLINE_WIDTH,
      cursor: "grab",
      tagName: "div",
      focusable: true,
      accessibleName: a11yStrings.angleToolVertexStringProperty,
    });
    const vertexTouchArea = Shape.circle(0, 0, VERTEX_RADIUS + OVERLAY_TOUCH_DILATION);
    vertexNode.mouseArea = vertexTouchArea;
    vertexNode.touchArea = vertexTouchArea;
    this.addChild(vertexNode);

    // ── Arm endpoint handles ──────────────────────────────────────────────
    const makeArmEndpoint = (accessibleName: TReadOnlyProperty<string>) => {
      const node = new Circle(ENDPOINT_RADIUS, {
        fill: "transparent",
        stroke: TrackLabColors.angleToolColorProperty,
        lineWidth: ARM_ENDPOINT_LINE_WIDTH,
        cursor: "crosshair",
        tagName: "div",
        focusable: true,
        accessibleName,
      });
      const touchArea = Shape.circle(0, 0, ENDPOINT_RADIUS + OVERLAY_TOUCH_DILATION);
      node.mouseArea = touchArea;
      node.touchArea = touchArea;
      return node;
    };
    const arm1Node = makeArmEndpoint(a11yStrings.angleArm1StringProperty);
    const arm2Node = makeArmEndpoint(a11yStrings.angleArm2StringProperty);
    this.addChild(arm1Node);
    this.addChild(arm2Node);

    // ── Angle label ───────────────────────────────────────────────────────
    const angleText = new Text("", {
      font: FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });
    const labelPanel = new Panel(angleText, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: LABEL_PANEL_CORNER_RADIUS,
      xMargin: LABEL_PANEL_X_MARGIN,
      yMargin: LABEL_PANEL_Y_MARGIN,
    });
    labelPanel.setScaleMagnitude(LABEL_PANEL_SCALE);
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
        angleText.string = `${angleDeg.toFixed(ANGLE_DECIMAL_PLACES)}\u00b0`;

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
        keyboardDragListenerOptions: { dragSpeed: OVERLAY_DRAG_SPEED, shiftDragSpeed: OVERLAY_SHIFT_DRAG_SPEED },
        tandem: Tandem.OPT_OUT,
      }),
    );
    arm1Node.addInputListener(
      new RichDragListener({
        positionProperty: model.angleArm1Property,
        keyboardDragListenerOptions: { dragSpeed: OVERLAY_DRAG_SPEED, shiftDragSpeed: OVERLAY_SHIFT_DRAG_SPEED },
        tandem: Tandem.OPT_OUT,
      }),
    );
    arm2Node.addInputListener(
      new RichDragListener({
        positionProperty: model.angleArm2Property,
        keyboardDragListenerOptions: { dragSpeed: OVERLAY_DRAG_SPEED, shiftDragSpeed: OVERLAY_SHIFT_DRAG_SPEED },
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

trackLab.register("AngleToolNode", AngleToolNode);
