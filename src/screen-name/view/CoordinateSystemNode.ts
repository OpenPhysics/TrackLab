import { Circle, Node, RichDragListener, Text } from "scenerystack/scenery";
import { ArrowNode, PhetFont } from "scenerystack/scenery-phet";
import { Tandem } from "scenerystack/tandem";
import type { TReadOnlyProperty } from "scenerystack/axon";
import type { SimModel } from "../model/SimModel.js";
import TrackLabColors from "../../TrackLabColors.js";

const ARROW_LENGTH = 120;
const HANDLE_FRACTION = 1 / 3;
const FONT = new PhetFont( { size: 14, weight: 'bold' } );

export class CoordinateSystemNode extends Node {
  public constructor( videoLoadedProperty: TReadOnlyProperty<boolean>, model: SimModel ) {
    super();

    // ── Rotating node: axes + rotation handle ─────────────────────────────
    const rotatingNode = new Node();

    // X axis arrow (horizontal, pointing right)
    rotatingNode.addChild( new ArrowNode( 0, 0, ARROW_LENGTH, 0, {
      fill: TrackLabColors.axisXColorProperty,
      stroke: null,
      headWidth: 12,
      headHeight: 10,
      tailWidth: 3,
    } ) );

    // Y axis arrow (vertical, pointing up — negative Y in screen coords)
    rotatingNode.addChild( new ArrowNode( 0, 0, 0, -ARROW_LENGTH, {
      fill: TrackLabColors.axisYColorProperty,
      stroke: null,
      headWidth: 12,
      headHeight: 10,
      tailWidth: 3,
    } ) );

    rotatingNode.addChild( new Text( 'x', {
      font: FONT,
      fill: TrackLabColors.axisXColorProperty,
      left: ARROW_LENGTH + 6,
      centerY: 0,
    } ) );

    rotatingNode.addChild( new Text( 'y', {
      font: FONT,
      fill: TrackLabColors.axisYColorProperty,
      centerX: 0,
      bottom: -ARROW_LENGTH - 4,
    } ) );

    // Small disk at 1/3 of the way along the x-axis; dragging it rotates the system
    const handleDisk = new Circle( 8, {
      x: ARROW_LENGTH * HANDLE_FRACTION,
      y: 0,
      fill: TrackLabColors.calibrationHandleProperty,
      stroke: TrackLabColors.textOnDarkProperty,
      lineWidth: 1.5,
      cursor: 'crosshair',
      tagName: 'div',
      focusable: true,
      accessibleName: 'Rotation Handle',
    } );
    rotatingNode.addChild( handleDisk );

    // ── Origin marker ─────────────────────────────────────────────────────
    const originMarker = new Circle( 5, {
      fill: TrackLabColors.originFillProperty,
      stroke: TrackLabColors.originStrokeProperty,
      lineWidth: 1,
    } );

    // ── Position wrapper: translates with model.coordOriginProperty ───────
    const positionNode = new Node( {
      children: [ rotatingNode, originMarker ],
      cursor: 'move',
      tagName: 'div',
      focusable: true,
      accessibleName: 'Coordinate System',
    } );
    this.addChild( positionNode );

    // ── Property → scene-graph linkage ────────────────────────────────────
    model.coordOriginProperty.link( pos => { positionNode.translation = pos; } );
    model.coordAngleProperty.link( angle => { rotatingNode.rotation = angle; } );

    // ── Drag: translate the entire coordinate system ──────────────────────
    positionNode.addInputListener( new RichDragListener( {
      positionProperty: model.coordOriginProperty,
      keyboardDragListenerOptions: {
        dragSpeed: 300,
        shiftDragSpeed: 50,
      },
      tandem: Tandem.OPT_OUT,
    } ) );

    // ── Drag: rotate around origin ────────────────────────────────────────
    // Dragging the handle disk updates the rotation angle based on the
    // pointer's angle relative to the coordinate-system origin.
    handleDisk.addInputListener( new RichDragListener( {
      dragListenerOptions: {
        drag: ( event ) => {
          const p = positionNode.globalToLocalPoint( event.pointer.point );
          model.coordAngleProperty.value = Math.atan2( p.y, p.x );
        },
      },
      keyboardDragListenerOptions: {
        keyboardDragDirection: 'leftRight',
        dragSpeed: 100,
        shiftDragSpeed: 20,
        drag: ( _event, listener ) => {
          model.coordAngleProperty.value += listener.modelDelta.x * ( Math.PI / 180 );
        },
      },
      tandem: Tandem.OPT_OUT,
    } ) );

    // ── Visibility: only shown once a video with a finite duration is loaded
    videoLoadedProperty.link( loaded => { this.visible = loaded; } );
  }
}
