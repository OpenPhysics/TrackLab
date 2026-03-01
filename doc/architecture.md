# TrackLab — Developer Architecture Guide

A reference for developers joining the project. Covers repo layout, key design
patterns, and the gotchas most likely to cost you time.

---

## Table of Contents

1. [Project overview](#1-project-overview)
2. [Directory layout](#2-directory-layout)
3. [Model layer](#3-model-layer)
4. [View layer](#4-view-layer)
5. [Property-driven reactivity (Axon)](#5-property-driven-reactivity-axon)
6. [Model-view transform (MVT)](#6-model-view-transform-mvt)
7. [OpenCV integration](#7-opencv-integration)
8. [Kinematics subsystem](#8-kinematics-subsystem)
9. [Graph subsystem](#9-graph-subsystem)
10. [Localization and accessibility](#10-localization-and-accessibility)
11. [Colors and theming](#11-colors-and-theming)
12. [Toolchain](#12-toolchain)
13. [Common gotchas](#13-common-gotchas)

---

## 1. Project overview

TrackLab is a single-page browser app for physics video analysis. The core
workflow:

1. Load a video (file upload or webcam recording).
2. Place and orient an XY coordinate system on the frame.
3. Calibrate a real-world distance using the calibration tool.
4. Digitize object positions frame-by-frame (manually or via OpenCV auto-tracking).
5. Inspect position, velocity, and acceleration graphs derived from the track data.

The UI is built on **SceneryStack** (a scene-graph framework). All state is held
in **Axon Properties** in the model layer; views observe those properties and
update automatically.

---

## 2. Directory layout

```
src/
├── main.ts                     # App entry point — wires screens, preferences, sim
├── init.ts                     # SceneryStack bootstrap (name, locales, color profiles)
├── TrackLabColors.ts           # All UI colors as ProfileColorProperty instances
├── TrackLabConstants.ts        # Shared numeric constants (panel sizes, drag speeds, …)
├── TrackLabButton.ts           # Factory for uniformly styled push buttons
├── TrackLabIcons.ts            # SVG icon factory functions
├── webcam.ts                   # getUserMedia / MediaRecorder wrapper
│
├── i18n/
│   ├── StringManager.ts        # Singleton — typed access to localized strings
│   ├── strings_en.json         # English copy (source of truth for key names)
│   └── strings_fr.json         # French copy (must have identical key set)
│
├── preferences/
│   ├── TrackLabPreferencesModel.ts
│   ├── TrackLabPreferencesNode.ts
│   └── trackLabQueryParameters.ts
│
├── tracking/
│   └── OpenCVTracker.ts        # Main-thread facade for the OpenCV Web Worker
│
└── screen-name/
    ├── SimScreen.ts            # Wires SimModel + SimScreenView into a PhET Screen
    ├── model/
    │   ├── SimModel.ts         # Top-level coordinator; composes the four sub-models
    │   ├── OverlayToolsModel.ts  # Axes, calibration, measuring tape, angle tool, MVT
    │   ├── VideoPlaybackModel.ts # Timing, frame rate, display transform
    │   ├── VideoSourceModel.ts   # Webcam blobs, uploaded files, current source
    │   ├── TrackingModel.ts      # Tracks array, kinematics cache, OpenCV facade
    │   ├── Track.ts              # Track and TrackPoint types
    │   ├── KinematicsComputer.ts # Pure: derives v, a from position data
    │   ├── ModelViewTransformFactory.ts # Pure: builds MVT from axes + calibration
    │   └── TrackExporter.ts      # Pure: serializes tracks to CSV
    │
    ├── view/
    │   ├── SimScreenView.ts      # Root layout node; positions all panels + overlays
    │   ├── VideoPlayerNode.ts    # <video> element + stacked overlay nodes
    │   ├── ControlPanel.ts       # Left sidebar controls
    │   ├── TrackListPanel.ts     # Track list + per-track controls
    │   ├── CoordinateSystemNode.ts  # Draggable/rotatable XY axes overlay
    │   ├── CalibrationToolNode.ts   # Draggable ruler for distance calibration
    │   ├── DigitizingOverlayNode.ts # Crosshair + magnifier for manual digitizing
    │   ├── AutoTrackerNode.ts       # Drag-to-select ROI + OpenCV tracking overlay
    │   ├── MeasuringTapeNode.ts
    │   ├── AngleToolNode.ts
    │   ├── DataTableNode.ts         # Scrollable data table
    │   ├── KinematicsGraphNode.ts   # Draggable, resizable graph panel
    │   └── PlaybackControlsNode.ts  # Play/pause/step/speed controls
    │
    └── graph/                    # Self-contained graphing subsystem
        ├── ConfigurableGraph.ts
        ├── GraphRenderer.ts
        ├── GraphDataManager.ts
        ├── GraphInteractionHandler.ts
        ├── PlottableProperty.ts
        └── kinematics-plottable-properties.ts

public/
└── opencv-worker.js            # Web Worker — all OpenCV WASM runs here

videos/                         # Sample video files (served as /videos/)
scripts/                        # Icon generation utilities (run with `npm run icons`)
.githooks/                      # pre-commit (biome fix) and pre-push (lint + typecheck)
```

---

## 3. Model layer

`SimModel` is a thin coordinator that composes four sub-models. Each sub-model
owns a specific slice of state and exposes it as Axon Properties.

| Sub-model | Owns |
|---|---|
| `OverlayToolsModel` | Axis origin/angle, calibration endpoints + scale, measuring tape, angle tool, derived MVT |
| `VideoPlaybackModel` | Current frame number, playback rate, video element dimensions, display transform |
| `VideoSourceModel` | Current video blob (uploaded file or webcam recording) |
| `TrackingModel` | Tracks array, active track ID, kinematics cache, `OpenCVTracker` instance |

`SimModel` also owns cross-model logic that cannot live in a single sub-model,
most importantly `retransformTrackPoints()` — called whenever the MVT changes to
re-express all stored track points in the new coordinate system.

### Pure utility classes

`KinematicsComputer`, `ModelViewTransformFactory`, and `TrackExporter` have zero
UI dependencies and are stateless pure functions. Keep them that way.

---

## 4. View layer

`SimScreenView` is the root `ScreenView` node. It creates and positions every
panel and overlay, then passes the relevant model slices down.

The overlay nodes (`CoordinateSystemNode`, `CalibrationToolNode`,
`DigitizingOverlayNode`, `AutoTrackerNode`, `MeasuringTapeNode`,
`AngleToolNode`) all live inside `VideoPlayerNode` so they scale with the video.

`DataTableNode` and `KinematicsGraphNode` live outside the video at fixed
positions in the screen-view coordinate system.

### Disposal pattern

Every view node that registers listeners must clean them up. The convention:

```ts
export class FooNode extends Node {
  private readonly disposeFooNode: () => void;

  public constructor(model: ...) {
    super();

    const listener = (value: T) => { /* update scene graph */ };
    model.someProperty.link(listener);

    this.disposeFooNode = () => {
      model.someProperty.unlink(listener);
    };
  }

  public override dispose(): void {
    this.disposeFooNode();
    super.dispose();
  }
}
```

Miss the `unlink()` and the listener fires forever, potentially on a disposed
node — a crash or silent memory leak.

---

## 5. Property-driven reactivity (Axon)

All mutable state is expressed as `Property<T>` or `DerivedProperty<T>`.

```ts
// Read current value
const val = model.someProperty.value;

// React to every change (fires immediately with current value)
model.someProperty.link(callback);

// React only to future changes (does NOT fire on link)
model.someProperty.lazyLink(callback);

// React to multiple properties changing
Multilink.multilink(
  [propA, propB],
  (a, b) => { /* ... */ }
);
```

`DerivedProperty` is read-only and recomputes automatically when its
dependencies change:

```ts
const areaProperty = new DerivedProperty(
  [widthProperty, heightProperty],
  (w, h) => w * h
);
```

**Always use `lazyLink` when the reaction would be expensive or has side
effects that must not fire on initialization.** For example, the MVT `lazyLink`
in `SimModel` only re-expresses track points when the transform actually changes,
not on every construction.

---

## 6. Model-view transform (MVT)

The MVT is the bridge between real-world model coordinates (metres, centimetres,
etc.) and video pixel coordinates.

Built by `ModelViewTransformFactory.buildModelViewTransform()` from:
- axis origin (pixels)
- axis angle (radians)
- calibration scale (pixels per model unit)

Exposed as `OverlayToolsModel.modelViewTransformProperty` (a
`DerivedProperty`). Anything that stores model coordinates and renders them on
the video must listen to this property and re-project when it changes.

`SimModel.retransformTrackPoints()` handles this for track data — it rewrites
every stored point into the new coordinate system so points remain visually
pinned to the same pixel after the user moves the axes.

---

## 7. OpenCV integration

**Architecture:** A Web Worker (`public/opencv-worker.js`) owns the WASM runtime.
The main thread communicates via `postMessage`.

**Main-thread facade:** `src/tracking/OpenCVTracker.ts` — call only this class.

**Pipeline:**

1. User drags a bounding box over the target object in `AutoTrackerNode`.
2. `OpenCVTracker.initFromVideo()` draws the current video frame to an offscreen
   canvas and captures the template region via `getImageData()`.
3. On each frame advance, `OpenCVTracker.track()` sends the current search region
   to the worker.
4. Worker runs `cv.matchTemplate()` (TM_CCOEFF_NORMED) and returns the best
   match position and confidence score.
5. If confidence ≥ 0.25 the result is accepted; the trail point is appended and
   the crosshair moves.

**Performance notes:**
- Only the search window (not the full frame) is transferred to the worker —
  reduces `getImageData()` cost significantly on large videos.
- A 5×5 Gaussian blur is applied to both template and search region to reduce
  noise sensitivity.
- `opencv.js` is served directly from `node_modules` (not bundled by Rollup) so
  Vite does not attempt to parse the WASM bundle. See `vite.config.ts` →
  `serveOpenCV()`.

---

## 8. Kinematics subsystem

`KinematicsComputer` derives velocity and acceleration from raw position data
using finite differences:

- **Central differences** for interior points (more accurate)
- **Forward/backward differences** for the first/last points

The results are cached in `TrackingModel` keyed by track ID. Cache validity is
checked by object identity of the `points` array (`cached.points === track.points`).
Because tracks are immutable — mutations always create a new `Track` with a new
`points` array — this is safe and cheap.

---

## 9. Graph subsystem

The graph subsystem lives entirely in `src/screen-name/graph/` and is
deliberately self-contained. Its seven files each own one responsibility:

| File | Responsibility |
|---|---|
| `ConfigurableGraph.ts` | Public API; composes the other six |
| `GraphRenderer.ts` | Canvas drawing (axes, grid, data series) |
| `GraphDataManager.ts` | Data selection and range computation |
| `GraphInteractionHandler.ts` | Mouse/touch pan and zoom |
| `PlottableProperty.ts` | Descriptor for a single plottable quantity |
| `kinematics-plottable-properties.ts` | Defines x, y, vx, vy, ax, ay descriptors |

Do not add business logic to `GraphRenderer` or rendering logic to
`GraphDataManager`.

---

## 10. Localization and accessibility

### Strings

`StringManager` is a singleton. Obtain the instance, then call the appropriate
accessor:

```ts
const strings = StringManager.getInstance().getControls();
// strings.playLabel — a Property<string> that switches language automatically
```

- `strings_en.json` is the source of truth for key names.
- `strings_fr.json` must have an identical key set — `StringManager` throws at
  construction if the two files diverge.
- Never hardcode English strings in view files.

### Accessibility

- Every interactive SceneryStack node (`Button`, `Checkbox`, draggable handle)
  must have `accessibleName` sourced from `StringManager.getA11y()`.
- Non-interactive canvas/DOM wrappers: set `tagName: "div"` and
  `accessibleName` so screen readers can identify the region.
- HTML data tables: use a visually-hidden `<caption>` and `aria-label` on `<th>`
  elements.

---

## 11. Colors and theming

All colors live in `TrackLabColors.ts` as `ProfileColorProperty` instances.
These automatically switch between *default* and *projector* (high-contrast)
modes without any view-layer code.

```ts
// Correct — reactive, theme-aware
fill: TrackLabColors.panelFillProperty

// Wrong — hardcoded, breaks projector mode
fill: '#ffffff'
```

Track colors are a 26-element palette (indices 0–25, one per letter A–Z).
Track symbols are assigned monotonically and never recycled within a session.

---

## 12. Toolchain

| Tool | Purpose | Config |
|---|---|---|
| TypeScript | Language | `tsconfig.json` (strict, ES2022) |
| Vite | Bundler + dev server | `vite.config.ts` |
| Biome | Linting + formatting | `biome.json` |
| Workbox (via vite-plugin-pwa) | Service worker / PWA | `vite.config.ts` |

### Key npm scripts

```
npm start          # Dev server (HMR)
npm run build      # tsc + vite build → dist/
npm run lint       # Biome lint (read-only)
npm run format     # Biome format (writes)
npm run fix        # Biome lint + format (writes) — also run by pre-commit hook
npm run check      # tsc type-check only
npm run icons      # Regenerate app icons from bouncingBallToSVG
```

### Git hooks

`.githooks/` (activated by `git config core.hooksPath .githooks` in `prepare`):

- **pre-commit** — runs `npm run fix` on staged files and re-stages the result.
  If Biome cannot auto-fix an error the commit is aborted.
- **pre-push** — runs lint and `tsc` to catch type errors before the push lands.

### CI/CD

- **ci.yml** — runs on every push: typecheck, lint, build.
- **deploy.yml** — deploys `dist/` to GitHub Pages on every push to `main`.

---

## 13. Common gotchas

### Scene-graph mutations inside Property listeners cause reentry

Scenery flushes its internal event queue synchronously whenever a node's
transform or hit-area changes. If a Property listener mutates the scene graph,
Scenery may dispatch another event (e.g., a mouse-up) while the first
`_notifyListeners` call is still on the stack — triggering a "reentry detected"
assertion.

**Fix:** defer scene-graph mutations to a microtask, and guard with `isDisposed`:

```ts
let isDisposed = false;

model.someProperty.link((value) => {
  queueMicrotask(() => {
    if (isDisposed) { return; }
    node.translation = value;
  });
});
```

This is the pattern used in `CoordinateSystemNode` for `onOriginChange` and
`onAngleChange`.

---

### Forgetting to unlink listeners causes memory leaks and crashes

Every `link()` call must have a matching `unlink()` in the node's dispose path.
The same applies to `Multilink` — call `.dispose()` on the multilink object.

Nodes in SceneryStack can be disposed and re-created (e.g., when resetting the
sim). A listener left attached to a global Property will fire on a disposed node,
either crashing or silently corrupting state.

---

### Switching video sources does not auto-reset overlays

`VideoSourceModel` changing does not automatically reset the MVT, calibration,
or tracks. `SimModel` explicitly calls `model.tracking.reset()` and reverts the
MVT to identity. If you add a new tool with persistent state, add a reset call to
that same code path.

---

### Track data is immutable by convention

`Track` objects and their `points` arrays are never mutated in place. Every
operation that changes a track (add point, delete point, rename) creates a new
`Track` object with a new `points` array and replaces the entry in
`TrackingModel.tracksProperty`.

This is required for correct kinematics cache invalidation (identity check
`cached.points === track.points`) and for predictable Property-change
notifications.

---

### Track symbols and colors are never recycled

Symbols (A, B, C, …) and the `colorIndex` are assigned from a monotonically
increasing counter within a session. Deleting track B does not make B available
again. The counter resets on full sim reset. Do not assume symbol → index
mapping is stable across resets.

---

### `opencv.js` must not be bundled by Rollup

The WASM file is large (~11 MB) and contains constructs Rollup cannot parse.
`vite.config.ts` includes a `serveOpenCV()` plugin that intercepts
`/opencv.js` requests and serves the file directly from `node_modules`. Do not
import `opencv.js` or the `@techstark/opencv-js` package anywhere in the
main-thread TypeScript source — it is only used in `public/opencv-worker.js`.

---

### `SharedArrayBuffer` requires COOP/COEP headers

The dev server and the production build both set:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers are required for `SharedArrayBuffer` (used internally by the OpenCV
WASM). Removing them will break tracking in browsers that enforce COOP/COEP.

---

### Biome's `useBlockStatements` rule

Biome requires all `if` bodies to use braces, even one-liners:

```ts
// Wrong — lint error
if (isDisposed) return;

// Correct
if (isDisposed) { return; }
```

The pre-commit hook auto-fixes most Biome issues, but `noUnusedVariables`
requires manual intervention (either delete the variable or, for intentional
stubs, prefix with `_`). Prefer deleting; the underscore prefix is a last resort.

---

### No test suite

There is intentionally no test framework. The codebase evolves rapidly enough
that maintaining tests costs more than they save at this stage. Do not add a
test runner or test files.
