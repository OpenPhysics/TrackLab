/**
 * StringManager.ts
 *
 * Centralizes string management for trackLab.
 * Provides access to localized strings for all components.
 */

import { LocalizedString, ReadOnlyProperty } from "scenerystack";
import strings_en from "./strings_en.json";
import strings_fr from "./strings_fr.json";

/**
 * Manages all localized strings for the simulation
 */
export class StringManager {
  // The cached singleton instance
  private static instance: StringManager;

  // All string properties organized by category
  private readonly stringProperties;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.stringProperties = LocalizedString.getNestedStringProperties({
      en: strings_en,
      fr: strings_fr,
    });
  }

  /**
   * Get the singleton instance of StringManager
   */
  public static getInstance(): StringManager {
    if (!StringManager.instance) {
      StringManager.instance = new StringManager();
    }
    return StringManager.instance;
  }

  /**
   * Get the title string property
   */
  public getTitleStringProperty(): ReadOnlyProperty<string> {
    return this.stringProperties.titleStringProperty;
  }

  /**
   * Get screen name string properties
   */
  public getScreenNames(): {
    simStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      simStringProperty: this.stringProperties.screens.simStringProperty,
    };
  }

  /**
   * Get playback control string properties
   */
  public getControls(): {
    playStringProperty: ReadOnlyProperty<string>;
    pauseStringProperty: ReadOnlyProperty<string>;
    resetStringProperty: ReadOnlyProperty<string>;
    stepStringProperty: ReadOnlyProperty<string>;
    speedStringProperty: ReadOnlyProperty<string>;
    recordStringProperty: ReadOnlyProperty<string>;
    stopStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      playStringProperty: this.stringProperties.controls.playStringProperty,
      pauseStringProperty: this.stringProperties.controls.pauseStringProperty,
      resetStringProperty: this.stringProperties.controls.resetStringProperty,
      stepStringProperty: this.stringProperties.controls.stepStringProperty,
      speedStringProperty: this.stringProperties.controls.speedStringProperty,
      recordStringProperty: this.stringProperties.controls.recordStringProperty,
      stopStringProperty: this.stringProperties.controls.stopStringProperty,
    };
  }

  /**
   * Get tracking string properties
   */
  public getTracking(): {
    trackStringProperty: ReadOnlyProperty<string>;
    targetStringProperty: ReadOnlyProperty<string>;
    originStringProperty: ReadOnlyProperty<string>;
    calibrateStringProperty: ReadOnlyProperty<string>;
    scaleStringProperty: ReadOnlyProperty<string>;
    positionStringProperty: ReadOnlyProperty<string>;
    velocityStringProperty: ReadOnlyProperty<string>;
    accelerationStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      trackStringProperty: this.stringProperties.tracking.trackStringProperty,
      targetStringProperty: this.stringProperties.tracking.targetStringProperty,
      originStringProperty: this.stringProperties.tracking.originStringProperty,
      calibrateStringProperty:
        this.stringProperties.tracking.calibrateStringProperty,
      scaleStringProperty: this.stringProperties.tracking.scaleStringProperty,
      positionStringProperty:
        this.stringProperties.tracking.positionStringProperty,
      velocityStringProperty:
        this.stringProperties.tracking.velocityStringProperty,
      accelerationStringProperty:
        this.stringProperties.tracking.accelerationStringProperty,
    };
  }

  /**
   * Get video string properties
   */
  public getVideo(): {
    openFileStringProperty: ReadOnlyProperty<string>;
    frameRateStringProperty: ReadOnlyProperty<string>;
    currentFrameStringProperty: ReadOnlyProperty<string>;
    durationStringProperty: ReadOnlyProperty<string>;
    exportStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      openFileStringProperty:
        this.stringProperties.video.openFileStringProperty,
      frameRateStringProperty:
        this.stringProperties.video.frameRateStringProperty,
      currentFrameStringProperty:
        this.stringProperties.video.currentFrameStringProperty,
      durationStringProperty:
        this.stringProperties.video.durationStringProperty,
      exportStringProperty: this.stringProperties.video.exportStringProperty,
    };
  }

  /**
   * Get measurement string properties
   */
  public getMeasurement(): {
    timeStringProperty: ReadOnlyProperty<string>;
    distanceStringProperty: ReadOnlyProperty<string>;
    angleStringProperty: ReadOnlyProperty<string>;
    massStringProperty: ReadOnlyProperty<string>;
    gravityStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      timeStringProperty:
        this.stringProperties.measurement.timeStringProperty,
      distanceStringProperty:
        this.stringProperties.measurement.distanceStringProperty,
      angleStringProperty:
        this.stringProperties.measurement.angleStringProperty,
      massStringProperty:
        this.stringProperties.measurement.massStringProperty,
      gravityStringProperty:
        this.stringProperties.measurement.gravityStringProperty,
    };
  }
}
