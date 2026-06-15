/**
 * PlottableProperty.ts
 *
 * Describes a quantity that can appear on a graph axis.  There are exactly
 * two kinds, distinguished by how the graph obtains a numeric value:
 *
 *  - RecordPlottable  — value extracted from a data-point record via an
 *                       accessor function (used for kinematics quantities
 *                       derived from digitized track points).
 *
 *  - LivePlottable    — value read directly from a reactive Axon property
 *                       (used for quantities that exist independently of any
 *                       data record, such as a live sensor reading).
 *
 * Callers create one or the other; the graph dispatches on the discriminant
 * key without any optional chaining or fallback-to-null.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";

/** Shared display metadata present on both variants. */
type PlottableBase = {
  /** Label shown in the axis selector and as the axis title. */
  name: string | TReadOnlyProperty<string>;
  /** Unit suffix for the axis label (e.g. "m", "m/s"). */
  unit?: string | TReadOnlyProperty<string>;
};

/**
 * A quantity whose value is extracted from a data-point record.
 * The graph calls `accessor(point)` for each data record it receives.
 */
export type RecordPlottable = PlottableBase & {
  accessor: (point: Record<string, number>) => number;
};

/**
 * A quantity whose value is read from a live Axon property.
 * The graph reads `property.value` when it needs the current value.
 */
export type LivePlottable = PlottableBase & {
  property: TReadOnlyProperty<number>;
};

/** Union of the two concrete plottable variants. */
export type PlottableProperty = RecordPlottable | LivePlottable;

/** True when {@link p} sources its value from a data-record accessor. */
export const isRecordPlottable = (p: PlottableProperty): p is RecordPlottable => "accessor" in p;

/** True when {@link p} sources its value from a live reactive property. */
export const isLivePlottable = (p: PlottableProperty): p is LivePlottable => "property" in p;
