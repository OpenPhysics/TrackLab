/**
 * SimScreenView.ts
 *
 * Root layout for the simulation screen, composing all UI components and computing
 * the model-view transform between real-world and video-pixel coordinates.
 */

import { DerivedProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { DragListener, Node } from "scenerystack/scenery";
import { InfoButton, ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import type { TrackLabPreferencesModel } from "../../preferences/TrackLabPreferencesModel.js";
import { CONTROL_PANEL_LEFT_MARGIN, DATA_TABLE_TOP_SPACING, RESET_BUTTON_MARGIN } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import type { SimModel } from "../model/SimModel.js";
import { AngleToolNode } from "./AngleToolNode.js";
import { CalibrationToolNode } from "./CalibrationToolNode.js";
import { ControlPanel } from "./ControlPanel.js";
import { CoordinateSystemNode } from "./CoordinateSystemNode.js";
import { DataTableNode } from "./DataTableNode.js";
import { InfoDialogNode } from "./InfoDialogNode.js";
import { KinematicsGraphNode } from "./KinematicsGraphNode.js";
import { MeasurementToolsPanel } from "./MeasurementToolsPanel.js";
import { MeasuringTapeNode } from "./MeasuringTapeNode.js";
import { TrackListPanel } from "./TrackListPanel.js";
import { VideoPlayerNode } from "./VideoPlayerNode.js";

// ── Layout constants ──────────────────────────────────────────────────────────
const SCREEN_TOP_MARGIN = 10; // inset from layout top edge for control panel and video
const VIDEO_PLAYER_LEFT_SPACING = 60; // gap between control panel right and video player left
const KINEMATICS_GRAPH_BOTTOM_MARGIN = 50; // gap between kinematics graph bottom and reset button top

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
      [model.playback.videoLoadedProperty, model.overlayTools.axesVisibleProperty],
      (loaded, visible) => loaded && visible,
    );
    const calibrationShownProperty = new DerivedProperty(
      [model.playback.videoLoadedProperty, model.overlayTools.calibrationVisibleProperty],
      (loaded, visible) => loaded && visible,
    );
    const measuringTapeShownProperty = new DerivedProperty(
      [model.playback.videoLoadedProperty, model.overlayTools.measuringTapeVisibleProperty],
      (loaded, visible) => loaded && visible,
    );
    const angleToolShownProperty = new DerivedProperty(
      [model.playback.videoLoadedProperty, model.overlayTools.angleToolVisibleProperty],
      (loaded, visible) => loaded && visible,
    );

    // ── Control panel / tool checkboxes (upper left) ───────────────────────
    const controlPanel = new ControlPanel(model.overlayTools, trackLabPreferences);
    controlPanel.left = this.layoutBounds.left + CONTROL_PANEL_LEFT_MARGIN;
    controlPanel.top = this.layoutBounds.top + SCREEN_TOP_MARGIN;
    this.addChild(controlPanel);

    // ── Track list panel (beneath control panel) ─────────────────────────
    const trackListPanel = new TrackListPanel(model.tracking, model.playback.videoLoadedProperty);
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
    this.videoPlayerNode.left = controlPanel.right + VIDEO_PLAYER_LEFT_SPACING;
    this.videoPlayerNode.top = this.layoutBounds.top + SCREEN_TOP_MARGIN;
    this.addChild(this.videoPlayerNode);

    // ── Overlay tools (children of the video content layer, video-local coords) ──
    // All overlay tools are added via addVideoOverlay() so they share the same
    // video-local coordinate space and transform with the video.
    const coordinateSystemNode = new CoordinateSystemNode(
      axesShownProperty,
      model.overlayTools,
      model.tracking.activeTrackIdProperty,
    );
    this.videoPlayerNode.addVideoOverlay(coordinateSystemNode);

    const calibrationToolNode = new CalibrationToolNode(
      calibrationShownProperty,
      this,
      model.overlayTools,
      model.tracking.activeTrackIdProperty,
    );
    this.videoPlayerNode.addVideoOverlay(calibrationToolNode);

    const measuringTapeNode = new MeasuringTapeNode(measuringTapeShownProperty, model.overlayTools);
    this.videoPlayerNode.addVideoOverlay(measuringTapeNode);

    const angleToolNode = new AngleToolNode(angleToolShownProperty, model.overlayTools);
    this.videoPlayerNode.addVideoOverlay(angleToolNode);

    // ── Data table (top right, shifts left when window is wider than layoutBounds) ─
    const dataTableNode = new DataTableNode(
      model.tracking,
      model.playback.videoLoadedProperty,
      model.overlayTools.calibUnitProperty,
    );
    this.addChild(dataTableNode);

    dataTableNode.top = this.layoutBounds.top + SCREEN_TOP_MARGIN;

    // ── Reset all (bottom right) ─────────────────────────────────────────
    const resetAllButton = new ResetAllButton({
      listener: () => {
        this.videoPlayerNode.reset(); // clear selection before model clears recordings list
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
    const kinematicsGraph = new KinematicsGraphNode(
      model.tracking,
      model.overlayTools,
      model.playback.videoLoadedProperty,
      this,
      trackLabPreferences,
    );
    this.addChild(kinematicsGraph);

    // ── Info dialog (explains digitizing workflow) ────────────────────────────
    const infoDialogNode = new InfoDialogNode();
    this.addChild(infoDialogNode);

    // ── Info button (lower-left corner, same vertical level as reset button) ─
    const infoButton = new InfoButton({
      listener: () => {
        infoDialogNode.visible = !infoDialogNode.visible;
      },
      scale: 0.5,
      tandem: Tandem.OPT_OUT,
    });
    this.addChild(infoButton);

    // ── Measurement tools panel (above the info button, preference-gated) ─
    const measurementToolsPanel = new MeasurementToolsPanel(model.overlayTools);
    measurementToolsPanel.visibleProperty = trackLabPreferences.enableMeasurementToolsProperty;
    this.addChild(measurementToolsPanel);

    // ── Webcam panel (topmost when visible, above coord/calibration overlays) ─
    const webcamPanel = this.videoPlayerNode.webcamPanel;
    this.addChild(webcamPanel);
    this.videoPlayerNode.boundsProperty.lazyLink(() => {
      webcamPanel.centerX = this.videoPlayerNode.centerX;
      webcamPanel.centerY = this.videoPlayerNode.centerY;
    });

    // ── Reactive visible-bounds layout ───────────────────────────────────────
    // visibleBoundsProperty extends beyond layoutBounds when the browser window
    // is wider/taller than the default layout. All right-edge anchors are linked
    // here so they track the actual visible edge rather than the fixed layoutBounds.
    this.visibleBoundsProperty.link((visibleBounds) => {
      // Reset button: anchor to the actual visible bottom-right corner.
      resetAllButton.right = visibleBounds.maxX - RESET_BUTTON_MARGIN;
      resetAllButton.bottom = visibleBounds.maxY - RESET_BUTTON_MARGIN;

      // Info button: lower-left corner, mirroring the reset button margin.
      infoButton.left = visibleBounds.minX + RESET_BUTTON_MARGIN;
      infoButton.centerY = resetAllButton.centerY;

      // Measurement tools panel: above the info button, left-aligned with it.
      measurementToolsPanel.left = infoButton.left;
      measurementToolsPanel.bottom = infoButton.top - RESET_BUTTON_MARGIN;

      // Info dialog: centered horizontally, positioned just above the info button.
      infoDialogNode.centerX = this.layoutBounds.centerX;
      infoDialogNode.bottom = infoButton.top - RESET_BUTTON_MARGIN;

      // Data table: anchor to the right with fixed margin from visible edge
      dataTableNode.right = visibleBounds.maxX - RESET_BUTTON_MARGIN - 20;

      // Kinematics graph: right edge tracks the visible right boundary.
      kinematicsGraph.right = visibleBounds.maxX;

      // Both of these depend on resetAllButton's final position (set above),
      // so they are wired here inside the same link.
      kinematicsGraph.bottom = resetAllButton.top - KINEMATICS_GRAPH_BOTTOM_MARGIN;
      playbackControlsNode.centerY = resetAllButton.centerY;
    });

    // ── PDOM order for keyboard tab navigation ────────────────────────────
    // The visual z-order (addChild sequence) doesn't match the logical tab
    // flow. ScreenView forbids setting pdomOrder on itself, so we add a
    // lightweight wrapper Node whose pdomOrder "borrows" every interactive
    // node and presents them in a sensible sequence:
    //   left sidebar → main video area → overlays (workflow order)
    //   → analysis panels → utility buttons → modals
    this.addChild(
      new Node({
        pdomOrder: [
          controlPanel,
          trackListPanel,
          this.videoPlayerNode,
          playbackControlsNode,
          coordinateSystemNode,
          calibrationToolNode,
          measuringTapeNode,
          angleToolNode,
          dataTableNode,
          kinematicsGraph,
          measurementToolsPanel,
          infoButton,
          resetAllButton,
          infoDialogNode,
          webcamPanel,
        ],
      }),
    );

    // ── Data table drag ───────────────────────────────────────────────────
    // Lets the user freely reposition the data table panel by dragging it.
    let dragStartPosition: Vector2 | null = null;
    let dragStartPointerPoint: Vector2 | null = null;
    dataTableNode.cursor = "grab";
    dataTableNode.addInputListener(
      new DragListener({
        start: (event) => {
          dragStartPosition = new Vector2(dataTableNode.x, dataTableNode.y);
          dragStartPointerPoint = event.pointer.point.copy();
        },
        drag: (event) => {
          if (!(dragStartPosition && dragStartPointerPoint)) {
            return;
          }
          const delta = event.pointer.point.minus(dragStartPointerPoint);
          dataTableNode.x = dragStartPosition.x + delta.x;
          dataTableNode.y = dragStartPosition.y + delta.y;
        },
        end: () => {
          dragStartPosition = null;
          dragStartPointerPoint = null;
        },
      }),
    );
  }
}

trackLab.register("SimScreenView", SimScreenView);
