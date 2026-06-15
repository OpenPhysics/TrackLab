/**
 * InfoDialogNode.ts
 *
 * Modal dialog explaining how to use TrackLab.
 * Tab 1 – Workflow: the six steps to digitize a track.
 * Tab 2 – Tools: less-known features (auto-tracking, measuring tape, angle
 *          tool, kinematics graph, data table).
 *
 * Toggled by the InfoButton in the lower-left corner of the screen.
 */

import type { ReadOnlyProperty } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Circle, FireListener, HBox, Line, Node, Path, Rectangle, RichText, Text, VBox } from "scenerystack/scenery";
import { ArrowNode, CloseButton, PhetFont } from "scenerystack/scenery-phet";
import { Panel } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { CONTROL_ICON_SIZE, PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";

// ── Layout constants ──────────────────────────────────────────────────────────
const CONTENT_WIDTH = 370; // inner width of the panel content area
const PANEL_X_MARGIN = 18;
const PANEL_Y_MARGIN = 16;
const TITLE_FONT = new PhetFont({ size: 15, weight: "bold" });
const TAB_FONT = new PhetFont({ size: 13, weight: "bold" });
const STEP_TITLE_FONT = new PhetFont({ size: 13, weight: "bold" });
const STEP_BODY_FONT = new PhetFont(13);
const STEPS_SPACING = 12; // vertical gap between steps
const STEP_INNER_SPACING = 2; // gap between step title and body text
const CLOSE_BUTTON_ICON_LENGTH = 10;
const ICON_SPACING = 8; // gap between icon and text
const TITLE_MAX_WIDTH_SPACING = 8; // gap between title text and close button
const TAB_SPACING = 24; // horizontal gap between tab labels
const TAB_UNDERLINE_HEIGHT = 2; // thickness of active-tab indicator
const TAB_ACTIVE_OPACITY = 1;
const TAB_INACTIVE_OPACITY = 0.4;

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

// ── Tab 1 icon helpers ────────────────────────────────────────────────────────

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

// ── Tab 2 icon helpers ────────────────────────────────────────────────────────

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

/** Horizontal tape with end ticks — measuring tape. */
function measuringTapeIcon(): Node {
  const cx = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const cy = CONTROL_ICON_SIZE * ICON_CENTER_FRACTION;
  const half = CONTROL_ICON_SIZE * ICON_HALF_FRACTION;
  const color = TrackLabColors.measuringTapeColorProperty;
  const tickH = 4;
  return new Node({
    children: [
      new Line(cx - half, cy, cx + half, cy, { stroke: color, lineWidth: ICON_LINE_WIDTH_THICK }),
      new Line(cx - half, cy - tickH / 2, cx - half, cy + tickH / 2, { stroke: color, lineWidth: 1 }),
      new Line(cx, cy - tickH / 4, cx, cy + tickH / 4, { stroke: color, lineWidth: 1 }),
      new Line(cx + half, cy - tickH / 2, cx + half, cy + tickH / 2, { stroke: color, lineWidth: 1 }),
    ],
  });
}

/** Two arms meeting at a vertex with a small arc — angle tool. */
function angleToolIcon(): Node {
  const color = TrackLabColors.angleToolColorProperty;
  const vx = CONTROL_ICON_SIZE * 0.12; // vertex x (near left)
  const vy = CONTROL_ICON_SIZE * 0.84; // vertex y (near bottom)
  const armLen = CONTROL_ICON_SIZE * 0.75;
  const armAngle = Math.PI / 4; // 45° above horizontal (in screen-space, negative y)

  const arm1 = new Line(vx, vy, vx + armLen, vy, {
    stroke: color,
    lineWidth: ICON_LINE_WIDTH_THICK,
  });
  const arm2 = new Line(vx, vy, vx + armLen * Math.cos(armAngle), vy - armLen * Math.sin(armAngle), {
    stroke: color,
    lineWidth: ICON_LINE_WIDTH_THICK,
  });
  // Arc sweeping from the diagonal arm (−armAngle) to horizontal (0), clockwise on screen
  const arcR = armLen * 0.32;
  const arc = new Path(new Shape().arc(vx, vy, arcR, -armAngle, 0, false), {
    stroke: color,
    lineWidth: 1,
    fill: null,
  });

  return new Node({ children: [arm1, arm2, arc] });
}

/** X/Y axes with a plotted curve — kinematics graph. */
function graphIcon(): Node {
  const gray = TrackLabColors.iconGrayProperty;
  const curveColor = TrackLabColors.plot1Property;
  const m = 2;
  const left = m;
  const bottom = CONTROL_ICON_SIZE - m;
  const right = CONTROL_ICON_SIZE - m;
  const top = m + 1;
  const w = right - left;

  const xAxis = new Line(left, bottom, right, bottom, { stroke: gray, lineWidth: 1 });
  const yAxis = new Line(left, bottom, left, top, { stroke: gray, lineWidth: 1 });
  const curveShape = new Shape()
    .moveTo(left + 1, bottom - 2)
    .cubicCurveTo(left + w * 0.25, bottom - 3, left + w * 0.55, top + 5, right - 1, top + 2);
  const curve = new Path(curveShape, { stroke: curveColor, lineWidth: 1.5, fill: null });

  return new Node({ children: [xAxis, yAxis, curve] });
}

/** Small grid — data table. */
function tableIcon(): Node {
  const gray = TrackLabColors.iconGrayProperty;
  const m = 2;
  const s = CONTROL_ICON_SIZE;
  const w = s - 2 * m;
  const h = s - 2 * m;
  const headerH = Math.round(h / 3);
  const midX = m + Math.round(w * 0.42);

  return new Node({
    children: [
      // header fill
      new Rectangle(m, m, w, headerH, { fill: TrackLabColors.tableHeaderBackgroundProperty, stroke: null }),
      // outer border (drawn after fill so it appears on top)
      new Rectangle(m, m, w, h, { stroke: gray, lineWidth: 1, fill: null }),
      // horizontal dividers
      new Line(m, m + headerH, m + w, m + headerH, { stroke: gray, lineWidth: 0.5 }),
      new Line(m, m + headerH + Math.round((h - headerH) / 2), m + w, m + headerH + Math.round((h - headerH) / 2), {
        stroke: gray,
        lineWidth: 0.5,
      }),
      // vertical divider
      new Line(midX, m, midX, m + h, { stroke: gray, lineWidth: 0.5 }),
    ],
  });
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** One row: icon left, bold title + muted body text right. */
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

/** Thin full-width separator line. */
function makeSeparator(): Node {
  return new Line(0, 0, CONTENT_WIDTH, 0, {
    stroke: TrackLabColors.panelStrokeProperty,
    lineWidth: 0.5,
    opacity: 0.6,
  });
}

// ── InfoDialogNode ────────────────────────────────────────────────────────────

/**
 * Floating panel explaining how to digitize a track and use advanced tools.
 *
 * Hidden by default (`visible = false`). Show by setting `visible = true`;
 * the internal close button hides it again.
 */
export class InfoDialogNode extends Node {
  public constructor() {
    super({ visible: false });

    const strings = StringManager.getInstance().getInfoDialog();
    const a11y = StringManager.getInstance().getA11y();

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

    const headerNode = new Node({ children: [titleText, closeButton] });
    closeButton.right = CONTENT_WIDTH;
    closeButton.centerY = titleText.centerY;
    titleText.maxWidth = CONTENT_WIDTH - closeButton.width - TITLE_MAX_WIDTH_SPACING;

    // ── Tab bar ───────────────────────────────────────────────────────────────
    const tab1Label = new Text(strings.tab1LabelStringProperty, {
      font: TAB_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });
    const tab1Underline = new Rectangle(0, 0, Math.max(tab1Label.width, 40), TAB_UNDERLINE_HEIGHT, {
      fill: TrackLabColors.textOnDarkProperty,
    });
    const tab1Button = new VBox({
      children: [tab1Label, tab1Underline],
      spacing: 3,
      align: "left",
      cursor: "pointer",
      tagName: "button",
      accessibleName: a11y.infoDialogTab1StringProperty,
    });

    const tab2Label = new Text(strings.tab2LabelStringProperty, {
      font: TAB_FONT,
      fill: TrackLabColors.textOnDarkProperty,
      opacity: TAB_INACTIVE_OPACITY,
    });
    const tab2Underline = new Rectangle(0, 0, Math.max(tab2Label.width, 40), TAB_UNDERLINE_HEIGHT, {
      fill: TrackLabColors.textOnDarkProperty,
      visible: false,
    });
    const tab2Button = new VBox({
      children: [tab2Label, tab2Underline],
      spacing: 3,
      align: "left",
      cursor: "pointer",
      tagName: "button",
      accessibleName: a11y.infoDialogTab2StringProperty,
    });

    const tabBar = new HBox({
      children: [tab1Button, tab2Button],
      spacing: TAB_SPACING,
      align: "bottom",
    });

    // ── Tab 1 content (Workflow) ──────────────────────────────────────────────
    const tab1Content = new VBox({
      children: [
        makeStep(videoIcon(), strings.loadVideoTitleStringProperty, strings.loadVideoBodyStringProperty),
        makeStep(axesIcon(), strings.coordinateSystemTitleStringProperty, strings.coordinateSystemBodyStringProperty),
        makeStep(calibrationIcon(), strings.calibrationTitleStringProperty, strings.calibrationBodyStringProperty),
        makeStep(addTrackIcon(), strings.addTrackTitleStringProperty, strings.addTrackBodyStringProperty),
        makeStep(magnifyIcon(), strings.digitizeTitleStringProperty, strings.digitizeBodyStringProperty),
      ],
      spacing: STEPS_SPACING,
      align: "left",
    });

    // ── Tab 2 content (Tools) ─────────────────────────────────────────────────
    const tab2Content = new VBox({
      children: [
        makeStep(trackingIcon(), strings.autoTrackTitleStringProperty, strings.autoTrackBodyStringProperty),
        makeStep(
          measuringTapeIcon(),
          strings.measuringTapeTitleStringProperty,
          strings.measuringTapeBodyStringProperty,
        ),
        makeStep(angleToolIcon(), strings.angleToolTitleStringProperty, strings.angleToolBodyStringProperty),
        makeStep(graphIcon(), strings.kinematicsGraphTitleStringProperty, strings.kinematicsGraphBodyStringProperty),
        makeStep(tableIcon(), strings.dataTableTitleStringProperty, strings.dataTableBodyStringProperty),
      ],
      spacing: STEPS_SPACING,
      align: "left",
    });

    // Container that holds whichever tab content is active.
    const contentContainer = new Node({ children: [tab1Content] });

    // ── Tab switching ─────────────────────────────────────────────────────────
    const switchToTab = (index: number): void => {
      contentContainer.removeAllChildren();
      contentContainer.addChild(index === 0 ? tab1Content : tab2Content);
      tab1Label.opacity = index === 0 ? TAB_ACTIVE_OPACITY : TAB_INACTIVE_OPACITY;
      tab2Label.opacity = index === 0 ? TAB_INACTIVE_OPACITY : TAB_ACTIVE_OPACITY;
      tab1Underline.visible = index === 0;
      tab2Underline.visible = index === 1;
    };

    tab1Button.addInputListener(new FireListener({ fire: () => switchToTab(0), tandem: Tandem.OPT_OUT }));
    tab2Button.addInputListener(new FireListener({ fire: () => switchToTab(1), tandem: Tandem.OPT_OUT }));

    // ── Assemble ──────────────────────────────────────────────────────────────
    const content = new VBox({
      children: [headerNode, makeSeparator(), tabBar, makeSeparator(), contentContainer],
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

TrackLabNamespace.register("InfoDialogNode", InfoDialogNode);
