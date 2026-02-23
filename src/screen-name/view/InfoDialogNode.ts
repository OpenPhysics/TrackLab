/**
 * InfoDialogNode.ts
 *
 * Modal dialog explaining the main steps for digitizing a track in TrackLab.
 * Toggled by the info button in the lower-left corner of the screen.
 */

import type { ReadOnlyProperty } from "scenerystack/axon";
import { Node, Rectangle, RichText, Text, VBox } from "scenerystack/scenery";
import { CloseButton, PhetFont } from "scenerystack/scenery-phet";
import { Panel } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";

// ── Layout constants ──────────────────────────────────────────────────────────
const CONTENT_WIDTH = 370; // inner width of the panel content area
const PANEL_X_MARGIN = 18;
const PANEL_Y_MARGIN = 16;
const TITLE_FONT = new PhetFont({ size: 15, weight: "bold" });
const STEP_TITLE_FONT = new PhetFont({ size: 13, weight: "bold" });
const STEP_BODY_FONT = new PhetFont(13);
const STEPS_SPACING = 12; // vertical gap between steps
const STEP_INNER_SPACING = 2; // gap between step title and body text
const SEPARATOR_MARGIN = 6; // gap above/below the horizontal rule
const CLOSE_BUTTON_ICON_LENGTH = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A thin horizontal rule separating the title from the steps. */
function makeSeparator(): Rectangle {
  return new Rectangle(0, 0, CONTENT_WIDTH, 1, {
    fill: TrackLabColors.panelStrokeLightProperty,
  });
}

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
 * Floating modal explaining how to digitize a track.
 *
 * Hidden by default (`visible = false`). Show by setting `visible = true`;
 * the internal close button hides it again.
 */
export class InfoDialogNode extends Node {
  public constructor() {
    super({ visible: false });

    const strings = StringManager.getInstance().getInfoDialog();

    // ── Header: title + close button ─────────────────────────────────────────
    const titleText = new Text(strings.titleStringProperty, {
      font: TITLE_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });

    const closeButton = new CloseButton({
      listener: () => {
        this.visible = false;
      },
      baseColor: TrackLabColors.buttonBaseDarkProperty,
      iconLength: CLOSE_BUTTON_ICON_LENGTH,
      tandem: Tandem.OPT_OUT,
    });

    // Lay out title and close button side-by-side, close button flush right.
    const headerNode = new Node({ children: [titleText, closeButton] });
    closeButton.right = CONTENT_WIDTH;
    closeButton.centerY = titleText.centerY;
    titleText.maxWidth = CONTENT_WIDTH - closeButton.width - 8;

    // ── Steps ────────────────────────────────────────────────────────────────
    const steps = [
      makeStep(strings.loadVideoTitleStringProperty, strings.loadVideoBodyStringProperty),
      makeStep(strings.coordinateSystemTitleStringProperty, strings.coordinateSystemBodyStringProperty),
      makeStep(strings.calibrationTitleStringProperty, strings.calibrationBodyStringProperty),
      makeStep(strings.addTrackTitleStringProperty, strings.addTrackBodyStringProperty),
      makeStep(strings.digitizeTitleStringProperty, strings.digitizeBodyStringProperty),
      makeStep(strings.autoTrackTitleStringProperty, strings.autoTrackBodyStringProperty),
    ];

    // ── Content layout ───────────────────────────────────────────────────────
    // Spacer nodes give extra breathing room around the separator.
    const separatorTop = new Rectangle(0, 0, 0, SEPARATOR_MARGIN);
    const separatorBottom = new Rectangle(0, 0, 0, SEPARATOR_MARGIN);

    const content = new VBox({
      children: [headerNode, separatorTop, makeSeparator(), separatorBottom, ...steps],
      spacing: STEPS_SPACING,
      align: "left",
    });

    const panel = new Panel(content, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: PANEL_CORNER_RADIUS,
      xMargin: PANEL_X_MARGIN,
      yMargin: PANEL_Y_MARGIN,
    });

    this.addChild(panel);
  }
}

trackLab.register("InfoDialogNode", InfoDialogNode);
