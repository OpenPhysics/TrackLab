/**
 * KinematicsGraphNode.ts
 *
 * A configurable graph that displays kinematic data from tracks.
 * Users can select which variables to plot on each axis (t, x, y, vx, vy, speed, ax, ay, |a|).
 */

import { Property, type TReadOnlyProperty } from "scenerystack/axon";
import { HBox, Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { ComboBox, type ComboBoxItem } from "scenerystack/sun";
import ConfigurableGraph from "../graph/ConfigurableGraph.js";
import type { PlottableProperty } from "../graph/PlottableProperty.js";
import type { SimModel } from "../model/SimModel.js";

// Graph dimensions
const GRAPH_WIDTH = 300;
const GRAPH_HEIGHT = 200;
const MAX_DATA_POINTS = 5000;

function createPlottableProperty(
  name: string,
  unit: string | TReadOnlyProperty<string>,
  accessor: (point: Record<string, number>) => number,
): PlottableProperty {
  return { name, unit, accessor };
}

export class KinematicsGraphNode extends VBox {
  private readonly graph: ConfigurableGraph;
  private readonly model: SimModel;
  private readonly selectedTrackProperty: Property<string | null>;
  private readonly trackSelectorContainer: Node;
  private readonly listParent: Node;
  private currentComboBox: ComboBox<string | null> | null = null;
  private readonly disposeKinematicsGraph: () => void;

  public constructor(model: SimModel, listParent: Node) {
    super({
      spacing: 8,
      align: "left",
    });

    this.model = model;
    this.listParent = listParent;
    this.selectedTrackProperty = new Property<string | null>(null);

    // Create plottable properties using unit properties from the model.
    // Accessor functions return 0 for undefined values (filtered out later by NaN check).
    // NOTE: Using bracket notation required by TypeScript's noUncheckedIndexedAccess
    const plottableProperties: PlottableProperty[] = [
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
      createPlottableProperty("t", "s", (pt) => pt["t"] ?? 0),
      createPlottableProperty(
        "x",
        model.distanceUnitProperty,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
        (pt) => pt["x"] ?? 0,
      ),
      createPlottableProperty(
        "y",
        model.distanceUnitProperty,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
        (pt) => pt["y"] ?? 0,
      ),
      createPlottableProperty(
        "vx",
        model.velocityUnitProperty,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
        (pt) => pt["vx"] ?? 0,
      ),
      createPlottableProperty(
        "vy",
        model.velocityUnitProperty,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
        (pt) => pt["vy"] ?? 0,
      ),
      createPlottableProperty(
        "speed",
        model.velocityUnitProperty,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
        (pt) => pt["speed"] ?? 0,
      ),
      createPlottableProperty(
        "ax",
        model.accelerationUnitProperty,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
        (pt) => pt["ax"] ?? 0,
      ),
      createPlottableProperty(
        "ay",
        model.accelerationUnitProperty,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
        (pt) => pt["ay"] ?? 0,
      ),
      createPlottableProperty(
        "|a|",
        model.accelerationUnitProperty,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
        (pt) => pt["aMag"] ?? 0,
      ),
    ];

    // Default: plot y vs x (trajectory)
    const initialXProperty = plottableProperties[1];
    const initialYProperty = plottableProperties[2];

    if (!(initialXProperty && initialYProperty)) {
      throw new Error("Failed to initialize plottable properties");
    }

    // Create the configurable graph
    // Pass 'this' (KinematicsGraphNode) as dragTargetNode so dragging moves the whole container
    this.graph = new ConfigurableGraph(
      plottableProperties,
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
    const trackSelectorLabel = new Text("Track:", {
      font: new PhetFont(12),
    });

    const trackComboBoxItems = this.createTrackComboBoxItems();
    this.currentComboBox = new ComboBox(this.selectedTrackProperty, trackComboBoxItems, this.listParent, {
      xMargin: 8,
      yMargin: 4,
    });

    const trackSelector = new HBox({
      spacing: 8,
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
          createNode: () => new Text("No tracks", { font: new PhetFont(12) }),
          tandemName: "noTracksItem",
        },
      ];
    }

    return tracks.map((track) => ({
      value: track.id,
      createNode: () =>
        new Text(`Track ${track.symbol}`, {
          font: new PhetFont(12),
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
