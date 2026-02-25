/**
 * InfoDialogNode.ts
 *
 * Modal dialog explaining the main steps for digitizing a track in TrackLab.
 * Toggled by the InfoButton in the lower-left corner of the screen.
 */

import type { ReadOnlyProperty } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Circle, HBox, Line, Node, Path, Rectangle, RichText, Text, VBox } from "scenerystack/scenery";
import { ArrowNode, CloseButton, PhetFont } from "scenerystack/scenery-phet";
import { Panel } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { CONTROL_ICON_SIZE, PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
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
const CLOSE_BUTTON_ICON_LENGTH = 10;
const ICON_SPACING = 8; // gap between icon and text
const TITLE_MAX_WIDTH_SPACING = 8; // gap between title text and close button

// ── Icon shared constants ────────────────────────────────────────────────────
const ICON_ARROW_HEAD_SIZE = 5;
const ICON_ARROW_TAIL_WIDTH = 1.5;
const ICON_LINE_WIDTH_THICK = 1.5;
const ICON_LINE_WIDTH_MAGNIFIER = 2;
const ICON_DOT_RADIUS = 3;
const ICON_CENTER_DOT_RADIUS = 2;
const ICON_LINE_DASH: number[] = [3, 2];

// Icon layout fractions
const ICON_ORIGIN_FRACTION = 0.7;
const ICON_X_ARROW_END_FRACTION = 0.85;
const ICON_Y_ARROW_END_FRACTION = 0.05;
const ICON_HALF_FRACTION = 0.4;
const ICON_CENTER_FRACTION = 0.5;
const ICON_MAGNIFIER_RADIUS_FRACTION = 0.32;
const ICON_TRACKING_RADIUS_FRACTION = 0.35;
const ICON_TRACKING_GAP_FRACTION = 0.15;

// ── Icon helpers ──────────────────────────────────────────────────────────────

/** Video/file icon - folder with video symbol. */
function videoIcon(): Node {
  const gray = TrackLabColors.iconGrayProperty;
  const folderShape = new Shape()
    .moveTo(2, 4)
    .lineTo(6, 4)
    .lineTo(7, 2)
    .lineTo(18, 2)
    .lineTo(18, 16)
    .lineTo(2, 16)
    .close();
  const folder = new Path(folderShape, { stroke: gray, lineWidth: ICON_LINE_WIDTH_THICK, fill: null });
  const play = new Path(new Shape().moveTo(8, 7).lineTo(8, 13).lineTo(13, 10).close(), { fill: gray });
  return new Node({ children: [folder, play] });
}

/** Two small XY arrows for coordinate system. */
function axesIcon(): Node {
  const xArrow = new ArrowNode(
    0,
    CONTROL_ICON_SIZE * ICON_ORIGIN_FRACTION,
    CONTROL_ICON_SIZE * ICON_X_ARROW_END_FRACTION,
    CONTROL_ICON_SIZE * ICON_ORIGIN_FRACTION,
    {
      fill: TrackLabColors.axisXColorProperty,
      stroke: null,
      headWidth: ICON_ARROW_HEAD_SIZE,
      headHeight: ICON_ARROW_HEAD_SIZE,
      tailWidth: ICON_ARROW_TAIL_WIDTH,
    },
  );
  const yArrow = new ArrowNode(
    0,
    CONTROL_ICON_SIZE * ICON_ORIGIN_FRACTION,
    0,
    CONTROL_ICON_SIZE * ICON_Y_ARROW_END_FRACTION,
    {
      fill: TrackLabColors.axisYColorProperty,
      stroke: null,
      headWidth: ICON_ARROW_HEAD_SIZE,
      headHeight: ICON_ARROW_HEAD_SIZE,
      tailWidth: ICON_ARROW_TAIL_WIDTH,
    },
  );
  return new Node({ children: [xArrow, yArrow] });
}

/** Two endpoint dots joined by a dashed line for calibration. */
function calibrationIcon(): Node {
  const cx = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const cy = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const half = CONTROL_ICON_SIZE * ICON_HALF_FRACTION;
  const calColor = TrackLabColors.calibrationFillProperty;
  return new Node({
    children: [
      new Line(cx - half, cy, cx + half, cy, {
        stroke: calColor,
        lineWidth: ICON_LINE_WIDTH_THICK,
        lineDash: ICON_LINE_DASH,
      }),
      new Circle(ICON_DOT_RADIUS, { fill: calColor, x: cx - half, y: cy }),
      new Circle(ICON_DOT_RADIUS, { fill: calColor, x: cx + half, y: cy }),
    ],
  });
}

/** Plus sign for adding tracks. */
function addTrackIcon(): Node {
  const gray = TrackLabColors.iconGrayProperty;
  const center = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const size = CONTROL_ICON_SIZE * 0.6;
  return new Node({
    children: [
      new Rectangle(center - 1, center - size / 2, 2, size, { fill: gray }),
      new Rectangle(center - size / 2, center - 1, size, 2, { fill: gray }),
    ],
  });
}

/** Magnifying glass for digitizing. */
function magnifyIcon(): Node {
  const r = CONTROL_ICON_SIZE * ICON_MAGNIFIER_RADIUS_FRACTION;
  const cx = r + 1;
  const cy = r + 1;
  const gray = TrackLabColors.iconGrayProperty;
  return new Node({
    children: [
      new Circle(r, {
        stroke: gray,
        lineWidth: ICON_LINE_WIDTH_THICK,
        fill: null,
        x: cx,
        y: cy,
      }),
      new Line(
        cx + r * ICON_ORIGIN_FRACTION,
        cy + r * ICON_ORIGIN_FRACTION,
        CONTROL_ICON_SIZE - 1,
        CONTROL_ICON_SIZE - 1,
        {
          stroke: gray,
          lineWidth: ICON_LINE_WIDTH_MAGNIFIER,
        },
      ),
    ],
  });
}

/** Crosshair with centre dot for auto-tracking. */
function trackingIcon(): Node {
  const cx = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const cy = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const r = CONTROL_ICON_SIZE * ICON_TRACKING_RADIUS_FRACTION;
  const gap = CONTROL_ICON_SIZE * ICON_TRACKING_GAP_FRACTION;
  const gray = TrackLabColors.iconGrayProperty;
  return new Node({
    children: [
      new Circle(r, {
        stroke: gray,
        lineWidth: ICON_LINE_WIDTH_THICK,
        fill: null,
        x: cx,
        y: cy,
      }),
      new Circle(ICON_CENTER_DOT_RADIUS, { fill: gray, x: cx, y: cy }),
      new Line(cx, cy - r - gap, cx, cy - gap, { stroke: gray, lineWidth: 1 }),
      new Line(cx, cy + gap, cx, cy + r + gap, { stroke: gray, lineWidth: 1 }),
      new Line(cx - r - gap, cy, cx - gap, cy, { stroke: gray, lineWidth: 1 }),
      new Line(cx + gap, cy, cx + r + gap, cy, { stroke: gray, lineWidth: 1 }),
    ],
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** One step: icon + bold heading above a softer-colored description. */
function makeStep(icon: Node, titleProp: ReadOnlyProperty<string>, bodyProp: ReadOnlyProperty<string>): Node {
  const titleText = new Text(titleProp, {
    font: STEP_TITLE_FONT,
    fill: TrackLabColors.textOnDarkProperty,
    maxWidth: CONTENT_WIDTH - CONTROL_ICON_SIZE - ICON_SPACING,
  });

  const bodyText = new RichText(bodyProp, {
    font: STEP_BODY_FONT,
    fill: TrackLabColors.textMutedProperty,
    lineWrap: CONTENT_WIDTH - CONTROL_ICON_SIZE - ICON_SPACING,
  });

  const textBox = new VBox({
    children: [titleText, bodyText],
    spacing: STEP_INNER_SPACING,
    align: "left",
  });

  return new HBox({
    children: [icon, textBox],
    spacing: ICON_SPACING,
    align: "top",
  });
}

// ── InfoDialogNode ────────────────────────────────────────────────────────────

/**
 * Floating panel explaining how to digitize a track.
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
    titleText.maxWidth = CONTENT_WIDTH - closeButton.width - TITLE_MAX_WIDTH_SPACING;

    // ── Steps ────────────────────────────────────────────────────────────────
    const content = new VBox({
      children: [
        headerNode,
        makeStep(videoIcon(), strings.loadVideoTitleStringProperty, strings.loadVideoBodyStringProperty),
        makeStep(axesIcon(), strings.coordinateSystemTitleStringProperty, strings.coordinateSystemBodyStringProperty),
        makeStep(calibrationIcon(), strings.calibrationTitleStringProperty, strings.calibrationBodyStringProperty),
        makeStep(addTrackIcon(), strings.addTrackTitleStringProperty, strings.addTrackBodyStringProperty),
        makeStep(magnifyIcon(), strings.digitizeTitleStringProperty, strings.digitizeBodyStringProperty),
        makeStep(trackingIcon(), strings.autoTrackTitleStringProperty, strings.autoTrackBodyStringProperty),
      ],
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
