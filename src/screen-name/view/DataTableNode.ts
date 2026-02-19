/**
 * DataTableNode.ts
 *
 * Panel displayed below the TrackListPanel showing the digitized position
 * of each track at (or just before) the current video frame.
 *
 * Layout: Excel-style grid with three columns:
 *   colour badge | x position | y position
 * Values are shown in the unit selected in the CalibrationToolNode.
 *
 * Performance note: row nodes are created/destroyed only when tracks are
 * added or removed. Value updates (time or unit change) mutate the existing
 * Text nodes in-place, avoiding SceneryStack node churn on every video frame.
 */

import { Color } from "scenerystack";
import type { TReadOnlyProperty } from "scenerystack/axon";
import {
  Circle,
  HBox,
  Node,
  Rectangle,
  Text,
  VBox,
} from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Panel } from "scenerystack/sun";
import TrackLabColors from "../../TrackLabColors.js";
import type { SimModel } from "../model/SimModel.js";
import type { Track, TrackPoint } from "../model/Track.js";

const FRAME_DURATION = 1 / 30; // assumes 30 fps

// ── Grid geometry ────────────────────────────────────────────────────────────
const COL_BADGE_W = 36;
const COL_X_W = 80;
const COL_Y_W = 80;
const ROW_H = 22;
const TABLE_W = COL_BADGE_W + COL_X_W + COL_Y_W;

// ── Colours ──────────────────────────────────────────────────────────────────
const GRID_STROKE = new Color(160, 160, 160);
const HEADER_BG = new Color(68, 114, 196);   // Excel-blue
const ROW_FILL_ODD = new Color(255, 255, 255);
const ROW_FILL_EVEN = new Color(235, 241, 251);

// ── Fonts ────────────────────────────────────────────────────────────────────
const TITLE_FONT = new PhetFont({ size: 12, weight: "bold" });
const HEADER_FONT = new PhetFont({ size: 11, weight: "bold" });
const CELL_FONT = new PhetFont(11);
const SYM_FONT = new PhetFont({ size: 10, weight: "bold" });
const BADGE_R = 7;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPointAtFrame(track: Track, frame: number): TrackPoint | null {
  const candidates = track.points.filter((p) => p.frame <= frame);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, p) => (p.frame > best.frame ? p : best));
}

/** One static header cell (label never changes). */
function makeHeaderCell(label: string, width: number): Node {
  const bg = new Rectangle(0, 0, width, ROW_H, {
    fill: HEADER_BG,
    stroke: GRID_STROKE,
    lineWidth: 0.5,
  });
  const text = new Text(label, { font: HEADER_FONT, fill: "white" });
  text.centerX = width / 2;
  text.centerY = ROW_H / 2;
  return new Node({ children: [bg, text] });
}

/** One mutable header cell (label updates when unit changes). */
function makeMutableHeaderCell(
  initialLabel: string,
  width: number,
): { node: Node; text: Text } {
  const bg = new Rectangle(0, 0, width, ROW_H, {
    fill: HEADER_BG,
    stroke: GRID_STROKE,
    lineWidth: 0.5,
  });
  const text = new Text(initialLabel, { font: HEADER_FONT, fill: "white" });
  text.centerX = width / 2;
  text.centerY = ROW_H / 2;
  return { node: new Node({ children: [bg, text] }), text };
}

/** One data cell whose value is mutated in-place. */
function makeDataCell(
  width: number,
  rowFill: Color,
): { node: Node; text: Text } {
  const bg = new Rectangle(0, 0, width, ROW_H, {
    fill: rowFill,
    stroke: GRID_STROKE,
    lineWidth: 0.5,
  });
  const text = new Text("—", { font: CELL_FONT, fill: "black" });
  text.centerX = width / 2;
  text.centerY = ROW_H / 2;
  return { node: new Node({ children: [bg, text] }), text };
}

/** Badge cell: coloured circle + symbol letter (static per track). */
function makeBadgeCell(track: Track, rowFill: Color): Node {
  const trackColor = new Color(track.color);
  const bg = new Rectangle(0, 0, COL_BADGE_W, ROW_H, {
    fill: rowFill,
    stroke: GRID_STROKE,
    lineWidth: 0.5,
  });
  const badge = new Circle(BADGE_R, { fill: trackColor });
  badge.centerX = COL_BADGE_W / 2;
  badge.centerY = ROW_H / 2;
  const sym = new Text(track.symbol, { font: SYM_FONT, fill: "white" });
  sym.center = badge.center;
  return new Node({ children: [bg, badge, sym] });
}

// ── Row types ────────────────────────────────────────────────────────────────

type RowRefs = { container: Node; xText: Text; yText: Text };

function buildTrackRow(track: Track, rowIndex: number): RowRefs {
  const fill = rowIndex % 2 === 0 ? ROW_FILL_ODD : ROW_FILL_EVEN;

  const badgeCell = makeBadgeCell(track, fill);
  const xCell = makeDataCell(COL_X_W, fill);
  const yCell = makeDataCell(COL_Y_W, fill);

  const container = new HBox({
    children: [badgeCell, xCell.node, yCell.node],
    spacing: 0,
    align: "center",
  });

  return { container, xText: xCell.text, yText: yCell.text };
}

// ── Component ────────────────────────────────────────────────────────────────

export class DataTableNode extends Panel {
  public constructor(
    model: SimModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    unitProperty: TReadOnlyProperty<string>,
  ) {
    // ── Column headers ────────────────────────────────────────────────────
    const xHeader = makeMutableHeaderCell("x", COL_X_W);
    const yHeader = makeMutableHeaderCell("y", COL_Y_W);

    const headerRow = new HBox({
      children: [makeHeaderCell("Track", COL_BADGE_W), xHeader.node, yHeader.node],
      spacing: 0,
      align: "center",
    });

    // ── "No data" placeholder row ─────────────────────────────────────────
    const noDataText = new Text("No digitized points", {
      font: CELL_FONT,
      fill: "black",
    });
    const noDataBg = new Rectangle(0, 0, TABLE_W, ROW_H, {
      fill: ROW_FILL_ODD,
      stroke: GRID_STROKE,
      lineWidth: 0.5,
    });
    noDataText.centerX = TABLE_W / 2;
    noDataText.centerY = ROW_H / 2;
    const noDataRow = new Node({ children: [noDataBg, noDataText] });

    // ── Body rows VBox ────────────────────────────────────────────────────
    const bodyVBox = new VBox({
      children: [noDataRow],
      spacing: 0,
      align: "left",
    });

    // ── Title + grid ──────────────────────────────────────────────────────
    const titleLabel = new Text("Position Data", {
      font: TITLE_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });

    const tableNode = new VBox({
      children: [headerRow, bodyVBox],
      spacing: 0,
      align: "left",
    });

    const content = new VBox({
      children: [titleLabel, tableNode],
      spacing: 6,
      align: "center",
    });

    super(content, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: 8,
      xMargin: 10,
      yMargin: 10,
      visible: false,
    });

    // ── Live row refs keyed by track ID ───────────────────────────────────
    const rowRefs = new Map<string, RowRefs>();
    let lastVisibleIds = "";
    let lastTrackIds = "";

    const updateValues = () => {
      const frame = Math.round(
        model.currentTimeProperty.value / FRAME_DURATION,
      );
      const unit = unitProperty.value;

      // Update column header labels to reflect current unit.
      xHeader.text.string = `x (${unit})`;
      yHeader.text.string = `y (${unit})`;
      xHeader.text.centerX = COL_X_W / 2;
      yHeader.text.centerX = COL_Y_W / 2;

      const tracksWithData = model.tracksProperty.value.filter(
        (t) => rowRefs.has(t.id) && t.points.some((p) => p.frame <= frame),
      );

      // Only reassign VBox children when the visible set changes.
      const visibleIds = tracksWithData.map((t) => t.id).join(",");
      if (visibleIds !== lastVisibleIds) {
        lastVisibleIds = visibleIds;
        bodyVBox.children =
          tracksWithData.length === 0
            ? [noDataRow]
            : tracksWithData.map((t) => rowRefs.get(t.id)!.container);
      }

      // Mutate Text values in-place; no node reconstruction.
      for (const track of tracksWithData) {
        const refs = rowRefs.get(track.id)!;
        const pt = getPointAtFrame(track, frame);
        refs.xText.string = pt ? pt.x.toFixed(3) : "—";
        refs.yText.string = pt ? pt.y.toFixed(3) : "—";
        refs.xText.centerX = COL_X_W / 2;
        refs.yText.centerX = COL_Y_W / 2;
      }
    };

    // ── Rebuild row nodes only when track set changes ─────────────────────
    model.tracksProperty.link((tracks) => {
      const ids = tracks.map((t) => t.id).join(",");
      if (ids !== lastTrackIds) {
        lastTrackIds = ids;

        for (const id of rowRefs.keys()) {
          if (!tracks.some((t) => t.id === id)) rowRefs.delete(id);
        }
        tracks.forEach((track, index) => {
          if (!rowRefs.has(track.id)) {
            rowRefs.set(track.id, buildTrackRow(track, index));
          }
        });
      }

      updateValues();
    });

    model.currentTimeProperty.link(updateValues);
    unitProperty.link(updateValues);

    videoLoadedProperty.link((loaded) => {
      this.visible = loaded;
    });
  }
}
