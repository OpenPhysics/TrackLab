import { Circle, Line, Node, VBox } from "scenerystack/scenery";
import { ArrowNode } from "scenerystack/scenery-phet";
import { Checkbox, Panel } from "scenerystack/sun";
import type { TrackLabPreferencesModel } from "../../preferences/TrackLabPreferencesModel.js";
import TrackLabColors from "../../TrackLabColors.js";
import { PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";

const ICON_SIZE = 20; // bounding box each icon targets
const ICON_ARROW_HEAD_SIZE = 5; // headWidth and headHeight for icon arrows
const ICON_ARROW_TAIL_WIDTH = 1.5;
const ICON_LINE_WIDTH_THICK = 1.5;
const ICON_LINE_WIDTH_THIN = 1;
const ICON_LINE_WIDTH_MAGNIFIER = 2; // handle line in magnifier icon
const ICON_DOT_RADIUS = 3; // calibration endpoint dots
const ICON_CENTER_DOT_RADIUS = 2; // centre dot in tracking icon
const ICON_LINE_DASH: number[] = [3, 2];
const PANEL_ROWS_SPACING = 12;
const PANEL_X_MARGIN = 12;
const PANEL_Y_MARGIN = 12;

// ── Icons ─────────────────────────────────────────────────────────────────

/** Two small XY arrows. */
function axesIcon(): Node {
  const xArrow = new ArrowNode(0, ICON_SIZE * 0.7, ICON_SIZE * 0.85, ICON_SIZE * 0.7, {
    fill: TrackLabColors.axisXColorProperty,
    stroke: null,
    headWidth: ICON_ARROW_HEAD_SIZE,
    headHeight: ICON_ARROW_HEAD_SIZE,
    tailWidth: ICON_ARROW_TAIL_WIDTH,
  });
  const yArrow = new ArrowNode(0, ICON_SIZE * 0.7, 0, ICON_SIZE * 0.05, {
    fill: TrackLabColors.axisYColorProperty,
    stroke: null,
    headWidth: ICON_ARROW_HEAD_SIZE,
    headHeight: ICON_ARROW_HEAD_SIZE,
    tailWidth: ICON_ARROW_TAIL_WIDTH,
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
        lineWidth: ICON_LINE_WIDTH_THICK,
        lineDash: ICON_LINE_DASH,
      }),
      new Circle(ICON_DOT_RADIUS, { fill: calColor, x: cx - half, y: cy }),
      new Circle(ICON_DOT_RADIUS, { fill: calColor, x: cx + half, y: cy }),
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
      new Circle(r, {
        stroke: gray,
        lineWidth: ICON_LINE_WIDTH_THICK,
        fill: null,
        x: cx,
        y: cy,
      }),
      new Line(cx + r * 0.7, cy + r * 0.7, ICON_SIZE - 1, ICON_SIZE - 1, {
        stroke: gray,
        lineWidth: ICON_LINE_WIDTH_MAGNIFIER,
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
      new Circle(r, {
        stroke: gray,
        lineWidth: ICON_LINE_WIDTH_THICK,
        fill: null,
        x: cx,
        y: cy,
      }),
      new Circle(ICON_CENTER_DOT_RADIUS, { fill: gray, x: cx, y: cy }),
      new Line(cx, cy - r - gap, cx, cy - gap, {
        stroke: gray,
        lineWidth: ICON_LINE_WIDTH_THIN,
      }),
      new Line(cx, cy + gap, cx, cy + r + gap, {
        stroke: gray,
        lineWidth: ICON_LINE_WIDTH_THIN,
      }),
      new Line(cx - r - gap, cy, cx - gap, cy, {
        stroke: gray,
        lineWidth: ICON_LINE_WIDTH_THIN,
      }),
      new Line(cx + gap, cy, cx + r + gap, cy, {
        stroke: gray,
        lineWidth: ICON_LINE_WIDTH_THIN,
      }),
    ],
  });
}

// ── Helper ────────────────────────────────────────────────────────────────

function makeRow(icon: Node, property: SimModel["axesVisibleProperty"]): Checkbox {
  return new Checkbox(property, icon, {
    checkboxColor: TrackLabColors.checkboxColorProperty,
    checkboxColorBackground: TrackLabColors.checkboxColorBackgroundProperty,
  });
}

// ── ControlPanel class ────────────────────────────────────────────────────

/**
 * Left-side toggle panel containing checkboxes for the axes, calibration,
 * magnifier, and auto-tracking overlays. The auto-tracking row is conditionally
 * visible based on the user-preference flag.
 */
export class ControlPanel extends Panel {
  /**
   * @param model - Provides the boolean visibility properties bound to each checkbox.
   * @param trackLabPreferences - Determines whether the auto-tracking checkbox is shown.
   */
  public constructor(model: SimModel, trackLabPreferences: TrackLabPreferencesModel) {
    const autoTrackingCheckbox = makeRow(trackingIcon(), model.autoTrackingProperty);
    // The auto-tracking checkbox is only visible if the preference allows it.
    // When the preference is disabled, the checkbox is completely hidden from the panel.
    autoTrackingCheckbox.visibleProperty = trackLabPreferences.enableAutoTrackingProperty;

    const rows = new VBox({
      children: [
        makeRow(axesIcon(), model.axesVisibleProperty),
        makeRow(calibrationIcon(), model.calibrationVisibleProperty),
        makeRow(magnifyIcon(), model.magnifyVideoProperty),
        autoTrackingCheckbox,
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
