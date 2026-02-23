import { DerivedProperty } from "scenerystack/axon";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import type { TrackLabPreferencesModel } from "../../preferences/TrackLabPreferencesModel.js";
import {
  CONTROL_PANEL_LEFT_MARGIN,
  DATA_TABLE_TOP_SPACING,
  RESET_BUTTON_MARGIN,
} from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";
import { CalibrationToolNode } from "./CalibrationToolNode.js";
import { ControlPanel } from "./ControlPanel.js";
import { CoordinateSystemNode } from "./CoordinateSystemNode.js";
import { DataTableNode } from "./DataTableNode.js";
import { KinematicsGraphNode } from "./KinematicsGraphNode.js";
import { TrackListPanel } from "./TrackListPanel.js";
import { VideoPlayerNode } from "./VideoPlayerNode.js";

/**
 * Root layout for the simulation screen.
 *
 * Positions all major UI regions: control panel, track list, video player with
 * overlays, coordinate system, calibration tool, data table, kinematics graph,
 * and reset button. The webcam modal is placed above all other content for
 * correct z-ordering.
 */
export class SimScreenView extends ScreenView {
  private readonly videoPlayerNode: VideoPlayerNode;

  /**
   * @param model - The simulation model owning all reactive state.
   * @param trackLabPreferences - User preference flags (e.g. auto-tracking toggle).
   * @param options - Optional ScreenView configuration passed to the superclass.
   */
  public constructor(model: SimModel, trackLabPreferences: TrackLabPreferencesModel, options?: ScreenViewOptions) {
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

    // ── Control panel / tool checkboxes (upper left) ───────────────────────
    const controlPanel = new ControlPanel(model, trackLabPreferences);
    controlPanel.left = this.layoutBounds.left + CONTROL_PANEL_LEFT_MARGIN;
    controlPanel.top = this.layoutBounds.top + 10;
    this.addChild(controlPanel);

    // ── Track list panel (beneath control panel) ─────────────────────────
    const trackListPanel = new TrackListPanel(model, model.videoLoadedProperty);
    this.addChild(trackListPanel);
    // Reactively reposition whenever controlPanel resizes (e.g. auto-tracking row toggles).
    controlPanel.boundsProperty.link(() => {
      trackListPanel.left = controlPanel.left;
      trackListPanel.top = controlPanel.bottom + DATA_TABLE_TOP_SPACING;
    });

    // ── Video player (shifted left) ──────────────────────────────────────
    // Uses model.modelViewTransformProperty (a DerivedProperty computed inside
    // SimModel from the tool state properties above).
    this.videoPlayerNode = new VideoPlayerNode(model, this);
    this.videoPlayerNode.left = controlPanel.right + 20;
    this.videoPlayerNode.top = this.layoutBounds.top + 10;
    this.addChild(this.videoPlayerNode);

    // ── Coordinate system overlay (above video, below camera modal) ─────────
    // Reads/writes model.coordOriginProperty and model.coordAngleProperty.
    const coordinateSystemNode = new CoordinateSystemNode(axesShownProperty, model);
    this.addChild(coordinateSystemNode);

    // ── Calibration tool overlay (above video, below camera modal) ─────────
    // Reads/writes model.calibPoint1/2Property, model.calibDistanceProperty,
    // and model.calibUnitProperty.
    const calibrationToolNode = new CalibrationToolNode(calibrationShownProperty, this, model);
    this.addChild(calibrationToolNode);

    // ── Data table (top, a bit to the left) ──────────────────────────────
    const dataTableNode = new DataTableNode(model, model.videoLoadedProperty, model.calibUnitProperty);
    this.addChild(dataTableNode);
    dataTableNode.top = this.layoutBounds.top + 10;

    // ── Reset all (bottom right) ─────────────────────────────────────────
    const resetAllButton = new ResetAllButton({
      listener: () => {
        model.reset(); // resets all model state including tool positions
      },
    });
    this.addChild(resetAllButton);

    // ── Playback controls bar (bottom of screen, same height as reset button) ─
    const playbackControlsNode = this.videoPlayerNode.playbackControlsNode;
    this.addChild(playbackControlsNode);
    playbackControlsNode.centerX = this.videoPlayerNode.centerX;
    playbackControlsNode.boundsProperty.lazyLink(() => {
      playbackControlsNode.centerX = this.videoPlayerNode.centerX;
      playbackControlsNode.centerY = resetAllButton.centerY;
    });

    // ── Kinematics graph (bottom right, above reset all) ─────────────────
    const kinematicsGraph = new KinematicsGraphNode(model, this, trackLabPreferences);
    this.addChild(kinematicsGraph);

    // ── Reactive right-edge positioning ──────────────────────────────────
    // When the browser window is wider than layoutBounds, visibleBoundsProperty
    // extends beyond layoutBounds on both sides.  The three elements below are
    // anchored to the right edge of the screen and must follow it dynamically.
    this.visibleBoundsProperty.link((visibleBounds) => {
      const extraWidth = Math.max(0, visibleBounds.maxX - this.layoutBounds.maxX);

      // Data display: shift right in proportion to the extra visible width.
      dataTableNode.left = this.videoPlayerNode.right + 20 + extraWidth;

      // Reset button: stays pinned to the visible bottom-right corner.
      resetAllButton.right = visibleBounds.maxX - RESET_BUTTON_MARGIN;
      resetAllButton.bottom = visibleBounds.maxY - RESET_BUTTON_MARGIN;

      // Playback controls align vertically with the reset button.
      playbackControlsNode.centerY = resetAllButton.centerY;

      // Kinematics graph (grasp): tracks the visible right edge with the same
      // fixed overhang that lets the user pull it onto the screen.
      kinematicsGraph.right = visibleBounds.maxX + 45;
      kinematicsGraph.bottom = resetAllButton.top - 150;
    });

    // ── Webcam panel (topmost when visible, above coord/calibration overlays) ─
    const webcamPanel = this.videoPlayerNode.webcamPanel;
    this.addChild(webcamPanel);
    this.videoPlayerNode.boundsProperty.lazyLink(() => {
      webcamPanel.centerX = this.videoPlayerNode.centerX;
      webcamPanel.centerY = this.videoPlayerNode.centerY;
    });
  }
}
