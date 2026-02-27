/**
 * KinematicsGraphNode.ts
 *
 * A configurable graph that displays kinematic data from tracks.
 * Users can select which variables to plot on each axis (t, x, y, vx, vy, speed, ax, ay, |a|).
 * The velocity and acceleration groups can be hidden via user preferences.
 */

import { Property, type TReadOnlyProperty } from "scenerystack/axon";
import { Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import type { TrackLabPreferencesModel } from "../../preferences/TrackLabPreferencesModel.js";
import TrackLabColors, { getTrackColor } from "../../TrackLabColors.js";
import trackLab from "../../TrackLabNamespace.js";
import ConfigurableGraph from "../graph/ConfigurableGraph.js";
import { buildKinematicsPlottableGroups } from "../graph/kinematics-plottable-properties.js";
import type { PlottableProperty } from "../graph/PlottableProperty.js";
import type { OverlayToolsModel } from "../model/OverlayToolsModel.js";
import type { Track } from "../model/Track.js";
import type { TrackingModel } from "../model/TrackingModel.js";

// Graph dimensions
const GRAPH_WIDTH = 300;
const GRAPH_HEIGHT = 200;
const MAX_DATA_POINTS = 5000;

// Track selector UI
const TRACK_CHECKBOX_FONT = new PhetFont(11);
const TRACK_CHECKBOX_SPACING = 6;

export class KinematicsGraphNode extends Node {
  private readonly graph: ConfigurableGraph;
  private readonly tracking: TrackingModel;
  private readonly selectedTracksProperty: Property<Set<string>>;
  private readonly trackCheckboxPanel: Node;
  private readonly trackCheckboxes: Map<string, { checkbox: Checkbox; property: Property<boolean> }> = new Map();
  private readonly disposeKinematicsGraph: () => void;

  public constructor(
    tracking: TrackingModel,
    overlayTools: OverlayToolsModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    listParent: Node,
    preferencesModel: TrackLabPreferencesModel,
  ) {
    const a11yStrings = StringManager.getInstance().getA11y();
    super({
      visible: false,
      tagName: "div",
      accessibleName: a11yStrings.kinematicsGraphStringProperty,
    });

    this.tracking = tracking;
    this.selectedTracksProperty = new Property<Set<string>>(new Set());

    // Build the categorised groups of plottable quantities.
    // Object references are stable — the same PlottableProperty instances are
    // reused across filter updates so identity checks in setAvailableProperties work.
    const groups = buildKinematicsPlottableGroups(overlayTools);

    /** Compute the current filtered list from preference state. */
    const getFilteredProperties = (): PlottableProperty[] => {
      const result: PlottableProperty[] = [...groups.time, ...groups.position];
      if (preferencesModel.showVelocityInGraphProperty.value) {
        result.push(...groups.velocity);
      }
      if (preferencesModel.showAccelerationInGraphProperty.value) {
        result.push(...groups.acceleration);
      }
      return result;
    };

    const initialFiltered = getFilteredProperties();

    // Default: plot y vs x (trajectory)
    const initialXProperty = groups.position[0];
    const initialYProperty = groups.position[1];

    if (!(initialXProperty && initialYProperty)) {
      throw new Error("Failed to initialize plottable properties");
    }

    // Create the configurable graph
    // Pass 'this' (KinematicsGraphNode) as dragTargetNode so dragging moves the whole container
    this.graph = new ConfigurableGraph(
      initialFiltered,
      initialXProperty,
      initialYProperty,
      GRAPH_WIDTH,
      GRAPH_HEIGHT,
      MAX_DATA_POINTS,
      listParent,
      this, // dragTargetNode - move this Node when dragging
    );

    // Make the graph visible by default (the Node visibility controls when it appears)
    this.graph.getGraphVisibleProperty().value = true;

    // Container for the track checkboxes (upper right of graph)
    this.trackCheckboxPanel = new Node();

    this.addChild(this.graph);
    // Add checkboxes to the graph so they move/resize with it
    this.graph.addChild(this.trackCheckboxPanel);

    // Update checkboxes when tracks change (link fires immediately, building initial checkboxes)
    const tracksListener = (tracks: readonly Track[]) => {
      // Dispose old checkboxes
      for (const [, { checkbox, property }] of this.trackCheckboxes) {
        checkbox.dispose();
        property.dispose();
      }
      this.trackCheckboxes.clear();

      // Update selection to remove tracks that no longer exist
      const currentSelection = this.selectedTracksProperty.value;
      const newSelection = new Set<string>();
      for (const trackId of currentSelection) {
        if (tracks.some((t) => t.id === trackId)) {
          newSelection.add(trackId);
        }
      }

      // Auto-select first track if none selected
      if (newSelection.size === 0 && tracks.length > 0 && tracks[0]) {
        newSelection.add(tracks[0].id);
      }

      this.selectedTracksProperty.value = newSelection;

      // Build new checkbox panel with updated tracks
      this.rebuildTrackCheckboxes();
    };
    tracking.tracksProperty.link(tracksListener);

    // Update graph when selected tracks change or kinematics update
    const selectedTracksListener = () => this.updateGraph();
    this.selectedTracksProperty.link(selectedTracksListener);

    const kinematicsListener = () => this.updateGraph();
    tracking.trackKinematicsProperty.link(kinematicsListener);

    // Update graph when axis selection changes
    const xPropertyListener = () => this.updateGraph();
    this.graph.getXPropertyProperty().lazyLink(xPropertyListener);

    const yPropertyListener = () => this.updateGraph();
    this.graph.getYPropertyProperty().lazyLink(yPropertyListener);

    // Update axis labels when calibration unit changes
    // (the unit properties in the model are derived from calibUnitProperty)
    const distanceUnitListener = () => {
      this.graph.updateAxisLabels();
    };
    overlayTools.calibUnitProperty.lazyLink(distanceUnitListener);

    // When preferences change, rebuild the available properties in the graph selectors.
    const velocityPrefListener = () => {
      this.graph.setAvailableProperties(getFilteredProperties());
    };
    preferencesModel.showVelocityInGraphProperty.lazyLink(velocityPrefListener);

    const accelerationPrefListener = () => {
      this.graph.setAvailableProperties(getFilteredProperties());
    };
    preferencesModel.showAccelerationInGraphProperty.lazyLink(accelerationPrefListener);

    // Make graph visible when video is loaded (like DataTableNode)
    const videoLoadedListener = (loaded: boolean) => {
      this.visible = loaded;
    };
    videoLoadedProperty.link(videoLoadedListener);

    // Update checkbox positions when graph bounds change (e.g., after resize)
    const graphBoundsListener = () => {
      this.updateCheckboxPositions();
    };
    this.graph.localBoundsProperty.lazyLink(graphBoundsListener);

    // Store cleanup function
    this.disposeKinematicsGraph = () => {
      tracking.tracksProperty.unlink(tracksListener);
      this.selectedTracksProperty.unlink(selectedTracksListener);
      tracking.trackKinematicsProperty.unlink(kinematicsListener);
      this.graph.getXPropertyProperty().unlink(xPropertyListener);
      this.graph.getYPropertyProperty().unlink(yPropertyListener);
      overlayTools.calibUnitProperty.unlink(distanceUnitListener);
      preferencesModel.showVelocityInGraphProperty.unlink(velocityPrefListener);
      preferencesModel.showAccelerationInGraphProperty.unlink(accelerationPrefListener);
      videoLoadedProperty.unlink(videoLoadedListener);
      this.graph.localBoundsProperty.unlink(graphBoundsListener);
      for (const [, { checkbox, property }] of this.trackCheckboxes) {
        checkbox.dispose();
        property.dispose();
      }
      this.trackCheckboxes.clear();
      this.selectedTracksProperty.dispose();
      this.graph.dispose();
    };
  }

  public override dispose(): void {
    this.disposeKinematicsGraph();
    super.dispose();
  }

  /**
   * Rebuilds the track checkbox panel with current tracks.
   * Positions it in the upper right corner of the graph.
   */
  private rebuildTrackCheckboxes(): void {
    const tracks = this.tracking.tracksProperty.value;

    if (tracks.length === 0) {
      this.trackCheckboxPanel.children = [];
      return;
    }

    const checkboxNodes: Node[] = [];

    for (const track of tracks) {
      // Create a property for this checkbox
      const checkboxProperty = new Property<boolean>(this.selectedTracksProperty.value.has(track.id));

      // When checkbox changes, update the selected tracks set
      checkboxProperty.link((checked) => {
        const newSelection = new Set(this.selectedTracksProperty.value);
        if (checked) {
          newSelection.add(track.id);
        } else {
          newSelection.delete(track.id);
        }
        this.selectedTracksProperty.value = newSelection;
      });

      // Create label with track symbol in track color
      const label = new Text(track.symbol, {
        font: TRACK_CHECKBOX_FONT,
        fill: getTrackColor(track.colorIndex),
      });

      // Create checkbox with accessibility label
      const kinematicsGraphStrings = StringManager.getInstance().getKinematicsGraph();
      const checkbox = new Checkbox(checkboxProperty, label, {
        checkboxColor: TrackLabColors.checkboxColorProperty,
        checkboxColorBackground: TrackLabColors.checkboxColorBackgroundProperty,
        spacing: 4,
        accessibleName: kinematicsGraphStrings.trackItemStringProperty.value.split("{{symbol}}").join(track.symbol),
      });
      checkbox.addInputListener({ down: () => checkbox.focus() });

      // Store for later disposal
      this.trackCheckboxes.set(track.id, { checkbox, property: checkboxProperty });

      checkboxNodes.push(checkbox);
    }

    // Arrange checkboxes vertically
    const checkboxContainer = new VBox({
      children: checkboxNodes,
      spacing: TRACK_CHECKBOX_SPACING,
      align: "left",
    });

    this.trackCheckboxPanel.children = [checkboxContainer];
    this.updateCheckboxPositions();
  }

  /**
   * Updates checkbox positions to stay in upper right corner of graph.
   * Called when checkboxes are rebuilt or when graph is resized.
   */
  private updateCheckboxPositions(): void {
    if (this.trackCheckboxPanel.children.length === 0) {
      return;
    }

    const checkboxContainer = this.trackCheckboxPanel.children[0];
    if (checkboxContainer) {
      // Position relative to graph's current dimensions
      const CHECKBOX_INSET = 8;
      checkboxContainer.right = this.graph.getGraphWidth() - CHECKBOX_INSET;
      checkboxContainer.top = CHECKBOX_INSET;
    }
  }

  /**
   * Updates the graph with data from all selected tracks.
   * Each track gets its own curve with its own color.
   */
  private updateGraph(): void {
    // Clear all tracks first
    this.graph.clearAllTracks();

    const selectedIds = this.selectedTracksProperty.value;
    if (selectedIds.size === 0) {
      return;
    }

    const kinematics = this.tracking.trackKinematicsProperty.value;
    const tracks = this.tracking.tracksProperty.value;

    // Plot each selected track separately with its own color
    for (const trackId of selectedIds) {
      const trackData = kinematics.find((tk) => tk.id === trackId);
      const track = tracks.find((t) => t.id === trackId);

      if (trackData && track && trackData.points.length > 0) {
        const dataPoints = trackData.points.map((pt) => ({
          t: pt.time,
          x: pt.x,
          y: pt.y,
          vx: pt.vx ?? Number.NaN,
          vy: pt.vy ?? Number.NaN,
          speed: pt.speed ?? Number.NaN,
          ax: pt.ax ?? Number.NaN,
          ay: pt.ay ?? Number.NaN,
          aMag: pt.accelerationMagnitude ?? Number.NaN,
        }));

        // Set track data with the track's color
        this.graph.setTrackData(trackId, getTrackColor(track.colorIndex), dataPoints);
      }
    }
  }
}

trackLab.register("KinematicsGraphNode", KinematicsGraphNode);
