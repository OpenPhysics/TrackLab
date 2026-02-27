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

import { HStrut, Node, VStrut } from "scenerystack/scenery";
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

// Re-export all icon factories from the central icons module so that existing
// imports of the form `import { makeDownloadIcon } from "…/TrackLabButton.js"`
// continue to work without modification.
// biome-ignore lint/performance/noBarrelFile: intentional re-export for API compatibility
export { makeDownloadIcon, makeUploadIcon } from "./TrackLabIcons.js";

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
