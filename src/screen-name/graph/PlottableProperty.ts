/**
 * Interface for a property that can be plotted on a graph.
 * This allows the graph to be configured with any numeric property from the model.
 */

import { type TReadOnlyProperty } from "scenerystack/axon";
import type { SubStepDataPoint } from "../../model/BaseModel.js";

export type PlottableProperty = {
  // The name to display in the selector (can be a string or a localized string property)
  name: string | TReadOnlyProperty<string>;

  // The property to read values from
  property: TReadOnlyProperty<number>;

  // Optional unit string for axis label (e.g., "m", "m/s", "J")
  unit?: string;

  // Optional accessor for extracting this property's value from sub-step data.
  // When provided, high-resolution sub-step data is used for smooth phase-space plots.
  // When absent, falls back to the current property value.
  subStepAccessor?: (point: SubStepDataPoint) => number;
};
