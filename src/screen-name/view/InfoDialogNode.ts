/**
 * InfoDialogNode.ts
 *
 * Modal dialog explaining the main steps for digitizing a track in TrackLab.
 * Shown by the InfoButton in the lower-left corner of the screen.
 */

import type { ReadOnlyProperty } from "scenerystack/axon";
import { Node, RichText, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Dialog } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";

// ── Layout constants ──────────────────────────────────────────────────────────
const CONTENT_WIDTH = 370; // inner width of the content area
const TITLE_FONT = new PhetFont({ size: 15, weight: "bold" });
const STEP_TITLE_FONT = new PhetFont({ size: 13, weight: "bold" });
const STEP_BODY_FONT = new PhetFont(13);
const STEPS_SPACING = 12; // vertical gap between steps
const STEP_INNER_SPACING = 2; // gap between step title and body text

// ── Helpers ───────────────────────────────────────────────────────────────────

/** One step: bold heading above a softer-colored description. */
function makeStep(titleProp: ReadOnlyProperty<string>, bodyProp: ReadOnlyProperty<string>): Node {
  const titleText = new Text(titleProp, {
    font: STEP_TITLE_FONT,
    fill: TrackLabColors.textOnDarkProperty,
    maxWidth: CONTENT_WIDTH,
  });

  const bodyText = new RichText(bodyProp, {
    font: STEP_BODY_FONT,
    fill: TrackLabColors.textMutedProperty,
    lineWrap: CONTENT_WIDTH,
  });

  return new VBox({
    children: [titleText, bodyText],
    spacing: STEP_INNER_SPACING,
    align: "left",
  });
}

// ── InfoDialogNode ────────────────────────────────────────────────────────────

/**
 * Modal dialog explaining how to digitize a track.
 *
 * Extends the standard Dialog from scenerystack/sun, which is shown and hidden
 * via show() / hide() and rendered in the sim's popup layer — no manual
 * scene-graph attachment needed.
 */
export class InfoDialogNode extends Dialog {
  public constructor() {
    const strings = StringManager.getInstance().getInfoDialog();

    // ── Title ─────────────────────────────────────────────────────────────
    const titleText = new Text(strings.titleStringProperty, {
      font: TITLE_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });

    // ── Steps ────────────────────────────────────────────────────────────
    const content = new VBox({
      children: [
        makeStep(strings.loadVideoTitleStringProperty, strings.loadVideoBodyStringProperty),
        makeStep(strings.coordinateSystemTitleStringProperty, strings.coordinateSystemBodyStringProperty),
        makeStep(strings.calibrationTitleStringProperty, strings.calibrationBodyStringProperty),
        makeStep(strings.addTrackTitleStringProperty, strings.addTrackBodyStringProperty),
        makeStep(strings.digitizeTitleStringProperty, strings.digitizeBodyStringProperty),
        makeStep(strings.autoTrackTitleStringProperty, strings.autoTrackBodyStringProperty),
      ],
      spacing: STEPS_SPACING,
      align: "left",
    });

    super(content, {
      title: titleText,
      titleAlign: "left",
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: PANEL_CORNER_RADIUS,
      closeButtonColor: TrackLabColors.textOnDarkProperty,
      tandem: Tandem.OPT_OUT,
    });
  }
}

trackLab.register("InfoDialogNode", InfoDialogNode);
