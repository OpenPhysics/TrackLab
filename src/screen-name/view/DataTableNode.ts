/**
 * DataTableNode.ts
 *
 * Panel displayed below the TrackListPanel showing the digitized position
 * of each track at (or just before) the current video frame.
 *
 * Columns: colour badge with symbol | x position | y position
 * Values are shown in the unit selected in the CalibrationToolNode.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Circle, HBox, Node, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Panel } from "scenerystack/sun";
import { Color } from "scenerystack";
import type { SimModel } from "../model/SimModel.js";
import type { Track, TrackPoint } from "../model/Track.js";
import TrackLabColors from "../../TrackLabColors.js";

const FRAME_DURATION = 1 / 30; // assumes 30 fps
const PANEL_WIDTH = 165;
const BADGE_R = 8;

const HEADER_FONT = new PhetFont( { size: 13, weight: "bold" } );
const LABEL_FONT  = new PhetFont( 11 );
const VALUE_FONT  = new PhetFont( { size: 11, weight: "bold" } );

/**
 * Returns the last TrackPoint at or before `frame`, or null if none exists.
 */
function getPointAtFrame( track: Track, frame: number ): TrackPoint | null {
  const candidates = track.points.filter( p => p.frame <= frame );
  if ( candidates.length === 0 ) return null;
  return candidates.reduce( ( best, p ) => p.frame > best.frame ? p : best );
}

/** Builds one compact row for a track. */
function buildTrackRow( track: Track, frame: number, unit: string ): Node {
  const trackColor = new Color( track.color );

  const badge = new Circle( BADGE_R, {
    fill: track.color,
  } );
  const symbolLabel = new Text( track.symbol, {
    font: new PhetFont( { size: 10, weight: "bold" } ),
    fill: "white",
  } );
  symbolLabel.center = badge.center;

  const badgeNode = new Node( { children: [ badge, symbolLabel ] } );

  const point = getPointAtFrame( track, frame );
  const xStr = point ? point.x.toFixed( 3 ) : "—";
  const yStr = point ? point.y.toFixed( 3 ) : "—";

  const xLabel = new Text( `x: ${ xStr } ${ unit }`, {
    font: LABEL_FONT,
    fill: TrackLabColors.textOnDarkProperty,
    maxWidth: PANEL_WIDTH - BADGE_R * 2 - 20,
  } );
  const yLabel = new Text( `y: ${ yStr } ${ unit }`, {
    font: LABEL_FONT,
    fill: TrackLabColors.textOnDarkProperty,
    maxWidth: PANEL_WIDTH - BADGE_R * 2 - 20,
  } );

  const valuesBox = new VBox( {
    children: [ xLabel, yLabel ],
    spacing: 2,
    align: "left",
  } );

  const bg = new Rectangle( 0, 0, PANEL_WIDTH, 0, 4, 4, {
    fill: trackColor.withAlpha( 0.12 ),
    stroke: trackColor.withAlpha( 0.5 ),
    lineWidth: 1,
    pickable: false,
  } );

  const row = new HBox( {
    children: [ badgeNode, valuesBox ],
    spacing: 8,
    align: "center",
  } );

  // Wrap in a node to add the background
  const container = new Node( { children: [ bg, row ] } );
  row.left = 6;
  row.centerY = 0;
  bg.rectHeight = row.height + 8;
  bg.top = row.top - 4;

  return container;
}

export class DataTableNode extends Panel {
  public constructor(
    model: SimModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    unitProperty: TReadOnlyProperty<string>
  ) {
    const widthSpacer = new Rectangle( 0, 0, PANEL_WIDTH, 1, {
      fill: null,
      stroke: null,
      pickable: false,
    } );

    const headerLabel = new Text( "Position Data", {
      font: HEADER_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    } );

    const noDataLabel = new Text( "No digitized points", {
      font: LABEL_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    } );

    const rowsVBox = new VBox( {
      children: [ noDataLabel ],
      spacing: 6,
      align: "left",
    } );

    const content = new VBox( {
      children: [ widthSpacer, headerLabel, rowsVBox ],
      spacing: 8,
      align: "center",
    } );

    super( content, {
      fill: TrackLabColors.panelFillProperty,
      stroke: TrackLabColors.panelStrokeProperty,
      cornerRadius: 8,
      xMargin: 10,
      yMargin: 10,
      visible: false,
    } );

    const rebuildRows = () => {
      const tracks = model.tracksProperty.value;
      const currentFrame = Math.round( model.currentTimeProperty.value / FRAME_DURATION );
      const unit = unitProperty.value;

      // Find tracks that have at least one point at or before the current frame.
      const tracksWithData = tracks.filter( t => t.points.some( p => p.frame <= currentFrame ) );

      if ( tracksWithData.length === 0 ) {
        rowsVBox.children = [ noDataLabel ];
      }
      else {
        rowsVBox.children = tracksWithData.map( t => buildTrackRow( t, currentFrame, unit ) );
      }
    };

    model.tracksProperty.link( rebuildRows );
    model.currentTimeProperty.link( rebuildRows );
    unitProperty.link( rebuildRows );

    videoLoadedProperty.link( loaded => {
      this.visible = loaded;
    } );
  }
}
