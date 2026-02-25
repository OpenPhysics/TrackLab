/**
 * ConfigurableGraph — interactive X-Y plot panel for the kinematics graph subsystem.
 *
 * ## Subsystem overview
 *
 * The graph subsystem lives in `src/screen-name/graph/` and consists of five files:
 *
 * | File | Role |
 * |------|------|
 * | `ConfigurableGraph.ts` | Top-level SceneryStack node; owns the bamboo chart, axis labels, control buttons, and coordinates all sub-modules |
 * | `GraphDataManager.ts` | Accumulates (x, y) data points, drives auto-scaling, and owns the tick-spacing algorithm |
 * | `GraphInteractionHandler.ts` | All pointer/touch/keyboard gestures: pan, pinch-zoom, axis-drag, header-drag, corner-resize |
 * | `GraphControlsPanel.ts` | Builds the axis-selector dropdowns and header bar UI |
 * | `PlottableProperty.ts` | `PlottableProperty` union type — the interface any quantity must satisfy to appear in the axis selector |
 * | `kinematics-plottable-properties.ts` | Canonical registry of all kinematics quantities; the sole place to add a new plottable quantity |
 *
 * ## Data flow
 *
 * ```
 * KinematicsGraphNode          (view layer — owns track selection and wires model → graph)
 *   └─ ConfigurableGraph       (graph node — layout, bamboo chart, buttons)
 *        ├─ GraphDataManager   (data store, auto-scale, tick math)
 *        ├─ GraphInteractionHandler
 *        │    ├─ ZoomGestureHandler
 *        │    ├─ PanGestureHandler
 *        │    ├─ AxisGestureHandler
 *        │    ├─ HeaderGestureHandler
 *        │    └─ ResizeGestureHandler
 *        └─ GraphControlsPanel (axis selector UI)
 * ```
 *
 * ## Gesture coordination
 *
 * `GraphInteractionHandler` is the largest file (~930 lines).  It delegates to
 * five single-responsibility sub-handlers, each in its own file.  Before adding
 * new gesture logic, read the existing `zoom()` / `pan()` / `rescaleAxes()`
 * helpers — many edge cases (pinch-centre preservation, manual-zoom locking,
 * axis-specific gestures) are already handled there.
 *
 * ## Axis selection
 *
 * The two `Property<PlottableProperty>` values (`xPropertyProperty`,
 * `yPropertyProperty`) drive everything: axis labels, data mapping, and the
 * dropdown UI.  They are exposed via `getXPropertyProperty()` /
 * `getYPropertyProperty()` so that `KinematicsGraphNode` can react to changes.
 *
 * ## Visibility
 *
 * `graphVisibleProperty` (initially `false`) gates the entire graph, header,
 * title panel, and resize handles.  Set it to `true` after construction to
 * show the graph; the ToolsControlPanel checkbox is the standard toggle.
 */

import { BooleanProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { ChartRectangle, ChartTransform, GridLineSet, LinePlot, TickLabelSet, TickMarkSet } from "scenerystack/bamboo";
import { Range } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { FireListener, HBox, Node, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import trackLab from "../../TrackLabNamespace.js";
import GraphControlsPanel from "./GraphControlsPanel.js";
import GraphDataManager from "./GraphDataManager.js";
import GraphInteractionHandler from "./GraphInteractionHandler.js";
import type { PlottableProperty } from "./PlottableProperty.js";

// Grid line styling
const GRID_LINE_WIDTH = 0.5;
const PLOT_LINE_WIDTH = 2;
const TICK_EXTENT = 8;
const TICK_LABEL_FONT = new PhetFont({ size: 10 });
const TICK_LABEL_DECIMALS = 2;

// Axis labels
const AXIS_LABEL_FONT = new PhetFont({ size: 12 });
const AXIS_LABEL_OFFSET = 35;

// Axis interaction regions
const Y_AXIS_INTERACTION_WIDTH = 60;
const X_AXIS_INTERACTION_HEIGHT = 30;

// Control button styling
const BUTTON_SIZE = 24;
const BUTTON_PADDING = 4;
const BUTTON_SPACING = 2;
const BUTTON_CORNER_RADIUS = 3;
const BUTTON_FONT = new PhetFont({ size: 14, weight: "bold" });
const BUTTON_HOVER_OPACITY = 0.8;
const TITLE_BOTTOM_OFFSET = -5;

export default class ConfigurableGraph extends Node {
  private readonly xPropertyProperty: Property<PlottableProperty>;
  private readonly yPropertyProperty: Property<PlottableProperty>;
  private readonly chartTransform: ChartTransform;
  private graphWidth: number;
  private graphHeight: number;
  private readonly initialWidth: number;
  private readonly initialHeight: number;

  // Drag and resize UI components
  private readonly headerBar;

  // Clipped data container for line plot and trail
  private readonly clippedDataContainer: Node;

  // Multi-track support: map of trackId -> {linePlot, dataManager}
  private readonly trackPlots: Map<string, { linePlot: LinePlot; dataManager: GraphDataManager }> = new Map();
  private readonly maxDataPoints: number;

  // Visibility control
  private readonly graphVisibleProperty: BooleanProperty;
  private readonly graphContentNode: Node;

  // Axis labels
  private readonly xAxisLabelNode: Text;
  private readonly yAxisLabelNode: Text;

  // Invisible interaction regions for axis controls
  private readonly xAxisInteractionRegion: Rectangle;
  private readonly yAxisInteractionRegion: Rectangle;

  // Module instances
  private readonly dataManager: GraphDataManager;
  private readonly interactionHandler: GraphInteractionHandler;
  private readonly controlsPanel: GraphControlsPanel;

  // Grid and tick components (shared across all tracks)
  private readonly gridConfig: import("./GraphDataManager.js").GridVisualizationConfig;

  // Title panel with combo boxes (needs to be on top of header bar)
  private readonly titlePanel: Node;

  // Drag and resize state properties (kept for dispose)
  private readonly isDraggingProperty: BooleanProperty;
  private readonly isResizingProperty: BooleanProperty;

  // Listener refs kept for unlink in dispose()
  private readonly disposeConfigurableGraph: () => void;

  /**
   * @param availableProperties - List of properties that can be plotted
   * @param initialXProperty - Initial property for x-axis
   * @param initialYProperty - Initial property for y-axis
   * @param width - Graph width in pixels
   * @param height - Graph height in pixels
   * @param maxDataPoints - Maximum number of points to store
   * @param listParent - Parent node for combo box lists
   * @param dragTargetNode - Optional node to move when dragging (defaults to this graph)
   */
  public constructor(
    availableProperties: PlottableProperty[],
    initialXProperty: PlottableProperty,
    initialYProperty: PlottableProperty,
    width: number,
    height: number,
    maxDataPoints: number,
    listParent: Node,
    dragTargetNode?: Node,
  ) {
    super();

    this.graphWidth = width;
    this.graphHeight = height;
    this.initialWidth = width;
    this.initialHeight = height;
    this.maxDataPoints = maxDataPoints;

    // Properties to track current axis selections
    this.xPropertyProperty = new Property(initialXProperty);
    this.yPropertyProperty = new Property(initialYProperty);

    // Property to control graph visibility
    this.graphVisibleProperty = new BooleanProperty(false);

    // Properties for drag and resize states
    this.isDraggingProperty = new BooleanProperty(false);
    this.isResizingProperty = new BooleanProperty(false);
    const isDraggingProperty = this.isDraggingProperty;
    const isResizingProperty = this.isResizingProperty;

    // Create a container for all graph content
    this.graphContentNode = new Node();

    // Create chart transform with initial ranges
    const initialRange = new Range(-10, 10);
    this.chartTransform = new ChartTransform({
      viewWidth: width,
      viewHeight: height,
      modelXRange: initialRange,
      modelYRange: initialRange,
    });

    // Create chart background
    const chartRectangle = new ChartRectangle(this.chartTransform, {
      fill: TrackLabColors.graphBackgroundProperty,
      stroke: TrackLabColors.controlPanelStrokeProperty,
    });
    this.graphContentNode.addChild(chartRectangle);

    // Create grid lines, tick marks, and tick labels
    const initialSpacing = GraphDataManager.calculateTickSpacing(initialRange.getLength());

    const verticalGridLineSet = new GridLineSet(this.chartTransform, Orientation.VERTICAL, initialSpacing, {
      stroke: TrackLabColors.gridLinesProperty,
      lineWidth: GRID_LINE_WIDTH,
    });
    this.graphContentNode.addChild(verticalGridLineSet);

    const horizontalGridLineSet = new GridLineSet(this.chartTransform, Orientation.HORIZONTAL, initialSpacing, {
      stroke: TrackLabColors.gridLinesProperty,
      lineWidth: GRID_LINE_WIDTH,
    });
    this.graphContentNode.addChild(horizontalGridLineSet);

    const xTickMarkSet = new TickMarkSet(this.chartTransform, Orientation.HORIZONTAL, initialSpacing, {
      edge: "min",
      extent: TICK_EXTENT,
      stroke: TrackLabColors.controlPanelStrokeProperty,
    });
    this.graphContentNode.addChild(xTickMarkSet);

    const yTickMarkSet = new TickMarkSet(this.chartTransform, Orientation.VERTICAL, initialSpacing, {
      edge: "min",
      extent: TICK_EXTENT,
      stroke: TrackLabColors.controlPanelStrokeProperty,
    });
    this.graphContentNode.addChild(yTickMarkSet);

    const xTickLabelSet = new TickLabelSet(this.chartTransform, Orientation.HORIZONTAL, initialSpacing, {
      edge: "min",
      createLabel: (value: number) =>
        new Text(value.toFixed(TICK_LABEL_DECIMALS), {
          font: TICK_LABEL_FONT,
          fill: TrackLabColors.textProperty,
        }),
    });
    this.graphContentNode.addChild(xTickLabelSet);

    const yTickLabelSet = new TickLabelSet(this.chartTransform, Orientation.VERTICAL, initialSpacing, {
      edge: "min",
      createLabel: (value: number) =>
        new Text(value.toFixed(TICK_LABEL_DECIMALS), {
          font: TICK_LABEL_FONT,
          fill: TrackLabColors.textProperty,
        }),
    });
    this.graphContentNode.addChild(yTickLabelSet);

    // Create invisible interaction regions for axis controls
    // These regions capture mouse/touch events across the entire tick label area,
    // not just on the text labels themselves
    const axisInteractionWidth = Y_AXIS_INTERACTION_WIDTH;
    const axisInteractionHeight = X_AXIS_INTERACTION_HEIGHT;

    // Y-axis interaction region (left side of graph, covering full height)
    this.yAxisInteractionRegion = new Rectangle(-axisInteractionWidth, 0, axisInteractionWidth, height, {
      fill: "transparent",
      pickable: true,
    });
    this.graphContentNode.addChild(this.yAxisInteractionRegion);

    // X-axis interaction region (bottom of graph, covering full width)
    this.xAxisInteractionRegion = new Rectangle(0, height, width, axisInteractionHeight, {
      fill: "transparent",
      pickable: true,
    });
    this.graphContentNode.addChild(this.xAxisInteractionRegion);

    // Clipped container for all track line plots; prevents overflow beyond the grid.
    this.clippedDataContainer = new Node({
      clipArea: Shape.rect(0, 0, width, height),
    });
    this.graphContentNode.addChild(this.clippedDataContainer);

    // Create axis labels
    this.xAxisLabelNode = new Text(this.formatAxisLabel(initialXProperty), {
      font: AXIS_LABEL_FONT,
      fill: TrackLabColors.textProperty,
      centerX: this.graphWidth / 2,
      top: this.graphHeight + AXIS_LABEL_OFFSET,
    });
    this.graphContentNode.addChild(this.xAxisLabelNode);

    this.yAxisLabelNode = new Text(this.formatAxisLabel(initialYProperty), {
      font: AXIS_LABEL_FONT,
      fill: TrackLabColors.textProperty,
      rotation: -Math.PI / 2,
      centerY: this.graphHeight / 2,
      right: -AXIS_LABEL_OFFSET,
    });
    this.graphContentNode.addChild(this.yAxisLabelNode);

    // Store grid config for creating track-specific data managers
    this.gridConfig = {
      verticalGridLineSet,
      horizontalGridLineSet,
      xTickMarkSet,
      yTickMarkSet,
      xTickLabelSet,
      yTickLabelSet,
    };

    // Coordinator for tick spacing, axis reset, and zoom-flag state shared by
    // gesture handlers.  No LinePlot: track plots are managed via setTrackData().
    this.dataManager = new GraphDataManager(this.chartTransform, null, maxDataPoints, this.gridConfig);

    // Create controls panel helper
    this.controlsPanel = new GraphControlsPanel(
      availableProperties,
      this.xPropertyProperty,
      this.yPropertyProperty,
      this.graphWidth,
    );
    const controlsPanel = this.controlsPanel;

    // Create title panel with combo boxes for axis selection
    // Note: titlePanel is added to 'this' (not graphContentNode) after headerBar
    // so combo boxes remain accessible while header bar can be dragged
    this.titlePanel = controlsPanel.createTitlePanel(listParent);
    this.titlePanel.centerX = this.graphWidth / 2;
    this.titlePanel.bottom = TITLE_BOTTOM_OFFSET;

    // Create control buttons panel with rescale, zoom, and pan buttons
    const buttonSize = BUTTON_SIZE;
    const buttonPadding = BUTTON_PADDING;
    const buttonSpacing = BUTTON_SPACING;

    const a11yStrings = StringManager.getInstance().getA11y();

    // Helper function to create a button
    const createButton = (label: string, onClick: () => void, accessibleName?: TReadOnlyProperty<string>): Node => {
      const buttonText = new Text(label, {
        font: BUTTON_FONT,
        fill: TrackLabColors.controlPanelStrokeProperty,
      });

      const buttonBackground = new Rectangle(0, 0, buttonSize, buttonSize, BUTTON_CORNER_RADIUS, BUTTON_CORNER_RADIUS, {
        fill: TrackLabColors.controlPanelFillProperty,
        stroke: TrackLabColors.controlPanelStrokeProperty,
        cursor: "pointer",
      });

      const button = new Node({
        children: [buttonBackground, buttonText],
        tagName: "button",
        ...(accessibleName && { accessibleName }),
      });

      // Center the text in the button
      buttonText.center = buttonBackground.center;

      // Add hover effect
      button.addInputListener({
        enter: () => {
          buttonBackground.opacity = BUTTON_HOVER_OPACITY;
        },
        exit: () => {
          buttonBackground.opacity = 1.0;
        },
      });

      // Add click handler
      button.addInputListener(
        new FireListener({
          fire: onClick,
        }),
      );

      return button;
    };

    // Create rescale button
    const rescaleButton = createButton(
      "↻",
      () => {
        // Reset manual zoom flag and rescale to fit data
        this.dataManager.setManuallyZoomed(false);
        this.dataManager.updateAxisRanges();
      },
      a11yStrings.graphRescaleStringProperty,
    );

    // Create zoom buttons
    const zoomInButton = createButton(
      "+",
      () => {
        this.interactionHandler.zoomIn();
      },
      a11yStrings.graphZoomInStringProperty,
    );

    const zoomOutButton = createButton(
      "−",
      () => {
        this.interactionHandler.zoomOut();
      },
      a11yStrings.graphZoomOutStringProperty,
    );

    // Create pan buttons
    const panLeftButton = createButton(
      "←",
      () => {
        this.interactionHandler.pan("left");
      },
      a11yStrings.graphPanLeftStringProperty,
    );

    const panRightButton = createButton(
      "→",
      () => {
        this.interactionHandler.pan("right");
      },
      a11yStrings.graphPanRightStringProperty,
    );

    const panUpButton = createButton(
      "↑",
      () => {
        this.interactionHandler.pan("up");
      },
      a11yStrings.graphPanUpStringProperty,
    );

    const panDownButton = createButton(
      "↓",
      () => {
        this.interactionHandler.pan("down");
      },
      a11yStrings.graphPanDownStringProperty,
    );

    // Create HBox to hold all buttons
    const controlButtonsPanel = new HBox({
      children: [rescaleButton, zoomInButton, zoomOutButton, panLeftButton, panRightButton, panUpButton, panDownButton],
      spacing: buttonSpacing,
      left: buttonPadding,
      top: buttonPadding,
    });

    this.graphContentNode.addChild(controlButtonsPanel);

    // Update labels when axes change
    const xPropertyListener = (property: PlottableProperty) => {
      this.xAxisLabelNode.string = this.formatAxisLabel(property);
      this.xAxisLabelNode.centerX = this.graphWidth / 2;
      this.clearData();
    };
    this.xPropertyProperty.link(xPropertyListener);

    const yPropertyListener = (property: PlottableProperty) => {
      this.yAxisLabelNode.string = this.formatAxisLabel(property);
      this.yAxisLabelNode.centerY = this.graphHeight / 2;
      this.clearData();
    };
    this.yPropertyProperty.link(yPropertyListener);

    // Create header bar (checkbox is now in ToolsControlPanel)
    this.headerBar = controlsPanel.createHeaderBar();

    // Add the graph content container first
    this.addChild(this.graphContentNode);

    // Add header bar after graphContentNode so it's on top and can receive drag events
    this.addChild(this.headerBar);

    // Add title panel after header bar so combo boxes remain accessible
    this.addChild(this.titlePanel);

    // Initialize interaction handler
    this.interactionHandler = new GraphInteractionHandler(
      {
        chartTransform: this.chartTransform,
        chartRectangle,
        dataManager: this.dataManager,
      },
      {
        isDraggingProperty,
        isResizingProperty,
      },
      {
        headerBar: this.headerBar,
        graphNode: this,
        ...(dragTargetNode && { dragTargetNode }),
        xTickLabelSet,
        yTickLabelSet,
        xAxisInteractionRegion: this.xAxisInteractionRegion,
        yAxisInteractionRegion: this.yAxisInteractionRegion,
      },
      {
        width: this.graphWidth,
        height: this.graphHeight,
      },
      this.resizeGraph.bind(this),
    );

    // Setup all interactions
    this.interactionHandler.initialize();

    // Create and add resize handles
    const resizeHandles = this.interactionHandler.createResizeHandles();
    for (const handle of resizeHandles) {
      this.addChild(handle);
    }

    // Link visibility property to the content node, header bar, title panel, and resize handles
    const graphVisibleListener = (visible: boolean) => {
      this.graphContentNode.visible = visible;
      this.headerBar.visible = visible;
      this.titlePanel.visible = visible;
      for (const handle of resizeHandles) {
        handle.visible = visible;
      }
    };
    this.graphVisibleProperty.link(graphVisibleListener);

    // Add visual feedback for drag and resize operations
    const isDraggingListener = (isDragging: boolean) => {
      this.opacity = isDragging ? 0.8 : 1.0;
      this.headerBar.cursor = isDragging ? "grabbing" : "grab";
    };
    isDraggingProperty.link(isDraggingListener);

    const isResizingListener = (isResizing: boolean) => {
      this.opacity = isResizing ? 0.8 : 1.0;
    };
    isResizingProperty.link(isResizingListener);

    this.disposeConfigurableGraph = () => {
      this.xPropertyProperty.unlink(xPropertyListener);
      this.yPropertyProperty.unlink(yPropertyListener);
      this.graphVisibleProperty.unlink(graphVisibleListener);
      isDraggingProperty.unlink(isDraggingListener);
      isResizingProperty.unlink(isResizingListener);
      this.controlsPanel.dispose();
      this.xPropertyProperty.dispose();
      this.yPropertyProperty.dispose();
      this.graphVisibleProperty.dispose();
      this.isDraggingProperty.dispose();
      this.isResizingProperty.dispose();
    };
  }

  /**
   * Helper to get the string value from either a string or TReadOnlyProperty<string>
   */
  private getNameValue(name: string | TReadOnlyProperty<string>): string {
    return typeof name === "string" ? name : name.value;
  }

  /**
   * Get the string value from a unit (which can be string or TReadOnlyProperty<string>)
   */
  private getUnitValue(unit: string | TReadOnlyProperty<string> | undefined): string | undefined {
    if (unit === undefined) {
      return undefined;
    }
    return typeof unit === "string" ? unit : unit.value;
  }

  /**
   * Format an axis label with the property name and unit
   */
  private formatAxisLabel(property: PlottableProperty): string {
    const nameValue = this.getNameValue(property.name);
    const unitValue = this.getUnitValue(property.unit);
    if (unitValue) {
      return `${nameValue} (${unitValue})`;
    }
    return nameValue;
  }

  /**
   * Resize the graph to new dimensions
   */
  private resizeGraph(newWidth: number, newHeight: number): void {
    this.graphWidth = newWidth;
    this.graphHeight = newHeight;

    // Update header bar
    GraphControlsPanel.updateHeaderBarWidth(this.headerBar, newWidth);

    // Update clipping area BEFORE updating chart transform to prevent temporary clipping during resize
    this.clippedDataContainer.clipArea = Shape.rect(0, 0, newWidth, newHeight);

    // Update chart transform
    this.chartTransform.setViewWidth(newWidth);
    this.chartTransform.setViewHeight(newHeight);

    // Update invisible interaction regions
    this.yAxisInteractionRegion.setRect(-Y_AXIS_INTERACTION_WIDTH, 0, Y_AXIS_INTERACTION_WIDTH, newHeight);
    this.xAxisInteractionRegion.setRect(0, newHeight, newWidth, X_AXIS_INTERACTION_HEIGHT);

    // Update axis labels positions
    this.xAxisLabelNode.centerX = newWidth / 2;
    this.xAxisLabelNode.top = newHeight + AXIS_LABEL_OFFSET;
    this.yAxisLabelNode.centerY = newHeight / 2;

    // Update title panel position
    this.titlePanel.centerX = newWidth / 2;

    // Update interaction handler dimensions
    this.interactionHandler.updateDimensions(newWidth, newHeight);
    this.interactionHandler.updateResizeHandlePositions();
  }

  /**
   * Clear all data points
   */
  public clearData(): void {
    this.dataManager.clearData();
  }

  /**
   * Update the axis labels (call when units change)
   */
  public updateAxisLabels(): void {
    this.xAxisLabelNode.string = this.formatAxisLabel(this.xPropertyProperty.value);
    this.yAxisLabelNode.string = this.formatAxisLabel(this.yPropertyProperty.value);
  }

  /**
   * Get the current x-axis property
   */
  public getXProperty(): PlottableProperty {
    return this.xPropertyProperty.value;
  }

  /**
   * Get the current y-axis property
   */
  public getYProperty(): PlottableProperty {
    return this.yPropertyProperty.value;
  }

  /**
   * Get the x-axis property Property (for listening to changes)
   */
  public getXPropertyProperty(): Property<PlottableProperty> {
    return this.xPropertyProperty;
  }

  /**
   * Get the y-axis property Property (for listening to changes)
   */
  public getYPropertyProperty(): Property<PlottableProperty> {
    return this.yPropertyProperty;
  }

  /**
   * Get the graph visibility property
   */
  public getGraphVisibleProperty(): BooleanProperty {
    return this.graphVisibleProperty;
  }

  /**
   * Get the current graph width
   */
  public getGraphWidth(): number {
    return this.graphWidth;
  }

  /**
   * Get the current graph height
   */
  public getGraphHeight(): number {
    return this.graphHeight;
  }

  /**
   * Update the set of quantities available in the axis-selector combo boxes.
   *
   * If the currently selected X or Y property is no longer in the new list it
   * is reset to the first available property before the combo boxes are rebuilt.
   *
   * @param newProperties - The replacement list of plottable properties.
   */
  public setAvailableProperties(newProperties: PlottableProperty[]): void {
    if (newProperties.length === 0) {
      return;
    }

    const first = newProperties[0];
    if (!first) {
      return;
    }

    // Reset selections that are no longer available.
    if (!newProperties.includes(this.xPropertyProperty.value)) {
      this.xPropertyProperty.value = first;
    }
    if (!newProperties.includes(this.yPropertyProperty.value)) {
      this.yPropertyProperty.value = first;
    }

    this.controlsPanel.rebuildComboBoxes(newProperties);
  }

  public override dispose(): void {
    this.disposeConfigurableGraph();
    super.dispose();
  }

  /**
   * Reset the graph to its initial state
   */
  public reset(): void {
    // Reset visibility property to initial value (false)
    this.graphVisibleProperty.reset();

    // Reset graph size to initial dimensions if it has been resized
    if (this.graphWidth !== this.initialWidth || this.graphHeight !== this.initialHeight) {
      this.resizeGraph(this.initialWidth, this.initialHeight);
    }

    // Clear all data
    this.clearData();
    this.clearAllTracks();
  }

  // ── Multi-track support ─────────────────────────────────────────────────────

  /**
   * Add or update a track's plot with new data.
   * @param trackId - Unique identifier for the track
   * @param trackColor - Color for the track's line plot
   * @param dataPoints - Array of data points for this track
   */
  public setTrackData(
    trackId: string,
    trackColor: import("scenerystack/scenery").TColor,
    dataPoints: Array<Record<string, number>>,
  ): void {
    // Create a new plot if this track doesn't exist yet
    if (!this.trackPlots.has(trackId)) {
      const linePlot = new LinePlot(this.chartTransform, [], {
        stroke: trackColor,
        lineWidth: PLOT_LINE_WIDTH,
      });

      // Create a data manager for this track using the shared grid config
      const dataManager = new GraphDataManager(this.chartTransform, linePlot, this.maxDataPoints, this.gridConfig);

      this.trackPlots.set(trackId, { linePlot, dataManager });
      this.clippedDataContainer.addChild(linePlot);
    }

    // Get the track's data manager
    const trackPlot = this.trackPlots.get(trackId);
    if (!trackPlot) {
      return;
    }

    // Map the data points to x,y coordinates using the current axis properties
    const xProperty = this.xPropertyProperty.value;
    const yProperty = this.yPropertyProperty.value;

    const mappedPoints: Array<{ x: number; y: number }> = [];
    for (const point of dataPoints) {
      const x = "accessor" in xProperty ? xProperty.accessor(point) : 0;
      const y = "accessor" in yProperty ? yProperty.accessor(point) : 0;
      if (!(Number.isNaN(x) || Number.isNaN(y))) {
        mappedPoints.push({ x, y });
      }
    }

    // Clear and update this track's data
    trackPlot.dataManager.clearData();
    if (mappedPoints.length > 0) {
      trackPlot.dataManager.addDataPoints(mappedPoints);
    }
  }

  /**
   * Remove a track's plot from the graph.
   * @param trackId - Unique identifier for the track to remove
   */
  public removeTrack(trackId: string): void {
    const trackPlot = this.trackPlots.get(trackId);
    if (trackPlot) {
      this.clippedDataContainer.removeChild(trackPlot.linePlot);
      this.trackPlots.delete(trackId);
    }
  }

  /**
   * Clear all track plots from the graph.
   */
  public clearAllTracks(): void {
    for (const [trackId] of this.trackPlots) {
      this.removeTrack(trackId);
    }
  }
}

// Register with namespace for debugging accessibility
trackLab.register("ConfigurableGraph", ConfigurableGraph);
