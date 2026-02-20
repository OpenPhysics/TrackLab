# TrackLab — Claude Code Guide

## Project overview

TrackLab is a browser-based physics video analysis tool. Users load a video, place a coordinate system, calibrate real-world distances, and auto-track objects across frames using OpenCV.

## Where to work

Most feature development happens in two directories:

```
src/screen-name/model/     ← application state
src/screen-name/view/      ← all UI components
```

**Model** (`src/screen-name/model/SimModel.ts`) holds every piece of reactive state as Axon `Property` objects (playback position, duration, overlay visibility, frame rate, model-view transform, tracks). `Track.ts` defines the track model (points, label, color). If you need a new piece of shared state, add it to `SimModel.ts`.

**View** (`src/screen-name/view/`) contains all SceneryStack nodes. Key files:

| File | Responsibility |
|------|----------------|
| `SimScreenView.ts` | Root layout, model-view transform computation |
| `VideoPlayerNode.ts` | Video element, hosts overlays (auto-tracker, digitizing) |
| `VideoSourceControlNode.ts` | Video dropdown, Record button |
| `PlaybackControlsNode.ts` | Play, scrubber, frame step, frame rate selector |
| `CoordinateSystemNode.ts` | Draggable/rotatable axes overlay |
| `CalibrationToolNode.ts` | Reference distance calibration tool |
| `AutoTrackerNode.ts` | Auto-tracking selection box and trail rendering |
| `DigitizingOverlayNode.ts` | Manual digitizing crosshair and magnifier |
| `DataTableNode.ts` | Spreadsheet of track data, CSV export |
| `TrackListPanel.ts` | Add/remove tracks for manual digitizing |
| `ControlPanel.ts` | Left-side toggle panel |
| `WebcamPanel.ts` | Webcam recording dialog |
| `KeyboardShortcutsNode.ts` | Keyboard shortcuts |

**Graph** (`src/screen-name/graph/`) powers the configurable X-Y plot panel. Key files:

| File | Responsibility |
|------|----------------|
| `ConfigurableGraph.ts` | Top-level graph node; owns axis selectors, chart layout, and zoom/reset buttons |
| `GraphDataManager.ts` | Accumulates data points, owns auto-scaling, tick spacing, and trail circle rendering |
| `GraphInteractionHandler.ts` | All pointer/touch/keyboard gestures — pan, pinch-zoom, axis drag, resize, header drag |
| `GraphControlsPanel.ts` | Axis property selector dropdowns (what to plot on each axis) |
| `PlottableProperty.ts` | `PlottableProperty` type — interface any quantity must satisfy to appear in the selector |

> **Note:** `GraphInteractionHandler.ts` is the largest file in the codebase (~1,150 lines). When modifying gesture logic, read the existing `zoom()` / `pan()` / `rescaleAxes()` helpers before adding new code — many edge cases (pinch center preservation, manual-zoom locking, axis-specific gestures) are already handled.

The other source directories are less frequently modified:

- `src/preferences/` — User preferences (color profile, etc.)
- `src/tracking/` — OpenCV template-matching pipeline (touch only for tracking algorithm changes)
- `src/i18n/` — Localization strings (English and French)
- `src/` root files (`main.ts`, `init.ts`, `TrackLabColors.ts`, `TrackLabConstants.ts`, etc.) — bootstrapping and global config

## Development commands

```bash
npm start          # start Vite dev server at http://localhost:5173
npm run build      # type-check (tsc) then bundle (vite build)
npm run check      # TypeScript type check only
npm run lint       # Biome lint
npm run format     # Biome format
npm run fix        # fix lint + format issues together
```

## Architecture notes

- **Reactive state**: all model values are Axon `Property` / `BooleanProperty` / `DerivedProperty`. Views observe properties and update automatically — avoid manual imperative sync.
- **Model-view transform**: `SimScreenView` computes a `modelViewTransformProperty` from the coordinate system pose and calibration data. Use it to convert between real-world units and video-pixel coordinates.
- **Frame rate**: `SimModel.frameRateProperty` (default 30 fps) drives `frameDurationProperty`. The user can change frame rate via `PlaybackControlsNode`; frame stepping and time display use this value.
- **SceneryStack layout**: use `HBox` / `VBox` for rows and columns. Prefer `align: 'center'` and explicit `spacing` values. Do not set absolute pixel positions unless absolutely necessary.

## Testing

There is currently **no test suite**, and none should be added at this stage. The codebase is evolving rapidly — APIs, model structure, and UI components change frequently enough that maintaining tests would cost more than they save right now. Do not install a test framework or create test files.
