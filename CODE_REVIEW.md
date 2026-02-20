# TrackLab — Comprehensive Code Review

**Date:** 2026-02-20
**Codebase:** ~7,650 lines of TypeScript across 30 source files
**Framework:** SceneryStack (PhET simulation framework) + OpenCV.js + FFmpeg WASM

---

## 1. Architecture & Design

### Overall Structure

TrackLab follows a clean **Model-View** separation:

```
src/
├── screen-name/model/   ← Reactive state (Axon Properties)
├── screen-name/view/    ← SceneryStack UI nodes
├── screen-name/graph/   ← Configurable graphing subsystem
├── tracking/            ← OpenCV template-matching pipeline
├── i18n/                ← Localization (EN/FR)
├── preferences/         ← User preferences
└── *.ts                 ← Bootstrap, colors, constants, namespace
```

**Strengths:**
- Reactive state management via Axon `Property` objects is well-applied. Views observe model properties and update automatically, avoiding imperative sync bugs.
- The model-view transform invariant (`SimModel.ts:377-398`) is well-designed: when the coordinate system or calibration changes, track points are reprojected to stay at the same pixel positions, preserving user intent.
- Immutable data patterns throughout — tracks and kinematics use spread operators to create new arrays/objects rather than mutating in place.
- Finite differences for kinematics (central differences at interior points, forward/backward at endpoints) are numerically sound.

**Weaknesses:**
- The graph subsystem (`src/screen-name/graph/`, 2,449 lines) is disproportionately complex compared to the rest of the app. `GraphInteractionHandler.ts` alone is 1,150 lines with touch/mouse/keyboard gesture handling tightly coupled.
- No dependency injection or service layer — `SimModel` directly instantiates `OpenCVTracker`, making it hard to test or swap implementations.
- `SimScreenView.ts` acts as a "god object" that instantiates all 12+ child nodes. As the app grows, this file will become a bottleneck.

---

## 2. Code Quality

### Readability & Naming

- **Consistent property naming:** All reactive properties end with `Property` suffix (`isPlayingProperty`, `frameRateProperty`, `coordOriginProperty`). Boolean properties use `is`/`can` prefixes.
- **Physics variable names:** Local variables use standard physics abbreviations (`vx`, `vy`, `ax`, `ay`, `dt`, `s`) which is appropriate for the domain.
- **Color naming:** `TrackLabColors.ts` uses descriptive, hierarchical names (`panelFillProperty`, `axisXColorProperty`, `calibrationStrokeProperty`).

### Issues

| Priority | File | Line | Issue |
|----------|------|------|-------|
| **Minor** | `KeyboardShorcutsNode.ts` | — | **Filename typo:** `Shorcuts` instead of `Shortcuts`. This file (72 lines, the more comprehensive version) is **dead code** — `main.ts:11` imports from `KeyboardShortcutsNode.ts` (22 lines, the simpler version). The better implementation is unused. |
| **Minor** | `SimModel.ts` | 420 | `localeCompare()` for single-letter track symbols is locale-dependent. Use `charCodeAt()` comparison for deterministic ASCII ordering. |
| **Minor** | `GraphInteractionHandler.ts` | 600-601 | Hard-coded magic numbers `60` and `30` for axis interaction widths duplicate constants `Y_AXIS_INTERACTION_WIDTH` and `X_AXIS_INTERACTION_HEIGHT` defined in `ConfigurableGraph.ts:273-274`. |

---

## 3. Bugs & Correctness

### Critical

**3.1 — NaN values pass through graph data filtering**
`ConfigurableGraph.ts:691-701`

```typescript
private getValueForAxis(axisProperty: PlottableProperty, point: SubStepDataPoint): number | null {
  if (axisProperty.subStepAccessor) {
    return axisProperty.subStepAccessor(point);  // Can return NaN
  }
  return axisProperty.property.value;  // Never returns null
}
```

The return type declares `number | null`, but when `subStepAccessor` returns `NaN` (which it will — `KinematicsGraphNode.ts:310-315` maps null kinematics to `Number.NaN`), the caller at line 675 checks `if (x !== null && y !== null)` which passes for NaN. NaN data points are added to the graph, causing rendering artifacts and incorrect axis range calculations.

**Fix:** Add `Number.isFinite()` check:
```typescript
const x = this.getValueForAxis(xProperty, point);
const y = this.getValueForAxis(yProperty, point);
if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
```

---

**3.2 — Y-axis pan direction is inverted**
`GraphInteractionHandler.ts:417`

```typescript
// Y-axis single touch pan (MISSING negative sign)
const modelDeltaY = deltaY * (initialYRange.getLength() / this.graphHeight);

// Compare: X-axis has correct negative sign (line 644)
const modelDeltaX = -deltaX * (initialXRange.getLength() / this.graphWidth);
```

Dragging down on the Y-axis pans values upward instead of downward. The X-axis correctly negates the delta.

**Fix:**
```typescript
const modelDeltaY = -deltaY * (initialYRange.getLength() / this.graphHeight);
```

---

### Moderate

**3.3 — Zoom buttons don't persist manual zoom**
`GraphInteractionHandler.ts:1079-1093`

```typescript
public zoomIn(): void {
  const centerPoint = new Vector2(this.graphWidth / 2, this.graphHeight / 2);
  this.zoom(this.zoomFactor, centerPoint, false);  // false = don't set manual flag
}
```

The zoom-in/zoom-out buttons pass `false` for `setManualFlag`, meaning auto-rescaling will override the user's zoom as soon as new data arrives. Mouse wheel zoom correctly sets the manual flag. Users clicking zoom buttons will see their zoom immediately undone.

**Fix:** Pass `true` for `setManualFlag`, or remove the parameter and always set it on explicit user action.

---

**3.4 — Coordinate system can be dragged off-screen**
`CoordinateSystemNode.ts:131-136`

The drag handler updates `coordOriginProperty` without bounds checking. Users can drag the coordinate system origin entirely off the video area, making it unrecoverable without reset.

**Fix:** Clamp the origin to the video bounds in the drag handler.

---

**3.5 — Calibration endpoints can overlap (zero distance)**
`CalibrationToolNode.ts`

Calibration endpoints can be placed at the same pixel position, resulting in `pixelDist ≈ 0`. While `buildModelViewTransform()` guards against this with `MIN_PIXEL_DISTANCE`, the identity transform fallback silently breaks the coordinate system without user feedback.

**Fix:** Add visual feedback (red highlight, warning text) when calibration distance is below threshold.

---

**3.6 — AutoTracker race condition on re-initialization**
`AutoTrackerNode.ts:194-202`

`initFromVideo()` is async. If the user selects a new tracking region while the previous initialization is still running, both tracker instances may run simultaneously, producing conflicting results.

**Fix:** Cancel/abort the previous initialization before starting a new one.

---

**3.7 — Dead keyboard shortcuts file — wrong implementation is used**
`main.ts:11` imports from `KeyboardShortcutsNode.ts` (22 lines), which only shows generic `BasicActionsKeyboardHelpSection` and `MoveDraggableItemsKeyboardHelpSection`. The more comprehensive implementation in `KeyboardShorcutsNode.ts` (72 lines) — with simulation controls (play/pause, step forward/backward) and graph interactions (zoom, pan, reset) — is never imported due to the filename typo.

**Fix:** Delete the simpler `KeyboardShortcutsNode.ts`, rename `KeyboardShorcutsNode.ts` to `KeyboardShortcutsNode.ts`, and update the import in `main.ts`.

---

### Minor

**3.8 — CSV decimal precision mismatch**
`DataTableNode.ts:34-35`

```typescript
const CSV_DECIMALS = 4;
const DISPLAY_DECIMALS = 3;
```

Exported CSV uses 4 decimal places while the on-screen table shows 3. Users may be confused when exported data doesn't match what they see.

---

**3.9 — Track color palette only covers 8 of 26 possible tracks**
`TrackLabColors.ts`

`TRACK_COLORS` has 8 entries, but tracks go A-Z (26 possible). Colors wrap via modulo, so Track I gets the same color as Track A. No visual distinction.

---

**3.10 — Frame rounding may miss or duplicate frames**
`AutoTrackerNode.ts:226`

```typescript
Math.round(time / frameDuration)
```

At frame boundaries, floating-point rounding could assign two adjacent timestamps to the same frame number, or skip a frame entirely. This is exacerbated by 29.97 fps where `frameDuration` is a repeating decimal.

---

## 4. Performance

| Priority | File | Line | Issue |
|----------|------|------|-------|
| **Moderate** | `GraphDataManager.ts` | 245-289 | `updateTrail()` destroys and recreates all Circle nodes on every call. Called in 11+ code paths (pan, zoom, resize, data add). Should maintain a pool of Circle nodes and update positions only. |
| **Moderate** | `KinematicsGraphNode.ts` | 306-316 | Creates a new `SubStepDataPoint[]` array on every graph update. With up to 5,000 points, this generates significant GC pressure. Consider reusing the array. |
| **Moderate** | `OpenCVTracker.ts` | `track()` | Creates 3 new OpenCV `Mat` objects per frame (frame, gray, result). These are freed correctly, but per-frame allocation through WASM is expensive. Consider reusing buffers across frames. |
| **Minor** | `DigitizingOverlayNode.ts` | 132-150 | Recalculates aspect ratio on every magnifier update. This could be cached and only recomputed when the video dimensions change. |
| **Minor** | `SimModel.ts` | 377-398 | When the model-view transform changes, ALL track points are reprojected (O(n) per track). For large tracks this is fine, but the operation triggers on every coordinate system drag, which fires continuously. Consider debouncing. |

---

## 5. Security

| Priority | File | Issue |
|----------|------|-------|
| **Moderate** | `OpenCVTracker.ts` | **CORS vulnerability:** `canvas.getContext('2d').drawImage(video)` followed by pixel access will throw a `SecurityError` if the video source is cross-origin without proper CORS headers. No try/catch around this path. |
| **Minor** | `DataTableNode.ts:413-419` | CSV export uses `document.createElement('a')` with a blob URL for download. The pattern is standard but the link element is appended to `document.body` and removed synchronously — in rare cases the click may not fire before removal. Use `link.click()` without DOM insertion (supported in modern browsers). |
| **Minor** | `webcam.ts` | Blob URLs are properly revoked in cleanup paths. However, if `onloadedmetadata` fires after `cleanup()` is called (race condition), the handler may reference a revoked URL. |
| **Info** | `i18n/StringManager.ts` | Localized strings are used via `textContent` and SceneryStack `Text` nodes (not `innerHTML`), so XSS from string injection is not a concern. |

---

## 6. Maintainability

### Test Coverage

**There are zero tests.** No `*.test.ts`, `*.spec.ts`, or test directories exist anywhere in the project. No test framework (Jest, Vitest, Mocha) is configured.

This is the single largest maintainability risk. Key pure functions that are highly testable:
- `buildModelViewTransform()` — geometric transform composition
- `computeTrackKinematics()` — finite differences, null propagation
- `generateCSV()` — data formatting
- `OpenCVTracker` — template matching pipeline (can be tested with fixture images)

### Disposal / Memory Management

`dispose()` is implemented in only 8 of 30 source files (67 total occurrences). Notable missing disposals:

| File | Issue |
|------|-------|
| `SimScreenView.ts` | No dispose method. DerivedProperty listeners and child node links never cleaned up. |
| `CoordinateSystemNode.ts` | Property links at lines 131-136 never unlinked. |
| `CalibrationToolNode.ts` | Property links never unlinked. |
| `PlaybackControlsNode.ts` | `timeSpeedProperty` link never unlinked. |
| `ConfigurableGraph.ts` | 150+ properties created, no dispose method. |

For a single-screen app that never destroys and recreates the view, this is tolerable. But if screens are ever swapped or components toggled, these will become real memory leaks.

### Documentation

- `CLAUDE.md` is excellent — clear project overview, file responsibilities, and development commands.
- Inline code comments are good in the model layer (especially `buildModelViewTransform` and `computeTrackKinematics`).
- The graph subsystem has sparse comments relative to its complexity.
- No API documentation or JSDoc on public methods.

### Localization

- English and French strings are complete and structurally matched.
- However, some UI strings are hard-coded: `KeyboardShorcutsNode.ts` uses localized strings from `StringManager`, but the active `KeyboardShortcutsNode.ts` uses only SceneryStack defaults (no localization).
- `CalibrationToolNode.ts:96` hard-codes the pattern `"{{min}} – {{max}} {{unit}}"` which may not be correct for RTL languages.

---

## 7. Summary

### Strengths

1. **Clean reactive architecture** — Axon Property-based state management is well-applied and consistent across the entire codebase. Views never manually sync with model state.
2. **Numerically sound physics** — The model-view transform composition, kinematics computation via finite differences, and coordinate system invariant maintenance are mathematically correct and well-documented.
3. **Good resource management** — OpenCV WASM loading with timeout/retry, blob URL revocation, video element cleanup, and webcam stream teardown are handled carefully.
4. **Comprehensive feature set** — For ~7,650 lines, the app covers video playback, webcam recording, manual/auto tracking, calibration, kinematics computation, data export, and interactive graphing.

### Top 3 Recommended Improvements

**1. Add a test suite (Critical)**
Zero test coverage is the highest-risk issue. Start with unit tests for the pure functions: `buildModelViewTransform`, `computeTrackKinematics`, and `generateCSV`. These are deterministic, have clear inputs/outputs, and encode the most critical domain logic. Add Vitest (already using Vite) with ~20 tests to cover the core math.

**2. Fix the NaN data propagation in the graph pipeline (Critical)**
`ConfigurableGraph.getValueForAxis()` allows NaN values through the `null` check, corrupting graph rendering and axis range calculations. Add `Number.isFinite()` guards at the data entry point. This is a one-line fix with high impact.

**3. Fix the dead keyboard shortcuts file (Moderate)**
The comprehensive keyboard shortcuts implementation (`KeyboardShorcutsNode.ts`) is unused due to a filename typo. The app ships with only generic SceneryStack shortcuts instead of the TrackLab-specific ones (play/pause, frame stepping, graph interactions). Rename the file and update the import.
