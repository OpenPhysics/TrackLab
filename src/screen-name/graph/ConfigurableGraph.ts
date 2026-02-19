/**
 * Configurable graph that allows users to select which properties to plot on each axis.
 * This provides a flexible way to explore relationships between any two quantities.
 */

import {
  Node,
  HBox,
  Text,
  Rectangle,
  FireListener,
} from "scenerystack/scenery";
import {
  ChartRectangle,
  ChartTransform,
  LinePlot,
  GridLineSet,
  TickMarkSet,
  TickLabelSet,
} from "scenerystack/bamboo";
import { Range } from "scenerystack/dot";
import {
  Property,
  BooleanProperty,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import { Orientation } from "scenerystack/phet-core";
import { Shape } from "scenerystack/kite";
import type { PlottableProperty } from "./PlottableProperty.js";
import type { SubStepDataPoint } from "../../model/BaseModel.js";
import ResonanceColors from "../../ResonanceColors.js";
import ResonanceConstants from "../../ResonanceConstants.js";
import { PhetFont } from "scenerystack/scenery-phet";
import GraphDataManager from "./GraphDataManager.js";
import GraphInteractionHandler from "./GraphInteractionHandler.js";
import GraphControlsPanel from "./GraphControlsPanel.js";
import resonance from "../../ResonanceNamespace.js";

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
  private readonly availableProperties: PlottableProperty[];
  private readonly xPropertyProperty: Property<PlottableProperty>;
  private readonly yPropertyProperty: Property<PlottableProperty>;
  private readonly chartTransform: ChartTransform;
  private readonly linePlot: LinePlot;
  private readonly chartRectangle: ChartRectangle;
  private graphWidth: number;
  private graphHeight: number;
  private readonly initialWidth: number;
  private readonly initialHeight: number;

  // Drag and resize UI components
  private readonly headerBar;
  private readonly isDraggingProperty: BooleanProperty;
  private readonly isResizingProperty: BooleanProperty;

  // Trail points
  private readonly trailNode: Node;

  // Clipped data container for line plot and trail
  private readonly clippedDataContainer: Node;

  // Visibility control
  private readonly graphVisibleProperty: BooleanProperty;
  private readonly graphContentNode: Node;

  // Axis labels
  private readonly xAxisLabelNode: Text;
  private readonly yAxisLabelNode: Text;

  // Grid and tick components
  private readonly verticalGridLineSet: GridLineSet;
  private readonly horizontalGridLineSet: GridLineSet;
  private readonly xTickMarkSet: TickMarkSet;
  private readonly yTickMarkSet: TickMarkSet;
  private readonly xTickLabelSet: TickLabelSet;
  private readonly yTickLabelSet: TickLabelSet;

  // Invisible interaction regions for axis controls
  private readonly xAxisInteractionRegion: Rectangle;
  private readonly yAxisInteractionRegion: Rectangle;

  // Module instances
  private readonly dataManager: GraphDataManager;
  private readonly interactionHandler: GraphInteractionHandler;

  // Control buttons
  private readonly rescaleButton: Node;
  private readonly controlButtonsPanel: Node;

  // Sub-step decimation counter for high-resolution data
  private decimationCounter: number = 0;

  /**
   * @param availableProperties - List of properties that can be plotted
   * @param initialXProperty - Initial property for x-axis
   * @param initialYProperty - Initial property for y-axis
   * @param width - Graph width in pixels
   * @param height - Graph height in pixels
   * @param maxDataPoints - Maximum number of points to store
   * @param listParent - Parent node for combo box lists
   */
  public constructor(
    availableProperties: PlottableProperty[],
    initialXProperty: PlottableProperty,
    initialYProperty: PlottableProperty,
    width: number,
    height: number,
    maxDataPoints: number = 2000,
    listParent: Node,
  ) {
    super();

    this.availableProperties = availableProperties;
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
    this.chartRectangle = new ChartRectangle(this.chartTransform, {
      fill: ResonanceColors.graphBackgroundProperty,
      stroke: ResonanceColors.controlPanelStrokeProperty,
    });
    this.graphContentNode.addChild(this.chartRectangle);

    // Create grid lines, tick marks, and tick labels
    const initialSpacing = GraphDataManager.calculateTickSpacing(
      initialRange.getLength(),
    );

    this.verticalGridLineSet = new GridLineSet(
      this.chartTransform,
      Orientation.VERTICAL,
      initialSpacing,
      {
        stroke: ResonanceColors.gridLinesProperty,
        lineWidth: GRID_LINE_WIDTH,
      },
    );
    this.graphContentNode.addChild(this.verticalGridLineSet);

    this.horizontalGridLineSet = new GridLineSet(
      this.chartTransform,
      Orientation.HORIZONTAL,
      initialSpacing,
      {
        stroke: ResonanceColors.gridLinesProperty,
        lineWidth: GRID_LINE_WIDTH,
      },
    );
    this.graphContentNode.addChild(this.horizontalGridLineSet);

    this.xTickMarkSet = new TickMarkSet(
      this.chartTransform,
      Orientation.HORIZONTAL,
      initialSpacing,
      {
        edge: "min",
        extent: TICK_EXTENT,
        stroke: ResonanceColors.controlPanelStrokeProperty,
      },
    );
    this.graphContentNode.addChild(this.xTickMarkSet);

    this.yTickMarkSet = new TickMarkSet(
      this.chartTransform,
      Orientation.VERTICAL,
      initialSpacing,
      {
        edge: "min",
        extent: TICK_EXTENT,
        stroke: ResonanceColors.controlPanelStrokeProperty,
      },
    );
    this.graphContentNode.addChild(this.yTickMarkSet);

    this.xTickLabelSet = new TickLabelSet(
      this.chartTransform,
      Orientation.HORIZONTAL,
      initialSpacing,
      {
        edge: "min",
        createLabel: (value: number) =>
          new Text(value.toFixed(TICK_LABEL_DECIMALS), {
            font: TICK_LABEL_FONT,
            fill: ResonanceColors.textProperty,
          }),
      },
    );
    this.graphContentNode.addChild(this.xTickLabelSet);

    this.yTickLabelSet = new TickLabelSet(
      this.chartTransform,
      Orientation.VERTICAL,
      initialSpacing,
      {
        edge: "min",
        createLabel: (value: number) =>
          new Text(value.toFixed(TICK_LABEL_DECIMALS), {
            font: TICK_LABEL_FONT,
            fill: ResonanceColors.textProperty,
          }),
      },
    );
    this.graphContentNode.addChild(this.yTickLabelSet);

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
    this.linePlot = new LinePlot(this.chartTransform, [], {
      stroke: ResonanceColors.plot1Property,
      lineWidth: PLOT_LINE_WIDTH,
    });

    // Create trail node for showing recent points
    this.trailNode = new Node();

    // Wrap line plot and trail in a clipped container to prevent overflow beyond the grid
    this.clippedDataContainer = new Node({
      children: [this.linePlot, this.trailNode],
      clipArea: Shape.rect(0, 0, width, height),
    });
    this.graphContentNode.addChild(this.clippedDataContainer);

    // Create axis labels
    this.xAxisLabelNode = new Text(this.formatAxisLabel(initialXProperty), {
      font: AXIS_LABEL_FONT,
      fill: ResonanceColors.textProperty,
      centerX: this.graphWidth / 2,
      top: this.graphHeight + AXIS_LABEL_OFFSET,
    });
    this.graphContentNode.addChild(this.xAxisLabelNode);

    this.yAxisLabelNode = new Text(this.formatAxisLabel(initialYProperty), {
      font: AXIS_LABEL_FONT,
      fill: ResonanceColors.textProperty,
      rotation: -Math.PI / 2,
      centerY: this.graphHeight / 2,
      right: -AXIS_LABEL_OFFSET,
    });
    this.graphContentNode.addChild(this.yAxisLabelNode);

    // Initialize data manager
    this.dataManager = new GraphDataManager(
      this.chartTransform,
      this.linePlot,
      this.trailNode,
      maxDataPoints,
      {
        verticalGridLineSet: this.verticalGridLineSet,
        horizontalGridLineSet: this.horizontalGridLineSet,
        xTickMarkSet: this.xTickMarkSet,
        yTickMarkSet: this.yTickMarkSet,
        xTickLabelSet: this.xTickLabelSet,
        yTickLabelSet: this.yTickLabelSet,
      },
    );

    // Create controls panel helper
    const controlsPanel = new GraphControlsPanel(
      this.availableProperties,
      this.xPropertyProperty,
      this.yPropertyProperty,
      this.graphWidth,
    );

    // Create title panel with combo boxes for axis selection
    const titlePanel = controlsPanel.createTitlePanel(listParent);
    titlePanel.centerX = this.graphWidth / 2;
    titlePanel.bottom = TITLE_BOTTOM_OFFSET;
    this.graphContentNode.addChild(titlePanel);

    // Create control buttons panel with rescale, zoom, and pan buttons
    const buttonSize = BUTTON_SIZE;
    const buttonPadding = BUTTON_PADDING;
    const buttonSpacing = BUTTON_SPACING;

    // Helper function to create a button
    const createButton = (label: string, onClick: () => void): Node => {
      const buttonText = new Text(label, {
        font: BUTTON_FONT,
        fill: ResonanceColors.controlPanelStrokeProperty,
      });

      const buttonBackground = new Rectangle(
        0,
        0,
        buttonSize,
        buttonSize,
        BUTTON_CORNER_RADIUS,
        BUTTON_CORNER_RADIUS,
        {
          fill: ResonanceColors.controlPanelFillProperty,
          stroke: ResonanceColors.controlPanelStrokeProperty,
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
    this.rescaleButton = createButton("↻", () => {
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
    this.controlButtonsPanel = new HBox({
      children: [
        this.rescaleButton,
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

    this.graphContentNode.addChild(this.controlButtonsPanel);

    // Update labels when axes change
    this.xPropertyProperty.link((property) => {
      this.xAxisLabelNode.string = this.formatAxisLabel(property);
      this.xAxisLabelNode.centerX = this.graphWidth / 2;
      this.clearData();
    });

    this.yPropertyProperty.link((property) => {
      this.yAxisLabelNode.string = this.formatAxisLabel(property);
      this.yAxisLabelNode.centerY = this.graphHeight / 2;
      this.clearData();
    });

    // Create header bar (checkbox is now in ToolsControlPanel)
    this.headerBar = controlsPanel.createHeaderBar();

    // Add header bar first (so it's behind the combo boxes in z-order)
    this.addChild(this.headerBar);

    // Add the graph content container (so combo boxes appear in front of header bar)
    this.addChild(this.graphContentNode);

    // Initialize interaction handler
    this.interactionHandler = new GraphInteractionHandler(
      {
        chartTransform: this.chartTransform,
        chartRectangle: this.chartRectangle,
        dataManager: this.dataManager,
      },
      {
        isDraggingProperty: this.isDraggingProperty,
        isResizingProperty: this.isResizingProperty,
      },
      {
        headerBar: this.headerBar,
        graphNode: this,
        xTickLabelSet: this.xTickLabelSet,
        yTickLabelSet: this.yTickLabelSet,
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
    resizeHandles.forEach((handle) => this.addChild(handle));

    // Link visibility property to the content node, header bar, and resize handles
    this.graphVisibleProperty.link((visible) => {
      this.graphContentNode.visible = visible;
      this.headerBar.visible = visible;
      resizeHandles.forEach((handle) => {
        handle.visible = visible;
      });
    });

    // Add visual feedback for drag and resize operations
    this.isDraggingProperty.link((isDragging) => {
      this.opacity = isDragging ? 0.8 : 1.0;
      this.headerBar.cursor = isDragging ? "grabbing" : "grab";
    });

    this.isResizingProperty.link((isResizing) => {
      this.opacity = isResizing ? 0.8 : 1.0;
    });
  }

  /**
   * Helper to get the string value from either a string or TReadOnlyProperty<string>
   */
  private getNameValue(name: string | TReadOnlyProperty<string>): string {
    return typeof name === "string" ? name : name.value;
  }

  /**
   * Format an axis label with the property name and unit
   */
  private formatAxisLabel(property: PlottableProperty): string {
    const nameValue = this.getNameValue(property.name);
    if (property.unit) {
      return `${nameValue} (${property.unit})`;
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
    const titlePanel = this.graphContentNode.children.find(
      (child) => child instanceof HBox,
    );
    if (titlePanel) {
      titlePanel.centerX = newWidth / 2;
    }

    // Update interaction handler dimensions
    this.interactionHandler.updateDimensions(newWidth, newHeight);
    this.interactionHandler.updateResizeHandlePositions();

    // Update trail with new transform
    this.dataManager.updateTrail();
  }

  /**
   * Add a new data point based on current property values
   */
  public addDataPoint(): void {
    const xValue = this.xPropertyProperty.value.property.value;
    const yValue = this.yPropertyProperty.value.property.value;

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
    const decimation = ResonanceConstants.SUB_STEP_DECIMATION;

    for (const point of subStepData) {
      this.decimationCounter++;

      // Only keep every Nth point
      if (this.decimationCounter >= decimation) {
        this.decimationCounter = 0;

        const x = this.getValueForAxis(xProperty, point);
        const y = this.getValueForAxis(yProperty, point);

        if (x !== null && y !== null) {
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
    return axisProperty.property.value;
  }

  /**
   * Get the current x-axis property
   * @unused Not called from outside this class.
   */
  public getXProperty(): PlottableProperty {
    return this.xPropertyProperty.value;
  }

  /**
   * Get the current y-axis property
   * @unused Not called from outside this class.
   */
  public getYProperty(): PlottableProperty {
    return this.yPropertyProperty.value;
  }

  /**
   * Get the graph visibility property
   */
  public getGraphVisibleProperty(): BooleanProperty {
    return this.graphVisibleProperty;
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
resonance.register("ConfigurableGraph", ConfigurableGraph);
