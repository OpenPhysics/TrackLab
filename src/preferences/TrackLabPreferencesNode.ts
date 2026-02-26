/**
 * TrackLabPreferencesNode - Custom preferences UI panel for the trackLab simulation.
 *
 * Renders the simulation-specific preferences content shown in the Preferences dialog.
 * Includes checkboxes to:
 *   - Enable/disable the auto-tracking feature
 *   - Show/hide velocity quantities on the kinematics graph
 *   - Show/hide acceleration quantities on the kinematics graph
 */

import { HStrut, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox } from "scenerystack/sun";
import { StringManager } from "../i18n/StringManager.js";
import TrackLabColors from "../TrackLabColors.js";
import trackLab from "../TrackLabNamespace.js";
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
        checkboxColor: TrackLabColors.checkboxPreferencesColorProperty,
        checkboxColorBackground: TrackLabColors.checkboxPreferencesColorBackgroundProperty,
        spacing: 8,
      },
    );

    const showVelocityCheckbox = new Checkbox(
      preferencesModel.showVelocityInGraphProperty,
      new VBox({
        align: "left",
        spacing: 2,
        children: [
          new Text(prefStrings.showVelocityStringProperty, {
            font: new PhetFont(14),
            fill: TrackLabColors.preferencesTextProperty,
          }),
          new Text(prefStrings.showVelocityDescriptionStringProperty, {
            font: new PhetFont(11),
            fill: TrackLabColors.preferencesTextSecondaryProperty,
            maxWidth: 500,
          }),
        ],
      }),
      {
        checkboxColor: TrackLabColors.checkboxPreferencesColorProperty,
        checkboxColorBackground: TrackLabColors.checkboxPreferencesColorBackgroundProperty,
        spacing: 8,
      },
    );

    const showAccelerationCheckbox = new Checkbox(
      preferencesModel.showAccelerationInGraphProperty,
      new VBox({
        align: "left",
        spacing: 2,
        children: [
          new Text(prefStrings.showAccelerationStringProperty, {
            font: new PhetFont(14),
            fill: TrackLabColors.preferencesTextProperty,
          }),
          new Text(prefStrings.showAccelerationDescriptionStringProperty, {
            font: new PhetFont(11),
            fill: TrackLabColors.preferencesTextSecondaryProperty,
            maxWidth: 500,
          }),
        ],
      }),
      {
        checkboxColor: TrackLabColors.checkboxPreferencesColorProperty,
        checkboxColorBackground: TrackLabColors.checkboxPreferencesColorBackgroundProperty,
        spacing: 8,
      },
    );

    const enableMeasurementToolsCheckbox = new Checkbox(
      preferencesModel.enableMeasurementToolsProperty,
      new VBox({
        align: "left",
        spacing: 2,
        children: [
          new Text(prefStrings.enableMeasurementToolsStringProperty, {
            font: new PhetFont(14),
            fill: TrackLabColors.preferencesTextProperty,
          }),
          new Text(prefStrings.enableMeasurementToolsDescriptionStringProperty, {
            font: new PhetFont(11),
            fill: TrackLabColors.preferencesTextSecondaryProperty,
            maxWidth: 500,
          }),
        ],
      }),
      {
        checkboxColor: TrackLabColors.checkboxPreferencesColorProperty,
        checkboxColorBackground: TrackLabColors.checkboxPreferencesColorBackgroundProperty,
        spacing: 8,
      },
    );

    super({
      align: "left",
      spacing: 12,
      children: [
        header,
        new HStrut(600),
        enableAutoTrackingCheckbox,
        showVelocityCheckbox,
        showAccelerationCheckbox,
        enableMeasurementToolsCheckbox,
      ],
    });
  }
}

trackLab.register("TrackLabPreferencesNode", TrackLabPreferencesNode);
