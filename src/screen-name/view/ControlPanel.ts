/**
 * ControlPanel.ts
 *
 * Left-side collapsible panel containing toggles for overlay tools
 * (coordinate system, calibration, auto-tracker, digitizing).
 */

import { Circle, Line, Node, VBox } from "scenerystack/scenery";
import { ArrowNode } from "scenerystack/scenery-phet";
import { Checkbox, Panel } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import type { TrackLabPreferencesModel } from "../../preferences/TrackLabPreferencesModel.js";
import TrackLabColors from "../../TrackLabColors.js";
import {
  CONTROL_ICON_SIZE,
  CONTROL_PANEL_ROWS_SPACING,
  CONTROL_PANEL_X_MARGIN,
  CONTROL_PANEL_Y_MARGIN,
  PANEL_CORNER_RADIUS,
} from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import type { OverlayToolsModel } from "../model/OverlayToolsModel.js";

const ICON_ARROW_HEAD_SIZE = 5; // headWidth and headHeight for icon arrows
const ICON_ARROW_TAIL_WIDTH = 1.5;
const ICON_LINE_WIDTH_THICK = 1.5;
const ICON_LINE_WIDTH_THIN = 1;
const ICON_LINE_WIDTH_MAGNIFIER = 2; // handle line in magnifier icon
const ICON_DOT_RADIUS = 3; // calibration endpoint dots
const ICON_CENTER_DOT_RADIUS = 2; // centre dot in tracking icon
const ICON_LINE_DASH: number[] = [3, 2];

// ── Icon layout fractions ─────────────────────────────────────────────────────
const ICON_ORIGIN_FRACTION = 0.7; // where axes originate (fraction of CONTROL_ICON_SIZE)
const ICON_X_ARROW_END_FRACTION = 0.85;
const ICON_Y_ARROW_END_FRACTION = 0.05;
const ICON_HALF_FRACTION = 0.4;
const ICON_CENTER_FRACTION = 0.5;
const ICON_MAGNIFIER_RADIUS_FRACTION = 0.32;
const ICON_TRACKING_RADIUS_FRACTION = 0.35;
const ICON_TRACKING_GAP_FRACTION = 0.15;

// ── Icons ─────────────────────────────────────────────────────────────────

/** Two small XY arrows. */
function axesIcon(): Node {
  const xArrow = new ArrowNode(
    0,
    CONTROL_ICON_SIZE * ICON_ORIGIN_FRACTION,
    CONTROL_ICON_SIZE * ICON_X_ARROW_END_FRACTION,
    CONTROL_ICON_SIZE * ICON_ORIGIN_FRACTION,
    {
      fill: TrackLabColors.axisXColorProperty,
      stroke: null,
      headWidth: ICON_ARROW_HEAD_SIZE,
      headHeight: ICON_ARROW_HEAD_SIZE,
      tailWidth: ICON_ARROW_TAIL_WIDTH,
    },
  );
  const yArrow = new ArrowNode(
    0,
    CONTROL_ICON_SIZE * ICON_ORIGIN_FRACTION,
    0,
    CONTROL_ICON_SIZE * ICON_Y_ARROW_END_FRACTION,
    {
      fill: TrackLabColors.axisYColorProperty,
      stroke: null,
      headWidth: ICON_ARROW_HEAD_SIZE,
      headHeight: ICON_ARROW_HEAD_SIZE,
      tailWidth: ICON_ARROW_TAIL_WIDTH,
    },
  );
  return new Node({ children: [xArrow, yArrow] });
}

/** Two endpoint dots joined by a dashed line. */
function calibrationIcon(): Node {
  const cx = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const cy = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const half = CONTROL_ICON_SIZE * ICON_HALF_FRACTION;
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
  const r = CONTROL_ICON_SIZE * ICON_MAGNIFIER_RADIUS_FRACTION;
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
      new Line(
        cx + r * ICON_ORIGIN_FRACTION,
        cy + r * ICON_ORIGIN_FRACTION,
        CONTROL_ICON_SIZE - 1,
        CONTROL_ICON_SIZE - 1,
        {
          stroke: gray,
          lineWidth: ICON_LINE_WIDTH_MAGNIFIER,
        },
      ),
    ],
  });
}

/** Crosshair with a small centre dot — tracking target. */
function trackingIcon(): Node {
  const cx = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const cy = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const r = CONTROL_ICON_SIZE * ICON_TRACKING_RADIUS_FRACTION;
  const gap = CONTROL_ICON_SIZE * ICON_TRACKING_GAP_FRACTION;
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

function makeRow(icon: Node, property: import("scenerystack/axon").BooleanProperty, accessibleName: string): Checkbox {
  return new Checkbox(property, icon, {
    checkboxColor: TrackLabColors.checkboxColorProperty,
    checkboxColorBackground: TrackLabColors.checkboxColorBackgroundProperty,
    accessibleName,
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
   * @param overlayTools - Provides the boolean visibility properties bound to each checkbox.
   * @param trackLabPreferences - Determines whether the auto-tracking checkbox is shown.
   */
  public constructor(overlayTools: OverlayToolsModel, trackLabPreferences: TrackLabPreferencesModel) {
    const a11yStrings = StringManager.getInstance().getA11y();

    const autoTrackingCheckbox = makeRow(
      trackingIcon(),
      overlayTools.autoTrackingProperty,
      a11yStrings.toggleAutoTrackingStringProperty.value,
    );
    // The auto-tracking checkbox is only visible if the preference allows it.
    // When the preference is disabled, the checkbox is completely hidden from the panel.
    autoTrackingCheckbox.visibleProperty = trackLabPreferences.enableAutoTrackingProperty;

    const rows = new VBox({
      children: [
        makeRow(axesIcon(), overlayTools.axesVisibleProperty, a11yStrings.toggleAxesStringProperty.value),
        makeRow(
          calibrationIcon(),
          overlayTools.calibrationVisibleProperty,
          a11yStrings.toggleCalibrationStringProperty.value,
        ),
        makeRow(magnifyIcon(), overlayTools.magnifyVideoProperty, a11yStrings.toggleMagnifierStringProperty.value),
        autoTrackingCheckbox,
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

trackLab.register("ControlPanel", ControlPanel);
