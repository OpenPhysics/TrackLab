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

import { BooleanProperty } from "scenerystack/axon";
import type { TReadOnlyProperty } from "scenerystack/axon";
import { Circle, Line, Node, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox, Panel, RectangularPushButton } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { Color } from "scenerystack";
import type { SimModel } from "../model/SimModel.js";
import type { Track } from "../model/Track.js";
import TrackLabColors from "../../TrackLabColors.js";

// ── Layout constants ────────────────────────────────────────────────────────
const PANEL_WIDTH = 165;   // inner content width
const ROW_HEIGHT  = 40;    // height of each track box
const BADGE_R     = 13;    // radius of colour badge circle
const BADGE_CX    = 22;    // x-centre of badge inside the row
const TRASH_W     = 34;    // width of the trash button column
const CHECKBOX_X  = BADGE_CX + BADGE_R + 10; // left edge of checkbox

const HEADER_FONT = new PhetFont( { size: 13, weight: 'bold' } );
const SYMBOL_FONT = new PhetFont( { size: 15, weight: 'bold' } );
const LABEL_FONT  = new PhetFont( 12 );

// ── Trash-can icon ──────────────────────────────────────────────────────────

function makeTrashIcon(): Node {
  const s = '#ff6666';
  const lw = 1.5;
  const bw = 10;
  const bh = 11;

  const body   = new Rectangle( 0, 0, bw, bh, 1, 1, { stroke: s, lineWidth: lw, fill: null } );
  const lid    = new Rectangle( -1.5, -3.5, bw + 3, 3, 0, 0, { stroke: s, lineWidth: lw, fill: null } );
  const handle = new Rectangle( 2.5, -7, 5, 3.5, 1, 1, { stroke: s, lineWidth: lw, fill: null } );
  const l1     = new Line( bw / 4,       2, bw / 4,       bh - 2, { stroke: s, lineWidth: 1 } );
  const l2     = new Line( bw / 2,       2, bw / 2,       bh - 2, { stroke: s, lineWidth: 1 } );
  const l3     = new Line( bw * 3 / 4,   2, bw * 3 / 4,   bh - 2, { stroke: s, lineWidth: 1 } );

  return new Node( { children: [ handle, lid, body, l1, l2, l3 ] } );
}

// ── Individual track row ────────────────────────────────────────────────────

class TrackRowNode extends Node {
  public constructor( track: Track, model: SimModel ) {
    super();

    const trackColor = new Color( track.color );
    const ROW_CY = ROW_HEIGHT / 2;

    // ── Rounded background (purely visual, not pickable) ──────────────────
    const bg = new Rectangle( 0, 0, PANEL_WIDTH, ROW_HEIGHT, 6, 6, {
      fill: trackColor.withAlpha( 0.15 ),
      stroke: trackColor.withAlpha( 0.7 ),
      lineWidth: 1.5,
      pickable: false,
    } );

    // ── Colour badge with symbol letter ───────────────────────────────────
    const badge = new Circle( BADGE_R, {
      fill: track.color,
      x: BADGE_CX,
      y: ROW_CY,
    } );

    const symbolLabel = new Text( track.symbol, {
      font: SYMBOL_FONT,
      fill: 'white',
    } );
    symbolLabel.centerX = BADGE_CX;
    symbolLabel.centerY = ROW_CY;

    // ── Checkbox: activates this track for video digitizing ───────────────
    const isDigitizingProperty = new BooleanProperty( model.activeTrackIdProperty.value === track.id );

    // Sync checkbox from model (when another track becomes active, uncheck this one)
    model.activeTrackIdProperty.link( activeId => {
      const shouldBeChecked = activeId === track.id;
      if ( isDigitizingProperty.value !== shouldBeChecked ) {
        isDigitizingProperty.value = shouldBeChecked;
      }
    } );

    // Sync model from checkbox
    isDigitizingProperty.lazyLink( isDigitizing => {
      if ( isDigitizing ) {
        model.activeTrackIdProperty.value = track.id;
      }
      else if ( model.activeTrackIdProperty.value === track.id ) {
        model.activeTrackIdProperty.value = null;
      }
    } );

    const checkbox = new Checkbox( isDigitizingProperty, new Rectangle( 0, 0, 0, 0 ), {
      boxWidth: 14,
      tandem: Tandem.OPT_OUT,
    } );
    checkbox.left    = CHECKBOX_X;
    checkbox.centerY = ROW_CY;

    // ── Trash button (right side) ─────────────────────────────────────────
    const trashButton = new RectangularPushButton( {
      content: makeTrashIcon(),
      baseColor: new Color( 60, 20, 20, 0.5 ),
      xMargin: 6,
      yMargin: 6,
      listener: () => model.removeTrack( track.id ),
      tandem: Tandem.OPT_OUT,
    } );
    trashButton.centerY = ROW_CY;
    trashButton.right   = PANEL_WIDTH - 3;

    this.addChild( bg );
    this.addChild( badge );
    this.addChild( symbolLabel );
    this.addChild( checkbox );
    this.addChild( trashButton );
  }
}

// ── TrackListPanel ──────────────────────────────────────────────────────────

export class TrackListPanel extends Panel {
  public constructor(
    model: SimModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>
  ) {
    // Width enforcer: invisible rectangle keeps the panel wide even when the
    // track list is empty.
    const widthSpacer = new Rectangle( 0, 0, PANEL_WIDTH, 1, { fill: null, stroke: null, pickable: false } );

    // ── "Add Track" button ────────────────────────────────────────────────
    const addButtonEnabledProperty = new BooleanProperty( false );

    const addButton = new RectangularPushButton( {
      content: new Text( '+ Add Track', {
        font: LABEL_FONT,
        fill: TrackLabColors.textOnDarkProperty,
      } ),
      baseColor: TrackLabColors.buttonBaseDarkProperty,
      xMargin: 10,
      yMargin: 6,
      enabledProperty: addButtonEnabledProperty,
      listener: () => model.addTrack(),
      tandem: Tandem.OPT_OUT,
    } );

    // ── Track list (rebuilt whenever tracks change) ───────────────────────
    const trackListVBox = new VBox( {
      children: [],
      spacing: 6,
      align: 'left',
    } );

    // ── Panel content ─────────────────────────────────────────────────────
    const headerLabel = new Text( 'Tracks', {
      font: HEADER_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    } );

    const content = new VBox( {
      children: [ widthSpacer, headerLabel, addButton, trackListVBox ],
      spacing: 8,
      align: 'center',
    } );

    super( content, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: 8,
      xMargin: 10,
      yMargin: 10,
      visible: false,
    } );

    // ── Show only when video is loaded ────────────────────────────────────
    videoLoadedProperty.link( loaded => {
      this.visible = loaded;
      addButtonEnabledProperty.value = loaded && model.canAddTrack();
    } );

    // ── Rebuild track rows on every track change ──────────────────────────
    model.tracksProperty.link( tracks => {
      trackListVBox.children = tracks.map( track => new TrackRowNode( track, model ) );
      addButtonEnabledProperty.value = model.canAddTrack();
    } );
  }
}
