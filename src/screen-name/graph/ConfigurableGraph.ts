/**
 * Configurable graph that allows users to select which properties to plot on each axis.
 * This provides a flexible way to explore relationships between any two quantities.
 */

import {
  BooleanProperty,
  Property,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import {
  ChartRectangle,
  ChartTransform,
  GridLineSet,
  LinePlot,
  TickLabelSet,
  TickMarkSet,
} from "scenerystack/bamboo";
import { Range } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import {
  FireListener,
  HBox,
  Node,
  Rectangle,
  Text,
} from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import TrackLabColors from "../../TrackLabColors.js";
import { SUB_STEP_DECIMATION } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import GraphControlsPanel from "./GraphControlsPanel.js";
import GraphDataManager from "./GraphDataManager.js";
import GraphInteractionHandler from "./GraphInteractionHandler.js";
import type {
  PlottableProperty,
  SubStepDataPoint,
} from "./PlottableProperty.js";

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

// Resize handle (reserved for future use)
const _RESIZE_HANDLE_SIZE = 16;
const _RESIZE_DOT_RADIUS = 2;
const _RESIZE_DOT_SPACING = 5;

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

  // Title panel with combo boxes (needs to be on top of header bar)
  private readonly titlePanel: Node;

  // Sub-step decimation counter for high-resolution data
  private decimationCounter: number = 0;

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
    maxDataPoints: number = 2000,
    listParent: Node,
    dragTargetNode?: Node,
  ) {
    super();

    this.graphWidth = width;
    this.graphHeight = height;
    this.initialWidth = width;
    this.initialHeight = height;

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
    const initialSpacing = GraphDataManager.calculateTickSpacing(
      initialRange.getLength(),
    );

    const verticalGridLineSet = new GridLineSet(
      this.chartTransform,
      Orientation.VERTICAL,
      initialSpacing,
      {
        stroke: TrackLabColors.gridLinesProperty,
        lineWidth: GRID_LINE_WIDTH,
      },
    );
    this.graphContentNode.addChild(verticalGridLineSet);

    const horizontalGridLineSet = new GridLineSet(
      this.chartTransform,
      Orientation.HORIZONTAL,
      initialSpacing,
      {
        stroke: TrackLabColors.gridLinesProperty,
        lineWidth: GRID_LINE_WIDTH,
      },
    );
    this.graphContentNode.addChild(horizontalGridLineSet);

    const xTickMarkSet = new TickMarkSet(
      this.chartTransform,
      Orientation.HORIZONTAL,
      initialSpacing,
      {
        edge: "min",
        extent: TICK_EXTENT,
        stroke: TrackLabColors.controlPanelStrokeProperty,
      },
    );
    this.graphContentNode.addChild(xTickMarkSet);

    const yTickMarkSet = new TickMarkSet(
      this.chartTransform,
      Orientation.VERTICAL,
      initialSpacing,
      {
        edge: "min",
        extent: TICK_EXTENT,
        stroke: TrackLabColors.controlPanelStrokeProperty,
      },
    );
    this.graphContentNode.addChild(yTickMarkSet);

    const xTickLabelSet = new TickLabelSet(
      this.chartTransform,
      Orientation.HORIZONTAL,
      initialSpacing,
      {
        edge: "min",
        createLabel: (value: number) =>
          new Text(value.toFixed(TICK_LABEL_DECIMALS), {
            font: TICK_LABEL_FONT,
            fill: TrackLabColors.textProperty,
          }),
      },
    );
    this.graphContentNode.addChild(xTickLabelSet);

    const yTickLabelSet = new TickLabelSet(
      this.chartTransform,
      Orientation.VERTICAL,
      initialSpacing,
      {
        edge: "min",
        createLabel: (value: number) =>
          new Text(value.toFixed(TICK_LABEL_DECIMALS), {
            font: TICK_LABEL_FONT,
            fill: TrackLabColors.textProperty,
          }),
      },
    );
    this.graphContentNode.addChild(yTickLabelSet);

    // Create invisible interaction regions for axis controls
    // These regions capture mouse/touch events across the entire tick label area,
    // not just on the text labels themselves
    const axisInteractionWidth = Y_AXIS_INTERACTION_WIDTH;
    const axisInteractionHeight = X_AXIS_INTERACTION_HEIGHT;

    // Y-axis interaction region (left side of graph, covering full height)
    this.yAxisInteractionRegion = new Rectangle(
      -axisInteractionWidth,
      0,
      axisInteractionWidth,
      height,
      {
        fill: "transparent",
        pickable: true,
      },
    );
    this.graphContentNode.addChild(this.yAxisInteractionRegion);

    // X-axis interaction region (bottom of graph, covering full width)
    this.xAxisInteractionRegion = new Rectangle(
      0,
      height,
      width,
      axisInteractionHeight,
      {
        fill: "transparent",
        pickable: true,
      },
    );
    this.graphContentNode.addChild(this.xAxisInteractionRegion);

    // Create line plot
    const linePlot = new LinePlot(this.chartTransform, [], {
      stroke: TrackLabColors.plot1Property,
      lineWidth: PLOT_LINE_WIDTH,
    });

    // Wrap line plot in a clipped container to prevent overflow beyond the grid
    this.clippedDataContainer = new Node({
      children: [linePlot],
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

    // Initialize data manager
    this.dataManager = new GraphDataManager(
      this.chartTransform,
      linePlot,
      maxDataPoints,
      {
        verticalGridLineSet,
        horizontalGridLineSet,
        xTickMarkSet,
        yTickMarkSet,
        xTickLabelSet,
        yTickLabelSet,
      },
    );

    // Create controls panel helper
    const controlsPanel = new GraphControlsPanel(
      availableProperties,
      this.xPropertyProperty,
      this.yPropertyProperty,
      this.graphWidth,
    );

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

    // Helper function to create a button
    const createButton = (label: string, onClick: () => void): Node => {
      const buttonText = new Text(label, {
        font: BUTTON_FONT,
        fill: TrackLabColors.controlPanelStrokeProperty,
      });

      const buttonBackground = new Rectangle(
        0,
        0,
        buttonSize,
        buttonSize,
        BUTTON_CORNER_RADIUS,
        BUTTON_CORNER_RADIUS,
        {
          fill: TrackLabColors.controlPanelFillProperty,
          stroke: TrackLabColors.controlPanelStrokeProperty,
          cursor: "pointer",
        },
      );

      const button = new Node({
        children: [buttonBackground, buttonText],
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
    const rescaleButton = createButton("↻", () => {
      // Reset manual zoom flag and rescale to fit data
      this.dataManager.setManuallyZoomed(false);
      this.dataManager.updateAxisRanges();
    });

    // Create zoom buttons (will be wired up after interactionHandler is created)
    const zoomInButton = createButton("+", () => {
      this.interactionHandler.zoomIn();
    });

    const zoomOutButton = createButton("−", () => {
      this.interactionHandler.zoomOut();
    });

    // Create pan buttons (will be wired up after interactionHandler is created)
    const panLeftButton = createButton("←", () => {
      this.interactionHandler.pan("left");
    });

    const panRightButton = createButton("→", () => {
      this.interactionHandler.pan("right");
    });

    const panUpButton = createButton("↑", () => {
      this.interactionHandler.pan("up");
    });

    const panDownButton = createButton("↓", () => {
      this.interactionHandler.pan("down");
    });

    // Create HBox to hold all buttons
    const controlButtonsPanel = new HBox({
      children: [
        rescaleButton,
        zoomInButton,
        zoomOutButton,
        panLeftButton,
        panRightButton,
        panUpButton,
        panDownButton,
      ],
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
      resizeHandles.forEach((handle) => {
        handle.visible = visible;
      });
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
  private getUnitValue(
    unit: string | TReadOnlyProperty<string> | undefined,
  ): string | undefined {
    if (unit === undefined) return undefined;
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
    const axisInteractionWidth = 60;
    const axisInteractionHeight = 30;
    this.yAxisInteractionRegion.setRect(
      -axisInteractionWidth,
      0,
      axisInteractionWidth,
      newHeight,
    );
    this.xAxisInteractionRegion.setRect(
      0,
      newHeight,
      newWidth,
      axisInteractionHeight,
    );

    // Update axis labels positions
    this.xAxisLabelNode.centerX = newWidth / 2;
    this.xAxisLabelNode.top = newHeight + 35;
    this.yAxisLabelNode.centerY = newHeight / 2;

    // Update title panel position
    this.titlePanel.centerX = newWidth / 2;

    // Update interaction handler dimensions
    this.interactionHandler.updateDimensions(newWidth, newHeight);
    this.interactionHandler.updateResizeHandlePositions();
  }

  /**
   * Add a new data point based on current property values.
   * @deprecated Not currently called anywhere — superseded by addDataPointsFromSubSteps.
   */
  public addDataPoint(): void {
    const xValue = this.xPropertyProperty.value.property?.value;
    const yValue = this.yPropertyProperty.value.property?.value;
    if (xValue === undefined || yValue === undefined) return;

    this.dataManager.addDataPoint(xValue, yValue);
  }

  /**
   * Clear all data points
   */
  public clearData(): void {
    this.dataManager.clearData();
    this.decimationCounter = 0;
  }

  /**
   * Add data points from sub-step data collected during ODE integration.
   * Maps the sub-step data to the currently selected x and y axes.
   * Uses decimation to prevent memory overflow while maintaining smooth curves.
   * @param subStepData - Array of sub-step data points from the model
   */
  public addDataPointsFromSubSteps(subStepData: SubStepDataPoint[]): void {
    if (subStepData.length === 0) return;

    const xProperty = this.xPropertyProperty.value;
    const yProperty = this.yPropertyProperty.value;

    // Map sub-step data to x/y values with decimation
    const mappedPoints: Array<{ x: number; y: number }> = [];
    const decimation = SUB_STEP_DECIMATION;

    for (const point of subStepData) {
      this.decimationCounter++;

      // Only keep every Nth point
      if (this.decimationCounter >= decimation) {
        this.decimationCounter = 0;

        const x = this.getValueForAxis(xProperty, point);
        const y = this.getValueForAxis(yProperty, point);

        if (
          x !== null &&
          y !== null &&
          Number.isFinite(x) &&
          Number.isFinite(y)
        ) {
          mappedPoints.push({ x, y });
        }
      }
    }

    if (mappedPoints.length > 0) {
      this.dataManager.addDataPoints(mappedPoints);
    }
  }

  /**
   * Get the value for a specific axis from a sub-step data point.
   * Uses the type-safe subStepAccessor when available, otherwise falls back
   * to the current property value for derived quantities (energy, RMS, etc.).
   */
  private getValueForAxis(
    axisProperty: PlottableProperty,
    point: SubStepDataPoint,
  ): number | null {
    if (axisProperty.subStepAccessor) {
      return axisProperty.subStepAccessor(point);
    }
    // For properties without sub-step data, fall back to current property value.
    // This handles derived properties like energy, RMS values, etc.
    return axisProperty.property?.value ?? null;
  }

  /**
   * Update the axis labels (call when units change)
   */
  public updateAxisLabels(): void {
    this.xAxisLabelNode.string = this.formatAxisLabel(
      this.xPropertyProperty.value,
    );
    this.yAxisLabelNode.string = this.formatAxisLabel(
      this.yPropertyProperty.value,
    );
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
    if (
      this.graphWidth !== this.initialWidth ||
      this.graphHeight !== this.initialHeight
    ) {
      this.resizeGraph(this.initialWidth, this.initialHeight);
    }

    // Clear all data
    this.clearData();
  }
}

// Register with namespace for debugging accessibility
trackLab.register("ConfigurableGraph", ConfigurableGraph);
