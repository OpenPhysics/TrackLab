import { Circle, HBox, Line, Node, Text, VBox } from "scenerystack/scenery";
import { ArrowNode, PhetFont } from "scenerystack/scenery-phet";
import { Checkbox, Panel } from "scenerystack/sun";
import type { SimModel } from "../model/SimModel.js";

const LABEL_FONT = new PhetFont( 13 );
const ICON_SIZE = 20; // bounding box each icon targets
const LABEL_COLOR = '#ddd';

// ── Icons ─────────────────────────────────────────────────────────────────

/** Two small XY arrows. */
function axesIcon(): Node {
  const xArrow = new ArrowNode( 0, ICON_SIZE * 0.7, ICON_SIZE * 0.85, ICON_SIZE * 0.7, {
    fill: '#f44', stroke: null, headWidth: 5, headHeight: 5, tailWidth: 1.5,
  } );
  const yArrow = new ArrowNode( 0, ICON_SIZE * 0.7, 0, ICON_SIZE * 0.05, {
    fill: '#4c4', stroke: null, headWidth: 5, headHeight: 5, tailWidth: 1.5,
  } );
  return new Node( { children: [ xArrow, yArrow ] } );
}

/** Two endpoint dots joined by a dashed line. */
function calibrationIcon(): Node {
  const cx = ICON_SIZE * 0.5;
  const cy = ICON_SIZE * 0.5;
  const half = ICON_SIZE * 0.4;
  return new Node( {
    children: [
      new Line( cx - half, cy, cx + half, cy, {
        stroke: 'rgba(255,255,100,0.9)', lineWidth: 1.5, lineDash: [ 3, 2 ],
      } ),
      new Circle( 3, { fill: 'rgba(255,255,100,0.9)', x: cx - half, y: cy } ),
      new Circle( 3, { fill: 'rgba(255,255,100,0.9)', x: cx + half, y: cy } ),
    ],
  } );
}

/** Circle with a diagonal handle — magnifying glass silhouette. */
function magnifyIcon(): Node {
  const r = ICON_SIZE * 0.32;
  const cx = r + 1;
  const cy = r + 1;
  return new Node( {
    children: [
      new Circle( r, { stroke: '#bbb', lineWidth: 1.5, fill: null, x: cx, y: cy } ),
      new Line( cx + r * 0.7, cy + r * 0.7, ICON_SIZE - 1, ICON_SIZE - 1, {
        stroke: '#bbb', lineWidth: 2,
      } ),
    ],
  } );
}

/** Crosshair with a small centre dot — tracking target. */
function trackingIcon(): Node {
  const cx = ICON_SIZE * 0.5;
  const cy = ICON_SIZE * 0.5;
  const r = ICON_SIZE * 0.35;
  const gap = ICON_SIZE * 0.15;
  return new Node( {
    children: [
      new Circle( r, { stroke: '#bbb', lineWidth: 1.5, fill: null, x: cx, y: cy } ),
      new Circle( 2, { fill: '#bbb', x: cx, y: cy } ),
      new Line( cx, cy - r - gap, cx, cy - gap, { stroke: '#bbb', lineWidth: 1 } ),
      new Line( cx, cy + gap, cx, cy + r + gap, { stroke: '#bbb', lineWidth: 1 } ),
      new Line( cx - r - gap, cy, cx - gap, cy, { stroke: '#bbb', lineWidth: 1 } ),
      new Line( cx + gap, cy, cx + r + gap, cy, { stroke: '#bbb', lineWidth: 1 } ),
    ],
  } );
}

// ── Helper ────────────────────────────────────────────────────────────────

function makeRow( icon: Node, label: string, property: SimModel['axesVisibleProperty'] ): Checkbox {
  const content = new HBox( {
    children: [
      icon,
      new Text( label, { font: LABEL_FONT, fill: LABEL_COLOR } ),
    ],
    spacing: 8,
    align: 'center',
  } );
  return new Checkbox( property, content, {
    checkboxColor: '#ddd',
    checkboxColorBackground: 'rgba(255,255,255,0.1)',
  } );
}

// ── ControlPanel class ────────────────────────────────────────────────────

export class ControlPanel extends Panel {
  public constructor( model: SimModel ) {
    const rows = new VBox( {
      children: [
        makeRow( axesIcon(),        'Axes Visible',              model.axesVisibleProperty ),
        makeRow( calibrationIcon(), 'Calibration Tool Visible',  model.calibrationVisibleProperty ),
        makeRow( magnifyIcon(),     'Magnify Around Cursor',     model.magnifyVideoProperty ),
        makeRow( trackingIcon(),    'Enable Auto Tracking',      model.autoTrackingProperty ),
      ],
      spacing: 12,
      align: 'left',
    } );

    super( rows, {
      fill: 'rgba(20, 20, 40, 0.92)',
      stroke: '#555',
      cornerRadius: 8,
      xMargin: 12,
      yMargin: 12,
    } );
  }
}
