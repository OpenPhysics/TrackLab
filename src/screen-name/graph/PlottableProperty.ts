/**
 * Interface for a property that can be plotted on a graph.
 * This allows the graph to be configured with any numeric property from the model.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";

/**
 * A data point from sub-step simulation data.
 * This is a flexible type that can hold any numeric data keyed by string names.
 */
export type SubStepDataPoint = Record<string, number>;

export type PlottableProperty = {
  // The name to display in the selector (can be a string or a localized string property)
  name: string | TReadOnlyProperty<string>;

  // The property to read values from.
  // Required when subStepAccessor is absent; may be omitted when subStepAccessor
  // covers all usage paths (e.g. kinematic variables that are always pushed via
  // addDataPointsFromSubSteps rather than polled with addDataPoint).
  property?: TReadOnlyProperty<number>;

  // Optional unit string for axis label (e.g., "m", "m/s", "J")
  // Can be a static string or a dynamic property for units that depend on calibration
  unit?: string | TReadOnlyProperty<string>;

  // Optional accessor for extracting this property's value from sub-step data.
  // When provided, high-resolution sub-step data is used for smooth phase-space plots.
  // When absent, falls back to the current property value.
  subStepAccessor?: (point: SubStepDataPoint) => number;
};
