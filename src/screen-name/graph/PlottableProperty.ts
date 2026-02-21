/**
 * Interface for a property that can be plotted on a graph.
 * This allows the graph to be configured with any numeric property from the model.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";

export type PlottableProperty = {
  // The name to display in the selector (can be a string or a localized string property)
  name: string | TReadOnlyProperty<string>;

  // The property to read values from.
  // Required when accessor is absent.
  property?: TReadOnlyProperty<number>;

  // Optional unit string for axis label (e.g., "m", "m/s", "J")
  // Can be a static string or a dynamic property for units that depend on calibration
  unit?: string | TReadOnlyProperty<string>;

  // Optional accessor for extracting this property's value from a data point record.
  // When provided, data is extracted from the record; when absent, falls back to property.value.
  accessor?: (point: Record<string, number>) => number;
};
