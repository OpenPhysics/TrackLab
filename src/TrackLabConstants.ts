/**
 * TrackLabConstants.ts
 *
 * Central repository for numeric constants shared across the application.
 * Component-specific constants that are only used within a single file live
 * at the top of that file instead.
 */

// ── Panel styling ─────────────────────────────────────────────────────────────
// Shared corner radius used by the main side panels.
export const PANEL_CORNER_RADIUS = 8;

// ── Screen layout bounds ───────────────────────────────────────────────────────
// SceneryStack's ScreenView.DEFAULT_LAYOUT_BOUNDS = Bounds2(0, 0, 1024, 618).
const LAYOUT_WIDTH = 1024;

// ── Video display dimensions ───────────────────────────────────────────────────
// The video element is always rendered at this fixed pixel size.
// Both the OpenCV tracker and all overlay nodes depend on these values.
export const VIDEO_WIDTH = 768;
export const VIDEO_HEIGHT = 432;

// ── Video position in screen (layout) coordinates ────────────────────────────
// The video player VBox is top-anchored at y=10.  The source-control row
// (~40 px) plus MAIN_CONTENT_SPACING (10 px) places the video top at ~60 px,
// so the video centre sits at approximately y=276 (keeping same top position as before).
export const VIDEO_PLAYER_Y_OFFSET = -20; // kept for reference; no longer used for positioning
export const VIDEO_CENTER_X = LAYOUT_WIDTH / 2; // 512
export const VIDEO_CENTER_Y = 276; // approximate video centre with top-anchored layout

// ── Initial calibration tool geometry ─────────────────────────────────────────
// Half-length of the default calibration segment (pixels from centre to each endpoint).
export const CALIB_HALF_LENGTH = 100;

// ── Screen layout offsets ─────────────────────────────────────────────────────
export const CONTROL_PANEL_LEFT_MARGIN = 10; // control panel inset from layout left edge
export const TRACK_LIST_LEFT_SPACING = -100; // offset from video right edge (negative moves panels left)
export const DATA_TABLE_TOP_SPACING = 8; // gap between track list bottom and data table
export const RESET_BUTTON_MARGIN = 10; // reset button inset from layout right/bottom edges

// ── Track symbol limits ───────────────────────────────────────────────────────
// Tracks are labelled A–Z using ASCII codes.  These bounds are used both when
// creating a new track and when resetting the session.
export const TRACK_SYMBOL_FIRST_CODE = 65; // ASCII 'A'
export const TRACK_SYMBOL_LAST_CODE = 90; // ASCII 'Z'

// ── Model-view transform precision thresholds ─────────────────────────────────
// Guards against degenerate (zero-length) calibration or pixel distances that
// would produce a singular transform matrix.
export const MIN_PIXEL_DISTANCE = 1e-6; // minimum pixel distance between calibration points
export const MIN_CALIB_DISTANCE = 1e-9; // minimum real-world calibration distance

// ── Button sizing ──────────────────────────────────────────────────────────────
// Shared margins applied to every RectangularPushButton (and TextPushButton) in
// the application, so all rectangular push buttons have a uniform appearance.
export const BUTTON_X_MARGIN = 8;
export const BUTTON_Y_MARGIN = 6;

// ── Webcam panel ──────────────────────────────────────────────────────────────
export const WEBCAM_PREVIEW_WIDTH = 576; // width of the preview and review video elements (20% bigger)
export const WEBCAM_PREVIEW_HEIGHT = 324; // height of the preview and review video elements (20% bigger)

// ── Overlay tool interaction ───────────────────────────────────────────────────
// Opacity applied to coordinate system and calibration tool overlays while
// the user is actively digitizing, signalling that those tools are locked out.
export const DIGITIZING_DIM_OPACITY = 0.35;
