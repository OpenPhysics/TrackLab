/**
 * Fleet-standard memory-leak regression suite (TemplateSingleSim / QubitSketch pattern).
 *
 * Creates a disposable model object inside a function boundary, disposes it, forces
 * garbage collection via global.gc (--expose-gc in vitest.config.ts), then asserts via
 * WeakRef that the object was collected. V8 requires a function boundary (not merely
 * a block scope) so local strong references die when the helper returns.
 */

import { Property } from "scenerystack/axon";
import { describe, expect, it } from "vitest";
import GraphControlsPanel from "../src/track-lab/graph/GraphControlsPanel.js";
import type { PlottableProperty } from "../src/track-lab/graph/PlottableProperty.js";

/**
 * Force garbage collection with multiple passes. When `earlyExitRef` is supplied
 * the loop bails as soon as the object is confirmed collected. The setTimeout(0)
 * yield after a live deref() avoids the WeakRef macrotask-liveness pin.
 */
async function forceGC(earlyExitRef?: WeakRef<object>): Promise<void> {
  for (let i = 0; i < 15; i++) {
    globalThis.gc?.();
    await new Promise<void>((r) => setTimeout(r, 50));
    if (earlyExitRef !== undefined && earlyExitRef.deref() === undefined) {
      return;
    }
    if (earlyExitRef !== undefined) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
}

// Named separately from the array so callers can reference them without an
// index lookup, which under noUncheckedIndexedAccess would widen to
// `PlottableProperty | undefined` and force a non-null assertion.
// Bracket access because `point` is a Record<string, number> and the project
// sets noPropertyAccessFromIndexSignature.
const TIME_PLOTTABLE: PlottableProperty = {
  name: "t",
  accessor: (point: Record<string, number>) => point["t"] ?? 0,
};
const POSITION_PLOTTABLE: PlottableProperty = {
  name: "x",
  accessor: (point: Record<string, number>) => point["x"] ?? 0,
};

const SAMPLE_PLOTTABLES: PlottableProperty[] = [TIME_PLOTTABLE, POSITION_PLOTTABLE];

function createAndDisposeGraphControlsPanel(): WeakRef<object> {
  // Explicit type argument: TypeScript narrows these consts to RecordPlottable
  // from their initializers, and Property<T> is invariant in T.
  const xPropertyProperty = new Property<PlottableProperty>(TIME_PLOTTABLE);
  const yPropertyProperty = new Property<PlottableProperty>(POSITION_PLOTTABLE);
  const panel = new GraphControlsPanel(SAMPLE_PLOTTABLES, xPropertyProperty, yPropertyProperty, 200);
  const ref = new WeakRef<object>(panel);
  panel.dispose();
  xPropertyProperty.dispose();
  yPropertyProperty.dispose();
  return ref;
}

describe("Memory leak regression", () => {
  it("global.gc is available (--expose-gc)", () => {
    expect(globalThis.gc).toBeDefined();
  });

  it("sanity: plain object is collected", async () => {
    const ref = (() => new WeakRef({ hello: "world" }))();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("GraphControlsPanel is collected after dispose", async () => {
    const ref = createAndDisposeGraphControlsPanel();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("double dispose() does not throw", () => {
    const xPropertyProperty = new Property<PlottableProperty>(TIME_PLOTTABLE);
    const yPropertyProperty = new Property<PlottableProperty>(POSITION_PLOTTABLE);
    const panel = new GraphControlsPanel(SAMPLE_PLOTTABLES, xPropertyProperty, yPropertyProperty, 200);
    panel.dispose();
    expect(() => panel.dispose()).not.toThrow();
    xPropertyProperty.dispose();
    yPropertyProperty.dispose();
  });

  it("repeated create/dispose cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDisposeGraphControlsPanel());
    }
    await forceGC();
    const survivors = refs.filter((r) => r.deref() !== undefined).length;
    expect(survivors).toBe(0);
  });
});
