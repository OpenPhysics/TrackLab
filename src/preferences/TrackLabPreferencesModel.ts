/**
 * TrackLabPreferencesModel - Model for trackLab simulation preferences.
 *
 * Manages user preferences for the trackLab simulation, including whether
 * the auto-tracking feature is enabled.
 */

import { BooleanProperty } from "scenerystack/axon";

export class TrackLabPreferencesModel {
  /**
   * Whether the auto-tracking checkbox is visible in the control panel.
   * When false, the auto-tracking checkbox is completely hidden.
   * When true, the checkbox is shown and can be toggled by the user.
   */
  public readonly enableAutoTrackingProperty: BooleanProperty;

  public constructor() {
    // By default, auto-tracking checkbox is hidden
    this.enableAutoTrackingProperty = new BooleanProperty(false);
  }

  public reset(): void {
    this.enableAutoTrackingProperty.reset();
  }
}
