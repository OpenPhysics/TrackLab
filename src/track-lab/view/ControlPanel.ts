/**
 * ControlPanel.ts
 *
 * Left-side collapsible panel containing toggles for overlay tools
 * (coordinate system, calibration, auto-tracker, digitizing).
 */

import { type Node, VBox } from "scenerystack/scenery";
import { Checkbox, Panel } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import type { TrackLabPreferencesModel } from "../../preferences/TrackLabPreferencesModel.js";
import TrackLabColors from "../../TrackLabColors.js";
import {
  CONTROL_PANEL_ROWS_SPACING,
  CONTROL_PANEL_X_MARGIN,
  CONTROL_PANEL_Y_MARGIN,
  PANEL_CORNER_RADIUS,
} from "../../TrackLabConstants.js";
import { makeAxesIcon, makeCalibrationIcon, makeMagnifyIcon, makeTrackingIcon } from "../../TrackLabIcons.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";
import type { OverlayToolsModel } from "../model/OverlayToolsModel.js";

// ── Helper ────────────────────────────────────────────────────────────────

function makeRow(icon: Node, property: import("scenerystack/axon").BooleanProperty, accessibleName: string): Checkbox {
  const checkbox = new Checkbox(property, icon, {
    checkboxColor: TrackLabColors.checkboxColorProperty,
    checkboxColorBackground: TrackLabColors.checkboxColorBackgroundProperty,
    accessibleName,
  });
  checkbox.addInputListener({ down: () => checkbox.focus() });
  return checkbox;
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
      makeTrackingIcon(),
      overlayTools.autoTrackingProperty,
      a11yStrings.toggleAutoTrackingStringProperty.value,
    );
    // The auto-tracking checkbox is only visible if the preference allows it.
    // When the preference is disabled, the checkbox is completely hidden from the panel.
    autoTrackingCheckbox.visibleProperty = trackLabPreferences.enableAutoTrackingProperty;

    const rows = new VBox({
      children: [
        makeRow(makeAxesIcon(), overlayTools.axesVisibleProperty, a11yStrings.toggleAxesStringProperty.value),
        makeRow(
          makeCalibrationIcon(),
          overlayTools.calibrationVisibleProperty,
          a11yStrings.toggleCalibrationStringProperty.value,
        ),
        makeRow(makeMagnifyIcon(), overlayTools.magnifyVideoProperty, a11yStrings.toggleMagnifierStringProperty.value),
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

TrackLabNamespace.register("ControlPanel", ControlPanel);
