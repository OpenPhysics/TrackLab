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

// ── Video display dimensions ───────────────────────────────────────────────────
// Maximum display dimensions for the video element. The actual rendered size
// may be smaller to preserve the source video's aspect ratio.
// Both the OpenCV tracker and all overlay nodes depend on these values.
export const VIDEO_WIDTH = 768;
export const VIDEO_HEIGHT = 432;

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

// Maximum number of simultaneous tracks a user may have active.
// Symbols are never reused: removing track B and adding a new one yields E, not B.
export const MAX_TRACKS = 4;

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

// Minimum icon content area (width × height) guaranteed by HStrut/VStrut inside
// the factory-created content wrapper.  This ensures every icon-only button is
// the same size even when the icon glyph is smaller than this floor.
export const BUTTON_MIN_CONTENT_SIZE = 18;

// Extra touch-target padding beyond the rendered button bounds.  Helps users on
// touch screens reliably tap small buttons without pixel-perfect precision.
export const TOUCH_AREA_DILATION = 5;

// Extra mouse-pointer hit area beyond the rendered button bounds.
export const MOUSE_AREA_DILATION = 2;

// ── Webcam panel ──────────────────────────────────────────────────────────────
export const WEBCAM_PREVIEW_WIDTH = 576; // width of the preview and review video elements (20% bigger)
export const WEBCAM_PREVIEW_HEIGHT = 324; // height of the preview and review video elements (20% bigger)

// ── Overlay tool interaction ───────────────────────────────────────────────────
// Opacity applied to coordinate system and calibration tool overlays while
// the user is actively digitizing, signalling that those tools are locked out.
export const DIGITIZING_DIM_OPACITY = 0.35;

// ── Shared overlay drag speeds ────────────────────────────────────────────────
// Keyboard drag speeds in pixels/second used by all draggable overlays
// (measuring tape, angle tool, calibration tool, coordinate system).
export const OVERLAY_DRAG_SPEED = 200; // normal keyboard drag
export const OVERLAY_SHIFT_DRAG_SPEED = 40; // shift-key fine adjustment

// ── Shared overlay label panel styling ────────────────────────────────────────
// Label panels that float near the measuring tape midpoint and angle tool vertex.
export const LABEL_PANEL_CORNER_RADIUS = 4;
export const LABEL_PANEL_X_MARGIN = 6;
export const LABEL_PANEL_Y_MARGIN = 3;
export const LABEL_PANEL_SCALE = 0.8;

// ── Shared overlay endpoint touch dilation ────────────────────────────────────
export const OVERLAY_TOUCH_DILATION = 12;

// ── Video panel drag & resize ──────────────────────────────────────────────────
// Height of the thin header bar between the source controls and video content.
// This bar is the drag target for moving the video panel.
export const PANEL_HEADER_HEIGHT = 6;

// ── Control panel icon and layout ─────────────────────────────────────────────
// Shared by ControlPanel, MeasurementToolsPanel, and InfoDialogNode.
export const CONTROL_ICON_SIZE = 20;
export const CONTROL_PANEL_ROWS_SPACING = 12;
export const CONTROL_PANEL_X_MARGIN = 12;
export const CONTROL_PANEL_Y_MARGIN = 12;
