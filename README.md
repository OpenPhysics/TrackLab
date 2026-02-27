# TrackLab

A browser-based video analysis tool for tracking and measuring motion in physics videos. Load a video, set up a coordinate system, calibrate real-world distances, and automatically track objects across frames using computer vision.

## Features

- **Video playback** — Load from 12 built-in physics sample videos or record your own with a webcam
- **Coordinate system** — Place and rotate a draggable axes overlay anywhere on the video
- **Calibration tool** — Define a known reference distance to convert pixel measurements to real-world units (mm, cm, m, km, in, ft)
- **Auto-tracking** — Select any object and track it across frames using OpenCV template matching
- **Video upload** — Load local video files or animated WebP images from disk
- **Manual digitizing** — Add multiple tracks (A, B, C…) and place points frame-by-frame with a crosshair cursor and magnifier
- **Measurement tools** — Draggable measuring tape (real-world distance) and three-handle angle tool, enabled via preferences
- **Kinematics graph** — Configurable X-Y plot of any two kinematic quantities (position, velocity, acceleration, speed) for any track
- **Data table** — Spreadsheet view of all track data with CSV export
- **Webcam recording** — Capture live video directly in the browser and use it as the analysis source
- **Help dialog** — In-app guide explaining the digitizing workflow, accessible via the info button
- **Configurable frame rate** — Set video frame rate (15–60 fps) for accurate time calculations
- **Bilingual UI** — English and French interface support
- **Color profiles** — Default and projector modes for classroom presentation
- **Pinned track points** — Digitized points stay at the same pixel on the video when you move the coordinate system or calibration
- **PWA support** — Installable as a desktop/mobile app

## Sample Videos

Bundled videos live in `public/videos/` and are served at `/videos/`.

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI Framework | [SceneryStack](https://scenerystack.org) (PhET) |
| Tracking | [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html) (WASM) |
| Build tool | [Vite](https://vite.dev) |
| Language | TypeScript |
| Linter / Formatter | [Biome](https://biomejs.dev) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm start
```

The app will be available at `http://localhost:5173`.

### Production build

```bash
npm run build
```

Output is written to `dist/`. The build includes the video files and the OpenCV WASM binary.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run check` | Run TypeScript type checking |
| `npm run lint` | Lint with Biome |
| `npm run format` | Format with Biome |
| `npm run fix` | Fix lint and format issues |
| `npm run icons` | Regenerate app icons (SVG → PNG/ICO) |
| `npm run generate-svg-icon` | Generate `public/icons/icon.svg` from bouncing ball script |
| `npm run preview` | Preview production build locally |

## Usage

### 1. Load a video

Use the dropdown to select a built-in video, or click **Record** to capture video from a connected webcam.

### 2. Set up the coordinate system

Enable the **Axes** toggle in the control panel. Drag the origin marker to position the coordinate system. Drag the handle on the x-axis to rotate it.

### 3. Calibrate real-world units

Enable the **Calibration** toggle. Drag the two endpoints of the calibration bar to span a known distance in the video, then enter the real-world length and choose a unit.

### 4. Track an object

**Auto-tracking:** Enable **Auto Tracking** in the control panel. On the video frame, click and drag to draw a box around the object you want to track. The tracker will follow it across subsequent frames, drawing a trail of past positions.

**Manual digitizing:** Enable **Digitize** and click **+ Add Track** in the track list panel. Select a track, then click on the video at each frame to record positions. Use the playback controls to step through or scrub the video.

### 5. View and export data

The data table shows all track positions in real-world units. Use **Export CSV** to download the data for analysis in spreadsheets or other tools.

## Architecture

```
src/
├── main.ts                  # App entry point
├── init.ts                  # Simulation metadata (name, version, locales)
├── splash.ts                # Splash screen
├── brand.ts                 # Branding metadata
├── assert.ts                # Assertion utilities
├── TrackLabButton.ts        # Factory for consistently styled push buttons
├── TrackLabColors.ts        # Centralized color properties (default + projector)
├── TrackLabConstants.ts     # Layout and validation constants
├── TrackLabNamespace.ts     # SceneryStack namespace registration
├── webcam.ts                # WebcamRecorder (getUserMedia, MediaRecorder)
├── i18n/
│   ├── StringManager.ts     # Localization singleton
│   ├── strings_en.json      # English strings
│   └── strings_fr.json      # French strings
├── preferences/
│   ├── TrackLabPreferencesModel.ts  # User preferences (auto-tracking, graph quantities, measurement tools)
│   ├── TrackLabPreferencesNode.ts  # Preferences UI
│   └── trackLabQueryParameters.ts  # Query parameter parsing
├── screen-name/
│   ├── SimScreen.ts         # Screen wiring (model + view)
│   ├── model/
│   │   ├── SimModel.ts             # Thin coordinator; composes sub-models
│   │   ├── OverlayToolsModel.ts    # Axes, calibration, measuring tape, angle tool, MVT
│   │   ├── VideoPlaybackModel.ts   # Timing, frame rate, playback state
│   │   ├── VideoSourceModel.ts     # Webcam recordings, uploads, active blob
│   │   ├── TrackingModel.ts       # Tracks, kinematics, OpenCV facade
│   │   ├── ModelViewTransformFactory.ts  # Builds Transform3 from coord-system + calibration
│   │   ├── Track.ts               # Track model (points, label, color)
│   │   ├── TrackExporter.ts       # CSV export
│   │   └── KinematicsComputer.ts  # Velocity and acceleration via finite differences
│   ├── view/
│   │   ├── SimScreenView.ts        # Root view, layout
│   │   ├── VideoPlayerNode.ts      # Video element, hosts overlays
│   │   ├── VideoSourceControlNode.ts  # Video dropdown, Record, Upload
│   │   ├── PlaybackControlsNode.ts    # Play, scrubber, frame step, frame rate
│   │   ├── CoordinateSystemNode.ts    # Draggable/rotatable axes overlay
│   │   ├── CalibrationToolNode.ts     # Reference distance tool
│   │   ├── ControlPanel.ts            # Left-side toggle panel
│   │   ├── AutoTrackerNode.ts         # Auto-tracking overlay and trail
│   │   ├── DigitizingOverlayNode.ts   # Manual digitizing crosshair + magnifier
│   │   ├── DigitizingAwareOverlayNode.ts  # Base for overlays that need digitizing context
│   │   ├── DataTableNode.ts           # Spreadsheet of track data, CSV export
│   │   ├── KinematicsGraphNode.ts     # Configurable kinematics graph (wraps graph/)
│   │   ├── TrackListPanel.ts          # Add/remove tracks for digitizing
│   │   ├── MeasurementToolsPanel.ts   # Checkboxes for measuring tape and angle tool
│   │   ├── MeasuringTapeNode.ts       # Draggable tape overlay with real-world distance label
│   │   ├── AngleToolNode.ts           # Three-handle angle overlay with degree label
│   │   ├── InfoDialogNode.ts          # Modal help dialog for digitizing workflow
│   │   ├── WebcamPanel.ts             # Webcam recording dialog
│   │   └── KeyboardShortcutsNode.ts   # Keyboard shortcuts reference overlay
│   └── graph/
│       ├── ConfigurableGraph.ts              # Top-level graph node; axis selectors, chart layout, zoom/reset
│       ├── GraphDataManager.ts               # Data points, auto-scaling, tick spacing
│       ├── GraphInteractionHandler.ts        # Orchestrates gesture handlers; shared chart config
│       ├── PanGestureHandler.ts              # Chart-area drag to pan both axes
│       ├── ZoomGestureHandler.ts             # Mouse-wheel and pinch zoom; double-click to reset
│       ├── AxisGestureHandler.ts             # Single-axis pan and zoom on axis labels
│       ├── ResizeGestureHandler.ts           # Corner drag handles for graph panel resize
│       ├── HeaderDragHandler.ts              # Header drag to reposition floating graph panel
│       ├── GraphControlsPanel.ts             # Axis property selector dropdowns
│       ├── PlottableProperty.ts              # Interface for quantities in the axis selector
│       └── kinematics-plottable-properties.ts  # Registry of all plottable quantities
├── tracking/
│   └── OpenCVTracker.ts     # OpenCV template matching (TM_CCOEFF_NORMED)
└── scripts/
    ├── bouncingBallToSVG.ts # Generates icon.svg from bouncing ball animation
    └── generate-icons.ts    # Creates PNG/ICO from icon.svg
```

### State management

State is modeled as reactive [Axon Properties](https://github.com/phetsims/axon). `SimModel` is a thin coordinator that composes four sub-models:

- **OverlayToolsModel** — Coordinate system, calibration, measuring tape, angle tool, and the derived model-view transform
- **VideoPlaybackModel** — Timing, frame rate, playback state
- **VideoSourceModel** — Webcam recordings, uploads, active video blob
- **TrackingModel** — Tracks (each with digitized points), kinematics, OpenCV facade

Views observe properties and update themselves automatically.

### Model-view transform

`ModelViewTransformFactory.buildModelViewTransform()` builds a `Transform3` from the coordinate system's position/rotation and the calibration tool's endpoints and distance. `OverlayToolsModel` exposes this as a reactive `modelViewTransformProperty`. The transform maps real-world coordinates (e.g., meters) to video pixel coordinates and back. When the user moves the coordinate system or calibration, `SimModel` re-expresses all track points so they stay pinned to the same pixels on the video.

### Tracking pipeline

**Auto-tracking:**
1. User drags a selection box over the target object (`AutoTrackerNode`)
2. `OpenCVTracker.initFromVideo()` captures the template image from the current video frame
3. On each frame advance, `OpenCVTracker.track()` runs OpenCV `matchTemplate` (TM_CCOEFF_NORMED) in a Web Worker to find the best match location without blocking the main thread
4. The result center point is appended to the trail and the crosshair is moved

**Manual digitizing:** User adds tracks in `TrackListPanel`, selects one, then clicks on the video at each frame. `DigitizingOverlayNode` provides a crosshair cursor and magnifier; positions are stored in the track model and converted to real-world units via the model-view transform.

## Browser Requirements

| Feature | Requirement |
|---------|-------------|
| OpenCV WASM | Chrome 79+, Firefox 72+, Safari 15.2+ |
| SharedArrayBuffer (OpenCV WASM) | Requires `COOP`/`COEP` headers (served automatically in dev and production) |
| WebM webcam recording | Chrome/Edge (Firefox records in WebM with limited seek support) |
| Range requests | Required for video seeking; handled automatically by the dev server and production build |

## Deployment

The repository includes GitHub Actions workflows:

- **`ci.yml`** — Runs on every push: type-check, lint, and build
- **`deploy.yml`** — Builds and deploys to GitHub Pages on push to `main`

For other hosting targets, upload the contents of `dist/` to any static file server that supports custom HTTP headers (needed for `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`).

## License

See [LICENSE](LICENSE) for details.
