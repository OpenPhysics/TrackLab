/**
 * MeasurementToolsPanel.ts
 *
 * A compact panel positioned above the Info button that houses two toggle
 * checkboxes — one for the measuring tape overlay, one for the angle tool
 * overlay. Each checkbox uses an icon-only label styled consistently with
 * the main ControlPanel.
 *
 * Visibility of this panel is driven by the "Enable Measurement Tools"
 * preference flag (TrackLabPreferencesModel.enableMeasurementToolsProperty).
 */

import { Shape } from "scenerystack/kite";
import { Circle, Line, Node, Path, VBox } from "scenerystack/scenery";
import { Checkbox, Panel } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import {
  CONTROL_ICON_SIZE,
  CONTROL_PANEL_ROWS_SPACING,
  CONTROL_PANEL_X_MARGIN,
  CONTROL_PANEL_Y_MARGIN,
  PANEL_CORNER_RADIUS,
} from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";

// ── Icon geometry constants ──────────────────────────────────────────────────
const ICON_EDGE_INSET = 1;
const ICON_TAPE_BODY_LINE_WIDTH = 2.5;
const ICON_REEL_RADIUS = 4;
const ICON_REEL_OUTLINE_WIDTH = 1;
const ICON_REEL_DOT_RADIUS = 1.5;
const ICON_TIP_RADIUS = 2.5;
const ICON_TICK_LENGTH = 4;
const ICON_TICK_HALF_LENGTH = 2.5;
const ICON_TICK_LINE_WIDTH = 1.5;
const ICON_ARM_LINE_WIDTH = 1.5;
const ICON_ARC_RADIUS = 7;

// ── Icons ─────────────────────────────────────────────────────────────────────

/** Measuring tape: a horizontal line with a reel circle at one end and a tick
 *  mark at each end plus the midpoint to evoke a tape measure. */
function measuringTapeIcon(): Node {
  const cy = CONTROL_ICON_SIZE / 2;
  const x0 = ICON_EDGE_INSET;
  const x1 = CONTROL_ICON_SIZE - ICON_EDGE_INSET;
  const xMid = CONTROL_ICON_SIZE / 2;
  return new Node({
    children: [
      // Tape body line
      new Line(x0, cy, x1, cy, {
        stroke: TrackLabColors.measuringTapeColorProperty,
        lineWidth: ICON_TAPE_BODY_LINE_WIDTH,
      }),
      // Reel circle (left end)
      new Circle(ICON_REEL_RADIUS, {
        fill: TrackLabColors.measuringTapeColorProperty,
        stroke: TrackLabColors.iconShadowProperty,
        lineWidth: ICON_REEL_OUTLINE_WIDTH,
        x: x0,
        y: cy,
      }),
      // Inner dot of reel
      new Circle(ICON_REEL_DOT_RADIUS, { fill: TrackLabColors.iconShadowProperty, x: x0, y: cy }),
      // Right tip circle
      new Circle(ICON_TIP_RADIUS, {
        fill: TrackLabColors.measuringTapeColorProperty,
        stroke: TrackLabColors.iconShadowProperty,
        lineWidth: ICON_REEL_OUTLINE_WIDTH,
        x: x1,
        y: cy,
      }),
      // Tick marks at left, mid, right
      new Line(x0, cy - ICON_TICK_LENGTH, x0, cy + ICON_TICK_LENGTH, {
        stroke: TrackLabColors.measuringTapeColorProperty,
        lineWidth: ICON_TICK_LINE_WIDTH,
      }),
      new Line(xMid, cy - ICON_TICK_HALF_LENGTH, xMid, cy + ICON_TICK_HALF_LENGTH, {
        stroke: TrackLabColors.measuringTapeColorProperty,
        lineWidth: ICON_TICK_LINE_WIDTH,
      }),
      new Line(x1, cy - ICON_TICK_LENGTH, x1, cy + ICON_TICK_LENGTH, {
        stroke: TrackLabColors.measuringTapeColorProperty,
        lineWidth: ICON_TICK_LINE_WIDTH,
      }),
    ],
  });
}

/** Angle tool: two lines meeting at a bottom-left vertex with a small arc
 *  showing the angle between them. */
function angleToolIcon(): Node {
  // Vertex at bottom-left, arm1 goes up-right, arm2 goes right
  const vx = 2;
  const vy = CONTROL_ICON_SIZE - 2;
  const a1x = CONTROL_ICON_SIZE - 2;
  const a1y = 2;
  const a2x = CONTROL_ICON_SIZE - 2;
  const a2y = CONTROL_ICON_SIZE - 2;
  const angle1 = Math.atan2(a1y - vy, a1x - vx);
  const angle2 = Math.atan2(a2y - vy, a2x - vx);
  const arcShape = new Shape().arc(vx, vy, ICON_ARC_RADIUS, angle1, angle2, false);
  return new Node({
    children: [
      new Line(vx, vy, a1x, a1y, { stroke: TrackLabColors.angleToolColorProperty, lineWidth: ICON_ARM_LINE_WIDTH }),
      new Line(vx, vy, a2x, a2y, { stroke: TrackLabColors.angleToolColorProperty, lineWidth: ICON_ARM_LINE_WIDTH }),
      new Path(arcShape, { stroke: TrackLabColors.angleToolColorProperty, lineWidth: ICON_ARM_LINE_WIDTH }),
    ],
  });
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeRow(icon: Node, property: import("scenerystack/axon").BooleanProperty, accessibleName: string): Checkbox {
  return new Checkbox(property, icon, {
    checkboxColor: TrackLabColors.checkboxColorProperty,
    checkboxColorBackground: TrackLabColors.checkboxColorBackgroundProperty,
    accessibleName,
  });
}

// ── MeasurementToolsPanel ────────────────────────────────────────────────────

/**
 * Compact toggle panel for the measuring tape and angle tool overlays.
 * Positioned above the Info button by SimScreenView.
 */
export class MeasurementToolsPanel extends Panel {
  public constructor(model: SimModel) {
    const a11yStrings = StringManager.getInstance().getA11y();

    const rows = new VBox({
      children: [
        makeRow(
          measuringTapeIcon(),
          model.overlayTools.measuringTapeVisibleProperty,
          a11yStrings.toggleMeasuringTapeStringProperty.value,
        ),
        makeRow(angleToolIcon(), model.overlayTools.angleToolVisibleProperty, a11yStrings.toggleAngleToolStringProperty.value),
      ],
      spacing: CONTROL_PANEL_ROWS_SPACING,
      align: "left",
    });

    super(rows, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: PANEL_CORNER_RADIUS,
      xMargin: CONTROL_PANEL_X_MARGIN,
      yMargin: CONTROL_PANEL_Y_MARGIN,
    });
  }
}
