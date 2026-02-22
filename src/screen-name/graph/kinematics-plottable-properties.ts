/**
 * kinematics-plottable-properties.ts
 *
 * Canonical registry of every quantity that can appear on a kinematics graph
 * axis.  Centralising the list here means:
 *
 *  - Adding a new physical quantity (e.g. kinetic energy) requires a change in
 *    exactly one place rather than hunting through KinematicsGraphNode.
 *  - The accessor keys (e.g. "vx", "aMag") are co-located with the
 *    PlottableProperty definitions, making key–accessor mismatches obvious.
 *  - Unit properties from the model are wired in a single factory call,
 *    keeping KinematicsGraphNode free of quantity-specific knowledge.
 *
 * ## Adding a quantity
 *
 *   1. Compute it in `KinematicsComputer.ts` and add it to `TrackKinematicsPoint`.
 *   2. Add a `createPlottableProperty(...)` call below with the matching key.
 *   3. Expose it in the `dataPoints` map inside `KinematicsGraphNode.updateGraph()`.
 *
 * That's it — the graph axis selector picks it up automatically because it
 * renders whatever is in this array.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import type { SimModel } from "../model/SimModel.js";
import type { PlottableProperty } from "./PlottableProperty.js";

function createPlottableProperty(
  name: string,
  unit: string | TReadOnlyProperty<string>,
  accessor: (point: Record<string, number>) => number,
): PlottableProperty {
  return { name, unit, accessor };
}

/**
 * Categorised groups of kinematics quantities available for axis selection.
 * Each category can be independently included or excluded based on user preferences.
 */
export type KinematicsPlottableGroups = {
  /** Time — always available */
  time: PlottableProperty[];
  /** Position components — always available */
  position: PlottableProperty[];
  /** Velocity components — shown when the "show velocity" preference is on */
  velocity: PlottableProperty[];
  /** Acceleration components — shown when the "show acceleration" preference is on */
  acceleration: PlottableProperty[];
};

/**
 * Build the categorised groups of kinematics quantities available for axis selection.
 * Called once per `KinematicsGraphNode` instance.
 *
 * @param model - Provides the reactive unit-string properties so that axis
 *   labels update automatically when the user changes the calibration unit.
 */
export function buildKinematicsPlottableGroups(model: SimModel): KinematicsPlottableGroups {
  return {
    // ── Time ──────────────────────────────────────────────────────────────
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
    time: [createPlottableProperty("t", "s", (pt) => pt["t"] ?? 0)],

    // ── Position ──────────────────────────────────────────────────────────
    position: [
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
      createPlottableProperty("x", model.distanceUnitProperty, (pt) => pt["x"] ?? 0),
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
      createPlottableProperty("y", model.distanceUnitProperty, (pt) => pt["y"] ?? 0),
    ],

    // ── Velocity ──────────────────────────────────────────────────────────
    velocity: [
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
      createPlottableProperty("vx", model.velocityUnitProperty, (pt) => pt["vx"] ?? 0),
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
      createPlottableProperty("vy", model.velocityUnitProperty, (pt) => pt["vy"] ?? 0),
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
      createPlottableProperty("speed", model.velocityUnitProperty, (pt) => pt["speed"] ?? 0),
    ],

    // ── Acceleration ──────────────────────────────────────────────────────
    acceleration: [
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
      createPlottableProperty("ax", model.accelerationUnitProperty, (pt) => pt["ax"] ?? 0),
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
      createPlottableProperty("ay", model.accelerationUnitProperty, (pt) => pt["ay"] ?? 0),
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation
      createPlottableProperty("|a|", model.accelerationUnitProperty, (pt) => pt["aMag"] ?? 0),
    ],
  };
}
