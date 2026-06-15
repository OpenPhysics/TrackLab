/**
 * Coordinates all user interactions for the configurable graph by delegating
 * to focused sub-handlers, each of which owns its own state:
 *
 * - ZoomGestureHandler  — mouse-wheel zoom, pinch-to-zoom, double-click reset,
 *                         zoomIn() / zoomOut() buttons
 * - PanGestureHandler   — drag-to-pan, pan() keyboard/button API
 * - AxisGestureHandler  — per-axis touch pan/pinch and mouse drag/wheel
 * - HeaderDragHandler   — header-bar drag to reposition the graph panel
 * - ResizeGestureHandler — corner handles for resizing the graph panel
 */

import type { BooleanProperty, TReadOnlyProperty } from "scenerystack/axon";
import type { ChartRectangle, ChartTransform, TickLabelSet } from "scenerystack/bamboo";
import type { Node, Rectangle } from "scenerystack/scenery";
import TrackLabNamespace from "../../TrackLabNamespace.js";
import AxisGestureHandler from "./AxisGestureHandler.js";
import type GraphDataManager from "./GraphDataManager.js";
import HeaderDragHandler from "./HeaderDragHandler.js";
import PanGestureHandler from "./PanGestureHandler.js";
import ResizeGestureHandler from "./ResizeGestureHandler.js";
import ZoomGestureHandler from "./ZoomGestureHandler.js";

/**
 * Configuration for the chart and its data management
 */
export interface ChartConfig {
  chartTransform: ChartTransform;
  chartRectangle: ChartRectangle;
  dataManager: GraphDataManager;
}

/**
 * UI state properties for graph interactions
 */
export interface GraphUIState {
  isDraggingProperty: BooleanProperty;
  isResizingProperty: BooleanProperty;
}

/**
 * UI elements that the interaction handler needs to reference
 */
export interface GraphUIElements {
  headerBar: Rectangle;
  graphNode: Node;
  /** Optional node to move when dragging. If not provided, graphNode is moved. */
  dragTargetNode?: Node;
  xTickLabelSet: TickLabelSet;
  yTickLabelSet: TickLabelSet;
  xAxisInteractionRegion: Rectangle;
  yAxisInteractionRegion: Rectangle;
}

/**
 * Graph dimensions
 */
export interface GraphDimensions {
  width: number;
  height: number;
}

/**
 * Thin coordinator that wires up all gesture sub-handlers for a ConfigurableGraph.
 *
 * The public API is identical to the previous monolithic implementation so that
 * ConfigurableGraph requires no changes.
 *
 * Call `initialize()` once after construction to attach all input listeners.
 */
export default class GraphInteractionHandler {
  private readonly zoomHandler: ZoomGestureHandler;
  private readonly panHandler: PanGestureHandler;
  private readonly axisHandler: AxisGestureHandler;
  private readonly headerDragHandler: HeaderDragHandler;
  private readonly resizeHandler: ResizeGestureHandler;

  /**
   * @param chartConfig - Chart transform, chart rectangle, and data manager
   * @param uiState - Observable flags for drag/resize in-progress state
   * @param uiElements - The visual nodes that receive input listeners
   * @param dimensions - Initial graph width/height in view coordinates
   * @param onResize - Callback invoked with the new (width, height) after a resize drag
   */
  public constructor(
    chartConfig: ChartConfig,
    uiState: GraphUIState,
    uiElements: GraphUIElements,
    dimensions: GraphDimensions,
    onResize: (width: number, height: number) => void,
  ) {
    this.zoomHandler = new ZoomGestureHandler(chartConfig, dimensions);
    this.panHandler = new PanGestureHandler(chartConfig);
    this.axisHandler = new AxisGestureHandler(
      chartConfig,
      {
        xAxisInteractionRegion: uiElements.xAxisInteractionRegion,
        yAxisInteractionRegion: uiElements.yAxisInteractionRegion,
      },
      dimensions,
    );
    this.headerDragHandler = new HeaderDragHandler(
      {
        headerBar: uiElements.headerBar,
        graphNode: uiElements.graphNode,
        dragTargetNode: uiElements.dragTargetNode,
      },
      uiState.isDraggingProperty,
    );
    this.resizeHandler = new ResizeGestureHandler(
      uiElements.graphNode,
      uiState.isResizingProperty,
      dimensions,
      onResize,
    );
  }

  /**
   * Initialize all interaction handlers.
   */
  public initialize(): void {
    this.zoomHandler.initialize();
    this.panHandler.initialize();
    this.axisHandler.initialize();
    this.headerDragHandler.initialize();
  }

  // ── Resize handle management ───────────────────────────────────────────────

  /**
   * Create and return resize handles for the graph corners.
   * The caller is responsible for adding them to the scene graph.
   *
   * @param cornerA11yNames - accessible names for [top-left, top-right, bottom-left, bottom-right]
   */
  public createResizeHandles(
    cornerA11yNames: [
      TReadOnlyProperty<string>,
      TReadOnlyProperty<string>,
      TReadOnlyProperty<string>,
      TReadOnlyProperty<string>,
    ],
  ): Rectangle[] {
    return this.resizeHandler.createResizeHandles(cornerA11yNames);
  }

  /**
   * Update all sub-handlers when the graph is resized.
   */
  public updateDimensions(width: number, height: number): void {
    this.zoomHandler.updateDimensions(width, height);
    this.axisHandler.updateDimensions(width, height);
    this.resizeHandler.updateDimensions(width, height);
  }

  /**
   * Reposition the corner resize handles to match the current graph size.
   */
  public updateResizeHandlePositions(): void {
    this.resizeHandler.updateResizeHandlePositions();
  }

  // ── Programmatic zoom / pan (toolbar buttons, keyboard shortcuts) ──────────

  public zoomIn(): void {
    this.zoomHandler.zoomIn();
  }

  public zoomOut(): void {
    this.zoomHandler.zoomOut();
  }

  public pan(direction: "left" | "right" | "up" | "down"): void {
    this.panHandler.pan(direction);
  }
}

TrackLabNamespace.register("GraphInteractionHandler", GraphInteractionHandler);
