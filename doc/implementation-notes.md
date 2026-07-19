# Implementation Notes - TrackLab

Developer-facing notes on the architecture. The measurement math is documented for educators in
[model.md](./model.md). Extended OpenCV and graph-gesture detail also lives in
[architecture.md](./architecture.md).

## Architecture Overview

TrackLab is a single-screen SceneryStack application for video kinematics. Unlike forward physics
sims, playback is driven by the HTML `<video>` element — `TrackLabModel.step()` is a no-op. The code
separates into:

```
src/track-lab/model/
  ├─ TrackLabModel.ts           thin coordinator: pixel→model, source activation, retransform hook
  ├─ VideoPlaybackModel.ts      current time, frame rate, playback rate, frame count
  ├─ VideoSourceModel.ts        uploads, webcam blobs, bundled vs user video flag
  ├─ TrackingModel.ts           tracks[], kinematics cache, OpenCVTracker facade
  ├─ OverlayToolsModel.ts       axes, calibration, tape, angle tool, modelViewTransformProperty
  ├─ ModelViewTransformFactory.ts   T(origin)·R(θ)·S(s,−s)
  ├─ Track.ts / TrackExporter.ts    data shapes and CSV export
  └─ KinematicsComputer.ts      pure finite-difference kinematics (no axon deps)

src/track-lab/view/
  ├─ TrackLabScreenView.ts      layout: panel, video, graph, table
  ├─ VideoPlayerNode.ts         hosts <video> + overlay stack
  ├─ CoordinateSystemNode / CalibrationToolNode / DigitizingOverlayNode / AutoTrackerNode
  ├─ KinematicsGraphNode / DataTableNode / ControlPanel / …
  └─ TrackLabScreenSummaryContent.ts, TrackLabKeyboardHelpContent.ts

src/track-lab/graph/
  ├─ ConfigurableGraph.ts       draggable/resizable plot shell
  ├─ GraphDataManager.ts / GraphRenderer.ts / PlottableProperty.ts
  └─ *GestureHandler.ts          pan, zoom, resize, axis drag

src/tracking/
  └─ OpenCVTracker.ts           main-thread facade → Web Worker template matcher

src/webcam.ts                   camera acquisition (used by model and view)
src/TrackLabColors.ts / TrackLabConstants.ts
```

Data flows Model → View through AXON `Property` objects. `KinematicsComputer` and
`ModelViewTransformFactory` are pure and unit-testable without SceneryStack.

## Key design decisions

- **Composed sub-models.** `TrackLabModel` delegates to four focused models and only handles
  cross-cutting orchestration (e.g. `recordTrackPoint`, `activateUpload`, MVT change → retransform).
- **MVT retransform invariant.** Track points are stored in **model coordinates**. When axes or
  calibration change, `overlayTools.modelViewTransformProperty` fires and
  `TrackingModel.retransformTrackPoints(prev, next)` maps each point through pixel space so marks
  stay visually anchored.
- **Kinematics cache.** `trackKinematicsProperty` is a `DerivedProperty` keyed by track id; cache
  validity uses **array identity** (`cached.points === track.points`). `removeTrack()` evicts cache
  entries to avoid unbounded growth.
- **OpenCV off the main thread.** Template matching runs in a Web Worker; `TrackingModel.initTracker`
  uses a monotonic `initVersion` to discard stale async results after `resetTracker()`.
- **Wall-clock timers (documented exceptions).** Webcam init, FPS sampling, and source-switch debounce
  use `setTimeout`/`setInterval` — real hardware timing, not sim clock (see `CLAUDE.md`).

## Model / view design

- `TrackLabModel.recordTrackPoint(trackId, pixelPoint)` reads playback time/frame from
  `VideoPlaybackModel`, converts pixels via the current MVT, and calls `TrackingModel.addPointToTrack`.
- Activating a new source (`activateRecording`, `activateUpload`, `activateBundledVideo`) resets
  tracking atomically.
- `TableRenderer.ts` builds the data table as real DOM; track colors use `TRACK_COLORS[i].toCSS()`
  (documented carve-out for CSS strings).
- Colors: `ProfileColorProperty` in `TrackLabColors.ts`; layout in `TrackLabConstants.ts`.

## Disposal conventions

`OpenCVTracker.dispose()` is called from `TrackingModel.reset()` and `resetTracker()`. Overlay and
graph nodes are screen-lifetime; verify listener cleanup when adding dynamic Property links (fleet
pattern in `tests/memory-leak.test.ts`).

## Testing

`npm test` (vitest):

- `tests/track-lab/model/KinematicsComputer.test.ts` — finite-difference edge cases (endpoints,
  null gaps, single-point tracks)
- `tests/memory-leak.test.ts` — fleet-standard WeakRef/GC regression suite

## Multi-screen simulations

Single-screen sim. See fleet `doc/multi-screen.md` if the app ever splits capture vs analysis.
