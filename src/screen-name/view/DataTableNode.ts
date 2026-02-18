/**
 * DataTableNode.ts
 *
 * Panel displayed below the TrackListPanel showing the digitized position
 * of each track at (or just before) the current video frame.
 *
 * Columns: colour badge with symbol | x position | y position
 * Values are shown in the unit selected in the CalibrationToolNode.
 *
 * Performance note: the panel separates structure rebuilds (only on
 * track add/remove) from value updates (on time or unit change). This
 * avoids recreating SceneryStack nodes on every video frame.
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
const PANEL_WIDTH = 165;
const BADGE_R = 8;

const HEADER_FONT = new PhetFont({ size: 13, weight: "bold" });
const LABEL_FONT = new PhetFont(11);

/**
 * Returns the last TrackPoint at or before `frame`, or null if none exists.
 */
function getPointAtFrame(track: Track, frame: number): TrackPoint | null {
  const candidates = track.points.filter((p) => p.frame <= frame);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, p) => (p.frame > best.frame ? p : best));
}

/** Mutable handles into one track row's Text nodes. */
type RowRefs = {
  container: Node;
  xLabel: Text;
  yLabel: Text;
};

/** Builds one compact row for a track and returns handles to its mutable labels. */
function buildTrackRow(track: Track): RowRefs {
  const trackColor = new Color(track.color);

  const badge = new Circle(BADGE_R, {
    fill: track.color,
  });
  const symbolLabel = new Text(track.symbol, {
    font: new PhetFont({ size: 10, weight: "bold" }),
    fill: "white",
  });
  symbolLabel.center = badge.center;

  const badgeNode = new Node({ children: [badge, symbolLabel] });

  const xLabel = new Text("x: — ", {
    font: LABEL_FONT,
    fill: TrackLabColors.textOnDarkProperty,
    maxWidth: PANEL_WIDTH - BADGE_R * 2 - 20,
  });
  const yLabel = new Text("y: — ", {
    font: LABEL_FONT,
    fill: TrackLabColors.textOnDarkProperty,
    maxWidth: PANEL_WIDTH - BADGE_R * 2 - 20,
  });

  const valuesBox = new VBox({
    children: [xLabel, yLabel],
    spacing: 2,
    align: "left",
  });

  const bg = new Rectangle(0, 0, PANEL_WIDTH, 0, 4, 4, {
    fill: trackColor.withAlpha(0.12),
    stroke: trackColor.withAlpha(0.5),
    lineWidth: 1,
    pickable: false,
  });

  const row = new HBox({
    children: [badgeNode, valuesBox],
    spacing: 8,
    align: "center",
  });

  // Wrap in a node to add the background
  const container = new Node({ children: [bg, row] });
  row.left = 6;
  row.centerY = 0;
  bg.rectHeight = row.height + 8;
  bg.top = row.top - 4;

  return { container, xLabel, yLabel };
}

export class DataTableNode extends Panel {
  public constructor(
    model: SimModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    unitProperty: TReadOnlyProperty<string>,
  ) {
    const widthSpacer = new Rectangle(0, 0, PANEL_WIDTH, 1, {
      fill: null,
      stroke: null,
      pickable: false,
    });

    const headerLabel = new Text("Position Data", {
      font: HEADER_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });

    const noDataLabel = new Text("No digitized points", {
      font: LABEL_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });

    const rowsVBox = new VBox({
      children: [noDataLabel],
      spacing: 6,
      align: "left",
    });

    const content = new VBox({
      children: [widthSpacer, headerLabel, rowsVBox],
      spacing: 8,
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
    // Rows are created/destroyed only when tracks are added or removed.
    // Value updates (time, unit changes) mutate the Text nodes in-place.
    const rowRefs = new Map<string, RowRefs>();

    // Last set of visible track IDs (joined string used as cheap fingerprint).
    let lastVisibleIds = "";

    const updateValues = () => {
      const frame = Math.round(
        model.currentTimeProperty.value / FRAME_DURATION,
      );
      const unit = unitProperty.value;

      // Determine which tracks have data at or before the current frame.
      const tracksWithData = model.tracksProperty.value.filter(
        (t) => rowRefs.has(t.id) && t.points.some((p) => p.frame <= frame),
      );

      // Only update VBox children when the visible set changes.
      const visibleIds = tracksWithData.map((t) => t.id).join(",");
      if (visibleIds !== lastVisibleIds) {
        lastVisibleIds = visibleIds;
        rowsVBox.children =
          tracksWithData.length === 0
            ? [noDataLabel]
            : tracksWithData.map((t) => rowRefs.get(t.id)!.container);
      }

      // Update Text values in-place (no node reconstruction).
      for (const track of tracksWithData) {
        const refs = rowRefs.get(track.id)!;
        const pt = getPointAtFrame(track, frame);
        refs.xLabel.string = pt ? `x: ${pt.x.toFixed(3)} ${unit}` : `x: — `;
        refs.yLabel.string = pt ? `y: ${pt.y.toFixed(3)} ${unit}` : `y: — `;
      }
    };

    // ── Rebuild row structure only when track IDs change ──────────────────
    let lastTrackIds = "";
    model.tracksProperty.link((tracks) => {
      const ids = tracks.map((t) => t.id).join(",");
      if (ids !== lastTrackIds) {
        lastTrackIds = ids;

        // Remove refs for deleted tracks.
        for (const id of rowRefs.keys()) {
          if (!tracks.some((t) => t.id === id)) {
            rowRefs.delete(id);
          }
        }
        // Add refs for new tracks.
        for (const track of tracks) {
          if (!rowRefs.has(track.id)) {
            rowRefs.set(track.id, buildTrackRow(track));
          }
        }
      }

      // Always refresh values after any track change (handles point additions).
      updateValues();
    });

    model.currentTimeProperty.link(updateValues);
    unitProperty.link(updateValues);

    videoLoadedProperty.link((loaded) => {
      this.visible = loaded;
    });
  }
}
