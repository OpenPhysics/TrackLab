# CLAUDE.md — TrackLab

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenPhysics/.github/CLAUDE.md](https://github.com/OpenPhysics/.github/blob/main/CLAUDE.md).

## Project

Browser-based physics video analysis: load or record video, set coordinate system and calibration, auto-track or manually digitize motion, plot kinematics, export CSV.

## Where to work

```
src/screen-name/model/     ← state (TrackingModel, VideoPlaybackModel, OverlayToolsModel, …)
src/screen-name/view/      ← UI (video player, overlays, graph, data table)
src/tracking/OpenCVTracker.ts   ← OpenCV template matching in Web Worker
```

## Constants and colors

- **Colors** → `TrackLabColors.ts` (`ProfileColorProperty` only; no hardcoded rgb/hex in views)
- **Layout** → `TrackLabConstants.ts` (margins, drag speeds, touch dilation)

## Model-view transform

`ModelViewTransformFactory.buildModelViewTransform()` maps real-world units to video pixels from coordinate-system position/rotation and calibration endpoints. `OverlayToolsModel` exposes this as `modelViewTransformProperty`. Moving axes or calibration re-expresses digitized track points so they stay pinned on the video.

## Accessibility

Follows the shared [OpenPhysics accessibility convention](https://github.com/OpenPhysics/Baton/blob/main/ACCESSIBILITY.md).

- A11y strings → `StringManager.getA11y()` (typed control names) and `getA11yStrings()` (full tree incl. screen summary) / `a11y` section in locale JSON
- `SimScreenView` registers `TrackLabScreenSummaryContent` (live current-details) and sets the PDOM traversal order via a wrapper `Node`'s `pdomOrder` (ScreenView forbids `pdomOrder` on itself)
- Interactive nodes need `accessibleName` from a11y properties
- Canvas overlays: `tagName: "div"` + `accessibleName`; data tables need `<caption>` and `aria-label` on headers

## Browser / build notes

- OpenCV WASM requires COOP/COEP headers (configured in Vite dev + production)
- Sample videos in `public/videos/`

## Testing

No test suite at this stage — do not add Vitest/Playwright without an explicit request. APIs are still evolving.

## Sim-specific commands

```bash
npm run generate-svg-icon   # Bouncing-ball icon SVG
```
