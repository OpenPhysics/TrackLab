/**
 * KinematicsGraphNode.ts
 *
 * A configurable graph that displays kinematic data from tracks.
 * Users can select which variables to plot on each axis (t, x, y, vx, vy, speed, ax, ay, |a|).
 * The velocity and acceleration groups can be hidden via user preferences.
 */

import { Property } from "scenerystack/axon";
import { HBox, Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { ComboBox, type ComboBoxItem } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import type { TrackLabPreferencesModel } from "../../preferences/TrackLabPreferencesModel.js";
import ConfigurableGraph from "../graph/ConfigurableGraph.js";
import { buildKinematicsPlottableGroups } from "../graph/kinematics-plottable-properties.js";
import type { PlottableProperty } from "../graph/PlottableProperty.js";
import type { SimModel } from "../model/SimModel.js";

// Graph dimensions
const GRAPH_WIDTH = 300;
const GRAPH_HEIGHT = 200;
const MAX_DATA_POINTS = 5000;

// Track selector UI
const VBOX_SPACING = 8; // vertical gap between track selector row and graph
const TRACK_SELECTOR_FONT = new PhetFont(12); // font for track selector label and combo box items
const TRACK_COMBO_X_MARGIN = 8; // horizontal margin inside track combo box
const TRACK_COMBO_Y_MARGIN = 4; // vertical margin inside track combo box
const TRACK_SELECTOR_SPACING = 8; // gap between "Track:" label and combo box

export class KinematicsGraphNode extends VBox {
  private readonly graph: ConfigurableGraph;
  private readonly model: SimModel;
  private readonly selectedTrackProperty: Property<string | null>;
  private readonly trackSelectorContainer: Node;
  private readonly listParent: Node;
  private currentComboBox: ComboBox<string | null> | null = null;
  private readonly disposeKinematicsGraph: () => void;
  private readonly kinematicsGraphStrings;

  public constructor(model: SimModel, listParent: Node, preferencesModel: TrackLabPreferencesModel) {
    super({
      spacing: VBOX_SPACING,
      align: "left",
    });

    this.kinematicsGraphStrings = StringManager.getInstance().getKinematicsGraph();
    this.model = model;
    this.listParent = listParent;
    this.selectedTrackProperty = new Property<string | null>(null);

    // Build the categorised groups of plottable quantities.
    // Object references are stable — the same PlottableProperty instances are
    // reused across filter updates so identity checks in setAvailableProperties work.
    const groups = buildKinematicsPlottableGroups(model);

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
      this, // dragTargetNode - move this VBox when dragging
    );

    // Make the graph visible by default
    this.graph.getGraphVisibleProperty().value = true;

    // Container for the track selector (will be rebuilt when tracks change)
    this.trackSelectorContainer = new Node();

    // Update combo box when tracks change (link fires immediately, building initial selector)
    const tracksListener = (tracks: readonly import("../model/Track.js").Track[]) => {
      // Dispose old combo box FIRST to disconnect it from the property
      // (prevents assertion error when property value changes)
      if (this.currentComboBox) {
        this.currentComboBox.dispose();
        this.currentComboBox = null;
      }

      // Now update selection to match new tracks
      const currentId = this.selectedTrackProperty.value;
      const firstTrack = tracks[0];
      if (tracks.length === 0 || !firstTrack) {
        this.selectedTrackProperty.value = null;
      } else if (currentId === null || !tracks.some((t) => t.id === currentId)) {
        this.selectedTrackProperty.value = firstTrack.id;
      }

      // Build new combo box with updated items
      this.rebuildTrackSelector();
    };
    model.tracksProperty.link(tracksListener);

    // Update graph when selected track changes or kinematics update
    const selectedTrackListener = () => this.updateGraph();
    this.selectedTrackProperty.link(selectedTrackListener);

    const kinematicsListener = () => this.updateGraph();
    model.trackKinematicsProperty.link(kinematicsListener);

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
    model.distanceUnitProperty.lazyLink(distanceUnitListener);

    // When preferences change, rebuild the available properties in the graph selectors.
    const velocityPrefListener = () => {
      this.graph.setAvailableProperties(getFilteredProperties());
    };
    preferencesModel.showVelocityInGraphProperty.lazyLink(velocityPrefListener);

    const accelerationPrefListener = () => {
      this.graph.setAvailableProperties(getFilteredProperties());
    };
    preferencesModel.showAccelerationInGraphProperty.lazyLink(accelerationPrefListener);

    // Layout
    this.children = [this.trackSelectorContainer, this.graph];

    // Store cleanup function
    this.disposeKinematicsGraph = () => {
      model.tracksProperty.unlink(tracksListener);
      this.selectedTrackProperty.unlink(selectedTrackListener);
      model.trackKinematicsProperty.unlink(kinematicsListener);
      this.graph.getXPropertyProperty().unlink(xPropertyListener);
      this.graph.getYPropertyProperty().unlink(yPropertyListener);
      model.distanceUnitProperty.unlink(distanceUnitListener);
      preferencesModel.showVelocityInGraphProperty.unlink(velocityPrefListener);
      preferencesModel.showAccelerationInGraphProperty.unlink(accelerationPrefListener);
      if (this.currentComboBox) {
        this.currentComboBox.dispose();
      }
      this.selectedTrackProperty.dispose();
      this.graph.dispose();
    };
  }

  public override dispose(): void {
    this.disposeKinematicsGraph();
    super.dispose();
  }

  /**
   * Rebuilds the track selector combo box with current tracks.
   * Note: The old combo box should be disposed before calling this method.
   */
  private rebuildTrackSelector(): void {
    const trackSelectorLabel = new Text(this.kinematicsGraphStrings.trackSelectorLabelStringProperty, {
      font: TRACK_SELECTOR_FONT,
    });

    const trackComboBoxItems = this.createTrackComboBoxItems();
    this.currentComboBox = new ComboBox(this.selectedTrackProperty, trackComboBoxItems, this.listParent, {
      xMargin: TRACK_COMBO_X_MARGIN,
      yMargin: TRACK_COMBO_Y_MARGIN,
    });

    const trackSelector = new HBox({
      spacing: TRACK_SELECTOR_SPACING,
      children: [trackSelectorLabel, this.currentComboBox],
    });

    this.trackSelectorContainer.children = [trackSelector];
  }

  /**
   * Creates combo box items for track selection.
   */
  private createTrackComboBoxItems(): ComboBoxItem<string | null>[] {
    const tracks = this.model.tracksProperty.value;

    if (tracks.length === 0) {
      return [
        {
          value: null,
          createNode: () => new Text(this.kinematicsGraphStrings.noTracksStringProperty, { font: TRACK_SELECTOR_FONT }),
          tandemName: "noTracksItem",
        },
      ];
    }

    return tracks.map((track) => ({
      value: track.id,
      createNode: () =>
        new Text(this.kinematicsGraphStrings.trackItemStringProperty.value.replace("{{symbol}}", track.symbol), {
          font: TRACK_SELECTOR_FONT,
          fill: track.color,
        }),
      tandemName: `track${track.symbol}Item`,
    }));
  }

  /**
   * Updates the graph with data from the selected track.
   */
  private updateGraph(): void {
    this.graph.clearData();

    const selectedId = this.selectedTrackProperty.value;
    if (selectedId === null) {
      return;
    }

    const kinematics = this.model.trackKinematicsProperty.value;
    const trackData = kinematics.find((tk) => tk.id === selectedId);

    if (!trackData || trackData.points.length === 0) {
      return;
    }

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

    if (dataPoints.length > 0) {
      this.graph.addDataPoints(dataPoints);
    }
  }
}
