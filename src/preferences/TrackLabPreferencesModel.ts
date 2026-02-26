/**
 * TrackLabPreferencesModel - Model for trackLab simulation preferences.
 *
 * Manages user preferences for the trackLab simulation, including whether
 * the auto-tracking feature is enabled and which kinematic quantities appear
 * on the graph axes.
 */

import { BooleanProperty } from "scenerystack/axon";
import trackLab from "../TrackLabNamespace.js";
import trackLabQueryParameters from "./trackLabQueryParameters.js";

export class TrackLabPreferencesModel {
  /**
   * Whether the auto-tracking checkbox is visible in the control panel.
   * When false, the auto-tracking checkbox is completely hidden.
   * When true, the checkbox is shown and can be toggled by the user.
   */
  public readonly enableAutoTrackingProperty: BooleanProperty;

  /**
   * Whether velocity quantities (vx, vy, speed) appear in the graph axis selectors.
   */
  public readonly showVelocityInGraphProperty: BooleanProperty;

  /**
   * Whether acceleration quantities (ax, ay, |a|) appear in the graph axis selectors.
   */
  public readonly showAccelerationInGraphProperty: BooleanProperty;

  /**
   * Whether the measurement tools panel (measuring tape + angle tool) is visible.
   * When false, the panel is completely hidden.
   * When true, the panel appears above the info button.
   */
  public readonly enableMeasurementToolsProperty: BooleanProperty;

  public constructor() {
    // Query-parameter controlled startup defaults.
    this.enableAutoTrackingProperty = new BooleanProperty(trackLabQueryParameters.enableAutoTracking);

    this.showVelocityInGraphProperty = new BooleanProperty(trackLabQueryParameters.showVelocityInGraph);
    this.showAccelerationInGraphProperty = new BooleanProperty(trackLabQueryParameters.showAccelerationInGraph);

    this.enableMeasurementToolsProperty = new BooleanProperty(trackLabQueryParameters.enableMeasurementTools);
  }

  public reset(): void {
    this.enableAutoTrackingProperty.reset();
    this.showVelocityInGraphProperty.reset();
    this.showAccelerationInGraphProperty.reset();
    this.enableMeasurementToolsProperty.reset();
  }
}

trackLab.register("TrackLabPreferencesModel", TrackLabPreferencesModel);
