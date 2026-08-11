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
- **Time sync is one-way and centralized.** `VideoPlayerNode` links `currentTimeProperty` → `videoElement.currentTime` (guarded by the `scrubbing` flag and a half-frame deadband). Writers of `currentTimeProperty` should *not* seek the element themselves; the video follows the model automatically.
- **`TrackPoint.time` is authoritative, `frame` is derived.** Changing the frame rate renumbers `currentFrameProperty`, so `TrackingModel.retimeTrackPoints()` re-derives every stored point's index from its timestamp (wired in `TrackLabModel`). Lowering the rate can collide two points onto one index; first wins.
- Up to 4 concurrent tracks (labels A–Z available; symbols are not reused) with independent colors for graphs and table rows.

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


### `package.json` overrides

JSON cannot carry comments, so the rationale for forced transitive pins lives here. Prefer
**tilde (`~`) or exact** versions — caret (`^`) lets minors drift under what is meant to be a
hard pin. Dependabot ignores these three names (see `.github/dependabot.yml`) so it does not
open PRs that fight the overrides. Revisit when SceneryStack drops or re-pins them upstream.

| Override | Pin | Why |
|---|---|---|
| `lodash` | `~4.18.1` | SceneryStack declares `~4.17.12`. Bump clears Dependabot/npm advisories patched in 4.18.x (e.g. GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh). |
| `three` | `~0.125.2` | SceneryStack declares `^0.104.0`. Floor is 0.125.0 for GHSA-fq6p-x6j3-cmmq (ReDoS). Staying on the 0.125 line avoids a larger API jump; **0.125.x still has open CVEs** (e.g. XSS GHSA-7vvq-7r29-5vg3, fixed only in ≥0.137.0). Remove this override if/when SceneryStack stops depending on `three` or pins a patched line itself. LightPropagation keeps a higher `three` pin — do not force 0.125 there. |
| `brace-expansion` | `~5.0.9` | Transitive via `vite-plugin-pwa` / Workbox. Clears npm audit (originally GHSA-mh99-v99m-4gvg; keep ≥5.0.9 for GHSA-rgw5-rvv9-x895). |

## Testing

Fleet-standard Vitest layout:

| Path | Purpose |
|---|---|
| `vitest.config.ts` | `happy-dom` environment, `setupFiles`, `execArgv: ["--expose-gc"]` |
| `tests/setup.ts` | Canvas / AudioContext mocks + `init({ name: "…" })` before SceneryStack imports |
| `tests/**/*.test.ts` | Model/physics unit tests — mirror `src/` under `tests/` |
| `tests/memory-leak.test.ts` | WeakRef + `forceGC` dispose regression (fleet pattern) |
| `tsconfig.test.json` | Typecheck config for `tests/` (adds `node` types), run by `npm run check` |

Actual specs:

- `tests/track-lab/model/KinematicsComputer.test.ts`
- `tests/track-lab/model/TrackingModel.test.ts`
- `tests/track-lab/model/TrackRetiming.test.ts` — frame indices re-derived from timestamps on frame-rate change
- `tests/track-lab/model/ModelViewTransformFactory.test.ts` — includes the retransform round-trip (points stay pinned to the same video pixel)
- `tests/track-lab/model/TrackExporter.test.ts`
- `tests/track-lab/model/VideoPlaybackModel.test.ts`
- `tests/track-lab/graph/GraphDataManager.test.ts` — tick spacing stays on the 1-2-5 sequence
- `tests/memory-leak.test.ts` — WeakRef dispose regression, plus listener-count regressions for `PlaybackControlsNode` (an HSlider that is rebuilt but never inserted must still be disposed, or it retains listeners on `currentTimeProperty`)

Run `npm test`. CI runs the suite when a `test` script is present.

`npm run check` typechecks three programs — `src` (root `tsconfig.json`), `scripts`
(`tsconfig.scripts.json`), and `tests` (`tsconfig.test.json`). Vitest transpiles without
typechecking, so a passing `npm test` does not imply the specs typecheck; `npm run check` is what
catches that.

## Commands

```bash
npm run lint && npm run check && npm run build
npm test
npm run generate-svg-icon   # bouncing-ball icon SVG
```

`npm run release` intentionally skips `npm test` in some sims — append `&& npm test` before the version bump so a release cannot ship a failing suite.

## Conventions & deliberate deviations

Extra `src/` root files beyond the standard set, each justified by cross-screen use:
`TrackLabIcons.ts`, `TrackLabButton.ts`, `webcam.ts`, and the `src/tracking/` folder (OpenCV Web Worker).

- **OpenCV WASM** requires COOP/COEP headers (configured in Vite dev + production). Sample videos live in top-level `videos/`, served at `/videos/` by the `serveVideos()` Vite plugin (Range-request support for seeking) and copied to `dist/videos/` on build — they are not under `public/`.
- **Wall-clock timers (allowed exception)** — webcam/video code uses raw `setTimeout`/`setInterval` rather than `stepTimer`: camera-init timeout in `webcam.ts`, FPS-sampling interval in `WebcamPanel.ts`, source-switch debounce in `VideoSourceControlNode.ts`. These track real hardware time, independent of the sim clock.
