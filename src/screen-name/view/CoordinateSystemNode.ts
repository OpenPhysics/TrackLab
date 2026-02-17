import { Circle, DragListener, Node, Text } from "scenerystack/scenery";
import { ArrowNode, PhetFont } from "scenerystack/scenery-phet";
import { Vector2 } from "scenerystack/dot";
import { NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";

const ARROW_LENGTH = 120;
const HANDLE_FRACTION = 1 / 3;
const FONT = new PhetFont( { size: 14, weight: 'bold' } );

export class CoordinateSystemNode extends Node {
  private readonly viewPositionProperty: Property<Vector2>;
  private readonly rotationAngleProperty: NumberProperty;

  public constructor( videoLoadedProperty: TReadOnlyProperty<boolean>, initialPosition: Vector2 ) {
    super();

    this.viewPositionProperty = new Property<Vector2>( initialPosition.copy() );
    this.rotationAngleProperty = new NumberProperty( 0 );

    // ── Rotating node: axes + rotation handle ─────────────────────────────
    const rotatingNode = new Node();

    // X axis arrow (horizontal, pointing right)
    rotatingNode.addChild( new ArrowNode( 0, 0, ARROW_LENGTH, 0, {
      fill: '#f44',
      stroke: null,
      headWidth: 12,
      headHeight: 10,
      tailWidth: 3,
    } ) );

    // Y axis arrow (vertical, pointing up — negative Y in screen coords)
    rotatingNode.addChild( new ArrowNode( 0, 0, 0, -ARROW_LENGTH, {
      fill: '#4c4',
      stroke: null,
      headWidth: 12,
      headHeight: 10,
      tailWidth: 3,
    } ) );

    rotatingNode.addChild( new Text( 'x', {
      font: FONT,
      fill: '#f44',
      left: ARROW_LENGTH + 6,
      centerY: 0,
    } ) );

    rotatingNode.addChild( new Text( 'y', {
      font: FONT,
      fill: '#4c4',
      centerX: 0,
      bottom: -ARROW_LENGTH - 4,
    } ) );

    // Small disk at 1/3 of the way along the x-axis; dragging it rotates the system
    const handleDisk = new Circle( 8, {
      x: ARROW_LENGTH * HANDLE_FRACTION,
      y: 0,
      fill: 'rgba(255, 220, 50, 0.9)',
      stroke: 'white',
      lineWidth: 1.5,
      cursor: 'crosshair',
    } );
    rotatingNode.addChild( handleDisk );

    // ── Origin marker ─────────────────────────────────────────────────────
    const originMarker = new Circle( 5, {
      fill: 'white',
      stroke: '#777',
      lineWidth: 1,
    } );

    // ── Position wrapper: translates with viewPositionProperty ───────────
    const positionNode = new Node( { children: [ rotatingNode, originMarker ], cursor: 'move' } );
    this.addChild( positionNode );

    // ── Property → scene-graph linkage ────────────────────────────────────
    this.viewPositionProperty.link( pos => { positionNode.translation = pos; } );
    this.rotationAngleProperty.link( angle => { rotatingNode.rotation = angle; } );

    // ── Drag: translate the entire coordinate system ──────────────────────
    let startPos = initialPosition.copy();
    let startPtr = new Vector2( 0, 0 );

    positionNode.addInputListener( new DragListener( {
      start: ( event ) => {
        startPos = this.viewPositionProperty.value.copy();
        startPtr = this.globalToLocalPoint( event.pointer.point );
      },
      drag: ( event ) => {
        const ptr = this.globalToLocalPoint( event.pointer.point );
        this.viewPositionProperty.value = startPos.plus( ptr.minus( startPtr ) );
      },
    } ) );

    // ── Drag: rotate around origin ────────────────────────────────────────
    // Dragging the handle disk updates the rotation angle based on the
    // pointer's angle relative to the coordinate-system origin.
    handleDisk.addInputListener( new DragListener( {
      drag: ( event ) => {
        const p = positionNode.globalToLocalPoint( event.pointer.point );
        this.rotationAngleProperty.value = Math.atan2( p.y, p.x );
      },
    } ) );

    // ── Visibility: only shown once a video with a finite duration is loaded
    videoLoadedProperty.link( loaded => { this.visible = loaded; } );
  }

  public reset(): void {
    this.viewPositionProperty.reset();
    this.rotationAngleProperty.reset();
  }
}
