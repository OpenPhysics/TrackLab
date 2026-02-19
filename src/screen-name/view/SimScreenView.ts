import { DerivedProperty } from "scenerystack/axon";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import type { TrackLabPreferencesModel } from "../../preferences/TrackLabPreferencesModel.js";
import {
  CONTROL_PANEL_LEFT_MARGIN,
  DATA_TABLE_TOP_SPACING,
  RESET_BUTTON_MARGIN,
  TRACK_LIST_LEFT_SPACING,
  VIDEO_PLAYER_Y_OFFSET,
} from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";
import { CalibrationToolNode } from "./CalibrationToolNode.js";
import { ControlPanel } from "./ControlPanel.js";
import { CoordinateSystemNode } from "./CoordinateSystemNode.js";
import { DataTableNode } from "./DataTableNode.js";
import { KinematicsGraphNode } from "./KinematicsGraphNode.js";
import { TrackListPanel } from "./TrackListPanel.js";
import { VideoPlayerNode } from "./VideoPlayerNode.js";

export class SimScreenView extends ScreenView {
  private readonly videoPlayerNode: VideoPlayerNode;

  public constructor(
    model: SimModel,
    trackLabPreferences: TrackLabPreferencesModel,
    options?: ScreenViewOptions,
  ) {
    super(options);

    // Combined visibility: video loaded AND user-toggled model flag.
    const axesShownProperty = new DerivedProperty(
      [model.videoLoadedProperty, model.axesVisibleProperty],
      (loaded, visible) => loaded && visible,
    );
    const calibrationShownProperty = new DerivedProperty(
      [model.videoLoadedProperty, model.calibrationVisibleProperty],
      (loaded, visible) => loaded && visible,
    );

    // ── Video player ──────────────────────────────────────────────────────
    // Uses model.modelViewTransformProperty (a DerivedProperty computed inside
    // SimModel from the tool state properties above).
    this.videoPlayerNode = new VideoPlayerNode(model, this);
    this.videoPlayerNode.center = this.layoutBounds.center.plusXY(
      0,
      VIDEO_PLAYER_Y_OFFSET,
    );
    this.addChild(this.videoPlayerNode);

    // ── Coordinate system overlay (above video, below camera modal) ─────────
    // Reads/writes model.coordOriginProperty and model.coordAngleProperty.
    const coordinateSystemNode = new CoordinateSystemNode(
      axesShownProperty,
      model,
    );
    this.addChild(coordinateSystemNode);

    // ── Calibration tool overlay (above video, below camera modal) ─────────
    // Reads/writes model.calibPoint1/2Property, model.calibDistanceProperty,
    // and model.calibUnitProperty.
    const calibrationToolNode = new CalibrationToolNode(
      calibrationShownProperty,
      this,
      model,
    );
    this.addChild(calibrationToolNode);

    // ── Control panel (left side) ─────────────────────────────────────────
    const controlPanel = new ControlPanel(model, trackLabPreferences);
    controlPanel.left = this.layoutBounds.left + CONTROL_PANEL_LEFT_MARGIN;
    controlPanel.centerY = this.layoutBounds.centerY;
    this.addChild(controlPanel);

    // ── Track list panel (right of the video) ────────────────────────────
    const trackListPanel = new TrackListPanel(model, model.videoLoadedProperty);
    this.addChild(trackListPanel);
    trackListPanel.left = this.videoPlayerNode.right + TRACK_LIST_LEFT_SPACING;
    trackListPanel.top = this.videoPlayerNode.top;

    // ── Data table (beneath the track list panel, same column) ───────────
    const dataTableNode = new DataTableNode(
      model,
      model.videoLoadedProperty,
      model.calibUnitProperty,
    );
    this.addChild(dataTableNode);
    dataTableNode.left = trackListPanel.left;
    trackListPanel.boundsProperty.link(() => {
      dataTableNode.top = trackListPanel.bottom + DATA_TABLE_TOP_SPACING;
    });

    // ── Kinematics graph (below the video, left side) ───────────────────
    const kinematicsGraph = new KinematicsGraphNode(model, this);
    this.addChild(kinematicsGraph);
    kinematicsGraph.left = this.videoPlayerNode.left;
    kinematicsGraph.top = this.videoPlayerNode.bottom + 10;

    // ── Reset all ─────────────────────────────────────────────────────────
    const resetAllButton = new ResetAllButton({
      listener: () => {
        model.reset(); // resets all model state including tool positions
      },
      right: this.layoutBounds.maxX - RESET_BUTTON_MARGIN,
      bottom: this.layoutBounds.maxY - RESET_BUTTON_MARGIN,
    });
    this.addChild(resetAllButton);

    // ── Webcam panel (topmost when visible, above coord/calibration overlays) ─
    const webcamPanel = this.videoPlayerNode.webcamPanel;
    this.addChild(webcamPanel);
    this.videoPlayerNode.boundsProperty.lazyLink(() => {
      webcamPanel.centerX = this.videoPlayerNode.centerX;
      webcamPanel.centerY = this.videoPlayerNode.centerY;
    });
  }
}
