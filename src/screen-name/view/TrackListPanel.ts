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

import { BooleanProperty, DerivedProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { Circle, Node, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox, Panel } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import { createTrackLabButton } from "../../TrackLabButton.js";
import TrackLabColors, { getTrackColor } from "../../TrackLabColors.js";
import { makePlusIcon, makeTrashIcon } from "../../TrackLabIcons.js";

const a11yStrings = StringManager.getInstance().getA11y();

import { PANEL_CORNER_RADIUS } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import type { Track } from "../model/Track.js";
import type { TrackingModel } from "../model/TrackingModel.js";

// ── Layout constants ────────────────────────────────────────────────────────
const PANEL_WIDTH = 110; // inner content width (reduced from 165)
const ROW_HEIGHT = 30; // height of each track box (reduced from 40)
const BADGE_R = 10; // radius of colour badge circle (reduced from 13)
const BADGE_CX = 16; // x-centre of badge inside the row (reduced from 22)
const CHECKBOX_X = BADGE_CX + BADGE_R + 6; // left edge of checkbox (reduced gap from 10)
const ROW_CORNER_RADIUS = 4; // corner radius of each track row background (reduced from 6)
const ROW_BG_ALPHA = 0.15; // track colour fill alpha for row background
const ROW_STROKE_ALPHA = 0.7; // track colour stroke alpha for row border
const ROW_STROKE_WIDTH = 1.5;
const CHECKBOX_BOX_WIDTH = 12; // reduced from 14
const TRASH_BUTTON_RIGHT_OFFSET = 2; // inset from PANEL_WIDTH right edge (reduced from 3)
const TRACK_LIST_SPACING = 4; // gap between track rows (reduced from 6)
const PANEL_CONTENT_SPACING = 6; // gap between header, add button, and track list (reduced from 8)
const PANEL_X_MARGIN = 8; // reduced from 10
const PANEL_Y_MARGIN = 8; // reduced from 10

const HEADER_FONT = new PhetFont({ size: 11, weight: "bold" }); // reduced from 13
const SYMBOL_FONT = new PhetFont({ size: 12, weight: "bold" }); // reduced from 15

// ── Individual track row ────────────────────────────────────────────────────

class TrackRowNode extends Node {
  private readonly disposeTrackRowNode: () => void;

  public constructor(track: Track, tracking: TrackingModel) {
    super();

    // colorIndex is always in range 0..TRACK_COLORS.length-1 by construction
    const trackColor = getTrackColor(track.colorIndex);
    const ROW_CY = ROW_HEIGHT / 2;

    // ── Rounded background (purely visual, not pickable) ──────────────────
    const bg = new Rectangle(0, 0, PANEL_WIDTH, ROW_HEIGHT, ROW_CORNER_RADIUS, ROW_CORNER_RADIUS, {
      fill: trackColor.withAlpha(ROW_BG_ALPHA),
      stroke: trackColor.withAlpha(ROW_STROKE_ALPHA),
      lineWidth: ROW_STROKE_WIDTH,
      pickable: false,
    });

    // ── Colour badge with symbol letter ───────────────────────────────────
    const badge = new Circle(BADGE_R, {
      fill: trackColor,
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
    const isDigitizingProperty = new BooleanProperty(tracking.activeTrackIdProperty.value === track.id);

    // Sync checkbox from model (when another track becomes active, uncheck this one).
    // Axon Properties deduplicate same-value writes, so no infinite loop can occur.
    const activeTrackListener = (activeId: string | null) => {
      isDigitizingProperty.value = activeId === track.id;
    };
    tracking.activeTrackIdProperty.link(activeTrackListener);

    // Sync model from checkbox
    const digitizingListener = (isDigitizing: boolean) => {
      if (isDigitizing) {
        tracking.activeTrackIdProperty.value = track.id;
      } else if (tracking.activeTrackIdProperty.value === track.id) {
        tracking.activeTrackIdProperty.value = null;
      }
    };
    isDigitizingProperty.lazyLink(digitizingListener);

    const checkbox = new Checkbox(isDigitizingProperty, new Rectangle(0, 0, 0, 0), {
      boxWidth: CHECKBOX_BOX_WIDTH,
      tandem: Tandem.OPT_OUT,
      accessibleName: a11yStrings.digitizeTrackStringProperty.value.replace("{{symbol}}", track.symbol),
    });
    checkbox.left = CHECKBOX_X;
    checkbox.centerY = ROW_CY;

    // ── Trash button (right side) ─────────────────────────────────────────
    const trashButton = createTrackLabButton(makeTrashIcon(), {
      baseColor: TrackLabColors.trashButtonBaseProperty,
      listener: () => tracking.removeTrack(track.id),
      accessibleName: a11yStrings.removeTrackStringProperty.value.replace("{{symbol}}", track.symbol),
    });
    trashButton.centerY = ROW_CY;
    trashButton.right = PANEL_WIDTH - TRASH_BUTTON_RIGHT_OFFSET;

    this.addChild(bg);
    this.addChild(badge);
    this.addChild(symbolLabel);
    this.addChild(checkbox);
    this.addChild(trashButton);

    // Store cleanup function
    this.disposeTrackRowNode = () => {
      tracking.activeTrackIdProperty.unlink(activeTrackListener);
      isDigitizingProperty.unlink(digitizingListener);
      checkbox.dispose();
      trashButton.dispose();
      isDigitizingProperty.dispose();
    };
  }

  public override dispose(): void {
    this.disposeTrackRowNode();
    super.dispose();
  }
}

// ── TrackListPanel ──────────────────────────────────────────────────────────

export class TrackListPanel extends Panel {
  private readonly disposeTrackListPanel: () => void;

  public constructor(tracking: TrackingModel, videoLoadedProperty: TReadOnlyProperty<boolean>) {
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
      [videoLoadedProperty, tracking.canAddTrackProperty],
      (loaded, canAdd) => loaded && canAdd,
    );

    const addButton = createTrackLabButton(makePlusIcon(), {
      enabledProperty: addButtonEnabledProperty,
      listener: () => tracking.addTrack(),
      accessibleName: trackListStrings.addTrackStringProperty,
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
    const videoLoadedListener = (loaded: boolean) => {
      this.visible = loaded;
    };
    videoLoadedProperty.link(videoLoadedListener);

    // ── Rebuild track rows only when track IDs change ─────────────────────
    // addPointToTrack() also replaces tracksProperty, but the set of IDs is
    // unchanged in that case, so we skip the expensive row reconstruction.
    let lastIds = "";
    const tracksListener = (tracks: readonly Track[]) => {
      const ids = tracks.map((t) => t.id).join(",");
      if (ids === lastIds) {
        return;
      }
      lastIds = ids;
      // Dispose old track rows before creating new ones
      for (const child of trackListVBox.children) {
        if (child instanceof TrackRowNode) {
          child.dispose();
        }
      }
      trackListVBox.children = tracks.map((track) => new TrackRowNode(track, tracking));
    };
    tracking.tracksProperty.link(tracksListener);

    // Store cleanup function
    this.disposeTrackListPanel = () => {
      videoLoadedProperty.unlink(videoLoadedListener);
      tracking.tracksProperty.unlink(tracksListener);
      // Dispose all track rows
      for (const child of trackListVBox.children) {
        if (child instanceof TrackRowNode) {
          child.dispose();
        }
      }
      addButtonEnabledProperty.dispose();
      addButton.dispose();
    };
  }

  public override dispose(): void {
    this.disposeTrackListPanel();
    super.dispose();
  }
}

trackLab.register("TrackListPanel", TrackListPanel);
