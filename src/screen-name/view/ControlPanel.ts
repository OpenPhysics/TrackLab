import { Circle, Line, Node, VBox } from "scenerystack/scenery";
import { ArrowNode } from "scenerystack/scenery-phet";
import { Checkbox, Panel } from "scenerystack/sun";
import TrackLabColors from "../../TrackLabColors.js";
import type { SimModel } from "../model/SimModel.js";

const ICON_SIZE = 20; // bounding box each icon targets

// ── Icons ─────────────────────────────────────────────────────────────────

/** Two small XY arrows. */
function axesIcon(): Node {
  const xArrow = new ArrowNode(
    0,
    ICON_SIZE * 0.7,
    ICON_SIZE * 0.85,
    ICON_SIZE * 0.7,
    {
      fill: TrackLabColors.axisXColorProperty,
      stroke: null,
      headWidth: 5,
      headHeight: 5,
      tailWidth: 1.5,
    },
  );
  const yArrow = new ArrowNode(0, ICON_SIZE * 0.7, 0, ICON_SIZE * 0.05, {
    fill: TrackLabColors.axisYColorProperty,
    stroke: null,
    headWidth: 5,
    headHeight: 5,
    tailWidth: 1.5,
  });
  return new Node({ children: [xArrow, yArrow] });
}

/** Two endpoint dots joined by a dashed line. */
function calibrationIcon(): Node {
  const cx = ICON_SIZE * 0.5;
  const cy = ICON_SIZE * 0.5;
  const half = ICON_SIZE * 0.4;
  const calColor = TrackLabColors.calibrationFillProperty;
  return new Node({
    children: [
      new Line(cx - half, cy, cx + half, cy, {
        stroke: calColor,
        lineWidth: 1.5,
        lineDash: [3, 2],
      }),
      new Circle(3, { fill: calColor, x: cx - half, y: cy }),
      new Circle(3, { fill: calColor, x: cx + half, y: cy }),
    ],
  });
}

/** Circle with a diagonal handle — magnifying glass silhouette. */
function magnifyIcon(): Node {
  const r = ICON_SIZE * 0.32;
  const cx = r + 1;
  const cy = r + 1;
  const gray = TrackLabColors.iconGrayProperty;
  return new Node({
    children: [
      new Circle(r, { stroke: gray, lineWidth: 1.5, fill: null, x: cx, y: cy }),
      new Line(cx + r * 0.7, cy + r * 0.7, ICON_SIZE - 1, ICON_SIZE - 1, {
        stroke: gray,
        lineWidth: 2,
      }),
    ],
  });
}

/** Crosshair with a small centre dot — tracking target. */
function trackingIcon(): Node {
  const cx = ICON_SIZE * 0.5;
  const cy = ICON_SIZE * 0.5;
  const r = ICON_SIZE * 0.35;
  const gap = ICON_SIZE * 0.15;
  const gray = TrackLabColors.iconGrayProperty;
  return new Node({
    children: [
      new Circle(r, { stroke: gray, lineWidth: 1.5, fill: null, x: cx, y: cy }),
      new Circle(2, { fill: gray, x: cx, y: cy }),
      new Line(cx, cy - r - gap, cx, cy - gap, { stroke: gray, lineWidth: 1 }),
      new Line(cx, cy + gap, cx, cy + r + gap, { stroke: gray, lineWidth: 1 }),
      new Line(cx - r - gap, cy, cx - gap, cy, { stroke: gray, lineWidth: 1 }),
      new Line(cx + gap, cy, cx + r + gap, cy, { stroke: gray, lineWidth: 1 }),
    ],
  });
}

// ── Helper ────────────────────────────────────────────────────────────────

function makeRow(
  icon: Node,
  property: SimModel["axesVisibleProperty"],
): Checkbox {
  return new Checkbox(property, icon, {
    checkboxColor: TrackLabColors.checkboxColorProperty,
    checkboxColorBackground: TrackLabColors.checkboxColorBackgroundProperty,
  });
}

// ── ControlPanel class ────────────────────────────────────────────────────

export class ControlPanel extends Panel {
  public constructor(model: SimModel) {
    const rows = new VBox({
      children: [
        makeRow(axesIcon(), model.axesVisibleProperty),
        makeRow(calibrationIcon(), model.calibrationVisibleProperty),
        makeRow(magnifyIcon(), model.magnifyVideoProperty),
        makeRow(trackingIcon(), model.autoTrackingProperty),
      ],
      spacing: 12,
      align: "left",
    });

    super(rows, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: 8,
      xMargin: 12,
      yMargin: 12,
    });
  }
}
