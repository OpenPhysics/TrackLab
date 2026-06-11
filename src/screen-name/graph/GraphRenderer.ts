/**
 * GraphRenderer — creates and owns all static rendering nodes for ConfigurableGraph.
 *
 * Extracted from ConfigurableGraph so that the coordinator class stays thin.
 * Responsibilities:
 *   - Bamboo chart background, grid lines, tick marks, and tick labels
 *   - Axis interaction regions (invisible hit areas for axis gestures)
 *   - Clipped data container (clips LinePlot children to chart bounds)
 *   - Axis label Text nodes
 *   - Control buttons panel (rescale, zoom, pan)
 *
 * After construction, the caller adds `contentNode` to the scene graph and
 * accesses individual sub-nodes via the public readonly properties.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import type { ChartTransform } from "scenerystack/bamboo";
import { ChartRectangle, GridLineSet, TickLabelSet, TickMarkSet } from "scenerystack/bamboo";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { FireListener, HBox, Node, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";
import GraphDataManager, { type GridVisualizationConfig } from "./GraphDataManager.js";
import type { PlottableProperty } from "./PlottableProperty.js";

// ── Styling constants (kept local — only GraphRenderer uses them) ─────────────
const GRID_LINE_WIDTH = 0.5;
const TICK_EXTENT = 8;
const TICK_LABEL_FONT = new PhetFont({ size: 10 });
const TICK_LABEL_DECIMALS = 2;

const AXIS_LABEL_FONT = new PhetFont({ size: 12 });
export const AXIS_LABEL_OFFSET = 35; // exported so resizeGraph can use the same value

const Y_AXIS_INTERACTION_WIDTH = 60;
const X_AXIS_INTERACTION_HEIGHT = 30;

const BUTTON_SIZE = 24;
const BUTTON_PADDING = 4;
const BUTTON_SPACING = 2;
const BUTTON_CORNER_RADIUS = 3;
const BUTTON_FONT = new PhetFont({ size: 14, weight: "bold" });
const BUTTON_HOVER_OPACITY = 0.8;

/** Callbacks wired from ConfigurableGraph into the control buttons. */
export type ButtonCallbacks = {
  onRescale: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPan: (direction: "left" | "right" | "up" | "down") => void;
};

/** Helper: format an axis label string from a PlottableProperty. */
export function formatAxisLabel(property: PlottableProperty): string {
  const name = typeof property.name === "string" ? property.name : property.name.value;
  const unit =
    property.unit === undefined ? undefined : typeof property.unit === "string" ? property.unit : property.unit.value;
  return unit ? `${name} (${unit})` : name;
}

export default class GraphRenderer {
  /** Top-level container — add this to the scene graph. */
  public readonly contentNode: Node;

  // Bamboo chart background
  public readonly chartRectangle: ChartRectangle;

  // Shared grid / tick config for GraphDataManager
  public readonly gridConfig: GridVisualizationConfig;

  /** Clipped container for LinePlot children (prevents overflow). */
  public readonly clippedDataContainer: Node;

  /** Axis label nodes (text updates on axis-property change). */
  public readonly xAxisLabelNode: Text;
  public readonly yAxisLabelNode: Text;

  /** Invisible hit regions for axis drag gestures. */
  public readonly xAxisInteractionRegion: Rectangle;
  public readonly yAxisInteractionRegion: Rectangle;

  private graphWidth: number;
  private graphHeight: number;

  public constructor(
    chartTransform: ChartTransform,
    width: number,
    height: number,
    initialXProperty: PlottableProperty,
    initialYProperty: PlottableProperty,
    callbacks: ButtonCallbacks,
  ) {
    this.graphWidth = width;
    this.graphHeight = height;

    this.contentNode = new Node();

    // ── Chart background ─────────────────────────────────────────────────────
    this.chartRectangle = new ChartRectangle(chartTransform, {
      fill: TrackLabColors.graphBackgroundProperty,
      stroke: TrackLabColors.controlPanelStrokeProperty,
    });
    this.contentNode.addChild(this.chartRectangle);

    // ── Grid lines, tick marks, tick labels ──────────────────────────────────
    const initialSpacing = GraphDataManager.calculateTickSpacing(20); // initial range length = 20

    const verticalGridLineSet = new GridLineSet(chartTransform, Orientation.VERTICAL, initialSpacing, {
      stroke: TrackLabColors.gridLinesProperty,
      lineWidth: GRID_LINE_WIDTH,
    });
    this.contentNode.addChild(verticalGridLineSet);

    const horizontalGridLineSet = new GridLineSet(chartTransform, Orientation.HORIZONTAL, initialSpacing, {
      stroke: TrackLabColors.gridLinesProperty,
      lineWidth: GRID_LINE_WIDTH,
    });
    this.contentNode.addChild(horizontalGridLineSet);

    const xTickMarkSet = new TickMarkSet(chartTransform, Orientation.HORIZONTAL, initialSpacing, {
      edge: "min",
      extent: TICK_EXTENT,
      stroke: TrackLabColors.controlPanelStrokeProperty,
    });
    this.contentNode.addChild(xTickMarkSet);

    const yTickMarkSet = new TickMarkSet(chartTransform, Orientation.VERTICAL, initialSpacing, {
      edge: "min",
      extent: TICK_EXTENT,
      stroke: TrackLabColors.controlPanelStrokeProperty,
    });
    this.contentNode.addChild(yTickMarkSet);

    const xTickLabelSet = new TickLabelSet(chartTransform, Orientation.HORIZONTAL, initialSpacing, {
      edge: "min",
      createLabel: (value: number) =>
        new Text(value.toFixed(TICK_LABEL_DECIMALS), {
          font: TICK_LABEL_FONT,
          fill: TrackLabColors.textProperty,
        }),
    });
    this.contentNode.addChild(xTickLabelSet);

    const yTickLabelSet = new TickLabelSet(chartTransform, Orientation.VERTICAL, initialSpacing, {
      edge: "min",
      createLabel: (value: number) =>
        new Text(value.toFixed(TICK_LABEL_DECIMALS), {
          font: TICK_LABEL_FONT,
          fill: TrackLabColors.textProperty,
        }),
    });
    this.contentNode.addChild(yTickLabelSet);

    this.gridConfig = {
      verticalGridLineSet,
      horizontalGridLineSet,
      xTickMarkSet,
      yTickMarkSet,
      xTickLabelSet,
      yTickLabelSet,
    };

    // ── Axis interaction regions ─────────────────────────────────────────────
    this.yAxisInteractionRegion = new Rectangle(-Y_AXIS_INTERACTION_WIDTH, 0, Y_AXIS_INTERACTION_WIDTH, height, {
      fill: "transparent",
      pickable: true,
    });
    this.contentNode.addChild(this.yAxisInteractionRegion);

    this.xAxisInteractionRegion = new Rectangle(0, height, width, X_AXIS_INTERACTION_HEIGHT, {
      fill: "transparent",
      pickable: true,
    });
    this.contentNode.addChild(this.xAxisInteractionRegion);

    // ── Clipped data container ───────────────────────────────────────────────
    this.clippedDataContainer = new Node({ clipArea: Shape.rect(0, 0, width, height) });
    this.contentNode.addChild(this.clippedDataContainer);

    // ── Axis labels ──────────────────────────────────────────────────────────
    this.xAxisLabelNode = new Text(formatAxisLabel(initialXProperty), {
      font: AXIS_LABEL_FONT,
      fill: TrackLabColors.textProperty,
      centerX: width / 2,
      top: height + AXIS_LABEL_OFFSET,
    });
    this.contentNode.addChild(this.xAxisLabelNode);

    this.yAxisLabelNode = new Text(formatAxisLabel(initialYProperty), {
      font: AXIS_LABEL_FONT,
      fill: TrackLabColors.textProperty,
      rotation: -Math.PI / 2,
      centerY: height / 2,
      right: -AXIS_LABEL_OFFSET,
    });
    this.contentNode.addChild(this.yAxisLabelNode);

    // ── Control buttons ──────────────────────────────────────────────────────
    const a11y = StringManager.getInstance().getA11y();

    const createButton = (label: string, onClick: () => void, accessibleName?: TReadOnlyProperty<string>): Node => {
      const buttonText = new Text(label, {
        font: BUTTON_FONT,
        fill: TrackLabColors.controlPanelStrokeProperty,
      });
      const buttonBackground = new Rectangle(
        0,
        0,
        BUTTON_SIZE,
        BUTTON_SIZE,
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
        tagName: "button",
        ...(accessibleName && { accessibleName }),
      });
      buttonText.center = buttonBackground.center;
      button.addInputListener({
        enter: () => {
          buttonBackground.opacity = BUTTON_HOVER_OPACITY;
        },
        exit: () => {
          buttonBackground.opacity = 1.0;
        },
      });
      button.addInputListener(new FireListener({ fire: onClick }));
      return button;
    };

    const controlButtonsPanel = new HBox({
      children: [
        createButton("↻", callbacks.onRescale, a11y.graphRescaleStringProperty),
        createButton("+", callbacks.onZoomIn, a11y.graphZoomInStringProperty),
        createButton("−", callbacks.onZoomOut, a11y.graphZoomOutStringProperty),
        createButton("←", () => callbacks.onPan("left"), a11y.graphPanLeftStringProperty),
        createButton("→", () => callbacks.onPan("right"), a11y.graphPanRightStringProperty),
        createButton("↑", () => callbacks.onPan("up"), a11y.graphPanUpStringProperty),
        createButton("↓", () => callbacks.onPan("down"), a11y.graphPanDownStringProperty),
      ],
      spacing: BUTTON_SPACING,
      left: BUTTON_PADDING,
      top: BUTTON_PADDING,
    });
    this.contentNode.addChild(controlButtonsPanel);
  }

  /**
   * Update rendering nodes after a graph resize.
   * ConfigurableGraph calls this from its resizeGraph() method.
   */
  public updateDimensions(newWidth: number, newHeight: number): void {
    this.graphWidth = newWidth;
    this.graphHeight = newHeight;

    this.clippedDataContainer.clipArea = Shape.rect(0, 0, newWidth, newHeight);
    this.yAxisInteractionRegion.setRect(-Y_AXIS_INTERACTION_WIDTH, 0, Y_AXIS_INTERACTION_WIDTH, newHeight);
    this.xAxisInteractionRegion.setRect(0, newHeight, newWidth, X_AXIS_INTERACTION_HEIGHT);

    this.xAxisLabelNode.centerX = newWidth / 2;
    this.xAxisLabelNode.top = newHeight + AXIS_LABEL_OFFSET;
    this.yAxisLabelNode.centerY = newHeight / 2;
  }

  /**
   * Refresh the axis label strings (called when the selected property changes).
   */
  public updateXAxisLabel(property: PlottableProperty): void {
    this.xAxisLabelNode.string = formatAxisLabel(property);
    this.xAxisLabelNode.centerX = this.graphWidth / 2;
  }

  public updateYAxisLabel(property: PlottableProperty): void {
    this.yAxisLabelNode.string = formatAxisLabel(property);
    this.yAxisLabelNode.centerY = this.graphHeight / 2;
  }
}

TrackLabNamespace.register("GraphRenderer", GraphRenderer);
