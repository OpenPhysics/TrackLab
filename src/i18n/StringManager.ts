/**
 * StringManager.ts
 *
 * Centralizes string management for trackLab.
 * Provides access to localized strings for all components.
 */

import { LocalizedString, type ReadOnlyProperty } from "scenerystack";
import stringsEn from "./strings_en.json";
import stringsFr from "./strings_fr.json";

// ── Compile-time key-parity check ─────────────────────────────────────────────
// These type aliases exist solely so TypeScript verifies that both language files
// share identical key structures. If a key is added to one file but not the
// other, a type error will appear here before the app is ever run.
type EnMatchesFr = typeof stringsEn extends typeof stringsFr ? true : never;
type FrMatchesEn = typeof stringsFr extends typeof stringsEn ? true : never;
// Force evaluation (unused types are not checked without a reference).
declare const _parity: EnMatchesFr & FrMatchesEn;

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
      en: stringsEn,
      fr: stringsFr,
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
   * Get keyboard shortcuts string properties
   */
  public getKeyboardShortcutsStrings(): {
    titleStringProperty: ReadOnlyProperty<string>;
    simulationControlsStringProperty: ReadOnlyProperty<string>;
    graphInteractionsStringProperty: ReadOnlyProperty<string>;
    playPauseSimulationStringProperty: ReadOnlyProperty<string>;
    resetSimulationStringProperty: ReadOnlyProperty<string>;
    stepBackwardStringProperty: ReadOnlyProperty<string>;
    stepForwardStringProperty: ReadOnlyProperty<string>;
    rewindToStartStringProperty: ReadOnlyProperty<string>;
    resetZoomStringProperty: ReadOnlyProperty<string>;
    zoomInOutStringProperty: ReadOnlyProperty<string>;
    panViewStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      titleStringProperty: this.stringProperties.keyboardShortcuts.titleStringProperty,
      simulationControlsStringProperty: this.stringProperties.keyboardShortcuts.simulationControlsStringProperty,
      graphInteractionsStringProperty: this.stringProperties.keyboardShortcuts.graphInteractionsStringProperty,
      playPauseSimulationStringProperty: this.stringProperties.keyboardShortcuts.playPauseSimulationStringProperty,
      resetSimulationStringProperty: this.stringProperties.keyboardShortcuts.resetSimulationStringProperty,
      stepBackwardStringProperty: this.stringProperties.keyboardShortcuts.stepBackwardStringProperty,
      stepForwardStringProperty: this.stringProperties.keyboardShortcuts.stepForwardStringProperty,
      rewindToStartStringProperty: this.stringProperties.keyboardShortcuts.rewindToStartStringProperty,
      resetZoomStringProperty: this.stringProperties.keyboardShortcuts.resetZoomStringProperty,
      zoomInOutStringProperty: this.stringProperties.keyboardShortcuts.zoomInOutStringProperty,
      panViewStringProperty: this.stringProperties.keyboardShortcuts.panViewStringProperty,
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
    graphVsStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      playStringProperty: this.stringProperties.controls.playStringProperty,
      pauseStringProperty: this.stringProperties.controls.pauseStringProperty,
      resetStringProperty: this.stringProperties.controls.resetStringProperty,
      stepStringProperty: this.stringProperties.controls.stepStringProperty,
      speedStringProperty: this.stringProperties.controls.speedStringProperty,
      recordStringProperty: this.stringProperties.controls.recordStringProperty,
      stopStringProperty: this.stringProperties.controls.stopStringProperty,
      graphVsStringProperty: this.stringProperties.controls.graphVsStringProperty,
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
      calibrateStringProperty: this.stringProperties.tracking.calibrateStringProperty,
      scaleStringProperty: this.stringProperties.tracking.scaleStringProperty,
      positionStringProperty: this.stringProperties.tracking.positionStringProperty,
      velocityStringProperty: this.stringProperties.tracking.velocityStringProperty,
      accelerationStringProperty: this.stringProperties.tracking.accelerationStringProperty,
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
      openFileStringProperty: this.stringProperties.video.openFileStringProperty,
      frameRateStringProperty: this.stringProperties.video.frameRateStringProperty,
      currentFrameStringProperty: this.stringProperties.video.currentFrameStringProperty,
      durationStringProperty: this.stringProperties.video.durationStringProperty,
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
      timeStringProperty: this.stringProperties.measurement.timeStringProperty,
      distanceStringProperty: this.stringProperties.measurement.distanceStringProperty,
      angleStringProperty: this.stringProperties.measurement.angleStringProperty,
      massStringProperty: this.stringProperties.measurement.massStringProperty,
      gravityStringProperty: this.stringProperties.measurement.gravityStringProperty,
    };
  }

  /**
   * Get preference string properties
   */
  public getPreferences(): {
    simulationStringProperty: ReadOnlyProperty<string>;
    enableAutoTrackingStringProperty: ReadOnlyProperty<string>;
    enableAutoTrackingDescriptionStringProperty: ReadOnlyProperty<string>;
    showVelocityStringProperty: ReadOnlyProperty<string>;
    showVelocityDescriptionStringProperty: ReadOnlyProperty<string>;
    showAccelerationStringProperty: ReadOnlyProperty<string>;
    showAccelerationDescriptionStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      simulationStringProperty: this.stringProperties.preferences.simulationStringProperty,
      enableAutoTrackingStringProperty: this.stringProperties.preferences.enableAutoTrackingStringProperty,
      enableAutoTrackingDescriptionStringProperty:
        this.stringProperties.preferences.enableAutoTrackingDescriptionStringProperty,
      showVelocityStringProperty: this.stringProperties.preferences.showVelocityStringProperty,
      showVelocityDescriptionStringProperty: this.stringProperties.preferences.showVelocityDescriptionStringProperty,
      showAccelerationStringProperty: this.stringProperties.preferences.showAccelerationStringProperty,
      showAccelerationDescriptionStringProperty:
        this.stringProperties.preferences.showAccelerationDescriptionStringProperty,
    };
  }

  /**
   * Get auto-tracker string properties
   */
  public getAutoTracker(): {
    dragToSelectStringProperty: ReadOnlyProperty<string>;
    videoTrackingAreaStringProperty: ReadOnlyProperty<string>;
    trackingInitFailedStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      dragToSelectStringProperty: this.stringProperties.autoTracker.dragToSelectStringProperty,
      videoTrackingAreaStringProperty: this.stringProperties.autoTracker.videoTrackingAreaStringProperty,
      trackingInitFailedStringProperty: this.stringProperties.autoTracker.trackingInitFailedStringProperty,
    };
  }

  /**
   * Get calibration tool string properties
   */
  public getCalibration(): {
    pointsTooCloseStringProperty: ReadOnlyProperty<string>;
    calibrationPoint1StringProperty: ReadOnlyProperty<string>;
    calibrationPoint2StringProperty: ReadOnlyProperty<string>;
  } {
    return {
      pointsTooCloseStringProperty: this.stringProperties.calibration.pointsTooCloseStringProperty,
      calibrationPoint1StringProperty: this.stringProperties.calibration.calibrationPoint1StringProperty,
      calibrationPoint2StringProperty: this.stringProperties.calibration.calibrationPoint2StringProperty,
    };
  }

  /**
   * Get data table string properties
   */
  public getDataTable(): {
    titleStringProperty: ReadOnlyProperty<string>;
    csvStringProperty: ReadOnlyProperty<string>;
    noDataStringProperty: ReadOnlyProperty<string>;
    frameStringProperty: ReadOnlyProperty<string>;
    timeSecondsStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      titleStringProperty: this.stringProperties.dataTable.titleStringProperty,
      csvStringProperty: this.stringProperties.dataTable.csvStringProperty,
      noDataStringProperty: this.stringProperties.dataTable.noDataStringProperty,
      frameStringProperty: this.stringProperties.dataTable.frameStringProperty,
      timeSecondsStringProperty: this.stringProperties.dataTable.timeSecondsStringProperty,
    };
  }

  /**
   * Get track list string properties
   */
  public getTrackList(): {
    addTrackStringProperty: ReadOnlyProperty<string>;
    tracksStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      addTrackStringProperty: this.stringProperties.trackList.addTrackStringProperty,
      tracksStringProperty: this.stringProperties.trackList.tracksStringProperty,
    };
  }

  /**
   * Get general UI string properties
   */
  public getUI(): {
    fpsStringProperty: ReadOnlyProperty<string>;
    selectVideoStringProperty: ReadOnlyProperty<string>;
    sampleVideosStringProperty: ReadOnlyProperty<string>;
    myRecordingsStringProperty: ReadOnlyProperty<string>;
    uploadedVideosStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      fpsStringProperty: this.stringProperties.ui.fpsStringProperty,
      selectVideoStringProperty: this.stringProperties.ui.selectVideoStringProperty,
      sampleVideosStringProperty: this.stringProperties.ui.sampleVideosStringProperty,
      myRecordingsStringProperty: this.stringProperties.ui.myRecordingsStringProperty,
      uploadedVideosStringProperty: this.stringProperties.ui.uploadedVideosStringProperty,
    };
  }

  /**
   * Get coordinate system string properties
   */
  public getCoordSystem(): {
    xAxisLabelStringProperty: ReadOnlyProperty<string>;
    yAxisLabelStringProperty: ReadOnlyProperty<string>;
    rotationHandleStringProperty: ReadOnlyProperty<string>;
    coordinateSystemStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      xAxisLabelStringProperty: this.stringProperties.coordSystem.xAxisLabelStringProperty,
      yAxisLabelStringProperty: this.stringProperties.coordSystem.yAxisLabelStringProperty,
      rotationHandleStringProperty: this.stringProperties.coordSystem.rotationHandleStringProperty,
      coordinateSystemStringProperty: this.stringProperties.coordSystem.coordinateSystemStringProperty,
    };
  }

  /**
   * Get video source control string properties
   */
  public getVideoSource(): {
    downloadVideoStringProperty: ReadOnlyProperty<string>;
    openVideoFileStringProperty: ReadOnlyProperty<string>;
    recordWebcamStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      downloadVideoStringProperty: this.stringProperties.videoSource.downloadVideoStringProperty,
      openVideoFileStringProperty: this.stringProperties.videoSource.openVideoFileStringProperty,
      recordWebcamStringProperty: this.stringProperties.videoSource.recordWebcamStringProperty,
    };
  }

  /**
   * Get webcam string properties
   */
  public getWebcam(): {
    requestingAccessStringProperty: ReadOnlyProperty<string>;
    accessDeniedStringProperty: ReadOnlyProperty<string>;
    processingStringProperty: ReadOnlyProperty<string>;
    fixingMetadataStringProperty: ReadOnlyProperty<string>;
    recordingStringProperty: ReadOnlyProperty<string>;
    cancelStringProperty: ReadOnlyProperty<string>;
    startRecordingStringProperty: ReadOnlyProperty<string>;
    stopRecordingStringProperty: ReadOnlyProperty<string>;
    reRecordStringProperty: ReadOnlyProperty<string>;
    useVideoStringProperty: ReadOnlyProperty<string>;
    cameraStringProperty: ReadOnlyProperty<string>;
    recordFromWebcamStringProperty: ReadOnlyProperty<string>;
    estimatingFrameRateStringProperty: ReadOnlyProperty<string>;
    highConfidenceStringProperty: ReadOnlyProperty<string>;
    mediumConfidenceStringProperty: ReadOnlyProperty<string>;
    lowConfidenceStringProperty: ReadOnlyProperty<string>;
    estimatedFpsStringProperty: ReadOnlyProperty<string>;
    cameraLabelStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      requestingAccessStringProperty: this.stringProperties.webcam.requestingAccessStringProperty,
      accessDeniedStringProperty: this.stringProperties.webcam.accessDeniedStringProperty,
      processingStringProperty: this.stringProperties.webcam.processingStringProperty,
      fixingMetadataStringProperty: this.stringProperties.webcam.fixingMetadataStringProperty,
      recordingStringProperty: this.stringProperties.webcam.recordingStringProperty,
      cancelStringProperty: this.stringProperties.webcam.cancelStringProperty,
      startRecordingStringProperty: this.stringProperties.webcam.startRecordingStringProperty,
      stopRecordingStringProperty: this.stringProperties.webcam.stopRecordingStringProperty,
      reRecordStringProperty: this.stringProperties.webcam.reRecordStringProperty,
      useVideoStringProperty: this.stringProperties.webcam.useVideoStringProperty,
      cameraStringProperty: this.stringProperties.webcam.cameraStringProperty,
      recordFromWebcamStringProperty: this.stringProperties.webcam.recordFromWebcamStringProperty,
      estimatingFrameRateStringProperty: this.stringProperties.webcam.estimatingFrameRateStringProperty,
      highConfidenceStringProperty: this.stringProperties.webcam.highConfidenceStringProperty,
      mediumConfidenceStringProperty: this.stringProperties.webcam.mediumConfidenceStringProperty,
      lowConfidenceStringProperty: this.stringProperties.webcam.lowConfidenceStringProperty,
      estimatedFpsStringProperty: this.stringProperties.webcam.estimatedFpsStringProperty,
      cameraLabelStringProperty: this.stringProperties.webcam.cameraLabelStringProperty,
    };
  }

  /**
   * Get kinematics graph string properties
   */
  public getKinematicsGraph(): {
    trackSelectorLabelStringProperty: ReadOnlyProperty<string>;
    noTracksStringProperty: ReadOnlyProperty<string>;
    trackItemStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      trackSelectorLabelStringProperty: this.stringProperties.kinematicsGraph.trackSelectorLabelStringProperty,
      noTracksStringProperty: this.stringProperties.kinematicsGraph.noTracksStringProperty,
      trackItemStringProperty: this.stringProperties.kinematicsGraph.trackItemStringProperty,
    };
  }

  /**
   * Get playback format string properties
   */
  public getPlayback(): {
    secondsUnitStringProperty: ReadOnlyProperty<string>;
    durationZeroStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      secondsUnitStringProperty: this.stringProperties.playback.secondsUnitStringProperty,
      durationZeroStringProperty: this.stringProperties.playback.durationZeroStringProperty,
    };
  }

  /**
   * Get accessibility string properties
   */
  public getA11y(): {
    videoPlayerStringProperty: ReadOnlyProperty<string>;
    videoScrubberStringProperty: ReadOnlyProperty<string>;
    rewindToStartStringProperty: ReadOnlyProperty<string>;
    digitizingAreaStringProperty: ReadOnlyProperty<string>;
    digitizeTrackStringProperty: ReadOnlyProperty<string>;
    removeTrackStringProperty: ReadOnlyProperty<string>;
    dataTableStringProperty: ReadOnlyProperty<string>;
    exportCSVStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      videoPlayerStringProperty: this.stringProperties.a11y.videoPlayerStringProperty,
      videoScrubberStringProperty: this.stringProperties.a11y.videoScrubberStringProperty,
      rewindToStartStringProperty: this.stringProperties.a11y.rewindToStartStringProperty,
      digitizingAreaStringProperty: this.stringProperties.a11y.digitizingAreaStringProperty,
      digitizeTrackStringProperty: this.stringProperties.a11y.digitizeTrackStringProperty,
      removeTrackStringProperty: this.stringProperties.a11y.removeTrackStringProperty,
      dataTableStringProperty: this.stringProperties.a11y.dataTableStringProperty,
      exportCSVStringProperty: this.stringProperties.a11y.exportCSVStringProperty,
    };
  }

  /**
   * Get info dialog string properties
   */
  public getInfoDialog(): {
    titleStringProperty: ReadOnlyProperty<string>;
    loadVideoTitleStringProperty: ReadOnlyProperty<string>;
    loadVideoBodyStringProperty: ReadOnlyProperty<string>;
    coordinateSystemTitleStringProperty: ReadOnlyProperty<string>;
    coordinateSystemBodyStringProperty: ReadOnlyProperty<string>;
    calibrationTitleStringProperty: ReadOnlyProperty<string>;
    calibrationBodyStringProperty: ReadOnlyProperty<string>;
    addTrackTitleStringProperty: ReadOnlyProperty<string>;
    addTrackBodyStringProperty: ReadOnlyProperty<string>;
    digitizeTitleStringProperty: ReadOnlyProperty<string>;
    digitizeBodyStringProperty: ReadOnlyProperty<string>;
    autoTrackTitleStringProperty: ReadOnlyProperty<string>;
    autoTrackBodyStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      titleStringProperty: this.stringProperties.infoDialog.titleStringProperty,
      loadVideoTitleStringProperty: this.stringProperties.infoDialog.loadVideoTitleStringProperty,
      loadVideoBodyStringProperty: this.stringProperties.infoDialog.loadVideoBodyStringProperty,
      coordinateSystemTitleStringProperty: this.stringProperties.infoDialog.coordinateSystemTitleStringProperty,
      coordinateSystemBodyStringProperty: this.stringProperties.infoDialog.coordinateSystemBodyStringProperty,
      calibrationTitleStringProperty: this.stringProperties.infoDialog.calibrationTitleStringProperty,
      calibrationBodyStringProperty: this.stringProperties.infoDialog.calibrationBodyStringProperty,
      addTrackTitleStringProperty: this.stringProperties.infoDialog.addTrackTitleStringProperty,
      addTrackBodyStringProperty: this.stringProperties.infoDialog.addTrackBodyStringProperty,
      digitizeTitleStringProperty: this.stringProperties.infoDialog.digitizeTitleStringProperty,
      digitizeBodyStringProperty: this.stringProperties.infoDialog.digitizeBodyStringProperty,
      autoTrackTitleStringProperty: this.stringProperties.infoDialog.autoTrackTitleStringProperty,
      autoTrackBodyStringProperty: this.stringProperties.infoDialog.autoTrackBodyStringProperty,
    };
  }

  /**
   * Get video file label string properties
   */
  public getVideoFiles(): {
    ballOilStringProperty: ReadOnlyProperty<string>;
    bouncingCartStringProperty: ReadOnlyProperty<string>;
    cartPendulumStringProperty: ReadOnlyProperty<string>;
    cupsClipsStringProperty: ReadOnlyProperty<string>;
    parachuteMonkeyStringProperty: ReadOnlyProperty<string>;
    pendulumStringProperty: ReadOnlyProperty<string>;
    pendulumDragStringProperty: ReadOnlyProperty<string>;
    pucksCollideStringProperty: ReadOnlyProperty<string>;
    springWarsStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      ballOilStringProperty: this.stringProperties.videoFiles.ballOilStringProperty,
      bouncingCartStringProperty: this.stringProperties.videoFiles.bouncingCartStringProperty,
      cartPendulumStringProperty: this.stringProperties.videoFiles.cartPendulumStringProperty,
      cupsClipsStringProperty: this.stringProperties.videoFiles.cupsClipsStringProperty,
      parachuteMonkeyStringProperty: this.stringProperties.videoFiles.parachuteMonkeyStringProperty,
      pendulumStringProperty: this.stringProperties.videoFiles.pendulumStringProperty,
      pendulumDragStringProperty: this.stringProperties.videoFiles.pendulumDragStringProperty,
      pucksCollideStringProperty: this.stringProperties.videoFiles.pucksCollideStringProperty,
      springWarsStringProperty: this.stringProperties.videoFiles.springWarsStringProperty,
    };
  }
}
