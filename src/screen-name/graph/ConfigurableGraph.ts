/**
 * ConfigurableGraph — interactive X-Y plot panel for the kinematics graph subsystem.
 *
 * ## Subsystem overview
 *
 * The graph subsystem lives in `src/screen-name/graph/` and consists of seven files:
 *
 * | File | Role |
 * |------|------|
 * | `ConfigurableGraph.ts` | Top-level SceneryStack node; thin coordinator — wires sub-modules together |
 * | `GraphRenderer.ts` | Creates and owns all rendering nodes (chart, grid, buttons, axis labels) |
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
 *   └─ ConfigurableGraph       (graph node — thin coordinator)
 *        ├─ GraphRenderer      (chart background, grid, tick labels, axis labels, buttons)
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

import { BooleanProperty, Property } from "scenerystack/axon";
import { ChartTransform, LinePlot } from "scenerystack/bamboo";
import { Range } from "scenerystack/dot";
import { Node } from "scenerystack/scenery";
import { StringManager } from "../../i18n/StringManager.js";
import trackLab from "../../TrackLabNamespace.js";
import GraphControlsPanel from "./GraphControlsPanel.js";
import GraphDataManager from "./GraphDataManager.js";
import GraphInteractionHandler from "./GraphInteractionHandler.js";
import GraphRenderer from "./GraphRenderer.js";
import type { PlottableProperty } from "./PlottableProperty.js";

// Line-plot stroke width — only ConfigurableGraph creates LinePlots
const PLOT_LINE_WIDTH = 2;
const TITLE_BOTTOM_OFFSET = -5;

/**
 * Map raw data-point records to {x, y} pairs using the current axis accessors.
 * NaN points are filtered out so the line plot stays clean.
 */
function mapDataPoints(
  dataPoints: Array<Record<string, number>>,
  xProperty: PlottableProperty,
  yProperty: PlottableProperty,
): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];
  for (const point of dataPoints) {
    const x = "accessor" in xProperty ? xProperty.accessor(point) : 0;
    const y = "accessor" in yProperty ? yProperty.accessor(point) : 0;
    if (!(Number.isNaN(x) || Number.isNaN(y))) {
      result.push({ x, y });
    }
  }
  return result;
}

export default class ConfigurableGraph extends Node {
  private readonly xPropertyProperty: Property<PlottableProperty>;
  private readonly yPropertyProperty: Property<PlottableProperty>;
  private readonly graphVisibleProperty: BooleanProperty;
  private readonly isDraggingProperty: BooleanProperty;
  private readonly isResizingProperty: BooleanProperty;

  private graphWidth: number;
  private graphHeight: number;
  private readonly initialWidth: number;
  private readonly initialHeight: number;
  private readonly maxDataPoints: number;

  // The shared chart transform (owned here, passed to renderer and data managers)
  private readonly chartTransform: ChartTransform;

  // Sub-modules
  private readonly graphRenderer: GraphRenderer;
  private readonly dataManager: GraphDataManager;
  private readonly interactionHandler: GraphInteractionHandler;
  private readonly controlsPanel: GraphControlsPanel;

  // UI nodes that ConfigurableGraph directly manages
  private readonly headerBar;
  private readonly titlePanel: Node;

  // Multi-track support: map of trackId -> {linePlot, dataManager}
  private readonly trackPlots: Map<string, { linePlot: LinePlot; dataManager: GraphDataManager }> = new Map();

  // Listener refs for dispose
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

    this.xPropertyProperty = new Property(initialXProperty);
    this.yPropertyProperty = new Property(initialYProperty);
    this.graphVisibleProperty = new BooleanProperty(false);
    this.isDraggingProperty = new BooleanProperty(false);
    this.isResizingProperty = new BooleanProperty(false);

    // ── ChartTransform (shared across renderer and all data managers) ─────────
    const initialRange = new Range(-10, 10);
    this.chartTransform = new ChartTransform({
      viewWidth: width,
      viewHeight: height,
      modelXRange: initialRange,
      modelYRange: initialRange,
    });

    // ── Renderer (chart background, grid, tick labels, axis labels, buttons) ──
    // Button callbacks use arrow functions so interactionHandler / dataManager
    // references resolve lazily after they are assigned below.
    this.graphRenderer = new GraphRenderer(this.chartTransform, width, height, initialXProperty, initialYProperty, {
      onRescale: () => {
        this.dataManager.setManuallyZoomed(false);
        this.dataManager.updateAxisRanges();
      },
      onZoomIn: () => this.interactionHandler.zoomIn(),
      onZoomOut: () => this.interactionHandler.zoomOut(),
      onPan: (dir) => this.interactionHandler.pan(dir),
    });

    // ── DataManager (coordinator — no LinePlot of its own) ───────────────────
    this.dataManager = new GraphDataManager(this.chartTransform, null, maxDataPoints, this.graphRenderer.gridConfig);

    // ── Controls panel ───────────────────────────────────────────────────────
    this.controlsPanel = new GraphControlsPanel(
      availableProperties,
      this.xPropertyProperty,
      this.yPropertyProperty,
      this.graphWidth,
    );

    this.titlePanel = this.controlsPanel.createTitlePanel(listParent);
    this.titlePanel.centerX = this.graphWidth / 2;
    this.titlePanel.bottom = TITLE_BOTTOM_OFFSET;

    const a11yStrings = StringManager.getInstance().getA11y();
    this.headerBar = this.controlsPanel.createHeaderBar(a11yStrings.graphPanelHeaderStringProperty);

    // ── Scene graph assembly ─────────────────────────────────────────────────
    this.addChild(this.graphRenderer.contentNode);
    this.addChild(this.headerBar);
    this.addChild(this.titlePanel);

    // ── Interaction handler ──────────────────────────────────────────────────
    this.interactionHandler = new GraphInteractionHandler(
      {
        chartTransform: this.chartTransform,
        chartRectangle: this.graphRenderer.chartRectangle,
        dataManager: this.dataManager,
      },
      {
        isDraggingProperty: this.isDraggingProperty,
        isResizingProperty: this.isResizingProperty,
      },
      {
        headerBar: this.headerBar,
        graphNode: this,
        ...(dragTargetNode && { dragTargetNode }),
        xTickLabelSet: this.graphRenderer.gridConfig.xTickLabelSet,
        yTickLabelSet: this.graphRenderer.gridConfig.yTickLabelSet,
        xAxisInteractionRegion: this.graphRenderer.xAxisInteractionRegion,
        yAxisInteractionRegion: this.graphRenderer.yAxisInteractionRegion,
      },
      { width: this.graphWidth, height: this.graphHeight },
      this.resizeGraph.bind(this),
    );
    this.interactionHandler.initialize();

    const resizeHandles = this.interactionHandler.createResizeHandles([
      a11yStrings.graphResizeTopLeftStringProperty,
      a11yStrings.graphResizeTopRightStringProperty,
      a11yStrings.graphResizeBottomLeftStringProperty,
      a11yStrings.graphResizeBottomRightStringProperty,
    ]);
    for (const handle of resizeHandles) {
      this.addChild(handle);
    }

    // ── Property listeners ───────────────────────────────────────────────────
    const xPropertyListener = (property: PlottableProperty) => {
      this.graphRenderer.updateXAxisLabel(property);
      this.clearData();
    };
    this.xPropertyProperty.link(xPropertyListener);

    const yPropertyListener = (property: PlottableProperty) => {
      this.graphRenderer.updateYAxisLabel(property);
      this.clearData();
    };
    this.yPropertyProperty.link(yPropertyListener);

    const graphVisibleListener = (visible: boolean) => {
      this.graphRenderer.contentNode.visible = visible;
      this.headerBar.visible = visible;
      this.titlePanel.visible = visible;
      for (const handle of resizeHandles) {
        handle.visible = visible;
      }
    };
    this.graphVisibleProperty.link(graphVisibleListener);

    const isDraggingListener = (isDragging: boolean) => {
      this.opacity = isDragging ? 0.8 : 1.0;
      this.headerBar.cursor = isDragging ? "grabbing" : "grab";
    };
    this.isDraggingProperty.link(isDraggingListener);

    const isResizingListener = (isResizing: boolean) => {
      this.opacity = isResizing ? 0.8 : 1.0;
    };
    this.isResizingProperty.link(isResizingListener);

    this.disposeConfigurableGraph = () => {
      this.xPropertyProperty.unlink(xPropertyListener);
      this.yPropertyProperty.unlink(yPropertyListener);
      this.graphVisibleProperty.unlink(graphVisibleListener);
      this.isDraggingProperty.unlink(isDraggingListener);
      this.isResizingProperty.unlink(isResizingListener);
      this.controlsPanel.dispose();
      this.xPropertyProperty.dispose();
      this.yPropertyProperty.dispose();
      this.graphVisibleProperty.dispose();
      this.isDraggingProperty.dispose();
      this.isResizingProperty.dispose();
    };
  }

  // ── Resize ──────────────────────────────────────────────────────────────────

  private resizeGraph(newWidth: number, newHeight: number): void {
    this.graphWidth = newWidth;
    this.graphHeight = newHeight;

    GraphControlsPanel.updateHeaderBarWidth(this.headerBar, newWidth);
    this.graphRenderer.updateDimensions(newWidth, newHeight);

    this.chartTransform.setViewWidth(newWidth);
    this.chartTransform.setViewHeight(newHeight);

    this.titlePanel.centerX = newWidth / 2;
    this.interactionHandler.updateDimensions(newWidth, newHeight);
    this.interactionHandler.updateResizeHandlePositions();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  public clearData(): void {
    this.dataManager.clearData();
  }

  public updateAxisLabels(): void {
    this.graphRenderer.updateXAxisLabel(this.xPropertyProperty.value);
    this.graphRenderer.updateYAxisLabel(this.yPropertyProperty.value);
  }

  public getXProperty(): PlottableProperty {
    return this.xPropertyProperty.value;
  }

  public getYProperty(): PlottableProperty {
    return this.yPropertyProperty.value;
  }

  public getXPropertyProperty(): Property<PlottableProperty> {
    return this.xPropertyProperty;
  }

  public getYPropertyProperty(): Property<PlottableProperty> {
    return this.yPropertyProperty;
  }

  public getGraphVisibleProperty(): BooleanProperty {
    return this.graphVisibleProperty;
  }

  public getGraphWidth(): number {
    return this.graphWidth;
  }

  public getGraphHeight(): number {
    return this.graphHeight;
  }

  public setAvailableProperties(newProperties: PlottableProperty[]): void {
    if (newProperties.length === 0) {
      return;
    }
    const first = newProperties[0];
    if (!first) {
      return;
    }
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

  public reset(): void {
    this.graphVisibleProperty.reset();
    if (this.graphWidth !== this.initialWidth || this.graphHeight !== this.initialHeight) {
      this.resizeGraph(this.initialWidth, this.initialHeight);
    }
    this.clearData();
    this.clearAllTracks();
  }

  // ── Multi-track support ──────────────────────────────────────────────────────

  public setTrackData(
    trackId: string,
    trackColor: import("scenerystack/scenery").TColor,
    dataPoints: Array<Record<string, number>>,
  ): void {
    if (!this.trackPlots.has(trackId)) {
      const linePlot = new LinePlot(this.chartTransform, [], {
        stroke: trackColor,
        lineWidth: PLOT_LINE_WIDTH,
      });
      const dataManager = new GraphDataManager(
        this.chartTransform,
        linePlot,
        this.maxDataPoints,
        this.graphRenderer.gridConfig,
      );
      this.trackPlots.set(trackId, { linePlot, dataManager });
      this.graphRenderer.clippedDataContainer.addChild(linePlot);
    }

    const trackPlot = this.trackPlots.get(trackId);
    if (!trackPlot) {
      return;
    }

    const mappedPoints = mapDataPoints(dataPoints, this.xPropertyProperty.value, this.yPropertyProperty.value);
    trackPlot.dataManager.clearData();
    if (mappedPoints.length > 0) {
      trackPlot.dataManager.addDataPoints(mappedPoints);
    }
  }

  public removeTrack(trackId: string): void {
    const trackPlot = this.trackPlots.get(trackId);
    if (trackPlot) {
      this.graphRenderer.clippedDataContainer.removeChild(trackPlot.linePlot);
      this.trackPlots.delete(trackId);
    }
  }

  public clearAllTracks(): void {
    for (const [trackId] of this.trackPlots) {
      this.removeTrack(trackId);
    }
  }
}

// Register with namespace for debugging accessibility
trackLab.register("ConfigurableGraph", ConfigurableGraph);
