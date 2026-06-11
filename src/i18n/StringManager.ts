/**
 * StringManager.ts
 *
 * Centralizes string management for trackLab.
 * Provides access to localized strings for all components.
 */

import type { ReadOnlyProperty } from "scenerystack/axon";
import { LocalizedString } from "scenerystack/chipper";
import stringsEn from "./strings_en.json";
import stringsEs from "./strings_es.json";
import stringsFr from "./strings_fr.json";

/** Recursively apply phet.chipper.mapString to all string values (for ?stringTest=double, etc.) */
function applyStringTest<T>(obj: T): T {
  const mapString = (globalThis as { phet?: { chipper?: { mapString?: (s: string) => string } } }).phet?.chipper
    ?.mapString;
  if (!mapString) {
    return obj;
  }

  if (typeof obj === "string") {
    return mapString(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(applyStringTest) as T;
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = applyStringTest(v);
    }
    return result as T;
  }
  return obj;
}

// ── Compile-time key-parity check ─────────────────────────────────────────────
// satisfies errors immediately if either locale file is missing keys from the other.
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsEn satisfies typeof stringsFr);
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsFr satisfies typeof stringsEn);

// ── Build the reactive string property tree ───────────────────────────────────
const stringProperties = LocalizedString.getNestedStringProperties({
  en: applyStringTest(stringsEn),
  fr: applyStringTest(stringsFr),
  es: applyStringTest(stringsEs),
});

export class StringManager {
  private static instance: StringManager | null = null;

  private constructor() {
    // Private — obtain via getInstance()
  }

  public static getInstance(): StringManager {
    if (StringManager.instance === null) {
      StringManager.instance = new StringManager();
    }
    return StringManager.instance;
  }

  /**
   * Get the title string property
   */
  public getTitleStringProperty(): ReadOnlyProperty<string> {
    return stringProperties.titleStringProperty;
  }

  /**
   * Get screen name string properties
   */
  public getScreenNames(): {
    simStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      simStringProperty: stringProperties.screens.simStringProperty,
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
      titleStringProperty: stringProperties.keyboardShortcuts.titleStringProperty,
      simulationControlsStringProperty: stringProperties.keyboardShortcuts.simulationControlsStringProperty,
      graphInteractionsStringProperty: stringProperties.keyboardShortcuts.graphInteractionsStringProperty,
      playPauseSimulationStringProperty: stringProperties.keyboardShortcuts.playPauseSimulationStringProperty,
      resetSimulationStringProperty: stringProperties.keyboardShortcuts.resetSimulationStringProperty,
      stepBackwardStringProperty: stringProperties.keyboardShortcuts.stepBackwardStringProperty,
      stepForwardStringProperty: stringProperties.keyboardShortcuts.stepForwardStringProperty,
      rewindToStartStringProperty: stringProperties.keyboardShortcuts.rewindToStartStringProperty,
      resetZoomStringProperty: stringProperties.keyboardShortcuts.resetZoomStringProperty,
      zoomInOutStringProperty: stringProperties.keyboardShortcuts.zoomInOutStringProperty,
      panViewStringProperty: stringProperties.keyboardShortcuts.panViewStringProperty,
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
      playStringProperty: stringProperties.controls.playStringProperty,
      pauseStringProperty: stringProperties.controls.pauseStringProperty,
      resetStringProperty: stringProperties.controls.resetStringProperty,
      stepStringProperty: stringProperties.controls.stepStringProperty,
      speedStringProperty: stringProperties.controls.speedStringProperty,
      recordStringProperty: stringProperties.controls.recordStringProperty,
      stopStringProperty: stringProperties.controls.stopStringProperty,
      graphVsStringProperty: stringProperties.controls.graphVsStringProperty,
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
      trackStringProperty: stringProperties.tracking.trackStringProperty,
      targetStringProperty: stringProperties.tracking.targetStringProperty,
      originStringProperty: stringProperties.tracking.originStringProperty,
      calibrateStringProperty: stringProperties.tracking.calibrateStringProperty,
      scaleStringProperty: stringProperties.tracking.scaleStringProperty,
      positionStringProperty: stringProperties.tracking.positionStringProperty,
      velocityStringProperty: stringProperties.tracking.velocityStringProperty,
      accelerationStringProperty: stringProperties.tracking.accelerationStringProperty,
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
    loadFailedStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      openFileStringProperty: stringProperties.video.openFileStringProperty,
      frameRateStringProperty: stringProperties.video.frameRateStringProperty,
      currentFrameStringProperty: stringProperties.video.currentFrameStringProperty,
      durationStringProperty: stringProperties.video.durationStringProperty,
      exportStringProperty: stringProperties.video.exportStringProperty,
      loadFailedStringProperty: stringProperties.video.loadFailedStringProperty,
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
      timeStringProperty: stringProperties.measurement.timeStringProperty,
      distanceStringProperty: stringProperties.measurement.distanceStringProperty,
      angleStringProperty: stringProperties.measurement.angleStringProperty,
      massStringProperty: stringProperties.measurement.massStringProperty,
      gravityStringProperty: stringProperties.measurement.gravityStringProperty,
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
    enableMeasurementToolsStringProperty: ReadOnlyProperty<string>;
    enableMeasurementToolsDescriptionStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      simulationStringProperty: stringProperties.preferences.simulationStringProperty,
      enableAutoTrackingStringProperty: stringProperties.preferences.enableAutoTrackingStringProperty,
      enableAutoTrackingDescriptionStringProperty:
        stringProperties.preferences.enableAutoTrackingDescriptionStringProperty,
      showVelocityStringProperty: stringProperties.preferences.showVelocityStringProperty,
      showVelocityDescriptionStringProperty: stringProperties.preferences.showVelocityDescriptionStringProperty,
      showAccelerationStringProperty: stringProperties.preferences.showAccelerationStringProperty,
      showAccelerationDescriptionStringProperty: stringProperties.preferences.showAccelerationDescriptionStringProperty,
      enableMeasurementToolsStringProperty: stringProperties.preferences.enableMeasurementToolsStringProperty,
      enableMeasurementToolsDescriptionStringProperty:
        stringProperties.preferences.enableMeasurementToolsDescriptionStringProperty,
    };
  }

  /**
   * Get auto-tracker string properties
   */
  public getAutoTracker(): {
    dragToSelectStringProperty: ReadOnlyProperty<string>;
    videoTrackingAreaStringProperty: ReadOnlyProperty<string>;
    trackingInitFailedStringProperty: ReadOnlyProperty<string>;
    framesTrackedStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      dragToSelectStringProperty: stringProperties.autoTracker.dragToSelectStringProperty,
      videoTrackingAreaStringProperty: stringProperties.autoTracker.videoTrackingAreaStringProperty,
      trackingInitFailedStringProperty: stringProperties.autoTracker.trackingInitFailedStringProperty,
      framesTrackedStringProperty: stringProperties.autoTracker.framesTrackedStringProperty,
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
      pointsTooCloseStringProperty: stringProperties.calibration.pointsTooCloseStringProperty,
      calibrationPoint1StringProperty: stringProperties.calibration.calibrationPoint1StringProperty,
      calibrationPoint2StringProperty: stringProperties.calibration.calibrationPoint2StringProperty,
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
      titleStringProperty: stringProperties.dataTable.titleStringProperty,
      csvStringProperty: stringProperties.dataTable.csvStringProperty,
      noDataStringProperty: stringProperties.dataTable.noDataStringProperty,
      frameStringProperty: stringProperties.dataTable.frameStringProperty,
      timeSecondsStringProperty: stringProperties.dataTable.timeSecondsStringProperty,
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
      addTrackStringProperty: stringProperties.trackList.addTrackStringProperty,
      tracksStringProperty: stringProperties.trackList.tracksStringProperty,
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
      fpsStringProperty: stringProperties.ui.fpsStringProperty,
      selectVideoStringProperty: stringProperties.ui.selectVideoStringProperty,
      sampleVideosStringProperty: stringProperties.ui.sampleVideosStringProperty,
      myRecordingsStringProperty: stringProperties.ui.myRecordingsStringProperty,
      uploadedVideosStringProperty: stringProperties.ui.uploadedVideosStringProperty,
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
      xAxisLabelStringProperty: stringProperties.coordSystem.xAxisLabelStringProperty,
      yAxisLabelStringProperty: stringProperties.coordSystem.yAxisLabelStringProperty,
      rotationHandleStringProperty: stringProperties.coordSystem.rotationHandleStringProperty,
      coordinateSystemStringProperty: stringProperties.coordSystem.coordinateSystemStringProperty,
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
      downloadVideoStringProperty: stringProperties.videoSource.downloadVideoStringProperty,
      openVideoFileStringProperty: stringProperties.videoSource.openVideoFileStringProperty,
      recordWebcamStringProperty: stringProperties.videoSource.recordWebcamStringProperty,
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
      requestingAccessStringProperty: stringProperties.webcam.requestingAccessStringProperty,
      accessDeniedStringProperty: stringProperties.webcam.accessDeniedStringProperty,
      processingStringProperty: stringProperties.webcam.processingStringProperty,
      fixingMetadataStringProperty: stringProperties.webcam.fixingMetadataStringProperty,
      recordingStringProperty: stringProperties.webcam.recordingStringProperty,
      cancelStringProperty: stringProperties.webcam.cancelStringProperty,
      startRecordingStringProperty: stringProperties.webcam.startRecordingStringProperty,
      stopRecordingStringProperty: stringProperties.webcam.stopRecordingStringProperty,
      reRecordStringProperty: stringProperties.webcam.reRecordStringProperty,
      useVideoStringProperty: stringProperties.webcam.useVideoStringProperty,
      cameraStringProperty: stringProperties.webcam.cameraStringProperty,
      recordFromWebcamStringProperty: stringProperties.webcam.recordFromWebcamStringProperty,
      estimatingFrameRateStringProperty: stringProperties.webcam.estimatingFrameRateStringProperty,
      highConfidenceStringProperty: stringProperties.webcam.highConfidenceStringProperty,
      mediumConfidenceStringProperty: stringProperties.webcam.mediumConfidenceStringProperty,
      lowConfidenceStringProperty: stringProperties.webcam.lowConfidenceStringProperty,
      estimatedFpsStringProperty: stringProperties.webcam.estimatedFpsStringProperty,
      cameraLabelStringProperty: stringProperties.webcam.cameraLabelStringProperty,
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
      trackSelectorLabelStringProperty: stringProperties.kinematicsGraph.trackSelectorLabelStringProperty,
      noTracksStringProperty: stringProperties.kinematicsGraph.noTracksStringProperty,
      trackItemStringProperty: stringProperties.kinematicsGraph.trackItemStringProperty,
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
      secondsUnitStringProperty: stringProperties.playback.secondsUnitStringProperty,
      durationZeroStringProperty: stringProperties.playback.durationZeroStringProperty,
    };
  }

  /**
   * Get accessibility string properties
   */
  public getA11y(): {
    infoDialogTab1StringProperty: ReadOnlyProperty<string>;
    infoDialogTab2StringProperty: ReadOnlyProperty<string>;
    videoPlayerStringProperty: ReadOnlyProperty<string>;
    videoScrubberStringProperty: ReadOnlyProperty<string>;
    rewindToStartStringProperty: ReadOnlyProperty<string>;
    digitizingAreaStringProperty: ReadOnlyProperty<string>;
    digitizeTrackStringProperty: ReadOnlyProperty<string>;
    removeTrackStringProperty: ReadOnlyProperty<string>;
    dataTableStringProperty: ReadOnlyProperty<string>;
    exportCSVStringProperty: ReadOnlyProperty<string>;
    measuringTapeBaseStringProperty: ReadOnlyProperty<string>;
    measuringTapeTipStringProperty: ReadOnlyProperty<string>;
    angleToolVertexStringProperty: ReadOnlyProperty<string>;
    angleArm1StringProperty: ReadOnlyProperty<string>;
    angleArm2StringProperty: ReadOnlyProperty<string>;
    toggleAxesStringProperty: ReadOnlyProperty<string>;
    toggleCalibrationStringProperty: ReadOnlyProperty<string>;
    toggleMagnifierStringProperty: ReadOnlyProperty<string>;
    toggleAutoTrackingStringProperty: ReadOnlyProperty<string>;
    toggleMeasuringTapeStringProperty: ReadOnlyProperty<string>;
    toggleAngleToolStringProperty: ReadOnlyProperty<string>;
    graphRescaleStringProperty: ReadOnlyProperty<string>;
    graphZoomInStringProperty: ReadOnlyProperty<string>;
    graphZoomOutStringProperty: ReadOnlyProperty<string>;
    graphPanLeftStringProperty: ReadOnlyProperty<string>;
    graphPanRightStringProperty: ReadOnlyProperty<string>;
    graphPanUpStringProperty: ReadOnlyProperty<string>;
    graphPanDownStringProperty: ReadOnlyProperty<string>;
    kinematicsGraphStringProperty: ReadOnlyProperty<string>;
    selectTrackForGraphStringProperty: ReadOnlyProperty<string>;
    graphResizeTopLeftStringProperty: ReadOnlyProperty<string>;
    graphResizeTopRightStringProperty: ReadOnlyProperty<string>;
    graphResizeBottomLeftStringProperty: ReadOnlyProperty<string>;
    graphResizeBottomRightStringProperty: ReadOnlyProperty<string>;
    tableResizeTopLeftStringProperty: ReadOnlyProperty<string>;
    tableResizeTopRightStringProperty: ReadOnlyProperty<string>;
    tableResizeBottomLeftStringProperty: ReadOnlyProperty<string>;
    tableResizeBottomRightStringProperty: ReadOnlyProperty<string>;
    toggleVideoVisibilityStringProperty: ReadOnlyProperty<string>;
    graphPanelHeaderStringProperty: ReadOnlyProperty<string>;
    videoPanelHandleStringProperty: ReadOnlyProperty<string>;
    videoPanelResizeHandleStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      infoDialogTab1StringProperty: stringProperties.a11y.infoDialogTab1StringProperty,
      infoDialogTab2StringProperty: stringProperties.a11y.infoDialogTab2StringProperty,
      videoPlayerStringProperty: stringProperties.a11y.videoPlayerStringProperty,
      videoScrubberStringProperty: stringProperties.a11y.videoScrubberStringProperty,
      rewindToStartStringProperty: stringProperties.a11y.rewindToStartStringProperty,
      digitizingAreaStringProperty: stringProperties.a11y.digitizingAreaStringProperty,
      digitizeTrackStringProperty: stringProperties.a11y.digitizeTrackStringProperty,
      removeTrackStringProperty: stringProperties.a11y.removeTrackStringProperty,
      dataTableStringProperty: stringProperties.a11y.dataTableStringProperty,
      exportCSVStringProperty: stringProperties.a11y.exportCSVStringProperty,
      measuringTapeBaseStringProperty: stringProperties.a11y.measuringTapeBaseStringProperty,
      measuringTapeTipStringProperty: stringProperties.a11y.measuringTapeTipStringProperty,
      angleToolVertexStringProperty: stringProperties.a11y.angleToolVertexStringProperty,
      angleArm1StringProperty: stringProperties.a11y.angleArm1StringProperty,
      angleArm2StringProperty: stringProperties.a11y.angleArm2StringProperty,
      toggleAxesStringProperty: stringProperties.a11y.toggleAxesStringProperty,
      toggleCalibrationStringProperty: stringProperties.a11y.toggleCalibrationStringProperty,
      toggleMagnifierStringProperty: stringProperties.a11y.toggleMagnifierStringProperty,
      toggleAutoTrackingStringProperty: stringProperties.a11y.toggleAutoTrackingStringProperty,
      toggleMeasuringTapeStringProperty: stringProperties.a11y.toggleMeasuringTapeStringProperty,
      toggleAngleToolStringProperty: stringProperties.a11y.toggleAngleToolStringProperty,
      graphRescaleStringProperty: stringProperties.a11y.graphRescaleStringProperty,
      graphZoomInStringProperty: stringProperties.a11y.graphZoomInStringProperty,
      graphZoomOutStringProperty: stringProperties.a11y.graphZoomOutStringProperty,
      graphPanLeftStringProperty: stringProperties.a11y.graphPanLeftStringProperty,
      graphPanRightStringProperty: stringProperties.a11y.graphPanRightStringProperty,
      graphPanUpStringProperty: stringProperties.a11y.graphPanUpStringProperty,
      graphPanDownStringProperty: stringProperties.a11y.graphPanDownStringProperty,
      kinematicsGraphStringProperty: stringProperties.a11y.kinematicsGraphStringProperty,
      selectTrackForGraphStringProperty: stringProperties.a11y.selectTrackForGraphStringProperty,
      graphResizeTopLeftStringProperty: stringProperties.a11y.graphResizeTopLeftStringProperty,
      graphResizeTopRightStringProperty: stringProperties.a11y.graphResizeTopRightStringProperty,
      graphResizeBottomLeftStringProperty: stringProperties.a11y.graphResizeBottomLeftStringProperty,
      graphResizeBottomRightStringProperty: stringProperties.a11y.graphResizeBottomRightStringProperty,
      tableResizeTopLeftStringProperty: stringProperties.a11y.tableResizeTopLeftStringProperty,
      tableResizeTopRightStringProperty: stringProperties.a11y.tableResizeTopRightStringProperty,
      tableResizeBottomLeftStringProperty: stringProperties.a11y.tableResizeBottomLeftStringProperty,
      tableResizeBottomRightStringProperty: stringProperties.a11y.tableResizeBottomRightStringProperty,
      toggleVideoVisibilityStringProperty: stringProperties.a11y.toggleVideoVisibilityStringProperty,
      graphPanelHeaderStringProperty: stringProperties.a11y.graphPanelHeaderStringProperty,
      videoPanelHandleStringProperty: stringProperties.a11y.videoPanelHandleStringProperty,
      videoPanelResizeHandleStringProperty: stringProperties.a11y.videoPanelResizeHandleStringProperty,
    };
  }

  /**
   * Get info dialog string properties
   */
  public getInfoDialog(): {
    titleStringProperty: ReadOnlyProperty<string>;
    tab1LabelStringProperty: ReadOnlyProperty<string>;
    tab2LabelStringProperty: ReadOnlyProperty<string>;
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
    measuringTapeTitleStringProperty: ReadOnlyProperty<string>;
    measuringTapeBodyStringProperty: ReadOnlyProperty<string>;
    angleToolTitleStringProperty: ReadOnlyProperty<string>;
    angleToolBodyStringProperty: ReadOnlyProperty<string>;
    kinematicsGraphTitleStringProperty: ReadOnlyProperty<string>;
    kinematicsGraphBodyStringProperty: ReadOnlyProperty<string>;
    dataTableTitleStringProperty: ReadOnlyProperty<string>;
    dataTableBodyStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      titleStringProperty: stringProperties.infoDialog.titleStringProperty,
      tab1LabelStringProperty: stringProperties.infoDialog.tab1LabelStringProperty,
      tab2LabelStringProperty: stringProperties.infoDialog.tab2LabelStringProperty,
      loadVideoTitleStringProperty: stringProperties.infoDialog.loadVideoTitleStringProperty,
      loadVideoBodyStringProperty: stringProperties.infoDialog.loadVideoBodyStringProperty,
      coordinateSystemTitleStringProperty: stringProperties.infoDialog.coordinateSystemTitleStringProperty,
      coordinateSystemBodyStringProperty: stringProperties.infoDialog.coordinateSystemBodyStringProperty,
      calibrationTitleStringProperty: stringProperties.infoDialog.calibrationTitleStringProperty,
      calibrationBodyStringProperty: stringProperties.infoDialog.calibrationBodyStringProperty,
      addTrackTitleStringProperty: stringProperties.infoDialog.addTrackTitleStringProperty,
      addTrackBodyStringProperty: stringProperties.infoDialog.addTrackBodyStringProperty,
      digitizeTitleStringProperty: stringProperties.infoDialog.digitizeTitleStringProperty,
      digitizeBodyStringProperty: stringProperties.infoDialog.digitizeBodyStringProperty,
      autoTrackTitleStringProperty: stringProperties.infoDialog.autoTrackTitleStringProperty,
      autoTrackBodyStringProperty: stringProperties.infoDialog.autoTrackBodyStringProperty,
      measuringTapeTitleStringProperty: stringProperties.infoDialog.measuringTapeTitleStringProperty,
      measuringTapeBodyStringProperty: stringProperties.infoDialog.measuringTapeBodyStringProperty,
      angleToolTitleStringProperty: stringProperties.infoDialog.angleToolTitleStringProperty,
      angleToolBodyStringProperty: stringProperties.infoDialog.angleToolBodyStringProperty,
      kinematicsGraphTitleStringProperty: stringProperties.infoDialog.kinematicsGraphTitleStringProperty,
      kinematicsGraphBodyStringProperty: stringProperties.infoDialog.kinematicsGraphBodyStringProperty,
      dataTableTitleStringProperty: stringProperties.infoDialog.dataTableTitleStringProperty,
      dataTableBodyStringProperty: stringProperties.infoDialog.dataTableBodyStringProperty,
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
    collisionOneStringProperty: ReadOnlyProperty<string>;
    collisionTwoStringProperty: ReadOnlyProperty<string>;
    oscillatingCarStringProperty: ReadOnlyProperty<string>;
    verticalTossStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      ballOilStringProperty: stringProperties.videoFiles.ballOilStringProperty,
      bouncingCartStringProperty: stringProperties.videoFiles.bouncingCartStringProperty,
      cartPendulumStringProperty: stringProperties.videoFiles.cartPendulumStringProperty,
      cupsClipsStringProperty: stringProperties.videoFiles.cupsClipsStringProperty,
      parachuteMonkeyStringProperty: stringProperties.videoFiles.parachuteMonkeyStringProperty,
      pendulumStringProperty: stringProperties.videoFiles.pendulumStringProperty,
      pendulumDragStringProperty: stringProperties.videoFiles.pendulumDragStringProperty,
      pucksCollideStringProperty: stringProperties.videoFiles.pucksCollideStringProperty,
      collisionOneStringProperty: stringProperties.videoFiles.collisionOneStringProperty,
      collisionTwoStringProperty: stringProperties.videoFiles.collisionTwoStringProperty,
      oscillatingCarStringProperty: stringProperties.videoFiles.oscillatingCarStringProperty,
      verticalTossStringProperty: stringProperties.videoFiles.verticalTossStringProperty,
    };
  }
}
