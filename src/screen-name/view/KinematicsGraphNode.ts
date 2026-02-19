/**
 * KinematicsGraphNode.ts
 *
 * A configurable graph that displays kinematic data from tracks.
 * Users can select which variables to plot on each axis (t, x, y, vx, vy, speed, ax, ay, |a|).
 */

import { NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { HBox, Node, Text, VBox } from "scenerystack/scenery";
import { ComboBox, type ComboBoxItem } from "scenerystack/sun";
import { PhetFont } from "scenerystack/scenery-phet";
import type { SimModel } from "../model/SimModel.js";
import ConfigurableGraph from "../graph/ConfigurableGraph.js";
import type {
  PlottableProperty,
  SubStepDataPoint,
} from "../graph/PlottableProperty.js";

// Graph dimensions
const GRAPH_WIDTH = 300;
const GRAPH_HEIGHT = 200;
const MAX_DATA_POINTS = 5000;

/**
 * Creates a PlottableProperty for a kinematic variable with a subStepAccessor.
 */
function createPlottableProperty(
  name: string,
  unit: string | TReadOnlyProperty<string>,
  dummyProperty: NumberProperty,
  accessor: (point: SubStepDataPoint) => number,
): PlottableProperty {
  return {
    name,
    property: dummyProperty,
    unit,
    subStepAccessor: accessor,
  };
}

export class KinematicsGraphNode extends VBox {
  private readonly graph: ConfigurableGraph;
  private readonly model: SimModel;
  private readonly selectedTrackProperty: Property<string | null>;
  private readonly trackSelectorContainer: Node;
  private readonly listParent: Node;
  private currentComboBox: ComboBox<string | null> | null = null;

  // Dummy properties for the graph (values aren't used directly, we push data manually)
  private readonly tProperty = new NumberProperty(0);
  private readonly xProperty = new NumberProperty(0);
  private readonly yProperty = new NumberProperty(0);
  private readonly vxProperty = new NumberProperty(0);
  private readonly vyProperty = new NumberProperty(0);
  private readonly speedProperty = new NumberProperty(0);
  private readonly axProperty = new NumberProperty(0);
  private readonly ayProperty = new NumberProperty(0);
  private readonly aMagProperty = new NumberProperty(0);

  public constructor(model: SimModel, listParent: Node) {
    super({
      spacing: 8,
      align: "left",
    });

    this.model = model;
    this.listParent = listParent;
    this.selectedTrackProperty = new Property<string | null>(null);

    // Create plottable properties using unit properties from the model
    const plottableProperties: PlottableProperty[] = [
      createPlottableProperty("t", "s", this.tProperty, (pt) => pt.t),
      createPlottableProperty("x", model.distanceUnitProperty, this.xProperty, (pt) => pt.x),
      createPlottableProperty("y", model.distanceUnitProperty, this.yProperty, (pt) => pt.y),
      createPlottableProperty("vx", model.velocityUnitProperty, this.vxProperty, (pt) => pt.vx),
      createPlottableProperty("vy", model.velocityUnitProperty, this.vyProperty, (pt) => pt.vy),
      createPlottableProperty(
        "speed",
        model.velocityUnitProperty,
        this.speedProperty,
        (pt) => pt.speed,
      ),
      createPlottableProperty("ax", model.accelerationUnitProperty, this.axProperty, (pt) => pt.ax),
      createPlottableProperty("ay", model.accelerationUnitProperty, this.ayProperty, (pt) => pt.ay),
      createPlottableProperty(
        "|a|",
        model.accelerationUnitProperty,
        this.aMagProperty,
        (pt) => pt.aMag,
      ),
    ];

    // Default: plot y vs x (trajectory)
    const initialXProperty = plottableProperties[1]; // x
    const initialYProperty = plottableProperties[2]; // y

    // Create the configurable graph
    this.graph = new ConfigurableGraph(
      plottableProperties,
      initialXProperty,
      initialYProperty,
      GRAPH_WIDTH,
      GRAPH_HEIGHT,
      MAX_DATA_POINTS,
      listParent,
    );

    // Make the graph visible by default
    this.graph.getGraphVisibleProperty().value = true;

    // Container for the track selector (will be rebuilt when tracks change)
    this.trackSelectorContainer = new Node();

    // Update combo box when tracks change (link fires immediately, building initial selector)
    model.tracksProperty.link((tracks) => {
      // Dispose old combo box FIRST to disconnect it from the property
      // (prevents assertion error when property value changes)
      if (this.currentComboBox) {
        this.currentComboBox.dispose();
        this.currentComboBox = null;
      }

      // Now update selection to match new tracks
      const currentId = this.selectedTrackProperty.value;
      if (tracks.length === 0) {
        this.selectedTrackProperty.value = null;
      } else if (currentId === null || !tracks.some((t) => t.id === currentId)) {
        this.selectedTrackProperty.value = tracks[0].id;
      }

      // Build new combo box with updated items
      this.rebuildTrackSelector();
    });

    // Update graph when selected track changes or kinematics update
    this.selectedTrackProperty.link(() => this.updateGraph());
    model.trackKinematicsProperty.link(() => this.updateGraph());

    // Update graph when axis selection changes
    this.graph.getXPropertyProperty().lazyLink(() => this.updateGraph());
    this.graph.getYPropertyProperty().lazyLink(() => this.updateGraph());

    // Update axis labels when calibration unit changes
    // (the unit properties in the model are derived from calibUnitProperty)
    model.distanceUnitProperty.lazyLink(() => {
      this.graph.updateAxisLabels();
    });

    // Layout
    this.children = [this.trackSelectorContainer, this.graph];
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
    this.currentComboBox = new ComboBox(
      this.selectedTrackProperty,
      trackComboBoxItems,
      this.listParent,
      {
        xMargin: 8,
        yMargin: 4,
      },
    );

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
    if (selectedId === null) return;

    const kinematics = this.model.trackKinematicsProperty.value;
    const trackData = kinematics.find((tk) => tk.id === selectedId);

    if (!trackData || trackData.points.length === 0) return;

    // Convert kinematic points to SubStepDataPoint format for the graph
    const subStepData: SubStepDataPoint[] = trackData.points.map((pt) => ({
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

    if (subStepData.length > 0) {
      this.graph.addDataPointsFromSubSteps(subStepData);
    }
  }
}
