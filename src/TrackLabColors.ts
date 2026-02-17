/**
 * TrackLabColors.ts
 *
 * Central location for all colors used in the TrackLab Simulations, providing
 * support for different color profiles (default and projector mode).
 */

import { Color, ProfileColorProperty } from "scenerystack";
import trackLab from "./TrackLabNamespace.js";

// ── Base colors ───────────────────────────────────────────────────────────
const BLACK = new Color( 0, 0, 0 );
const WHITE = new Color( 255, 255, 255 );

// ── ProfileColorProperty factory ──────────────────────────────────────────
function profileColor(
  name: string,
  defaultColor: Color | string,
  projectorColor: Color | string
): ProfileColorProperty {
  return new ProfileColorProperty( trackLab, name, {
    default: defaultColor,
    projector: projectorColor,
  } );
}

/**
 * Color definitions for the TrackLab Simulations
 */
const TrackLabColors = {
  // Background
  backgroundColorProperty: profileColor( "backgroundColor", BLACK, WHITE ),

  // Video element background (HTML style.background)
  videoBackgroundColorProperty: profileColor( "videoBackground", BLACK, new Color( 30, 30, 30 ) ),

  // Panels (ControlPanel, CalibrationToolNode midpoint)
  panelFillProperty: profileColor(
    "panelFill",
    new Color( 20, 20, 40, 0.92 ),
    new Color( 30, 30, 50, 0.95 )
  ),
  // Webcam panel overlay (more opaque)
  webcamPanelFillProperty: profileColor(
    "webcamPanelFill",
    new Color( 20, 20, 40, 0.97 ),
    new Color( 30, 30, 50, 0.98 )
  ),
  panelStrokeProperty: profileColor( "panelStroke", "#555", "#333" ),
  panelStrokeLightProperty: profileColor( "panelStrokeLight", "#888", "#666" ),

  // Axes (X red, Y green)
  axisXColorProperty: profileColor( "axisX", "#f44", "#e33" ),
  axisYColorProperty: profileColor( "axisY", "#4c4", "#3b3" ),

  // Calibration tool
  calibrationFillProperty: profileColor(
    "calibrationFill",
    new Color( 255, 255, 100, 0.85 ),
    new Color( 255, 255, 120, 0.9 )
  ),
  calibrationStrokeProperty: profileColor(
    "calibrationStroke",
    new Color( 255, 255, 100, 0.8 ),
    new Color( 255, 255, 120, 0.9 )
  ),
  calibrationHandleProperty: profileColor(
    "calibrationHandle",
    new Color( 255, 220, 50, 0.9 ),
    new Color( 255, 230, 80, 0.95 )
  ),

  // Auto-tracker overlay
  trackerHintFillProperty: profileColor(
    "trackerHintFill",
    new Color( 255, 255, 100, 0.9 ),
    new Color( 255, 255, 120, 0.95 )
  ),
  trackerSelectionStrokeProperty: profileColor(
    "trackerSelectionStroke",
    new Color( 255, 255, 0, 0.9 ),
    new Color( 255, 255, 50, 0.95 )
  ),
  trackerSelectionFillProperty: profileColor(
    "trackerSelectionFill",
    new Color( 255, 255, 0, 0.08 ),
    new Color( 255, 255, 50, 0.12 )
  ),
  trackerTrailFillProperty: profileColor(
    "trackerTrailFill",
    new Color( 0, 255, 128, 0.75 ),
    new Color( 0, 255, 140, 0.85 )
  ),
  trackerCrosshairStrokeProperty: profileColor(
    "trackerCrosshairStroke",
    new Color( 255, 60, 60, 0.95 ),
    new Color( 255, 80, 80, 0.98 )
  ),

  // Control panel icons
  iconGrayProperty: profileColor( "iconGray", "#bbb", "#888" ),
  checkboxColorProperty: profileColor( "checkboxColor", "#ddd", "#aaa" ),
  checkboxColorBackgroundProperty: profileColor(
    "checkboxColorBackground",
    new Color( 255, 255, 255, 0.1 ),
    new Color( 255, 255, 255, 0.15 )
  ),

  // Coordinate system
  originFillProperty: profileColor( "originFill", WHITE, new Color( 240, 240, 240 ) ),
  originStrokeProperty: profileColor( "originStroke", "#777", "#555" ),

  // Buttons
  buttonBaseDarkProperty: profileColor( "buttonBaseDark", "#336", "#448" ),
  buttonBaseDarkerProperty: profileColor( "buttonBaseDarker", "#334", "#446" ),
  buttonRecordProperty: profileColor( "buttonRecord", "#c00", "#e00" ),
  buttonStopProperty: profileColor( "buttonStop", "#800", "#a00" ),
  buttonSuccessProperty: profileColor( "buttonSuccess", "#2a2", "#3c3" ),

  // Text / labels
  textMutedProperty: profileColor( "textMuted", "#ddd", "#bbb" ),
  textOnDarkProperty: profileColor( "textOnDark", WHITE, new Color( 250, 250, 250 ) ),
};

// Register the namespace
trackLab.register( "TrackLabColors", TrackLabColors );

export default TrackLabColors;
