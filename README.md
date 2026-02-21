# TrackLab

A browser-based video analysis tool for tracking and measuring motion in physics videos. Load a video, set up a coordinate system, calibrate real-world distances, and automatically track objects across frames using computer vision.

## Features

- **Video playback** — Load from 9 built-in physics sample videos or record your own with a webcam
- **Coordinate system** — Place and rotate a draggable axes overlay anywhere on the video
- **Calibration tool** — Define a known reference distance to convert pixel measurements to real-world units (mm, cm, m, km, in, ft)
- **Auto-tracking** — Select any object and track it across frames using OpenCV template matching
- **Manual digitizing** — Add multiple tracks (A, B, C…) and place points frame-by-frame with a crosshair cursor and magnifier
- **Kinematics graph** — Configurable X-Y plot of any two kinematic quantities (position, velocity, acceleration, speed) for any track
- **Data table** — Spreadsheet view of all track data with CSV export
- **Webcam recording** — Capture live video directly in the browser and use it as the analysis source
- **Configurable frame rate** — Set video frame rate (15–60 fps) for accurate time calculations
- **Bilingual UI** — English and French interface support
- **Color profiles** — Default and projector modes for classroom presentation
- **PWA support** — Installable as a desktop/mobile app

## Sample Videos

The following physics scenarios are included:

| File | Description |
|------|-------------|
| `ball_oil.mp4` | Ball falling through oil |
| `bouncing_cart.mp4` | Cart bouncing off a wall |
| `cart_pendulum.mp4` | Cart with pendulum |
| `CupsClips.mp4` | Cup collision demonstration |
| `parachute_monkey.mp4` | Monkey with parachute drop |
| `Pendulum.mp4` | Simple pendulum |
| `pendulum_drag.mp4` | Pendulum with drag |
| `PucksCollide.mp4` | Air puck collision |
| `spring_wars.mp4` | Spring force interactions |

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI Framework | [SceneryStack](https://scenerystack.org) (PhET) |
| Tracking | [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html) (WASM) |
| Video processing | [FFmpeg.js](https://ffmpegwasm.netlify.app/) |
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
| `npm run icons` | Regenerate app icons from `public/icons/icon.svg` |

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
├── TrackLabColors.ts        # Centralized color properties (default + projector)
├── TrackLabConstants.ts     # Layout and validation constants
├── TrackLabNamespace.ts     # SceneryStack namespace registration
├── webcam.ts                # WebcamRecorder (getUserMedia, MediaRecorder)
├── i18n/
│   ├── StringManager.ts     # Localization singleton
│   ├── strings_en.json      # English strings
│   └── strings_fr.json      # French strings
├── preferences/
│   ├── TrackLabPreferencesModel.ts  # User preferences (color profile, etc.)
│   └── TrackLabPreferencesNode.ts   # Preferences UI
├── screen-name/
│   ├── SimScreen.ts         # Screen wiring (model + view)
│   ├── model/
│   │   ├── SimModel.ts      # Application state (Axon Properties)
│   │   └── Track.ts         # Track model (points, label, color)
│   └── view/
│       ├── SimScreenView.ts        # Root view, layout, MVT computation
│       ├── VideoPlayerNode.ts      # Video element, hosts overlays
│       ├── VideoSourceControlNode.ts  # Video dropdown + Record button
│       ├── PlaybackControlsNode.ts    # Play, scrubber, frame step, frame rate
│       ├── CoordinateSystemNode.ts   # Draggable/rotatable axes overlay
│       ├── CalibrationToolNode.ts    # Reference distance tool
│       ├── ControlPanel.ts          # Left-side toggle panel
│       ├── AutoTrackerNode.ts       # Auto-tracking overlay and trail
│       ├── DigitizingOverlayNode.ts # Manual digitizing crosshair + magnifier
│       ├── DataTableNode.ts         # Spreadsheet of track data, CSV export
│       ├── KinematicsGraphNode.ts   # Configurable kinematics graph (wraps graph/)
│       ├── TrackListPanel.ts        # Add/remove tracks for digitizing
│       ├── WebcamPanel.ts           # Webcam recording dialog
│       └── KeyboardShortcutsNode.ts
├── graph/
│   ├── ConfigurableGraph.ts         # Top-level graph node; axis selectors, chart layout, zoom/reset
│   ├── GraphDataManager.ts          # Data points, auto-scaling, tick spacing
│   ├── GraphInteractionHandler.ts   # Pan, pinch-zoom, axis drag, resize, header drag gestures
│   ├── GraphControlsPanel.ts        # Axis property selector dropdowns
│   └── PlottableProperty.ts         # Interface for quantities that appear in the axis selector
└── tracking/
    └── OpenCVTracker.ts     # OpenCV template matching (TM_CCOEFF_NORMED)
```

### State management

State is modeled as reactive [Axon Properties](https://github.com/phetsims/axon). The central `SimModel` holds playback state, overlay visibility flags, frame rate, the computed model-view transform, and the list of tracks (each with digitized points). Views observe properties and update themselves automatically.

### Model-view transform

`SimScreenView` derives a `modelViewTransformProperty` from the coordinate system's position/rotation and the calibration tool's endpoints and distance. This transform maps real-world coordinates (e.g., meters) to video pixel coordinates and back.

### Tracking pipeline

**Auto-tracking:**
1. User drags a selection box over the target object (`AutoTrackerNode`)
2. `OpenCVTracker.initFromVideo()` captures the template image from the current video frame
3. On each frame advance, `OpenCVTracker.track()` runs OpenCV `matchTemplate` (TM_CCOEFF_NORMED) to find the best match location
4. The result center point is appended to the trail and the crosshair is moved

**Manual digitizing:** User adds tracks in `TrackListPanel`, selects one, then clicks on the video at each frame. `DigitizingOverlayNode` provides a crosshair cursor and magnifier; positions are stored in the track model and converted to real-world units via the model-view transform.

## Browser Requirements

| Feature | Requirement |
|---------|-------------|
| OpenCV WASM | Chrome 79+, Firefox 72+, Safari 15.2+ |
| SharedArrayBuffer (FFmpeg) | Requires `COOP`/`COEP` headers (served automatically in dev and production) |
| WebM webcam recording | Chrome/Edge (Firefox records in WebM with limited seek support) |
| Range requests | Required for video seeking; handled automatically by the dev server and production build |

## Deployment

The repository includes GitHub Actions workflows:

- **`ci.yml`** — Runs on every push: type-check, lint, and build
- **`deploy.yml`** — Builds and deploys to GitHub Pages on push to `main`

For other hosting targets, upload the contents of `dist/` to any static file server that supports custom HTTP headers (needed for `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`).

## License

See [LICENSE](LICENSE) for details.
