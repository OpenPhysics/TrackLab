/**
 * TrackLabButton.ts
 *
 * Factory function and icon helpers for all RectangularPushButton instances in
 * TrackLab.  A single factory ensures every button shares the same flat
 * appearance, base colour, margins, and touch/mouse target sizes, while still
 * allowing per-call overrides for special cases (e.g. record/stop/success
 * colours, enabled properties).
 *
 * Usage:
 *   import { createTrackLabButton, makeDownloadIcon } from '../../TrackLabButton.js';
 *
 *   const btn = createTrackLabButton(makeDownloadIcon(), {
 *     accessibleName: strings.downloadVideoStringProperty,
 *     listener: () => { ... },
 *   });
 *
 *   // Override base colour for a special action:
 *   const recordBtn = createTrackLabButton(recordIcon, {
 *     baseColor: TrackLabColors.buttonRecordProperty,
 *     listener: () => startRecording(),
 *   });
 */

import { Shape } from "scenerystack/kite";
import { HStrut, Node, Path, VStrut } from "scenerystack/scenery";
import { ButtonNode, RectangularPushButton } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "./TrackLabColors.js";
import {
  BUTTON_MIN_CONTENT_SIZE,
  BUTTON_X_MARGIN,
  BUTTON_Y_MARGIN,
  MOUSE_AREA_DILATION,
  TOUCH_AREA_DILATION,
} from "./TrackLabConstants.js";

// ── Types ─────────────────────────────────────────────────────────────────────

type PushButtonOptions = ConstructorParameters<typeof RectangularPushButton>[0];

/**
 * Options accepted by createTrackLabButton.
 * `content` is excluded because it is supplied as the first argument.
 */
export type TrackLabButtonOptions = Omit<PushButtonOptions, "content">;

// ── Content sizing ────────────────────────────────────────────────────────────

/**
 * Wrap an icon node with HStrut/VStrut so the content area is at least
 * BUTTON_MIN_CONTENT_SIZE × BUTTON_MIN_CONTENT_SIZE.  The icon is centred
 * within this minimum area so that small glyphs sit squarely in the middle
 * of the button rather than in a corner.
 *
 * If `icon` is already larger than the minimum (e.g. a wide text label), the
 * struts have no visible effect and the button sizes naturally to the content.
 */
function sizeContent(icon: Node): Node {
  icon.centerX = BUTTON_MIN_CONTENT_SIZE / 2;
  icon.centerY = BUTTON_MIN_CONTENT_SIZE / 2;
  return new Node({
    children: [new HStrut(BUTTON_MIN_CONTENT_SIZE), new VStrut(BUTTON_MIN_CONTENT_SIZE), icon],
  });
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a standard TrackLab rectangular push button.
 *
 * Defaults applied (all overridable via `options`):
 *  - Flat appearance strategy
 *  - Dark base colour (`buttonBaseDarkProperty`)
 *  - Consistent x/y margins from TrackLabConstants
 *  - Enlarged touch area (TOUCH_AREA_DILATION on each side)
 *  - Enlarged mouse area (MOUSE_AREA_DILATION on each side)
 *  - Tandem opted out
 *
 * The content is always wrapped with HStrut/VStrut to guarantee a minimum
 * icon area so that all icon buttons share identical dimensions.
 */
export function createTrackLabButton(content: Node, options?: TrackLabButtonOptions): RectangularPushButton {
  return new RectangularPushButton({
    // ── Defaults ────────────────────────────────────────────────────────────
    baseColor: TrackLabColors.buttonBaseDarkProperty,
    buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
    xMargin: BUTTON_X_MARGIN,
    yMargin: BUTTON_Y_MARGIN,
    touchAreaXDilation: TOUCH_AREA_DILATION,
    touchAreaYDilation: TOUCH_AREA_DILATION,
    mouseAreaXDilation: MOUSE_AREA_DILATION,
    mouseAreaYDilation: MOUSE_AREA_DILATION,
    tandem: Tandem.OPT_OUT,
    // ── Caller overrides ────────────────────────────────────────────────────
    ...options,
    // ── Content: always the min-sized wrapper ────────────────────────────────
    content: sizeContent(content),
  });
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

/**
 * Download icon: downward arrow with a tray bar.
 *
 * Replaces the plain ⬇ unicode glyph with a proper symbolic Path icon that
 * scales cleanly at all sizes and renders crisply regardless of font hinting.
 *
 *   | shaft |
 *  \  arrow  /
 *   \_head__/
 *  [=tray bar=]
 */
export function makeDownloadIcon(): Node {
  const totalW = 12; // total icon width
  const shaftW = 4; // width of the vertical arrow shaft
  const shaftH = 5; // height of the shaft above the arrowhead
  const headH = 4; // height of the arrowhead triangle
  const gap = 1; // gap between arrowhead tip and tray bar
  const barH = 2; // height of the tray bar

  const shape = new Shape();

  // Vertical shaft (centered horizontally)
  shape.rect((totalW - shaftW) / 2, 0, shaftW, shaftH);

  // Arrowhead triangle (pointing down)
  shape.moveTo(0, shaftH);
  shape.lineTo(totalW / 2, shaftH + headH);
  shape.lineTo(totalW, shaftH);
  shape.close();

  // Tray bar at bottom
  shape.rect(0, shaftH + headH + gap, totalW, barH);

  return new Path(shape, { fill: TrackLabColors.textOnDarkProperty });
}

/**
 * Upload icon: folder shape indicating "open a file".
 */
export function makeUploadIcon(): Node {
  const folderShape = new Shape()
    .moveTo(0, 3)
    .lineTo(4, 3)
    .lineTo(5.5, 0)
    .lineTo(14, 0)
    .lineTo(14, 10)
    .lineTo(0, 10)
    .close();
  return new Path(folderShape, { fill: TrackLabColors.textOnDarkProperty });
}
