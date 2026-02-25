# TrackLab — Claude Code Guide

## Project overview

TrackLab is a browser-based physics video analysis tool. Users load a video, place a coordinate system, calibrate real-world distances, and auto-track objects across frames using OpenCV.

## Where to work

Most feature development happens in two directories:

```
src/screen-name/model/     ← application state
src/screen-name/view/      ← all UI components
```

**Model** (`src/screen-name/model/`) holds all application state and pure computation logic. Key files:

| File | Responsibility |
|------|----------------|
| `SimModel.ts` | All reactive state as Axon `Property` objects (playback position, duration, overlay visibility, frame rate, model-view transform, tracks) |
| `Track.ts` | Track model — digitized points, label, color |
| `KinematicsComputer.ts` | Pure functions for computing velocity and acceleration from digitized points via finite differences |
| `ModelViewTransformFactory.ts` | Pure factory that builds the `Transform3` from coordinate-system pose and calibration data |

If you need a new piece of shared state, add it to `SimModel.ts`.

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
| `KinematicsGraphNode.ts` | Configurable kinematics graph; wraps `ConfigurableGraph` with track and unit wiring |
| `TrackListPanel.ts` | Add/remove tracks for manual digitizing |
| `ControlPanel.ts` | Left-side toggle panel |
| `MeasurementToolsPanel.ts` | Checkboxes for measuring tape and angle tool overlays (shown when measurement tools preference is enabled) |
| `MeasuringTapeNode.ts` | Two-endpoint draggable tape overlay; displays real-world distance via model-view transform |
| `AngleToolNode.ts` | Three-handle draggable angle overlay; draws an arc and label at the vertex in degrees |
| `InfoDialogNode.ts` | Modal help dialog explaining digitizing steps; toggled by the info button |
| `WebcamPanel.ts` | Webcam recording dialog |
| `KeyboardShortcutsNode.ts` | Keyboard shortcuts |

**Graph** (`src/screen-name/graph/`) powers the configurable X-Y plot panel. Key files:

| File | Responsibility |
|------|----------------|
| `ConfigurableGraph.ts` | Top-level graph node; owns axis selectors, chart layout, and zoom/reset buttons |
| `GraphDataManager.ts` | Accumulates data points, owns auto-scaling and tick spacing |
| `GraphInteractionHandler.ts` | Orchestrates all gesture handlers; owns shared chart config and exposes zoom/pan API |
| `PanGestureHandler.ts` | Mouse/touch drag on the chart area to pan both axes simultaneously |
| `ZoomGestureHandler.ts` | Mouse-wheel and pinch-to-zoom; preserves pointer/pinch center; double-click to reset |
| `AxisGestureHandler.ts` | Single-axis pan and zoom triggered by gestures on the axis labels |
| `ResizeGestureHandler.ts` | Corner drag handles that resize the graph panel |
| `HeaderDragHandler.ts` | Drag on the header bar to reposition the floating graph panel |
| `GraphControlsPanel.ts` | Axis property selector dropdowns (what to plot on each axis) |
| `PlottableProperty.ts` | `PlottableProperty` type — interface any quantity must satisfy to appear in the selector |
| `kinematics-plottable-properties.ts` | Canonical registry of all plottable quantities (position, velocity, acceleration, speed, time) |

> **Note:** Gesture logic is split across focused handler classes (`PanGestureHandler`, `ZoomGestureHandler`, `AxisGestureHandler`, `ResizeGestureHandler`, `HeaderDragHandler`). Read the relevant handler before adding new gesture code — many edge cases (pinch center preservation, manual-zoom locking, axis-specific gestures) are already handled.

The other source directories are less frequently modified:

- `src/preferences/` — User preferences: color profile, auto-tracking visibility, graph quantity visibility (`showVelocityInGraphProperty`, `showAccelerationInGraphProperty`), and measurement tools visibility (`enableMeasurementToolsProperty`)
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
- **Model-view transform**: `ModelViewTransformFactory.ts` builds the `Transform3` from the coordinate system pose and calibration data. `SimScreenView` wraps this in a `modelViewTransformProperty`. Use it to convert between real-world units and video-pixel coordinates.
- **Frame rate**: `SimModel.frameRateProperty` (default 30 fps) drives `frameDurationProperty`. The user can change frame rate via `PlaybackControlsNode`; frame stepping and time display use this value.
- **SceneryStack layout**: use `HBox` / `VBox` for rows and columns. Prefer `align: 'center'` and explicit `spacing` values. Do not set absolute pixel positions unless absolutely necessary.

## Constants and colors

- **Colors**: All UI colors live in `TrackLabColors.ts` as `ProfileColorProperty` instances for automatic dark/light theme switching. When adding a new color, create it there — never hardcode `rgb(…)` or hex strings in view files.
- **Layout constants**: Shared numeric constants (panel margins, drag speeds, touch dilation) live in `TrackLabConstants.ts`. File-local constants that are used only within a single view file can remain local, but any constant duplicated across two or more files should be hoisted to `TrackLabConstants.ts`.
- **Overlay constants**: Draggable overlays (measuring tape, angle tool, calibration tool, coordinate system) share `OVERLAY_DRAG_SPEED`, `OVERLAY_SHIFT_DRAG_SPEED`, `OVERLAY_TOUCH_DILATION`, and label panel styling constants (`LABEL_PANEL_*`) from `TrackLabConstants.ts`.
- **Control panel constants**: `CONTROL_ICON_SIZE`, `CONTROL_PANEL_ROWS_SPACING`, `CONTROL_PANEL_X_MARGIN`, `CONTROL_PANEL_Y_MARGIN` are shared across `ControlPanel.ts`, `MeasurementToolsPanel.ts`, and `InfoDialogNode.ts`.

## Accessibility

- **Localized a11y strings**: All accessibility text lives in `StringManager.getA11y()` backed by the `a11y` section in `strings_en.json` / `strings_fr.json`. Never hardcode English strings for `accessibleName` or `aria-label`.
- **Interactive elements**: Every interactive SceneryStack node (button, checkbox, draggable handle) must have an `accessibleName` sourced from the a11y string properties.
- **Canvas overlays**: Non-interactive overlay containers that wrap a Canvas or DOM element should have `tagName: "div"` and an `accessibleName` so screen readers can identify them.
- **HTML tables**: Use `<caption>` (visually hidden) and `aria-label` on `<th>` elements for data tables.

## Testing

There is currently **no test suite**, and none should be added at this stage. The codebase is evolving rapidly — APIs, model structure, and UI components change frequently enough that maintaining tests would cost more than they save right now. Do not install a test framework or create test files.
