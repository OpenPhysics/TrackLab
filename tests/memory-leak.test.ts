/**
 * Fleet-standard memory-leak regression suite (SceneryStackTemplate / QubitSketch pattern).
 *
 * Creates a disposable model object inside a function boundary, disposes it, forces
 * garbage collection via global.gc (--expose-gc in vitest.config.ts), then asserts via
 * WeakRef that the object was collected. V8 requires a function boundary (not merely
 * a block scope) so local strong references die when the helper returns.
 */

import { Property, type TReadOnlyProperty } from "scenerystack/axon";
import { describe, expect, it } from "vitest";
import GraphControlsPanel from "../src/track-lab/graph/GraphControlsPanel.js";
import type { PlottableProperty } from "../src/track-lab/graph/PlottableProperty.js";
import { TrackingModel } from "../src/track-lab/model/TrackingModel.js";
import { VideoPlaybackModel } from "../src/track-lab/model/VideoPlaybackModel.js";
import { PlaybackControlsNode } from "../src/track-lab/view/PlaybackControlsNode.js";

/**
 * Force garbage collection with multiple passes. When `earlyExitRefs` is supplied
 * the loop bails as soon as every referenced object is confirmed collected. The
 * setTimeout(0) yield after a live deref() avoids the WeakRef macrotask-liveness pin.
 * Without early-exit refs the loop always runs all passes, which on a slow `gc()`
 * can exceed the Vitest testTimeout — always pass refs when you have them.
 */
async function forceGC(earlyExitRefs?: WeakRef<object> | readonly WeakRef<object>[]): Promise<void> {
  const refs = earlyExitRefs === undefined ? [] : Array.isArray(earlyExitRefs) ? earlyExitRefs : [earlyExitRefs];
  for (let i = 0; i < 15; i++) {
    globalThis.gc?.();
    await new Promise<void>((r) => setTimeout(r, 50));
    if (refs.length > 0 && refs.every((ref) => ref.deref() === undefined)) {
      return;
    }
    if (refs.length > 0) {
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

/**
 * Number of listeners currently attached to `property`.
 *
 * Axon's TinyEmitter exposes getListenerCount() publicly but ReadOnlyProperty
 * re-declares it private, so the cast is deliberate. The public alternative,
 * hasListeners(), is too coarse: these properties always carry listeners from
 * the model's own DerivedProperties, so only the exact count distinguishes a
 * clean dispose from a retained one.
 */
function listenerCount(property: TReadOnlyProperty<number>): number {
  return (property as unknown as { getListenerCount(): number }).getListenerCount();
}

/** Shared no-op callback for view constructors under test. */
const noop = (): void => {
  /* no-op */
};

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

  // PlaybackControlsNode builds an HSlider bound to currentTimeProperty and
  // rebuilds it whenever duration, frame rate, or frame count changes. A
  // replacement that is never inserted into the scene graph must still be
  // disposed: an orphaned HSlider keeps its listeners on the model property
  // alive for the lifetime of the model, which no WeakRef on the node catches.
  it("PlaybackControlsNode leaves no listeners on currentTimeProperty after dispose", () => {
    const playback = new VideoPlaybackModel();
    const tracking = new TrackingModel();
    const videoElement = document.createElement("video");

    const baseline = listenerCount(playback.currentTimeProperty);

    for (let i = 0; i < 3; i++) {
      const node = new PlaybackControlsNode(playback, tracking, videoElement, noop, noop, noop);
      node.dispose();
    }

    expect(listenerCount(playback.currentTimeProperty)).toBe(baseline);
  });

  it("PlaybackControlsNode scrubber rebuilds do not accumulate listeners", () => {
    const playback = new VideoPlaybackModel();
    const tracking = new TrackingModel();
    const videoElement = document.createElement("video");

    const baseline = listenerCount(playback.currentTimeProperty);
    const node = new PlaybackControlsNode(playback, tracking, videoElement, noop, noop, noop);

    const afterConstruct = listenerCount(playback.currentTimeProperty);
    // Each of these triggers replaceScrubber().
    playback.durationProperty.value = 10;
    playback.durationProperty.value = 20;
    playback.frameRateProperty.value = 60;
    expect(listenerCount(playback.currentTimeProperty)).toBe(afterConstruct);

    node.dispose();
    expect(listenerCount(playback.currentTimeProperty)).toBe(baseline);
  });

  it("repeated create/dispose cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDisposeGraphControlsPanel());
    }
    await forceGC(refs);
    const survivors = refs.filter((r) => r.deref() !== undefined).length;
    expect(survivors).toBe(0);
  });
});
