# CLAUDE.md — TrackLab

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenPhysics/.github/CLAUDE.md](https://github.com/OpenPhysics/.github/blob/main/CLAUDE.md).

## Project

Browser-based **video motion-analysis** tool: load or record video, set coordinate system and calibration, auto-track or manually digitize motion, plot kinematics, export CSV. Not a forward physics integrator — it digitizes real motion and estimates derivatives.

Physics for educators: `doc/model.md`. Architecture: `doc/implementation-notes.md`.

## Key files

| Area | Location |
|---|---|
| Screen | `src/track-lab/TrackLabScreen.ts` |
| Model | `model/TrackLabModel.ts` (coordinator), `TrackingModel.ts`, `VideoPlaybackModel.ts`, `VideoSourceModel.ts`, `OverlayToolsModel.ts`, `KinematicsComputer.ts` |
| Tracking | `src/tracking/OpenCVTracker.ts` (template matching in Web Worker) |
| View | `view/TrackLabScreenView.ts`, `VideoPlayerNode.ts`, `WebcamPanel.ts`, `KinematicsGraphNode.ts`, `DataTableNode.ts`, `TableRenderer.ts`, `TrackLabScreenSummaryContent.ts` |
| Shared helpers | `src/TrackLabConstants.ts`, `TrackLabColors.ts`, `TrackLabButton.ts`, `TrackLabIcons.ts`, `webcam.ts` |
| Colors / strings | `TrackLabColors.ts`, `src/i18n/StringManager.ts` |

## Model

`TrackLabModel` composes four sub-models; cross-cutting orchestration (source activation, pixel→model conversion, re-transform on axis moves) lives here.

| Sub-model | Role |
|---|---|
| `playback` (`VideoPlaybackModel`) | timing, frame rate, display transform |
| `sources` (`VideoSourceModel`) | webcam recordings, uploads, active blob |
| `tracking` (`TrackingModel`) | particle tracks, kinematics, OpenCV facade |
| `overlayTools` (`OverlayToolsModel`) | axes, calibration, measurement tools; exposes `modelViewTransformProperty` |

### Numerics & gotchas

- `ModelViewTransformFactory.buildModelViewTransform()` maps real-world units to video pixels from coordinate-system position/rotation and calibration endpoints. Moving axes or calibration **re-expresses** digitized track points so they stay pinned on the video.
- Velocity and acceleration are **finite-difference estimates** from position series — noise amplifies on differentiation.
- Up to 26 tracks (labels A–Z) with independent colors for graphs and table rows.

## Accessibility

Follows the shared [OpenPhysics accessibility convention](https://github.com/OpenPhysics/Baton/blob/main/ACCESSIBILITY.md).
`TrackLabScreenView` registers `TrackLabScreenSummaryContent` (live current-details) via the
`screenSummaryContent` super-option and sets PDOM traversal order via a wrapper `Node`'s
`pdomOrder` (ScreenView forbids `pdomOrder` on itself). A11y strings live under the top-level
`a11y` key in each locale JSON, via `StringManager.getA11yStrings()` (and typed control names via
`getA11y()`). Canvas overlays use `tagName: "div"` + `accessibleName`; data tables need
`<caption>` and `aria-label` on headers.

## Compliance carve-outs

- **Hardcoded colors:** `view/TableRenderer.ts` builds the data table as real DOM and uses `TRACK_COLORS[…].toCSS()` with a `"#000000"` fallback literal — CSS-string carve-out for track visualization colors, not `TrackLabColors` UI tokens.
- **Domain clock:** `VideoPlaybackModel` drives video timing/scrubbing instead of composing fleet-standard `TimeModel` (`src/common/TimeModel.ts` is present for shared reference only).

## Testing

Fleet-standard Vitest layout:

| Path | Purpose |
|---|---|
| `vitest.config.ts` | `happy-dom` environment, `setupFiles`, `execArgv: ["--expose-gc"]` |
| `tests/setup.ts` | Canvas / AudioContext mocks + `init({ name: "…" })` before SceneryStack imports |
| `tests/**/*.test.ts` | Model/physics unit tests — mirror `src/` under `tests/` |
| `tests/memory-leak.test.ts` | WeakRef + `forceGC` dispose regression (fleet pattern) |

Actual specs:

- `tests/track-lab/model/KinematicsComputer.test.ts`
- `tests/memory-leak.test.ts`

Run `npm test`. CI runs the suite when a `test` script is present.

## Commands

```bash
npm run lint && npm run check && npm run build
npm test
npm run generate-svg-icon   # bouncing-ball icon SVG
```

## Conventions & deliberate deviations

Extra `src/` root files beyond the standard set, each justified by cross-screen use:
`TrackLabIcons.ts`, `TrackLabButton.ts`, `webcam.ts`, and the `src/tracking/` folder (OpenCV Web Worker).

- **OpenCV WASM** requires COOP/COEP headers (configured in Vite dev + production). Sample videos in `public/videos/`.
- **Wall-clock timers (allowed exception)** — webcam/video code uses raw `setTimeout`/`setInterval` rather than `stepTimer`: camera-init timeout in `webcam.ts`, FPS-sampling interval in `WebcamPanel.ts`, source-switch debounce in `VideoSourceControlNode.ts`. These track real hardware time, independent of the sim clock.
