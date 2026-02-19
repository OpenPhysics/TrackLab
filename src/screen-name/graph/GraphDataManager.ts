/**
 * Manages data points, axis ranges, and visualization updates for a configurable graph.
 * Handles auto-scaling, tick spacing calculations, and trail point rendering.
 */

import { Vector2 } from "scenerystack/dot";
import { Range } from "scenerystack/dot";
import { Node, Circle } from "scenerystack/scenery";
import type {
  ChartTransform,
  LinePlot,
  GridLineSet,
  TickMarkSet,
  TickLabelSet,
} from "scenerystack/bamboo";
import ResonanceColors from "../../ResonanceColors.js";
import resonance from "../../ResonanceNamespace.js";

/**
 * Configuration for grid lines, tick marks, and tick labels
 */
export interface GridVisualizationConfig {
  verticalGridLineSet: GridLineSet;
  horizontalGridLineSet: GridLineSet;
  xTickMarkSet: TickMarkSet;
  yTickMarkSet: TickMarkSet;
  xTickLabelSet: TickLabelSet;
  yTickLabelSet: TickLabelSet;
}

export default class GraphDataManager {
  private readonly dataPoints: Vector2[] = [];
  private readonly maxDataPoints: number;
  private readonly chartTransform: ChartTransform;
  private readonly linePlot: LinePlot;
  private readonly trailNode: Node;
  private readonly trailLength: number = 5;
  private isManuallyZoomed: boolean = false;

  // Grid and tick components
  private readonly verticalGridLineSet: GridLineSet;
  private readonly horizontalGridLineSet: GridLineSet;
  private readonly xTickMarkSet: TickMarkSet;
  private readonly yTickMarkSet: TickMarkSet;
  private readonly xTickLabelSet: TickLabelSet;
  private readonly yTickLabelSet: TickLabelSet;

  public constructor(
    chartTransform: ChartTransform,
    linePlot: LinePlot,
    trailNode: Node,
    maxDataPoints: number,
    gridConfig: GridVisualizationConfig,
  ) {
    this.chartTransform = chartTransform;
    this.linePlot = linePlot;
    this.trailNode = trailNode;
    this.maxDataPoints = maxDataPoints;
    this.verticalGridLineSet = gridConfig.verticalGridLineSet;
    this.horizontalGridLineSet = gridConfig.horizontalGridLineSet;
    this.xTickMarkSet = gridConfig.xTickMarkSet;
    this.yTickMarkSet = gridConfig.yTickMarkSet;
    this.xTickLabelSet = gridConfig.xTickLabelSet;
    this.yTickLabelSet = gridConfig.yTickLabelSet;
  }

  /**
   * Add a new data point to the graph
   */
  public addDataPoint(xValue: number, yValue: number): void {
    // Skip invalid values
    if (!isFinite(xValue) || !isFinite(yValue)) {
      return;
    }

    // Add point
    this.dataPoints.push(new Vector2(xValue, yValue));

    // Remove oldest point if we exceed max
    if (this.dataPoints.length > this.maxDataPoints) {
      this.dataPoints.shift();
    }

    // Update the line plot
    this.linePlot.setDataSet(this.dataPoints);

    // Auto-scale the axes if we have data and user hasn't manually zoomed
    if (this.dataPoints.length > 1 && !this.isManuallyZoomed) {
      this.updateAxisRanges();
    }

    // Update the trail visualization
    this.updateTrail();
  }

  /**
   * Add multiple data points at once (for sub-step data).
   * More efficient than calling addDataPoint repeatedly.
   * @param points - Array of [x, y] value pairs
   */
  public addDataPoints(points: Array<{ x: number; y: number }>): void {
    if (points.length === 0) return;

    // Add all valid points
    for (const { x, y } of points) {
      if (isFinite(x) && isFinite(y)) {
        this.dataPoints.push(new Vector2(x, y));
      }
    }

    // Remove oldest points if we exceed max
    while (this.dataPoints.length > this.maxDataPoints) {
      this.dataPoints.shift();
    }

    // Update the line plot
    this.linePlot.setDataSet(this.dataPoints);

    // Auto-scale the axes if we have data and user hasn't manually zoomed
    if (this.dataPoints.length > 1 && !this.isManuallyZoomed) {
      this.updateAxisRanges();
    }

    // Update the trail visualization
    this.updateTrail();
  }

  /**
   * Clear all data points
   */
  public clearData(): void {
    this.dataPoints.length = 0;
    this.linePlot.setDataSet([]);

    // Reset to default ranges
    const defaultRange = new Range(-10, 10);
    this.chartTransform.setModelXRange(defaultRange);
    this.chartTransform.setModelYRange(defaultRange);

    // Reset tick spacing
    this.updateTickSpacing(defaultRange, defaultRange);

    // Clear trail
    this.trailNode.removeAllChildren();

    // Reset zoom state
    this.isManuallyZoomed = false;
  }

  /**
   * Update axis ranges to fit all data with some padding
   */
  public updateAxisRanges(): void {
    const firstPoint = this.dataPoints[0];
    if (this.dataPoints.length === 0 || !firstPoint) {
      return;
    }

    let xMin = firstPoint.x;
    let xMax = firstPoint.x;
    let yMin = firstPoint.y;
    let yMax = firstPoint.y;

    for (const point of this.dataPoints) {
      xMin = Math.min(xMin, point.x);
      xMax = Math.max(xMax, point.x);
      yMin = Math.min(yMin, point.y);
      yMax = Math.max(yMax, point.y);
    }

    // Add 10% padding with a minimum to ensure reasonable range sizes
    const xSpan = xMax - xMin;
    const ySpan = yMax - yMin;

    // Use 10% padding but ensure a minimum range of 2 units
    const xPadding = Math.max(xSpan * 0.1, (2 - xSpan) / 2, 0.1);
    const yPadding = Math.max(ySpan * 0.1, (2 - ySpan) / 2, 0.1);

    const xRange = new Range(xMin - xPadding, xMax + xPadding);
    const yRange = new Range(yMin - yPadding, yMax + yPadding);

    this.chartTransform.setModelXRange(xRange);
    this.chartTransform.setModelYRange(yRange);

    // Update tick spacing for better readability
    this.updateTickSpacing(xRange, yRange);
  }

  /**
   * Update tick spacing based on the range
   */
  public updateTickSpacing(xRange: Range, yRange: Range): void {
    // Calculate appropriate tick spacing (aim for ~5 ticks to avoid clutter)
    const xSpacing = GraphDataManager.calculateTickSpacing(xRange.getLength());
    const ySpacing = GraphDataManager.calculateTickSpacing(yRange.getLength());

    this.verticalGridLineSet.setSpacing(ySpacing);
    this.horizontalGridLineSet.setSpacing(xSpacing);
    this.xTickMarkSet.setSpacing(xSpacing);
    this.yTickMarkSet.setSpacing(ySpacing);
    this.xTickLabelSet.setSpacing(xSpacing);
    this.yTickLabelSet.setSpacing(ySpacing);
  }

  /**
   * Calculate appropriate tick spacing for a given range.
   * This is a static utility method that doesn't depend on instance state.
   */
  public static calculateTickSpacing(rangeLength: number): number {
    // Handle edge cases
    if (!isFinite(rangeLength) || rangeLength <= 0) {
      return 1;
    }

    // Target ~5-6 ticks to avoid too many grid lines
    const targetTicks = 5;
    const roughSpacing = rangeLength / targetTicks;

    // Handle very small spacings
    if (roughSpacing < 1e-10) {
      return 1e-10;
    }

    // Round to a nice number (1, 2, 5, 10, 20, 50, etc.)
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughSpacing)));
    const residual = roughSpacing / magnitude;

    let spacing: number;
    if (residual <= 1.5) {
      spacing = magnitude;
    } else if (residual <= 3.5) {
      spacing = 2 * magnitude;
    } else if (residual <= 7.5) {
      spacing = 5 * magnitude;
    } else {
      spacing = 10 * magnitude;
    }

    // Ensure minimum spacing to prevent too many ticks
    return Math.max(spacing, rangeLength / 20);
  }

  /**
   * Update the trail visualization showing the most recent points
   */
  public updateTrail(): void {
    // Clear existing trail circles
    this.trailNode.removeAllChildren();

    // Get the last N points (up to trailLength)
    const numTrailPoints = Math.min(this.trailLength, this.dataPoints.length);
    if (numTrailPoints === 0) {
      return;
    }

    // Start from the most recent points
    const startIndex = this.dataPoints.length - numTrailPoints;

    for (let i = 0; i < numTrailPoints; i++) {
      const point = this.dataPoints[startIndex + i];
      if (!point) continue;

      // Calculate the age of this point (0 = oldest in trail, numTrailPoints-1 = newest)
      const age = i;
      const fraction = age / (numTrailPoints - 1 || 1); // 0 to 1, where 1 is newest

      // Size and opacity increase with recency
      // Oldest point: small and transparent
      // Newest point: large and opaque
      const minRadius = 3;
      const maxRadius = 5;
      const radius = minRadius + (maxRadius - minRadius) * fraction;

      const minOpacity = 0.2;
      const maxOpacity = 0.8;
      const opacity = minOpacity + (maxOpacity - minOpacity) * fraction;

      // Transform model coordinates to view coordinates
      const viewPosition = this.chartTransform.modelToViewPosition(point);

      // Create circle for this trail point
      const circle = new Circle(radius, {
        fill: ResonanceColors.plot1Property,
        opacity: opacity,
        center: viewPosition,
      });

      this.trailNode.addChild(circle);
    }
  }

  /**
   * Set the manually zoomed flag (called by interaction handlers)
   */
  public setManuallyZoomed(value: boolean): void {
    this.isManuallyZoomed = value;
  }

  /**
   * Get the manually zoomed state
   */
  public isManualZoom(): boolean {
    return this.isManuallyZoomed;
  }

  /**
   * Get the number of data points
   */
  public getDataPointCount(): number {
    return this.dataPoints.length;
  }
}

// Register with namespace for debugging accessibility
resonance.register("GraphDataManager", GraphDataManager);
