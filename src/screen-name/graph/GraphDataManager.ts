/**
 * Manages data points, axis ranges, and visualization updates for a configurable graph.
 * Handles auto-scaling and tick spacing calculations.
 */

import type { ChartTransform, GridLineSet, LinePlot, TickLabelSet, TickMarkSet } from "scenerystack/bamboo";
import { Range, Vector2 } from "scenerystack/dot";
import trackLab from "../../TrackLabNamespace.js";

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
  // ── Circular buffer ──────────────────────────────────────────────────────
  // Fixed-size ring buffer so that oldest-point eviction is O(1) rather than
  // O(n) (Array.shift reindexes every remaining element after removal).
  // Same pattern used by AutoTrackerNode for the trail buffer.
  private readonly dataBuf: (Vector2 | undefined)[];
  private dataHead = 0; // index where the NEXT write will land
  private dataSize = 0; // number of valid entries (0 … maxDataPoints)

  // ── Running min/max ──────────────────────────────────────────────────────
  // Maintained incrementally so that axis rescaling never scans all stored
  // points on the 30 Hz hot path.  A full rescan is triggered only when an
  // evicted point was at an axis extreme (rare in practice).
  private xMin = Infinity;
  private xMax = -Infinity;
  private yMin = Infinity;
  private yMax = -Infinity;

  private readonly maxDataPoints: number;
  private readonly chartTransform: ChartTransform;
  private readonly linePlot: LinePlot | null;
  private isManuallyZoomed = false;

  // Grid and tick components
  private readonly verticalGridLineSet: GridLineSet;
  private readonly horizontalGridLineSet: GridLineSet;
  private readonly xTickMarkSet: TickMarkSet;
  private readonly yTickMarkSet: TickMarkSet;
  private readonly xTickLabelSet: TickLabelSet;
  private readonly yTickLabelSet: TickLabelSet;

  public constructor(
    chartTransform: ChartTransform,
    linePlot: LinePlot | null,
    maxDataPoints: number,
    gridConfig: GridVisualizationConfig,
  ) {
    this.chartTransform = chartTransform;
    this.linePlot = linePlot;
    this.maxDataPoints = maxDataPoints;
    this.dataBuf = new Array(maxDataPoints);
    this.verticalGridLineSet = gridConfig.verticalGridLineSet;
    this.horizontalGridLineSet = gridConfig.horizontalGridLineSet;
    this.xTickMarkSet = gridConfig.xTickMarkSet;
    this.yTickMarkSet = gridConfig.yTickMarkSet;
    this.xTickLabelSet = gridConfig.xTickLabelSet;
    this.yTickLabelSet = gridConfig.yTickLabelSet;
  }

  /**
   * Returns all stored points in insertion order (oldest → newest).
   * Reconstructs an ordered array from the ring buffer for the line plot.
   */
  private getOrderedPoints(): Vector2[] {
    const result: Vector2[] = new Array(this.dataSize);
    for (let i = 0; i < this.dataSize; i++) {
      const idx = (this.dataHead - this.dataSize + i + this.maxDataPoints) % this.maxDataPoints;
      // biome-ignore lint/style/noNonNullAssertion: index is within dataSize, slot is always written
      result[i] = this.dataBuf[idx]!;
    }
    return result;
  }

  /**
   * Write one point to the ring buffer.
   * Returns the evicted Vector2 if the buffer was already full, otherwise undefined.
   */
  private writePoint(x: number, y: number): Vector2 | undefined {
    let evicted: Vector2 | undefined;
    if (this.dataSize === this.maxDataPoints) {
      // Buffer full: dataHead is the oldest slot — save it before overwriting.
      evicted = this.dataBuf[this.dataHead];
    } else {
      this.dataSize++;
    }
    this.dataBuf[this.dataHead] = new Vector2(x, y);
    this.dataHead = (this.dataHead + 1) % this.maxDataPoints;
    return evicted;
  }

  /**
   * Full O(n) scan to recompute xMin/xMax/yMin/yMax from the ring buffer.
   * Called only when an eviction may have invalidated a cached extreme.
   */
  private recomputeMinMax(): void {
    this.xMin = Infinity;
    this.xMax = -Infinity;
    this.yMin = Infinity;
    this.yMax = -Infinity;
    for (let i = 0; i < this.dataSize; i++) {
      const idx = (this.dataHead - this.dataSize + i + this.maxDataPoints) % this.maxDataPoints;
      // biome-ignore lint/style/noNonNullAssertion: index is within dataSize, slot is always written
      const p = this.dataBuf[idx]!;
      if (p.x < this.xMin) {
        this.xMin = p.x;
      }
      if (p.x > this.xMax) {
        this.xMax = p.x;
      }
      if (p.y < this.yMin) {
        this.yMin = p.y;
      }
      if (p.y > this.yMax) {
        this.yMax = p.y;
      }
    }
  }

  /**
   * Incrementally update running extremes after inserting (x, y) and evicting
   * `evicted`.  Falls back to a full rescan only when the evicted point was an
   * axis extreme (the common case — a buffer that has never filled — never rescans).
   */
  private updateMinMaxIncremental(x: number, y: number, evicted: Vector2 | undefined): void {
    if (x < this.xMin) {
      this.xMin = x;
    }
    if (x > this.xMax) {
      this.xMax = x;
    }
    if (y < this.yMin) {
      this.yMin = y;
    }
    if (y > this.yMax) {
      this.yMax = y;
    }
    if (
      evicted !== undefined &&
      (evicted.x <= this.xMin || evicted.x >= this.xMax || evicted.y <= this.yMin || evicted.y >= this.yMax)
    ) {
      this.recomputeMinMax();
    }
  }

  /**
   * Apply the cached axis extremes to the chart transform, with padding and
   * tick spacing updates.  O(1) — reads only the four cached scalars.
   */
  private applyAxisRangesFromExtremes(): void {
    if (this.dataSize === 0) {
      return;
    }
    const xSpan = this.xMax - this.xMin;
    const ySpan = this.yMax - this.yMin;

    const xPadding = Math.max(xSpan * 0.1, (2 - xSpan) / 2, 0.1);
    const yPadding = Math.max(ySpan * 0.1, (2 - ySpan) / 2, 0.1);

    const xRange = new Range(this.xMin - xPadding, this.xMax + xPadding);
    const yRange = new Range(this.yMin - yPadding, this.yMax + yPadding);

    this.chartTransform.setModelXRange(xRange);
    this.chartTransform.setModelYRange(yRange);
    this.updateTickSpacing(xRange, yRange);
  }

  /**
   * Add a new data point to the graph
   */
  public addDataPoint(xValue: number, yValue: number): void {
    if (!(Number.isFinite(xValue) && Number.isFinite(yValue))) {
      return;
    }

    const evicted = this.writePoint(xValue, yValue);
    this.updateMinMaxIncremental(xValue, yValue, evicted);

    this.linePlot?.setDataSet(this.getOrderedPoints());

    if (this.dataSize > 1 && !this.isManuallyZoomed) {
      this.applyAxisRangesFromExtremes();
    }
  }

  /**
   * Add multiple data points at once.
   * More efficient than calling addDataPoint repeatedly.
   * @param points - Array of x/y value pairs
   */
  public addDataPoints(points: Array<{ x: number; y: number }>): void {
    if (points.length === 0) {
      return;
    }

    let needsRescan = false;
    for (const { x, y } of points) {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        const evicted = this.writePoint(x, y);
        // Inline incremental update (avoids function-call overhead in tight loop).
        if (x < this.xMin) {
          this.xMin = x;
        }
        if (x > this.xMax) {
          this.xMax = x;
        }
        if (y < this.yMin) {
          this.yMin = y;
        }
        if (y > this.yMax) {
          this.yMax = y;
        }
        if (
          evicted !== undefined &&
          (evicted.x <= this.xMin || evicted.x >= this.xMax || evicted.y <= this.yMin || evicted.y >= this.yMax)
        ) {
          needsRescan = true;
        }
      }
    }

    if (needsRescan) {
      this.recomputeMinMax();
    }

    this.linePlot?.setDataSet(this.getOrderedPoints());

    if (this.dataSize > 1 && !this.isManuallyZoomed) {
      this.applyAxisRangesFromExtremes();
    }
  }

  /**
   * Clear all data points
   */
  public clearData(): void {
    this.dataHead = 0;
    this.dataSize = 0;
    this.xMin = Infinity;
    this.xMax = -Infinity;
    this.yMin = Infinity;
    this.yMax = -Infinity;
    this.linePlot?.setDataSet([]);

    const defaultRange = new Range(-10, 10);
    this.chartTransform.setModelXRange(defaultRange);
    this.chartTransform.setModelYRange(defaultRange);
    this.updateTickSpacing(defaultRange, defaultRange);

    this.isManuallyZoomed = false;
  }

  /**
   * Update axis ranges to fit all data with some padding.
   * Reads the cached min/max extremes — O(1) unless a rescan was triggered by eviction.
   */
  public updateAxisRanges(): void {
    this.applyAxisRangesFromExtremes();
  }

  /**
   * Update tick spacing based on the range
   */
  public updateTickSpacing(xRange: Range, yRange: Range): void {
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
   *
   * @param rangeLength - The total span of the axis.
   * @param targetTicks - Desired approximate number of major ticks (default 5).
   */
  public static calculateTickSpacing(rangeLength: number, targetTicks = 5): number {
    if (!Number.isFinite(rangeLength) || rangeLength <= 0) {
      return 1;
    }

    const roughSpacing = rangeLength / targetTicks;

    if (roughSpacing < 1e-10) {
      return 1e-10;
    }

    // Round to a nice number (1, 2, 5, 10, 20, 50, etc.)
    const magnitude = 10 ** Math.floor(Math.log10(roughSpacing));
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

    return Math.max(spacing, rangeLength / 20);
  }

  /**
   * Set the manually zoomed flag (called by interaction handlers)
   */
  public setManuallyZoomed(value: boolean): void {
    this.isManuallyZoomed = value;
  }

  /**
   * Get the number of data points
   */
  public getDataPointCount(): number {
    return this.dataSize;
  }
}

// Register with namespace for debugging accessibility
trackLab.register("GraphDataManager", GraphDataManager);
