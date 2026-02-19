/**
 * TrackLabPreferencesNode - Custom preferences UI panel for the trackLab simulation.
 *
 * Renders the simulation-specific preferences content shown in the Preferences dialog.
 * Currently includes a checkbox to enable/disable the auto-tracking feature.
 */

import { HStrut, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox } from "scenerystack/sun";
import { StringManager } from "../i18n/StringManager.js";
import TrackLabColors from "../TrackLabColors.js";
import type { TrackLabPreferencesModel } from "./TrackLabPreferencesModel.js";

export class TrackLabPreferencesNode extends VBox {
  public constructor(preferencesModel: TrackLabPreferencesModel) {
    const stringManager = StringManager.getInstance();
    const prefStrings = stringManager.getPreferences();

    const header = new Text(prefStrings.simulationStringProperty, {
      font: new PhetFont({ size: 18, weight: "bold" }),
      fill: TrackLabColors.preferencesTextProperty,
    });

    const enableAutoTrackingCheckbox = new Checkbox(
      preferencesModel.enableAutoTrackingProperty,
      new VBox({
        align: "left",
        spacing: 2,
        children: [
          new Text(prefStrings.enableAutoTrackingStringProperty, {
            font: new PhetFont(14),
            fill: TrackLabColors.preferencesTextProperty,
          }),
          new Text(prefStrings.enableAutoTrackingDescriptionStringProperty, {
            font: new PhetFont(11),
            fill: TrackLabColors.preferencesTextSecondaryProperty,
            maxWidth: 500,
          }),
        ],
      }),
      {
        checkboxColor: TrackLabColors.checkboxColorProperty,
        checkboxColorBackground: TrackLabColors.checkboxColorBackgroundProperty,
        spacing: 8,
      },
    );

    super({
      align: "left",
      spacing: 12,
      children: [header, new HStrut(600), enableAutoTrackingCheckbox],
    });
  }
}
