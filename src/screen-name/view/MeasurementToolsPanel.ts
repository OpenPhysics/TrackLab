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
import TrackLabColors from "../../TrackLabColors.js";
import { PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";

const ICON_SIZE = 20;
const PANEL_ROWS_SPACING = 12;
const PANEL_X_MARGIN = 12;
const PANEL_Y_MARGIN = 12;

// ── Icons ─────────────────────────────────────────────────────────────────────

/** Measuring tape: a horizontal line with a reel circle at one end and a tick
 *  mark at each end plus the midpoint to evoke a tape measure. */
function measuringTapeIcon(): Node {
  const cy = ICON_SIZE / 2;
  const color = "rgb(240, 185, 55)";
  const x0 = 1;
  const x1 = ICON_SIZE - 1;
  const xMid = ICON_SIZE / 2;
  return new Node({
    children: [
      // Tape body line
      new Line(x0, cy, x1, cy, { stroke: color, lineWidth: 2.5 }),
      // Reel circle (left end)
      new Circle(4, {
        fill: color,
        stroke: "rgba(0,0,0,0.5)",
        lineWidth: 1,
        x: x0,
        y: cy,
      }),
      // Inner dot of reel
      new Circle(1.5, { fill: "rgba(0,0,0,0.5)", x: x0, y: cy }),
      // Right tip circle
      new Circle(2.5, {
        fill: color,
        stroke: "rgba(0,0,0,0.5)",
        lineWidth: 1,
        x: x1,
        y: cy,
      }),
      // Tick marks at left, mid, right
      new Line(x0, cy - 4, x0, cy + 4, { stroke: color, lineWidth: 1.5 }),
      new Line(xMid, cy - 2.5, xMid, cy + 2.5, { stroke: color, lineWidth: 1.5 }),
      new Line(x1, cy - 4, x1, cy + 4, { stroke: color, lineWidth: 1.5 }),
    ],
  });
}

/** Angle tool: two lines meeting at a bottom-left vertex with a small arc
 *  showing the angle between them. */
function angleToolIcon(): Node {
  const color = "rgb(170, 100, 255)";
  // Vertex at bottom-left, arm1 goes up-right, arm2 goes right
  const vx = 2;
  const vy = ICON_SIZE - 2;
  const a1x = ICON_SIZE - 2;
  const a1y = 2;
  const a2x = ICON_SIZE - 2;
  const a2y = ICON_SIZE - 2;
  const arcRadius = 7;
  const angle1 = Math.atan2(a1y - vy, a1x - vx);
  const angle2 = Math.atan2(a2y - vy, a2x - vx);
  const arcShape = new Shape().arc(vx, vy, arcRadius, angle1, angle2, false);
  return new Node({
    children: [
      new Line(vx, vy, a1x, a1y, { stroke: color, lineWidth: 1.5 }),
      new Line(vx, vy, a2x, a2y, { stroke: color, lineWidth: 1.5 }),
      new Path(arcShape, { stroke: color, lineWidth: 1.5 }),
    ],
  });
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeRow(icon: Node, property: SimModel["measuringTapeVisibleProperty"]): Checkbox {
  return new Checkbox(property, icon, {
    checkboxColor: TrackLabColors.checkboxColorProperty,
    checkboxColorBackground: TrackLabColors.checkboxColorBackgroundProperty,
  });
}

// ── MeasurementToolsPanel ────────────────────────────────────────────────────

/**
 * Compact toggle panel for the measuring tape and angle tool overlays.
 * Positioned above the Info button by SimScreenView.
 */
export class MeasurementToolsPanel extends Panel {
  public constructor(model: SimModel) {
    const rows = new VBox({
      children: [
        makeRow(measuringTapeIcon(), model.measuringTapeVisibleProperty),
        makeRow(angleToolIcon(), model.angleToolVisibleProperty),
      ],
      spacing: PANEL_ROWS_SPACING,
      align: "left",
    });

    super(rows, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: PANEL_CORNER_RADIUS,
      xMargin: PANEL_X_MARGIN,
      yMargin: PANEL_Y_MARGIN,
    });
  }
}
