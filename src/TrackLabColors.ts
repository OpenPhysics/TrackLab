/**
 * TrackLabColors.ts
 *
 * Central location for all colors used in the TrackLab Simulations, providing
 * support for different color profiles (default and projector mode).
 */

import { Color, ProfileColorProperty } from "scenerystack";
import trackLab from "./TrackLabNamespace.js";

// ── Base colors ───────────────────────────────────────────────────────────
const BLACK = new Color(0, 0, 0);
const WHITE = new Color(255, 255, 255);

// ── ProfileColorProperty factory ──────────────────────────────────────────
function profileColor(
  name: string,
  defaultColor: Color | string,
  projectorColor: Color | string,
): ProfileColorProperty {
  return new ProfileColorProperty(trackLab, name, {
    default: defaultColor,
    projector: projectorColor,
  });
}

// ── Track colour palette (one CSS color per symbol A–H, repeats after 8) ────
export const TRACK_COLORS = [
  new Color(255, 140, 0), // A – orange
  new Color(0, 188, 212), // B – cyan
  new Color(233, 30, 140), // C – magenta
  new Color(156, 39, 176), // D – purple
  new Color(205, 220, 57), // E – lime-yellow
  new Color(0, 229, 255), // F – light cyan
  new Color(255, 87, 34), // G – deep orange
  new Color(118, 255, 3), // H – light green
];

/**
 * Color definitions for the TrackLab Simulations
 */
const TrackLabColors = {
  // Background
  backgroundColorProperty: profileColor("backgroundColor", BLACK, WHITE),

  // Video element background (HTML style.background)
  videoBackgroundColorProperty: profileColor(
    "videoBackground",
    BLACK,
    new Color(30, 30, 30),
  ),

  // Panels (ControlPanel, CalibrationToolNode midpoint, TrackListPanel, DataTableNode)
  // Dark panels on dark background (default) and light panels on light background (projector)
  panelFillProperty: profileColor(
    "panelFill",
    new Color(25, 25, 45, 0.95), // Darker, more opaque for better contrast with white text
    new Color(245, 245, 250, 0.98), // Light panel for projector mode with black text
  ),
  // Webcam panel overlay (more opaque)
  webcamPanelFillProperty: profileColor(
    "webcamPanelFill",
    new Color(25, 25, 45, 0.98), // More opaque for webcam panel
    new Color(245, 245, 250, 0.99), // More opaque light panel for projector
  ),
  panelStrokeProperty: profileColor(
    "panelStroke",
    new Color(120, 120, 140), // Lighter stroke for better contrast on dark panel
    new Color(180, 180, 200), // Darker stroke for better contrast on light panel
  ),
  panelStrokeLightProperty: profileColor(
    "panelStrokeLight",
    new Color(150, 150, 170), // Lighter stroke for better visibility
    new Color(160, 160, 180), // Darker stroke for light panel
  ),

  // Axes (X red, Y green)
  axisXColorProperty: profileColor(
    "axisX",
    new Color(255, 68, 68),
    new Color(238, 51, 51),
  ),
  axisYColorProperty: profileColor(
    "axisY",
    new Color(68, 204, 68),
    new Color(51, 187, 51),
  ),

  // Calibration tool
  calibrationFillProperty: profileColor(
    "calibrationFill",
    new Color(255, 255, 100, 0.85),
    new Color(255, 255, 120, 0.9),
  ),
  calibrationStrokeProperty: profileColor(
    "calibrationStroke",
    new Color(255, 255, 100, 0.8),
    new Color(255, 255, 120, 0.9),
  ),
  calibrationHandleProperty: profileColor(
    "calibrationHandle",
    new Color(255, 220, 50, 0.9),
    new Color(255, 230, 80, 0.95),
  ),

  // Auto-tracker overlay
  trackerHintFillProperty: profileColor(
    "trackerHintFill",
    new Color(255, 255, 100, 0.9),
    new Color(255, 255, 120, 0.95),
  ),
  trackerSelectionStrokeProperty: profileColor(
    "trackerSelectionStroke",
    new Color(255, 255, 0, 0.9),
    new Color(255, 255, 50, 0.95),
  ),
  trackerSelectionFillProperty: profileColor(
    "trackerSelectionFill",
    new Color(255, 255, 0, 0.08),
    new Color(255, 255, 50, 0.12),
  ),
  trackerTrailFillProperty: profileColor(
    "trackerTrailFill",
    new Color(0, 255, 128, 0.75),
    new Color(0, 255, 140, 0.85),
  ),
  trackerCrosshairStrokeProperty: profileColor(
    "trackerCrosshairStroke",
    new Color(255, 60, 60, 0.95),
    new Color(255, 80, 80, 0.98),
  ),

  // Control panel icons
  iconGrayProperty: profileColor(
    "iconGray",
    new Color(187, 187, 187),
    new Color(100, 100, 100),
  ),
  checkboxColorProperty: profileColor(
    "checkboxColor",
    new Color(221, 221, 221),
    new Color(140, 140, 140),
  ),
  checkboxColorBackgroundProperty: profileColor(
    "checkboxColorBackground",
    new Color(255, 255, 255, 0.1),
    new Color(255, 255, 255, 0.15),
  ),

  // Coordinate system
  originFillProperty: profileColor(
    "originFill",
    WHITE,
    new Color(240, 240, 240),
  ),
  originStrokeProperty: profileColor(
    "originStroke",
    new Color(119, 119, 119),
    new Color(70, 70, 70),
  ),

  // Buttons
  buttonBaseDarkProperty: profileColor(
    "buttonBaseDark",
    new Color(51, 51, 102),
    new Color(68, 68, 136),
  ),
  buttonBaseDarkerProperty: profileColor(
    "buttonBaseDarker",
    new Color(51, 51, 68),
    new Color(68, 68, 102),
  ),
  buttonRecordProperty: profileColor(
    "buttonRecord",
    new Color(204, 0, 0),
    new Color(238, 0, 0),
  ),
  buttonStopProperty: profileColor(
    "buttonStop",
    new Color(136, 0, 0),
    new Color(170, 0, 0),
  ),
  buttonSuccessProperty: profileColor(
    "buttonSuccess",
    new Color(34, 170, 34),
    new Color(60, 204, 60),
  ),

  // ComboBox
  comboBoxButtonFillProperty: profileColor(
    "comboBoxButtonFill",
    new Color(51, 51, 102),
    new Color(220, 220, 235), // Much lighter for projector mode
  ),
  comboBoxListFillProperty: profileColor(
    "comboBoxListFill",
    new Color(51, 51, 102),
    new Color(240, 240, 250), // Much lighter for projector mode
  ),
  comboBoxHighlightFillProperty: profileColor(
    "comboBoxHighlightFill",
    new Color(68, 68, 136),
    new Color(200, 200, 220), // Much lighter for projector mode
  ),

  // Text / labels
  textMutedProperty: profileColor(
    "textMuted",
    new Color(221, 221, 221),
    new Color(100, 100, 100),
  ),
  textOnDarkProperty: profileColor(
    "textOnDark",
    WHITE,
    BLACK,
  ),

  // Digitizing overlay (manual point placement)
  digitizingCursorStrokeProperty: profileColor(
    "digitizingCursorStroke",
    WHITE,
    new Color(40, 40, 40),
  ),
  digitizingMagnifierBorderProperty: profileColor(
    "digitizingMagnifierBorder",
    WHITE,
    new Color(40, 40, 40),
  ),
  digitizingMagnifierCrosshairProperty: profileColor(
    "digitizingMagnifierCrosshair",
    new Color(255, 255, 255, 0.8),
    new Color(40, 40, 40, 0.9),
  ),
  digitizingMagnifierShadowProperty: profileColor(
    "digitizingMagnifierShadow",
    new Color(0, 0, 0, 0.5),
    new Color(0, 0, 0, 0.3),
  ),

  // Data table
  tableHeaderBackgroundProperty: profileColor(
    "tableHeaderBackground",
    new Color(68, 114, 196),
    new Color(55, 90, 160),
  ),
  tableHeaderTextProperty: profileColor("tableHeaderText", WHITE, WHITE),
  tableRowOddProperty: profileColor(
    "tableRowOdd",
    WHITE,
    new Color(250, 250, 250),
  ),
  tableRowEvenProperty: profileColor(
    "tableRowEven",
    new Color(235, 241, 251),
    new Color(230, 238, 250),
  ),
  tableGridStrokeProperty: profileColor(
    "tableGridStroke",
    new Color(176, 176, 176),
    new Color(160, 160, 160),
  ),
  tableEmptyTextProperty: profileColor(
    "tableEmptyText",
    new Color(136, 136, 136),
    new Color(120, 120, 120),
  ),
  tableSymbolShadowProperty: profileColor(
    "tableSymbolShadow",
    new Color(0, 0, 0, 0.5),
    new Color(0, 0, 0, 0.3),
  ),
  tableBackgroundProperty: profileColor(
    "tableBackground",
    WHITE,
    new Color(250, 250, 250),
  ),
  exportButtonProperty: profileColor(
    "exportButton",
    new Color(76, 175, 80),
    new Color(60, 150, 65),
  ),

  // Track list panel
  trashIconProperty: profileColor(
    "trashIcon",
    new Color(255, 102, 102),
    new Color(220, 80, 80),
  ),
  trashButtonBaseProperty: profileColor(
    "trashButtonBase",
    new Color(60, 20, 20, 0.5),
    new Color(80, 30, 30, 0.6),
  ),
  trackSymbolTextProperty: profileColor("trackSymbolText", WHITE, WHITE),

  // Preferences dialog
  preferencesTextProperty: profileColor("preferencesText", BLACK, BLACK),
  preferencesTextSecondaryProperty: profileColor(
    "preferencesTextSecondary",
    new Color(102, 102, 102),
    new Color(80, 80, 80),
  ),
};

// Register the namespace
trackLab.register("TrackLabColors", TrackLabColors);

export default TrackLabColors;
