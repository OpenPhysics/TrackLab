/**
 * TrackListPanel.ts
 *
 * Right-side panel for manual particle tracking.
 *
 * Workflow:
 *  • User clicks "+ Add Track" → a new labelled track box appears (A, B, C …).
 *  • Each track box has a checkbox.  Checking it selects that track for
 *    digitizing: the cursor over the video becomes a crosshair and clicking
 *    the video records the position in model coordinates.
 *  • Only one track can be active at a time (checking one unchecks the others).
 *  • The trash icon removes the track.
 *  • The panel is hidden until a video is loaded.
 */

import { Color } from "scenerystack";
import {
  BooleanProperty,
  DerivedProperty,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import {
  Circle,
  Line,
  Node,
  Rectangle,
  Text,
  VBox,
} from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import {
  ButtonNode,
  Checkbox,
  Panel,
  RectangularPushButton,
} from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";
import type { Track } from "../model/Track.js";

// ── Layout constants ────────────────────────────────────────────────────────
const PANEL_WIDTH = 165; // inner content width
const ROW_HEIGHT = 40; // height of each track box
const BADGE_R = 13; // radius of colour badge circle
const BADGE_CX = 22; // x-centre of badge inside the row
const CHECKBOX_X = BADGE_CX + BADGE_R + 10; // left edge of checkbox
const ROW_CORNER_RADIUS = 6; // corner radius of each track row background
const ROW_BG_ALPHA = 0.15; // track colour fill alpha for row background
const ROW_STROKE_ALPHA = 0.7; // track colour stroke alpha for row border
const ROW_STROKE_WIDTH = 1.5;
const CHECKBOX_BOX_WIDTH = 14;
const TRASH_BUTTON_X_MARGIN = 6;
const TRASH_BUTTON_Y_MARGIN = 6;
const TRASH_BUTTON_RIGHT_OFFSET = 3; // inset from PANEL_WIDTH right edge
const TRACK_LIST_SPACING = 6; // gap between track rows
const PANEL_CONTENT_SPACING = 8; // gap between header, add button, and track list
const PANEL_X_MARGIN = 10;
const PANEL_Y_MARGIN = 10;
const ADD_BUTTON_X_MARGIN = 10;
const ADD_BUTTON_Y_MARGIN = 6;

const HEADER_FONT = new PhetFont({ size: 13, weight: "bold" });
const SYMBOL_FONT = new PhetFont({ size: 15, weight: "bold" });
const LABEL_FONT = new PhetFont(12);

// ── Trash-can icon ──────────────────────────────────────────────────────────

function makeTrashIcon(): Node {
  const lw = 1.5;
  const bw = 10;
  const bh = 11;

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

// ── Individual track row ────────────────────────────────────────────────────

class TrackRowNode extends Node {
  public constructor(track: Track, model: SimModel) {
    super();

    const trackColor = new Color(track.color);
    const ROW_CY = ROW_HEIGHT / 2;

    // ── Rounded background (purely visual, not pickable) ──────────────────
    const bg = new Rectangle(
      0,
      0,
      PANEL_WIDTH,
      ROW_HEIGHT,
      ROW_CORNER_RADIUS,
      ROW_CORNER_RADIUS,
      {
        fill: trackColor.withAlpha(ROW_BG_ALPHA),
        stroke: trackColor.withAlpha(ROW_STROKE_ALPHA),
        lineWidth: ROW_STROKE_WIDTH,
        pickable: false,
      },
    );

    // ── Colour badge with symbol letter ───────────────────────────────────
    const badge = new Circle(BADGE_R, {
      fill: track.color,
      x: BADGE_CX,
      y: ROW_CY,
    });

    const symbolLabel = new Text(track.symbol, {
      font: SYMBOL_FONT,
      fill: TrackLabColors.trackSymbolTextProperty,
    });
    symbolLabel.centerX = BADGE_CX;
    symbolLabel.centerY = ROW_CY;

    // ── Checkbox: activates this track for video digitizing ───────────────
    const isDigitizingProperty = new BooleanProperty(
      model.activeTrackIdProperty.value === track.id,
    );

    // Sync checkbox from model (when another track becomes active, uncheck this one).
    // Axon Properties deduplicate same-value writes, so no infinite loop can occur.
    model.activeTrackIdProperty.link((activeId) => {
      isDigitizingProperty.value = activeId === track.id;
    });

    // Sync model from checkbox
    isDigitizingProperty.lazyLink((isDigitizing) => {
      if (isDigitizing) {
        model.activeTrackIdProperty.value = track.id;
      } else if (model.activeTrackIdProperty.value === track.id) {
        model.activeTrackIdProperty.value = null;
      }
    });

    const checkbox = new Checkbox(
      isDigitizingProperty,
      new Rectangle(0, 0, 0, 0),
      {
        boxWidth: CHECKBOX_BOX_WIDTH,
        tandem: Tandem.OPT_OUT,
      },
    );
    checkbox.left = CHECKBOX_X;
    checkbox.centerY = ROW_CY;

    // ── Trash button (right side) ─────────────────────────────────────────
    const trashButton = new RectangularPushButton({
      content: makeTrashIcon(),
      baseColor: TrackLabColors.trashButtonBaseProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      xMargin: TRASH_BUTTON_X_MARGIN,
      yMargin: TRASH_BUTTON_Y_MARGIN,
      listener: () => model.removeTrack(track.id),
      tandem: Tandem.OPT_OUT,
    });
    trashButton.centerY = ROW_CY;
    trashButton.right = PANEL_WIDTH - TRASH_BUTTON_RIGHT_OFFSET;

    this.addChild(bg);
    this.addChild(badge);
    this.addChild(symbolLabel);
    this.addChild(checkbox);
    this.addChild(trashButton);
  }
}

// ── TrackListPanel ──────────────────────────────────────────────────────────

export class TrackListPanel extends Panel {
  public constructor(
    model: SimModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>,
  ) {
    const trackListStrings = StringManager.getInstance().getTrackList();

    // Width enforcer: invisible rectangle keeps the panel wide even when the
    // track list is empty.
    const widthSpacer = new Rectangle(0, 0, PANEL_WIDTH, 1, {
      fill: null,
      stroke: null,
      pickable: false,
    });

    // ── "Add Track" button ────────────────────────────────────────────────
    const addButtonEnabledProperty = new DerivedProperty(
      [videoLoadedProperty, model.canAddTrackProperty],
      (loaded, canAdd) => loaded && canAdd,
    );

    const addButton = new RectangularPushButton({
      content: new Text(trackListStrings.addTrackStringProperty, {
        font: LABEL_FONT,
        fill: TrackLabColors.textOnDarkProperty,
      }),
      baseColor: TrackLabColors.buttonBaseDarkProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      xMargin: ADD_BUTTON_X_MARGIN,
      yMargin: ADD_BUTTON_Y_MARGIN,
      enabledProperty: addButtonEnabledProperty,
      listener: () => model.addTrack(),
      tandem: Tandem.OPT_OUT,
    });

    // ── Track list (rebuilt whenever tracks change) ───────────────────────
    const trackListVBox = new VBox({
      children: [],
      spacing: TRACK_LIST_SPACING,
      align: "left",
    });

    // ── Panel content ─────────────────────────────────────────────────────
    const headerLabel = new Text(trackListStrings.tracksStringProperty, {
      font: HEADER_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });

    const content = new VBox({
      children: [widthSpacer, headerLabel, addButton, trackListVBox],
      spacing: PANEL_CONTENT_SPACING,
      align: "center",
    });

    super(content, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: PANEL_CORNER_RADIUS,
      xMargin: PANEL_X_MARGIN,
      yMargin: PANEL_Y_MARGIN,
      visible: false,
    });

    // ── Show only when video is loaded ────────────────────────────────────
    videoLoadedProperty.link((loaded) => {
      this.visible = loaded;
    });

    // ── Rebuild track rows only when track IDs change ─────────────────────
    // addPointToTrack() also replaces tracksProperty, but the set of IDs is
    // unchanged in that case, so we skip the expensive row reconstruction.
    let lastIds = "";
    model.tracksProperty.link((tracks) => {
      const ids = tracks.map((t) => t.id).join(",");
      if (ids === lastIds) return;
      lastIds = ids;
      trackListVBox.children = tracks.map(
        (track) => new TrackRowNode(track, model),
      );
    });
  }
}
