# TrackLab — Claude Code Guide

## Project overview

TrackLab is a browser-based physics video analysis tool. Users load a video, place a coordinate system, calibrate real-world distances, and auto-track objects across frames using OpenCV.

## Where to work

Most feature development happens in two directories:

```
src/screen-name/model/     ← application state
src/screen-name/view/      ← all UI components
```

## Constants and colors

- **Colors**: All UI colors live in `TrackLabColors.ts` as `ProfileColorProperty` instances for automatic dark/light theme switching. When adding a new color, create it there — never hardcode `rgb(…)` or hex strings in view files.
- **Layout constants**: Shared numeric constants (panel margins, drag speeds, touch dilation) live in `TrackLabConstants.ts`. File-local constants that are used only within a single view file can remain local, but any constant duplicated across two or more files should be hoisted to `TrackLabConstants.ts`.


## Accessibility

- **Localized a11y strings**: All accessibility text lives in `StringManager.getA11y()` backed by the `a11y` section in `strings_en.json` / `strings_fr.json`. Never hardcode English strings for `accessibleName` or `aria-label`.
- **Interactive elements**: Every interactive SceneryStack node (button, checkbox, draggable handle) must have an `accessibleName` sourced from the a11y string properties.
- **Canvas overlays**: Non-interactive overlay containers that wrap a Canvas or DOM element should have `tagName: "div"` and an `accessibleName` so screen readers can identify them.
- **HTML tables**: Use `<caption>` (visually hidden) and `aria-label` on `<th>` elements for data tables.

## Testing

There is currently **no test suite**, and none should be added at this stage. The codebase is evolving rapidly — APIs, model structure, and UI components change frequently enough that maintaining tests would cost more than they save right now. Do not install a test framework or create test files.
