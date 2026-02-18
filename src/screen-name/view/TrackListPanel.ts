/**
 * TrackListPanel.ts
 *
 * Right-side panel for manual particle tracking.
 *
 * Workflow:
 *  • User clicks "+ Add Track" → a new labelled track box appears (A, B, C …).
 *  • Clicking the track box records a data point at the current frame and
 *    advances the video by one frame (manual digitising).
 *  • The trash icon removes the track.
 *  • The panel is hidden until a video is loaded.
 */

import { BooleanProperty } from "scenerystack/axon";
import type { TReadOnlyProperty } from "scenerystack/axon";
import { Circle, FireListener, Line, Node, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Panel, RectangularPushButton } from "scenerystack/sun";
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

const HEADER_FONT = new PhetFont( { size: 13, weight: 'bold' } );
const SYMBOL_FONT = new PhetFont( { size: 15, weight: 'bold' } );
const LABEL_FONT  = new PhetFont( 12 );

const FRAME_DURATION = 1 / 30; // seconds per frame (30 fps)

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
  public constructor( track: Track, model: SimModel, onTag: () => void ) {
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

    // ── Clickable zone (left of the trash button) ─────────────────────────
    // Separate transparent rectangle so the trash button events don't bubble
    // up through the same handler.
    const clickZone = new Rectangle( 0, 0, PANEL_WIDTH - TRASH_W, ROW_HEIGHT, 0, 0, {
      fill: 'transparent',
      cursor: 'pointer',
    } );
    clickZone.addInputListener( new FireListener( {
      fire: onTag,
      tandem: Tandem.OPT_OUT,
    } ) );

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
    this.addChild( clickZone );
    this.addChild( badge );
    this.addChild( symbolLabel );
    this.addChild( trashButton );
  }
}

// ── TrackListPanel ──────────────────────────────────────────────────────────

export class TrackListPanel extends Panel {
  public constructor(
    model: SimModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    onStepForward: () => void
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
      trackListVBox.children = tracks.map( track => {
        const onTag = () => {
          const frame = Math.round( model.currentTimeProperty.value / FRAME_DURATION );
          model.addPointToTrack( track.id, frame, model.currentTimeProperty.value );
          onStepForward();
        };
        return new TrackRowNode( track, model, onTag );
      } );

      addButtonEnabledProperty.value = model.canAddTrack();
    } );
  }
}
