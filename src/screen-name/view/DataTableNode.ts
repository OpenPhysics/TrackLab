/**
 * DataTableNode.ts
 *
 * Scrollable (vertical + horizontal) data table rendered as an HTML <table>
 * inside a fixed-size <div overflow:auto>, wrapped in a Scenery DOM node.
 *
 *   Row 0  — header: Frame | Time (s) | X_A (cm) | Y_A (cm) | X_B (cm) | …
 *   Row 1+ — one row per unique frame number, sorted ascending.
 *
 * A download button in the title row exports the current data as a CSV file
 * named export1.csv, export2.csv, … on successive clicks.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { DOM, HBox, Line, Node, Path, Text, VBox } from "scenerystack/scenery";
import { Shape } from "scenerystack/kite";
import { PhetFont } from "scenerystack/scenery-phet";
import { Panel, RectangularPushButton } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { Color } from "scenerystack";
import type { SimModel } from "../model/SimModel.js";
import TrackLabColors from "../../TrackLabColors.js";

const TITLE_FONT = new PhetFont( { size: 13, weight: 'bold' } );

// ── Palette ───────────────────────────────────────────────────────────────────
const C_HEADER_BG    = '#1c4587';
const C_ROW_ODD      = '#1a2840';
const C_ROW_EVEN     = '#243550';
const C_GRID         = 'rgba(100,130,180,0.45)';
const C_TEXT         = '#ffffff';
const C_TEXT_DIM     = 'rgba(255,255,255,0.38)';
const C_SCROLL_BG    = '#0e1b2b';
const C_SCROLL_THUMB = '#445a78';

// ── Column widths (px) ────────────────────────────────────────────────────────
const W_FRAME = 50;
const W_TIME  = 68;
const W_XY    = 76;

// ── Shared cell styles ────────────────────────────────────────────────────────
const BASE_CELL = `padding:3px 6px;border:0.5px solid ${C_GRID};text-align:center;white-space:nowrap;`;
const HDR_CELL  = `${BASE_CELL}background:${C_HEADER_BG};font-weight:bold;`;

// ── Inject WebKit scrollbar CSS once ─────────────────────────────────────────
if ( !document.getElementById( 'tracklab-scroll-styles' ) ) {
  const s = document.createElement( 'style' );
  s.id = 'tracklab-scroll-styles';
  s.textContent = `
    .tl-scroll::-webkit-scrollbar          { width:6px; height:6px }
    .tl-scroll::-webkit-scrollbar-track    { background:${C_SCROLL_BG} }
    .tl-scroll::-webkit-scrollbar-thumb    { background:${C_SCROLL_THUMB}; border-radius:3px }
    .tl-scroll::-webkit-scrollbar-corner   { background:${C_SCROLL_BG} }
  `;
  document.head.appendChild( s );
}

// ── Download icon ─────────────────────────────────────────────────────────────
function makeDownloadIcon(): Node {
  const stroke = 'white';
  const lw = 1.5;
  const r = 7; // half-height of icon

  // Stem: vertical line from top down to just above arrowhead tip
  const stem = new Line( 0, -r, 0, r * 0.1, { stroke, lineWidth: lw } );

  // Arrowhead: chevron pointing down
  const arrowShape = new Shape()
    .moveTo( -r * 0.55, -r * 0.3 )
    .lineTo( 0, r * 0.5 )
    .lineTo( r * 0.55, -r * 0.3 );
  const arrow = new Path( arrowShape, { stroke, lineWidth: lw, fill: null } );

  // Tray: horizontal line at bottom
  const tray = new Line( -r * 0.7, r, r * 0.7, r, { stroke, lineWidth: lw } );

  return new Node( { children: [ stem, arrow, tray ] } );
}

// ── DataTableNode ─────────────────────────────────────────────────────────────

export class DataTableNode extends Panel {
  public constructor(
    model: SimModel,
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    unitProperty: TReadOnlyProperty<string>
  ) {

    // ── Scrollable DOM container ──────────────────────────────────────────
    const container = document.createElement( 'div' );
    container.className = 'tl-scroll';
    Object.assign( container.style, {
      width:          '285px',
      height:         '280px',
      overflow:       'auto',
      background:     C_SCROLL_BG,
      borderRadius:   '2px',
      scrollbarWidth: 'thin',
      scrollbarColor: `${C_SCROLL_THUMB} ${C_SCROLL_BG}`,
    } );

    const table = document.createElement( 'table' );
    Object.assign( table.style, {
      borderCollapse: 'collapse',
      fontFamily:     '"Courier New", Courier, monospace',
      fontSize:       '11px',
      color:          C_TEXT,
      width:          'max-content',
    } );
    container.appendChild( table );

    // ── CSV generator (shared by rebuild & download) ──────────────────────
    const buildCSV = (): string => {
      const tracks = [ ...model.tracksProperty.value ];

      const unit = unitProperty.value;
      const headers = [ 'Frame', 'Time (s)',
        ...tracks.flatMap( t => [ `X_${ t.symbol } (${ unit })`, `Y_${ t.symbol } (${ unit })` ] ),
      ];

      const allFrames = new Set<number>();
      for ( const track of tracks ) {
        for ( const pt of track.points ) allFrames.add( pt.frame );
      }
      const sortedFrames = [ ...allFrames ].sort( ( a, b ) => a - b );

      const lines: string[] = [ headers.join( ',' ) ];
      sortedFrames.forEach( frame => {
        let time = 0;
        for ( const track of tracks ) {
          const pt = track.points.find( p => p.frame === frame );
          if ( pt ) { time = pt.time; break; }
        }
        const row = [ String( frame ), time.toFixed( 3 ),
          ...tracks.flatMap( track => {
            const pt = track.points.find( p => p.frame === frame );
            return pt ? [ pt.x.toFixed( 3 ), pt.y.toFixed( 3 ) ] : [ '', '' ];
          } ),
        ];
        lines.push( row.join( ',' ) );
      } );
      return lines.join( '\r\n' );
    };

    // ── Rebuild HTML table ────────────────────────────────────────────────
    const rebuild = () => {
      const tracks = [ ...model.tracksProperty.value ];

      let html = '<thead><tr>';
      const unit = unitProperty.value;
      html += `<th style="${HDR_CELL}width:${W_FRAME}px;color:${C_TEXT}">Frame</th>`;
      html += `<th style="${HDR_CELL}width:${W_TIME}px;color:${C_TEXT}">Time (s)</th>`;
      tracks.forEach( track => {
        html += `<th style="${HDR_CELL}width:${W_XY}px;color:${track.color}">X<sub>${ track.symbol }</sub>&nbsp;(${ unit })</th>`;
        html += `<th style="${HDR_CELL}width:${W_XY}px;color:${track.color}">Y<sub>${ track.symbol }</sub>&nbsp;(${ unit })</th>`;
      } );
      html += '</tr></thead>';

      const allFrames = new Set<number>();
      for ( const track of tracks ) {
        for ( const pt of track.points ) allFrames.add( pt.frame );
      }
      const sortedFrames = [ ...allFrames ].sort( ( a, b ) => a - b );

      html += '<tbody>';
      sortedFrames.forEach( ( frame, idx ) => {
        const rowBg = idx % 2 === 0 ? C_ROW_ODD : C_ROW_EVEN;

        let time = 0;
        for ( const track of tracks ) {
          const pt = track.points.find( p => p.frame === frame );
          if ( pt ) { time = pt.time; break; }
        }

        html += `<tr style="background:${rowBg}">`;
        html += `<td style="${BASE_CELL}">${ frame }</td>`;
        html += `<td style="${BASE_CELL}">${ time.toFixed( 3 ) }</td>`;
        tracks.forEach( track => {
          const pt   = track.points.find( p => p.frame === frame );
          const xTxt = pt ? pt.x.toFixed( 3 ) : '&mdash;';
          const yTxt = pt ? pt.y.toFixed( 3 ) : '&mdash;';
          const dim  = pt ? '' : `color:${C_TEXT_DIM};`;
          html += `<td style="${BASE_CELL}${dim}">${ xTxt }</td>`;
          html += `<td style="${BASE_CELL}${dim}">${ yTxt }</td>`;
        } );
        html += '</tr>';
      } );
      html += '</tbody>';

      table.innerHTML = html;
    };

    model.tracksProperty.link( () => rebuild() );
    unitProperty.link( () => rebuild() );

    // ── Download button ───────────────────────────────────────────────────
    let exportCounter = 1;

    const downloadButton = new RectangularPushButton( {
      content: makeDownloadIcon(),
      baseColor: new Color( 30, 50, 80, 0.8 ),
      xMargin: 5,
      yMargin: 5,
      tandem: Tandem.OPT_OUT,
      listener: () => {
        const csv  = buildCSV();
        const blob = new Blob( [ csv ], { type: 'text/csv;charset=utf-8;' } );
        const url  = URL.createObjectURL( blob );
        const a    = document.createElement( 'a' );
        a.href     = url;
        a.download = `export${ exportCounter }.csv`;
        a.click();
        URL.revokeObjectURL( url );
        exportCounter++;
      },
    } );

    // ── Scenery wrapper ───────────────────────────────────────────────────
    const domNode = new DOM( container, { allowInput: true } );

    const titleLabel = new Text( 'Data', {
      font: TITLE_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    } );

    const titleRow = new HBox( {
      children: [ titleLabel, downloadButton ],
      spacing:  8,
      align:    'center',
    } );

    const content = new VBox( {
      children: [ titleRow, domNode ],
      spacing:  6,
      align:    'left',
    } );

    super( content, {
      fill:         TrackLabColors.panelFillProperty,
      stroke:       TrackLabColors.panelStrokeProperty,
      cornerRadius: 8,
      xMargin:      10,
      yMargin:      10,
      visible:      false,
    } );

    videoLoadedProperty.link( loaded => { this.visible = loaded; } );
  }
}
