import { Circle, DragListener, HBox, Line, Node, Text } from "scenerystack/scenery";
import { Keypad, PhetFont } from "scenerystack/scenery-phet";
import { KeypadDialog } from "scenerystack/sim";
import { Range, Vector2 } from "scenerystack/dot";
import { DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { ComboBox, type ComboBoxItem, Panel, TextPushButton } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";

const FONT = new PhetFont( 14 );
const ENDPOINT_RADIUS = 8;
const INITIAL_HALF_LENGTH = 100; // pixels from center to each endpoint

const UNITS = [ 'mm', 'cm', 'm', 'km', 'in', 'ft' ] as const;
type Unit = typeof UNITS[ number ];

const DISTANCE_RANGE = new Range( 0.001, 100000 );

export class CalibrationToolNode extends Node {
  private readonly distanceProperty: NumberProperty;
  private readonly unitProperty: Property<Unit>;
  private readonly point1Property: Property<Vector2>;
  private readonly point2Property: Property<Vector2>;

  public constructor(
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    listParent: Node,
    initialCenter: Vector2
  ) {
    super();

    this.point1Property = new Property<Vector2>( initialCenter.plusXY( -INITIAL_HALF_LENGTH, 0 ) );
    this.point2Property = new Property<Vector2>( initialCenter.plusXY( INITIAL_HALF_LENGTH, 0 ) );
    this.distanceProperty = new NumberProperty( 1, { range: DISTANCE_RANGE } );
    this.unitProperty = new Property<Unit>( 'm' );

    // ── Connecting line ────────────────────────────────────────────────────
    const calibrationLine = new Line( 0, 0, 0, 0, {
      stroke: 'rgba(255, 255, 100, 0.8)',
      lineWidth: 2,
      lineDash: [ 8, 4 ],
    } );
    this.addChild( calibrationLine );

    // ── Endpoint circles ──────────────────────────────────────────────────
    const makeEndpoint = () => new Circle( ENDPOINT_RADIUS, {
      fill: 'rgba(255, 255, 100, 0.85)',
      stroke: 'white',
      lineWidth: 1.5,
      cursor: 'crosshair',
    } );
    const endpoint1 = makeEndpoint();
    const endpoint2 = makeEndpoint();
    this.addChild( endpoint1 );
    this.addChild( endpoint2 );

    // ── Keypad dialog ─────────────────────────────────────────────────────
    const keypadDialog = new KeypadDialog( {
      keypadLayout: Keypad.PositiveDecimalLayout,
      tandem: Tandem.OPT_OUT,
    } );
    // Pattern shown inside the dialog as "Range: {{min}} – {{max}}"
    const rangePatternProperty = new Property( '{{min}} – {{max}}' );

    // ── Midpoint panel ────────────────────────────────────────────────────
    // Button showing current value; clicking it opens the keypad.
    const buttonLabelProperty = new DerivedProperty(
      [ this.distanceProperty ],
      ( dist: number ) => dist.toFixed( 1 )
    );

    const distanceButton = new TextPushButton( buttonLabelProperty, {
      font: FONT,
      baseColor: '#334',
      textFill: 'white',
      listener: () => {
        keypadDialog.beginEdit(
          ( value: number ) => { this.distanceProperty.value = value; },
          DISTANCE_RANGE,
          rangePatternProperty,
          () => {}
        );
      },
      tandem: Tandem.OPT_OUT,
    } );

    // Unit selector
    const unitItems: ComboBoxItem<Unit>[] = UNITS.map( unit => ( {
      value: unit,
      createNode: () => new Text( unit, { font: FONT } ),
      tandemName: `${ unit }Item`,
    } ) );
    const unitComboBox = new ComboBox( this.unitProperty, unitItems, listParent, {
      tandem: Tandem.OPT_OUT,
    } );

    const midpointPanel = new Panel(
      new HBox( {
        children: [ distanceButton, unitComboBox ],
        spacing: 8,
        align: 'center',
      } ),
      {
        fill: 'rgba(20, 20, 40, 0.90)',
        stroke: '#888',
        cornerRadius: 6,
        xMargin: 8,
        yMargin: 6,
      }
    );
    this.addChild( midpointPanel );

    // ── Update geometry when endpoints move ───────────────────────────────
    const updateGeometry = () => {
      const p1 = this.point1Property.value;
      const p2 = this.point2Property.value;
      calibrationLine.setLine( p1.x, p1.y, p2.x, p2.y );
      endpoint1.translation = p1;
      endpoint2.translation = p2;
      const mid = p1.blend( p2, 0.5 );
      midpointPanel.centerX = mid.x;
      midpointPanel.bottom = mid.y - 12;
    };
    this.point1Property.link( updateGeometry );
    this.point2Property.link( updateGeometry );

    // ── Drag listeners for endpoints ──────────────────────────────────────
    const makeDragListener = ( pointProperty: Property<Vector2> ) => {
      let startPos = pointProperty.value.copy();
      let startPtr = new Vector2( 0, 0 );
      return new DragListener( {
        start: ( event ) => {
          startPos = pointProperty.value.copy();
          startPtr = this.globalToLocalPoint( event.pointer.point );
        },
        drag: ( event ) => {
          const ptr = this.globalToLocalPoint( event.pointer.point );
          pointProperty.value = startPos.plus( ptr.minus( startPtr ) );
        },
      } );
    };
    endpoint1.addInputListener( makeDragListener( this.point1Property ) );
    endpoint2.addInputListener( makeDragListener( this.point2Property ) );

    // ── Visibility ─────────────────────────────────────────────────────────
    videoLoadedProperty.link( loaded => { this.visible = loaded; } );
  }

  public reset(): void {
    this.point1Property.reset();
    this.point2Property.reset();
    this.distanceProperty.reset();
    this.unitProperty.reset();
  }
}
