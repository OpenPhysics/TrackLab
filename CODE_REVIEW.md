# TrackLab Code Review

**Date:** 2026-02-20
**Scope:** Full codebase review — architecture, correctness, performance, security, maintainability

---

## Executive Summary

TrackLab is a well-architected browser-based physics video analysis tool built on SceneryStack with a clean reactive state model. The codebase demonstrates strong separation of concerns between model and view layers, consistent use of Axon Properties for reactivity, and immutable update patterns for data structures. Key areas for improvement center on **inconsistent resource cleanup**, **missing input validation in the OpenCV tracking pipeline**, **verbose kinematics computation**, and **several edge cases that could cause silent failures or subtle data corruption**.

---

## 1. Architecture & Design

### Strengths

- **Clean model-view separation.** `SimModel.ts` contains zero UI imports; all reactive state lives as Axon Properties, and views observe them declaratively. This is textbook reactive architecture.
- **Immutable data flow.** Track mutations create new arrays/objects rather than mutating in place (`SimModel.ts:403-411`), preventing stale reference bugs.
- **Centralized configuration.** Colors (`TrackLabColors.ts`) and constants (`TrackLabConstants.ts`) are consolidated, making theme changes and layout adjustments straightforward.
- **Dual color profiles.** The `profileColor()` factory in `TrackLabColors.ts` cleanly supports both dark and projector modes with zero runtime branching in view code.
- **Smart incremental DOM updates.** `DataTableNode.ts:495-575` detects structural vs. data-only changes to avoid full DOM rebuilds during 30 Hz auto-tracking — a critical performance optimization.

### Design Concerns

| Priority | Issue | Location | Description |
|----------|-------|----------|-------------|
| Moderate | View-layer validation | `CoordinateSystemNode.ts:155-173` | Bounds clamping uses an `isClamping` re-entrancy flag in the view to prevent feedback loops when reassigning the model property. This validation belongs in the model layer (e.g., a custom Property subclass or a guard in the setter), not the view. The flag-based approach is fragile and would break if a second listener also writes to the same property. |
| Moderate | Feature stubs in model | `SimModel.ts:341-342` | `magnifyVideoProperty` and `autoTrackingProperty` are declared as `BooleanProperty` but unused by any model logic. Dead state in the model layer adds confusion — these should either be implemented or removed. |
| Minor | Graph file size | `GraphInteractionHandler.ts` (~1,150 lines) | This file handles mouse, touch, keyboard, pinch-zoom, axis drag, and resize gestures in a single class. While internally well-organized, it would benefit from being split into focused handlers (e.g., `PanHandler`, `ZoomHandler`, `ResizeHandler`) to improve testability and reduce cognitive load. |

---

## 2. Code Quality

### Strengths

- Consistent naming conventions throughout (`*Property` for reactive state, `*Node` for UI components).
- Good use of TypeScript types — `Track.ts` uses pure type definitions with `readonly` arrays and explicit `null` for uncomputable values.
- Comments are generally meaningful and explain "why," not just "what."
- Constants are extracted and named (`SPEED_FAST`, `MIN_REGION_SIZE`, etc.) rather than left as magic numbers in most places.

### Issues

| Priority | Issue | Location | Description |
|----------|-------|----------|-------------|
| Moderate | Verbose kinematics with heavy duplication | `SimModel.ts:117-246` | `computeTrackKinematics()` spans ~130 lines with near-identical null-checking across velocity and acceleration computation. The forward/backward/central difference logic is copy-pasted three times for each derivative. A single `finiteDifference(getValue, getTime, index, length)` helper would halve the line count and eliminate the duplication. |
| Moderate | Inconsistent `link` vs. `lazyLink` usage | Multiple files | Some property listeners use `link` (fires immediately with current value) and others use `lazyLink` (skips initial). The pattern varies across files without clear rationale. For example, `PlaybackControlsNode.ts:54` uses `link` for view→model sync but `:59` uses `lazyLink` for model→view. This creates potential initialization ordering bugs if a third party also listens to `playbackRateProperty`. |
| Minor | Magic numbers in constants file | `TrackLabConstants.ts:13` | `VIDEO_CENTER_Y = 289` is derived from `(618 / 2) + (-20)` but the source layout bounds (1024 × 618) are not defined as constants. Expressing it as a formula would be self-documenting: `const VIDEO_CENTER_Y = LAYOUT_HEIGHT / 2 + VIDEO_PLAYER_Y_OFFSET;` |
| Minor | `StringManager` boilerplate | `StringManager.ts:45-356` | Each category getter method is structurally identical. A generic `getCategory<K>()` method or code generation would eliminate ~300 lines of repetitive accessor code. |

---

## 3. Bugs & Correctness

### Critical

**3.1 — OpenCV region dimensions not validated for negative/zero values**
`OpenCVTracker.ts:185-192`

The template initialization clamps the region origin to `>= 0` but never validates that width and height are positive *after* clamping. If `region.w` or `region.h` is zero or negative (e.g., a degenerate selection box), `Math.min()` could produce a zero or negative dimension, which OpenCV's `roi()` does not handle gracefully and will crash the WASM module.

```typescript
// Current code — no width/height validation
const clampedX = Math.round(Math.max(0, region.x));
const clampedY = Math.round(Math.max(0, region.y));
const roi = new cv.Rect(
  clampedX, clampedY,
  Math.round(Math.min(region.w, this.offscreen.width - clampedX)),
  Math.round(Math.min(region.h, this.offscreen.height - clampedY)),
);
```

**Fix:** Add explicit dimension validation before constructing the `Rect`:

```typescript
const roiW = Math.round(Math.min(region.w, this.offscreen.width - clampedX));
const roiH = Math.round(Math.min(region.h, this.offscreen.height - clampedY));
if (roiW <= 0 || roiH <= 0) {
  throw new Error(`Invalid ROI dimensions: ${roiW}x${roiH}`);
}
const roi = new cv.Rect(clampedX, clampedY, roiW, roiH);
```

### Moderate

**3.2 — Duplicate point silently rejected without update option**
`SimModel.ts:461`

When `addPointToTrack()` encounters a duplicate frame number, it silently returns the existing track unchanged. If a user re-digitizes a point at the same frame (to correct a misclick), the new coordinates are discarded without any feedback. The user sees the crosshair placed at the new position but the data table retains the old value.

**Suggestion:** Either update the existing point's coordinates (replace semantics) or return a status indicating the point was rejected so the view can display feedback.

**3.3 — `prevModelViewTransform` never reset on `reset()`**
`SimModel.ts:470-493`

The `reset()` method resets all properties but does not set `prevModelViewTransform` back to `null`. On the next `modelViewTransformProperty` change after reset, the stale cached transform is used to reproject points. In practice, this is safe because `tracksProperty` is also cleared, so the reprojection loop has nothing to iterate over. However, the logic is fragile — if `reset()` is ever modified to preserve tracks, this becomes a data corruption bug.

**Fix:** Add `this.prevModelViewTransform = null;` to `reset()`.

**3.4 — Auto-tracker creates track during async gap**
`AutoTrackerNode.ts:188-199`

When auto-tracking starts without an active track, a new track is created synchronously and then `initFromVideo()` is called asynchronously. If the user removes tracks during the WASM load, the auto-tracker's `activeTrackIdProperty` still references the now-deleted track, and subsequent `addPointToTrack()` calls silently fail (the `map()` in `SimModel.ts:453` finds no matching track).

**Suggestion:** Verify the track still exists when the async `initFromVideo()` resolves, before beginning frame-by-frame tracking.

**3.5 — X-axis drag direction inverted relative to Y-axis**
`GraphInteractionHandler.ts:544` vs `:770`

Y-axis drag uses `+deltaY` to compute model offset, while X-axis drag uses `-deltaX`. This means dragging right moves the X-axis view *left* (natural scrolling), but dragging down moves the Y-axis view *down* (direct scrolling). The inconsistency could confuse users. If intentional, it should be documented with a comment explaining the UX rationale.

### Minor

**3.6 — `canAddTrackProperty` off-by-one on boundary**
`SimModel.ts:424-425`

After incrementing `nextSymbolCode`, the check is `nextSymbolCode <= TRACK_SYMBOL_LAST_CODE`. When `nextSymbolCode` becomes 91 (one past 'Z'), `canAddTrackProperty` is set to `false`, which is correct. However, the guard at line 417 (`if (this.nextSymbolCode > TRACK_SYMBOL_LAST_CODE) return`) means the 26th track *is* created successfully but the button disables *after* creation. This is the correct behavior, but only because both checks happen to agree on the boundary. A single `MAX_TRACKS = 26` constant would make the invariant explicit.

**3.7 — Floating-point frame rounding inconsistency**
`PlaybackControlsNode.ts:130` vs `AutoTrackerNode.ts:249`

The playback controls compute frame number as `Math.round(time / frameDuration)`, while the auto-tracker uses `Math.round(time * frameRate)`. At non-integer frame rates like 29.97 fps, `1/29.97 * 29.97 !== 1.0` due to IEEE 754 arithmetic. The auto-tracker's comment (lines 245-248) correctly explains why multiplication is preferred. The playback controls should use the same approach for consistency:

```typescript
// Before (playback controls)
const current = Math.round(time / frameDuration);
// After
const current = Math.round(time * model.frameRateProperty.value);
```

---

## 4. Performance

| Priority | Issue | Location | Description |
|----------|-------|----------|-------------|
| Moderate | Full kinematics recomputation on every track change | `SimModel.ts` (trackKinematicsProperty) | `trackKinematicsProperty` is a `DerivedProperty` that recomputes kinematics for *all* tracks whenever *any* track changes. Adding a single point to one track triggers O(N) differentiation across all tracks. For sessions with many long tracks, this could cause frame drops. **Suggestion:** Cache kinematics per track ID and only recompute for the modified track. |
| Moderate | `Array.shift()` in auto-tracker trail | `AutoTrackerNode.ts:238` | The trail array uses `shift()` to remove the oldest point when exceeding `MAX_TRAIL = 150`. `Array.shift()` is O(n) because it reindexes all elements. At 30 fps this runs 30 times/second. A circular buffer (ring buffer with head/tail indices) would make this O(1). |
| Minor | Dual property links trigger double geometry update | `CalibrationToolNode.ts:241-242` | Both `calibPoint1Property` and `calibPoint2Property` are individually linked to `updateGeometry()`. When both change in the same synchronous batch (e.g., during a reset), the geometry is rebuilt twice. Using `Multilink` would coalesce this into a single update. |
| Minor | DOM `innerHTML = ""` for table clearing | `DataTableNode.ts:463` | Setting `innerHTML = ""` forces the browser to parse an empty HTML string. `while (el.firstChild) el.removeChild(el.firstChild)` or `el.replaceChildren()` is marginally faster and avoids HTML parser overhead. |

---

## 5. Security

| Priority | Issue | Location | Description |
|----------|-------|----------|-------------|
| Critical | Unvalidated ROI dimensions can crash WASM | `OpenCVTracker.ts:185-192` | See Bug 3.1 above. A malformed region could cause an out-of-bounds read in the OpenCV WASM module. While this is a client-side crash (not a remote exploit), it produces an unrecoverable error that requires page reload. |
| Minor | Cross-origin video errors silently swallowed | `OpenCVTracker.ts:214-216` | The `catch` block in `track()` returns `null` without logging. If a user loads a cross-origin video, tracking silently fails with no feedback. Consider at minimum a `console.warn()`. |
| Minor | `as any` type casting for WASM module | `OpenCVTracker.ts:75-76` | The OpenCV WASM module is loaded with `as any` to bypass TypeScript. If the OpenCV API changes between versions, method calls could fail at runtime with cryptic errors. Consider defining a minimal interface type and validating the loaded module shape. |

---

## 6. Maintainability

### Resource Cleanup (Memory Leaks)

This is the most significant maintainability concern. Several components register property listeners but never unlink them:

| File | Has `dispose()`? | Leaked Listeners |
|------|:-:|---|
| `VideoPlayerNode.ts` | Yes | Properly cleans up all listeners |
| `AutoTrackerNode.ts` | Yes | Properly cleans up all listeners |
| `DigitizingOverlayNode.ts` | Yes | Properly cleans up all listeners |
| `DataTableNode.ts` | Yes | Properly cleans up all listeners |
| `TrackListPanel.ts` | Yes | Properly cleans up all listeners |
| `KinematicsGraphNode.ts` | Yes | Properly cleans up all listeners |
| **`PlaybackControlsNode.ts`** | **No** | `timeSpeedProperty.link()` at line 54, `model.playbackRateProperty.lazyLink()` at line 59, `model.currentTimeProperty.lazyLink()` at line 103 |
| **`CoordinateSystemNode.ts`** | **No** | `model.coordOriginProperty.link()` at line 146, `.lazyLink()` at line 156, `model.coordAngleProperty.link()` at line 149 |
| **`CalibrationToolNode.ts`** | **No** | `model.calibPoint1Property.link()`, `model.calibPoint2Property.link()` at lines 241-242, plus visibility links |

In the current application, these components are created once and live for the entire session, so the leaks are benign. However, if the application ever supports multiple screens, hot-reloading, or dynamic component creation, these become real memory leaks.

**Recommendation:** Add `dispose()` overrides to `PlaybackControlsNode`, `CoordinateSystemNode`, and `CalibrationToolNode` that unlink all registered listeners. Even if not currently needed, this establishes a consistent cleanup pattern.

### WebcamPanel Timer Leak

`WebcamPanel.ts:480-501`

The recording timer (`setInterval`) is tracked in `this.timerInterval` and cleared in `stopTimer()`. However, if the component is disposed while recording is active (e.g., user navigates away), `stopTimer()` is never called and the interval continues running indefinitely. The `cleanup()` method (called on dialog close) should explicitly call `stopTimer()`.

### Test Coverage

Per project instructions, there is no test suite and none should be added at this stage. This is a reasonable decision for a rapidly evolving codebase, but it increases the importance of defensive coding practices (input validation, null checks, explicit error handling) since there is no automated safety net.

### Localization

The i18n system (`StringManager.ts`, `strings_en.json`, `strings_fr.json`) works correctly but has no compile-time validation that both language files contain the same keys. If a key is added to English but not French, the application would show `undefined` at runtime. A build-time script that validates key parity between language files would prevent this.

---

## Summary of Findings by Priority

### Critical (3 issues)
1. **OpenCV ROI dimension validation** — negative/zero dimensions can crash WASM (`OpenCVTracker.ts:185-192`)
2. **Duplicate point rejection without feedback** — user data silently discarded (`SimModel.ts:461`)
3. **Missing `dispose()` on 3 view components** — establishes inconsistent cleanup pattern

### Moderate (7 issues)
4. View-layer clamping should be model-layer validation (`CoordinateSystemNode.ts:155-173`)
5. Verbose, duplicated kinematics code (`SimModel.ts:117-246`)
6. Full kinematics recomputation on any track change (performance)
7. `prevModelViewTransform` not reset in `reset()` (`SimModel.ts:470-493`)
8. Auto-tracker race condition with track deletion (`AutoTrackerNode.ts:188-199`)
9. X/Y axis drag direction inconsistency (`GraphInteractionHandler.ts:544` vs `:770`)
10. WebcamPanel timer not cleared on dispose (`WebcamPanel.ts:480-501`)

### Minor (6 issues)
11. Floating-point frame rounding inconsistency (`PlaybackControlsNode.ts:130`)
12. `Array.shift()` for trail instead of circular buffer (`AutoTrackerNode.ts:238`)
13. Double geometry update from dual property links (`CalibrationToolNode.ts:241-242`)
14. Magic number for `VIDEO_CENTER_Y` (`TrackLabConstants.ts:13`)
15. Cross-origin errors silently swallowed (`OpenCVTracker.ts:214-216`)
16. No i18n key parity validation between language files
