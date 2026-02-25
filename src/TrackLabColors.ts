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

// ── Track colour palette (one CSS color per symbol A–Z) ─────────────────────
// 26 distinct, high-contrast colours so every possible track has a unique hue.
export const TRACK_COLORS = [
  new Color(255, 140, 0), // A – orange
  new Color(0, 188, 212), // B – cyan
  new Color(233, 30, 140), // C – magenta
  new Color(156, 39, 176), // D – purple
  new Color(205, 220, 57), // E – lime-yellow
  new Color(0, 229, 255), // F – light cyan
  new Color(255, 87, 34), // G – deep orange
  new Color(118, 255, 3), // H – light green
  new Color(244, 67, 54), // I – red
  new Color(63, 81, 181), // J – indigo
  new Color(0, 150, 136), // K – teal
  new Color(255, 235, 59), // L – yellow
  new Color(121, 85, 72), // M – brown
  new Color(96, 125, 139), // N – blue-grey
  new Color(233, 30, 99), // O – pink
  new Color(33, 150, 243), // P – blue
  new Color(139, 195, 74), // Q – light green (darker)
  new Color(255, 193, 7), // R – amber
  new Color(0, 188, 84), // S – green
  new Color(121, 134, 203), // T – periwinkle
  new Color(255, 112, 67), // U – deep orange (lighter)
  new Color(77, 208, 225), // V – light teal
  new Color(174, 213, 129), // W – sage
  new Color(240, 98, 146), // X – light pink
  new Color(129, 212, 250), // Y – sky blue
  new Color(178, 132, 190), // Z – lavender
];

/**
 * Color definitions for the TrackLab Simulations
 */
const TrackLabColors = {
  // Background
  backgroundColorProperty: profileColor("backgroundColor", BLACK, WHITE),

  // Video element background (HTML style.background)
  videoBackgroundColorProperty: profileColor("videoBackground", BLACK, new Color(30, 30, 30)),

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
  axisXColorProperty: profileColor("axisX", new Color(255, 68, 68, 0.85), new Color(238, 51, 51, 0.85)),
  axisYColorProperty: profileColor("axisY", new Color(68, 204, 68, 0.85), new Color(51, 187, 51, 0.85)),

  // Calibration tool (bright colors with shadows for visibility on all backgrounds)
  calibrationFillProperty: profileColor(
    "calibrationFill",
    new Color(0, 255, 255, 0.3), // Bright cyan - semi-transparent for positioning
    new Color(255, 0, 255, 0.3), // Bright magenta - semi-transparent for positioning
  ),
  calibrationStrokeProperty: profileColor(
    "calibrationStroke",
    new Color(0, 255, 255), // Bright cyan
    new Color(255, 0, 255), // Bright magenta
  ),
  // Shadow stroke for maximum contrast on all backgrounds
  calibrationShadowStrokeProperty: profileColor(
    "calibrationShadowStroke",
    new Color(0, 0, 0, 0.9), // Dark shadow
    new Color(0, 0, 0, 0.9), // Dark shadow
  ),
  calibrationHandleProperty: profileColor(
    "calibrationHandle",
    new Color(0, 255, 255, 0.4), // Bright cyan - semi-transparent
    new Color(255, 0, 255, 0.4), // Bright magenta - semi-transparent
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
  iconGrayProperty: profileColor("iconGray", new Color(187, 187, 187), new Color(100, 100, 100)),
  checkboxColorProperty: profileColor("checkboxColor", new Color(255, 255, 255), new Color(40, 40, 40)),
  checkboxColorBackgroundProperty: profileColor(
    "checkboxColorBackground",
    new Color(80, 80, 100, 0.4),
    new Color(200, 200, 220, 0.5),
  ),
  // Preferences checkboxes (fixed appearance, don't change with profile)
  checkboxPreferencesColorProperty: profileColor(
    "checkboxPreferencesColor",
    new Color(40, 40, 40),
    new Color(40, 40, 40),
  ),
  checkboxPreferencesColorBackgroundProperty: profileColor(
    "checkboxPreferencesColorBackground",
    new Color(200, 200, 220, 0.5),
    new Color(200, 200, 220, 0.5),
  ),

  // Coordinate system - semi-transparent origin for better positioning
  originFillProperty: profileColor(
    "originFill",
    new Color(255, 255, 255, 0.4), // 40% opacity white
    new Color(240, 240, 240, 0.4),
  ),
  originStrokeProperty: profileColor(
    "originStroke",
    new Color(119, 119, 119, 0.8), // 80% opacity stroke for visibility
    new Color(70, 70, 70, 0.8),
  ),
  // Shadow/outline stroke for coordinate system (contrast on all backgrounds)
  coordShadowStrokeProperty: profileColor(
    "coordShadowStroke",
    new Color(0, 0, 0, 0.8), // Dark shadow for contrast on light backgrounds
    new Color(0, 0, 0, 0.8),
  ),

  // Buttons
  buttonBaseDarkProperty: profileColor(
    "buttonBaseDark",
    new Color(51, 51, 102),
    new Color(220, 220, 235), // Much lighter for projector mode
  ),
  buttonBaseDarkerProperty: profileColor("buttonBaseDarker", new Color(51, 51, 68), new Color(68, 68, 102)),
  buttonRecordProperty: profileColor("buttonRecord", new Color(204, 0, 0), new Color(238, 0, 0)),
  buttonStopProperty: profileColor("buttonStop", new Color(136, 0, 0), new Color(170, 0, 0)),
  buttonSuccessProperty: profileColor("buttonSuccess", new Color(34, 170, 34), new Color(60, 204, 60)),

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
  textMutedProperty: profileColor("textMuted", new Color(221, 221, 221), new Color(100, 100, 100)),
  textOnDarkProperty: profileColor("textOnDark", WHITE, BLACK),

  // Digitizing overlay (manual point placement)
  digitizingCursorStrokeProperty: profileColor("digitizingCursorStroke", WHITE, new Color(40, 40, 40)),
  digitizingMagnifierBorderProperty: profileColor("digitizingMagnifierBorder", WHITE, new Color(40, 40, 40)),
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
  tableHeaderBackgroundProperty: profileColor("tableHeaderBackground", new Color(68, 114, 196), new Color(55, 90, 160)),
  tableHeaderTextProperty: profileColor("tableHeaderText", WHITE, WHITE),
  tableRowOddProperty: profileColor("tableRowOdd", WHITE, new Color(250, 250, 250)),
  tableRowEvenProperty: profileColor("tableRowEven", new Color(235, 241, 251), new Color(230, 238, 250)),
  tableGridStrokeProperty: profileColor("tableGridStroke", new Color(176, 176, 176), new Color(160, 160, 160)),
  tableEmptyTextProperty: profileColor("tableEmptyText", new Color(136, 136, 136), new Color(120, 120, 120)),
  tableSymbolShadowProperty: profileColor("tableSymbolShadow", new Color(0, 0, 0, 0.5), new Color(0, 0, 0, 0.3)),
  tableBackgroundProperty: profileColor("tableBackground", WHITE, new Color(250, 250, 250)),
  exportButtonProperty: profileColor("exportButton", new Color(76, 175, 80), new Color(60, 150, 65)),

  // Graph (ConfigurableGraph, GraphDataManager, GraphControlsPanel)
  graphBackgroundProperty: profileColor("graphBackground", new Color(25, 25, 45, 0.95), new Color(245, 245, 250, 0.98)),
  controlPanelFillProperty: profileColor(
    "controlPanelFill",
    new Color(35, 35, 55, 0.95),
    new Color(235, 235, 245, 0.98),
  ),
  controlPanelStrokeProperty: profileColor("controlPanelStroke", new Color(120, 120, 140), new Color(180, 180, 200)),
  gridLinesProperty: profileColor("gridLines", new Color(80, 80, 100), new Color(200, 200, 220)),
  textProperty: profileColor("text", WHITE, BLACK),
  plot1Property: profileColor(
    "plot1",
    new Color(0, 188, 212), // Cyan – visible on dark background
    new Color(0, 150, 180),
  ),

  // Measuring tape overlay
  measuringTapeColorProperty: profileColor("measuringTapeColor", new Color(240, 185, 55), new Color(220, 170, 40)),
  measuringTapeShadowProperty: profileColor("measuringTapeShadow", new Color(0, 0, 0, 0.45), new Color(0, 0, 0, 0.45)),

  // Angle tool overlay
  angleToolColorProperty: profileColor("angleToolColor", new Color(170, 100, 255), new Color(150, 80, 230)),
  angleToolShadowProperty: profileColor("angleToolShadow", new Color(0, 0, 0, 0.45), new Color(0, 0, 0, 0.45)),

  // Shared overlay handle outline (used by measuring tape and angle tool endpoints)
  overlayHandleOutlineProperty: profileColor(
    "overlayHandleOutline",
    new Color(0, 0, 0, 0.65),
    new Color(0, 0, 0, 0.65),
  ),

  // Shared overlay icon shadow (used by measurement tool panel icons)
  iconShadowProperty: profileColor("iconShadow", new Color(0, 0, 0, 0.5), new Color(0, 0, 0, 0.5)),

  // Calibration tool warning (endpoints too close)
  calibrationWarningColorProperty: profileColor(
    "calibrationWarningColor",
    new Color(255, 60, 60),
    new Color(255, 60, 60),
  ),

  // Track list panel
  trashIconProperty: profileColor("trashIcon", new Color(255, 102, 102), new Color(220, 80, 80)),
  trashButtonBaseProperty: profileColor("trashButtonBase", new Color(60, 20, 20, 0.5), new Color(80, 30, 30, 0.6)),
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
