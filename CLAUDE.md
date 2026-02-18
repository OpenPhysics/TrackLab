# TrackLab — Claude Code Guide

## Project overview

TrackLab is a browser-based physics video analysis tool. Users load a video, place a coordinate system, calibrate real-world distances, and auto-track objects across frames using OpenCV.

## Where to work

Most feature development happens in two directories:

```
src/screen-name/model/     ← application state
src/screen-name/view/      ← all UI components
```

**Model** (`src/screen-name/model/SimModel.ts`) holds every piece of reactive state as Axon `Property` objects (playback position, duration, overlay visibility, model-view transform). If you need a new piece of shared state, add it here.

**View** (`src/screen-name/view/`) contains all SceneryStack nodes. Key files:

| File | Responsibility |
|------|----------------|
| `VideoPlayerNode.ts` | Video element, playback controls, scrubber, time/frame display |
| `SimScreenView.ts` | Root layout, model-view transform computation |
| `CoordinateSystemNode.ts` | Draggable/rotatable axes overlay |
| `CalibrationToolNode.ts` | Reference distance calibration tool |
| `AutoTrackerNode.ts` | Tracking selection box and trail rendering |
| `ControlPanel.ts` | Left-side toggle panel |
| `WebcamPanel.ts` | Webcam recording dialog |

The other source directories are less frequently modified:

- `src/tracking/` — OpenCV template-matching pipeline (touch only for tracking algorithm changes)
- `src/i18n/` — Localization strings (English and French)
- `src/` root files (`main.ts`, `init.ts`, `TrackLabColors.ts`, etc.) — bootstrapping and global config

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
- **Frame rate**: the codebase assumes 30 fps (`FRAME_DURATION = 1/30` in `VideoPlayerNode.ts`). Frame stepping and the frame counter both rely on this constant.
- **SceneryStack layout**: use `HBox` / `VBox` for rows and columns. Prefer `align: 'center'` and explicit `spacing` values. Do not set absolute pixel positions unless absolutely necessary.
