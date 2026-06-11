# Implementation Notes - TrackLab Simulation

## Architecture Overview

TrackLab is a browser-based physics video analysis application built on SceneryStack. Unlike traditional physics sims, it digitizes motion from video rather than integrating differential equations. The core workflow is: load video → set coordinate system → calibrate → digitize or auto-track → graph kinematics → export CSV.

### High-Level Architecture

The simulation follows a composed Model-View pattern:

- **Model Layer (`src/screen-name/model/`)**: Four sub-models coordinated by `SimModel`
- **View Layer (`src/screen-name/view/`)**: Video player, overlay tools, graph, and data table
- **Graph subsystem (`src/screen-name/graph/`)**: Configurable kinematics plots
- **Tracking (`src/tracking/`)**: OpenCV template matching in a Web Worker

`SimModel` is a thin coordinator that delegates to specialized sub-models and handles cross-cutting concerns such as retransforming track points when the model-view transform changes.

For extended developer detail (OpenCV, graph gestures, gotchas), see also [`architecture.md`](architecture.md).

### Model-View Transform

`ModelViewTransformFactory.buildModelViewTransform()` builds a `Transform3`:

`T(origin) · R(θ) · S(s, −s)`

from coordinate-system position/rotation and calibration endpoints. `OverlayToolsModel` exposes this as `modelViewTransformProperty`. Track points are stored in model coordinates; `retransformTrackPoints()` runs when axes or calibration change.

## Model Components

### Core Model Design

`SimModel` composes four sub-models:

1. **VideoPlaybackModel** — frame timing, playback rate, display transform
2. **VideoSourceModel** — uploads, webcam recordings, current source
3. **TrackingModel** — particle tracks, kinematics cache, OpenCV facade
4. **OverlayToolsModel** — axes, calibration, measuring tape, angle tool, MVT

### Component Specialization

Additional model utilities:

1. **Track** / **TrackPoint**: Digitized position data per frame
2. **KinematicsComputer**: Pure functions deriving velocity and acceleration from positions
3. **TrackExporter**: CSV serialization
4. **OpenCVTracker.ts**: Main-thread facade for the Web Worker template matcher

OpenCV WASM requires COOP/COEP headers (configured in Vite dev and production builds).

## View Components

### SimScreenView as Coordinator

The root view positions the control panel, video player, overlay stack, kinematics graph, and data table.

Specialized view classes handle specific aspects:

1. **VideoPlayerNode**: `<video>` element hosting overlay nodes
2. **CoordinateSystemNode**: Draggable, rotatable XY axes
3. **CalibrationToolNode**: Draggable ruler for distance calibration
4. **DigitizingOverlayNode**: Crosshair and magnifier for manual digitizing
5. **AutoTrackerNode**: ROI selection and OpenCV tracking overlay
6. **KinematicsGraphNode**: Draggable, resizable graph panel
7. **DataTableNode**: Scrollable tabular data with accessibility caption
8. **MeasuringTapeNode**, **AngleToolNode**: Measurement tools
9. **WebcamPanel**: Record from webcam

The graph subsystem (`ConfigurableGraph`, `GraphDataManager`, `GraphRenderer`, gesture handlers) is self-contained under `src/screen-name/graph/`.

### Color Scheme

All UI colors are `ProfileColorProperty` instances in `TrackLabColors.ts`. Track series use the `TRACK_COLORS` palette. Layout constants live in `TrackLabConstants.ts`.

### Accessibility

A11y strings are in the `a11y` section of locale JSON files, accessed via `StringManager.getA11y()`. Interactive overlays use `accessibleName`; data tables include `<caption>` and `aria-label` on headers.

### Performance Optimizations

- OpenCV runs off the main thread in a Web Worker
- Kinematics are cached on the model and invalidated when track data changes
- Graph rendering uses a dedicated renderer with zoom/pan gesture handlers

Sample videos ship in `public/videos/` for offline demos.

Note that disposal patterns should be verified when adding new Property links or overlay listeners.
