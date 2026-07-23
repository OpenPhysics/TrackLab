/**
 * TrackLabIcons.ts
 *
 * Centralised icon factory functions for all SceneryStack Path/Node icons used
 * in TrackLab buttons and panels.  Keeping icon definitions here prevents
 * duplication across view files and makes it easy to update a glyph in one
 * place.
 *
 * Usage:
 *   import { makeDownloadIcon, makeTrashIcon } from '../../TrackLabIcons.js';
 */

import { Shape } from "scenerystack/kite";
import { Circle, Line, Node, Path, Rectangle } from "scenerystack/scenery";
import { ArrowNode } from "scenerystack/scenery-phet";
import TrackLabColors from "./TrackLabColors.js";
import {
  CONTROL_ICON_ARROW_HEAD_SIZE,
  CONTROL_ICON_ARROW_TAIL_WIDTH,
  CONTROL_ICON_CENTER_DOT_RADIUS,
  CONTROL_ICON_CENTER_FRACTION,
  CONTROL_ICON_DOT_RADIUS,
  CONTROL_ICON_HALF_FRACTION,
  CONTROL_ICON_LINE_DASH,
  CONTROL_ICON_LINE_WIDTH_MAGNIFIER,
  CONTROL_ICON_LINE_WIDTH_THICK,
  CONTROL_ICON_LINE_WIDTH_THIN,
  CONTROL_ICON_MAGNIFIER_RADIUS_FRACTION,
  CONTROL_ICON_ORIGIN_FRACTION,
  CONTROL_ICON_SIZE,
  CONTROL_ICON_TRACKING_GAP_FRACTION,
  CONTROL_ICON_TRACKING_RADIUS_FRACTION,
  CONTROL_ICON_X_ARROW_END_FRACTION,
  CONTROL_ICON_Y_ARROW_END_FRACTION,
} from "./TrackLabConstants.js";

/**
 * Download icon: downward arrow with a tray bar.
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

/**
 * Plus icon: two perpendicular lines forming a "+" glyph.
 * Used in "Add Track" buttons.
 */
export function makePlusIcon(): Node {
  const size = 12; // size of the plus icon
  const lw = 2; // line width
  const half = size / 2;

  const horizontal = new Line(-half, 0, half, 0, {
    stroke: TrackLabColors.textOnDarkProperty,
    lineWidth: lw,
  });
  const vertical = new Line(0, -half, 0, half, {
    stroke: TrackLabColors.textOnDarkProperty,
    lineWidth: lw,
  });

  return new Node({ children: [horizontal, vertical] });
}

/**
 * Trash-can icon: body with lid, handle, and three vertical line slots.
 * Used in "Remove Track" buttons.
 */
export function makeTrashIcon(): Node {
  const lw = 1.2; // reduced from 1.5
  const bw = 8; // reduced from 10
  const bh = 9; // reduced from 11

  const body = new Rectangle(0, 0, bw, bh, 1, 1, {
    stroke: TrackLabColors.trashIconProperty,
    lineWidth: lw,
    fill: null,
  });
  const lid = new Rectangle(-1.5, -3.5, bw + 3, 3, 0, 0, {
    stroke: TrackLabColors.trashIconProperty,
    lineWidth: lw,
    fill: null,
  });
  const handle = new Rectangle(2.5, -7, 5, 3.5, 1, 1, {
    stroke: TrackLabColors.trashIconProperty,
    lineWidth: lw,
    fill: null,
  });
  const l1 = new Line(bw / 4, 2, bw / 4, bh - 2, {
    stroke: TrackLabColors.trashIconProperty,
    lineWidth: 1,
  });
  const l2 = new Line(bw / 2, 2, bw / 2, bh - 2, {
    stroke: TrackLabColors.trashIconProperty,
    lineWidth: 1,
  });
  const l3 = new Line((bw * 3) / 4, 2, (bw * 3) / 4, bh - 2, {
    stroke: TrackLabColors.trashIconProperty,
    lineWidth: 1,
  });

  return new Node({ children: [handle, lid, body, l1, l2, l3] });
}

/**
 * Two small XY arrows for the coordinate-system control / info-dialog row.
 */
export function makeAxesIcon(): Node {
  const xArrow = new ArrowNode(
    0,
    CONTROL_ICON_SIZE * CONTROL_ICON_ORIGIN_FRACTION,
    CONTROL_ICON_SIZE * CONTROL_ICON_X_ARROW_END_FRACTION,
    CONTROL_ICON_SIZE * CONTROL_ICON_ORIGIN_FRACTION,
    {
      fill: TrackLabColors.axisXColorProperty,
      stroke: null,
      headWidth: CONTROL_ICON_ARROW_HEAD_SIZE,
      headHeight: CONTROL_ICON_ARROW_HEAD_SIZE,
      tailWidth: CONTROL_ICON_ARROW_TAIL_WIDTH,
    },
  );
  const yArrow = new ArrowNode(
    0,
    CONTROL_ICON_SIZE * CONTROL_ICON_ORIGIN_FRACTION,
    0,
    CONTROL_ICON_SIZE * CONTROL_ICON_Y_ARROW_END_FRACTION,
    {
      fill: TrackLabColors.axisYColorProperty,
      stroke: null,
      headWidth: CONTROL_ICON_ARROW_HEAD_SIZE,
      headHeight: CONTROL_ICON_ARROW_HEAD_SIZE,
      tailWidth: CONTROL_ICON_ARROW_TAIL_WIDTH,
    },
  );
  return new Node({ children: [xArrow, yArrow] });
}

/**
 * Two endpoint dots joined by a dashed line — calibration segment glyph.
 */
export function makeCalibrationIcon(): Node {
  const cx = CONTROL_ICON_SIZE * CONTROL_ICON_CENTER_FRACTION;
  const cy = CONTROL_ICON_SIZE * CONTROL_ICON_CENTER_FRACTION;
  const half = CONTROL_ICON_SIZE * CONTROL_ICON_HALF_FRACTION;
  const calColor = TrackLabColors.calibrationFillProperty;
  return new Node({
    children: [
      new Line(cx - half, cy, cx + half, cy, {
        stroke: calColor,
        lineWidth: CONTROL_ICON_LINE_WIDTH_THICK,
        lineDash: [...CONTROL_ICON_LINE_DASH],
      }),
      new Circle(CONTROL_ICON_DOT_RADIUS, { fill: calColor, x: cx - half, y: cy }),
      new Circle(CONTROL_ICON_DOT_RADIUS, { fill: calColor, x: cx + half, y: cy }),
    ],
  });
}

/**
 * Circle with a diagonal handle — magnifying glass silhouette.
 */
export function makeMagnifyIcon(): Node {
  const r = CONTROL_ICON_SIZE * CONTROL_ICON_MAGNIFIER_RADIUS_FRACTION;
  const cx = r + 1;
  const cy = r + 1;
  const gray = TrackLabColors.iconGrayProperty;
  return new Node({
    children: [
      new Circle(r, {
        stroke: gray,
        lineWidth: CONTROL_ICON_LINE_WIDTH_THICK,
        fill: null,
        x: cx,
        y: cy,
      }),
      new Line(
        cx + r * CONTROL_ICON_ORIGIN_FRACTION,
        cy + r * CONTROL_ICON_ORIGIN_FRACTION,
        CONTROL_ICON_SIZE - 1,
        CONTROL_ICON_SIZE - 1,
        {
          stroke: gray,
          lineWidth: CONTROL_ICON_LINE_WIDTH_MAGNIFIER,
        },
      ),
    ],
  });
}

/**
 * Crosshair with a small centre dot — tracking / auto-track target.
 */
export function makeTrackingIcon(): Node {
  const cx = CONTROL_ICON_SIZE * CONTROL_ICON_CENTER_FRACTION;
  const cy = CONTROL_ICON_SIZE * CONTROL_ICON_CENTER_FRACTION;
  const r = CONTROL_ICON_SIZE * CONTROL_ICON_TRACKING_RADIUS_FRACTION;
  const gap = CONTROL_ICON_SIZE * CONTROL_ICON_TRACKING_GAP_FRACTION;
  const gray = TrackLabColors.iconGrayProperty;
  return new Node({
    children: [
      new Circle(r, {
        stroke: gray,
        lineWidth: CONTROL_ICON_LINE_WIDTH_THICK,
        fill: null,
        x: cx,
        y: cy,
      }),
      new Circle(CONTROL_ICON_CENTER_DOT_RADIUS, { fill: gray, x: cx, y: cy }),
      new Line(cx, cy - r - gap, cx, cy - gap, {
        stroke: gray,
        lineWidth: CONTROL_ICON_LINE_WIDTH_THIN,
      }),
      new Line(cx, cy + gap, cx, cy + r + gap, {
        stroke: gray,
        lineWidth: CONTROL_ICON_LINE_WIDTH_THIN,
      }),
      new Line(cx - r - gap, cy, cx - gap, cy, {
        stroke: gray,
        lineWidth: CONTROL_ICON_LINE_WIDTH_THIN,
      }),
      new Line(cx + gap, cy, cx + r + gap, cy, {
        stroke: gray,
        lineWidth: CONTROL_ICON_LINE_WIDTH_THIN,
      }),
    ],
  });
}
