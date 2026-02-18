import { Circle, HBox, Line, Node, RichDragListener, Text } from "scenerystack/scenery";
import { Keypad, PhetFont } from "scenerystack/scenery-phet";
import { KeypadDialog } from "scenerystack/sim";
import { DerivedProperty } from "scenerystack/axon";
import type { TReadOnlyProperty } from "scenerystack/axon";
import { ComboBox, type ComboBoxItem, Panel, TextPushButton } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import type { SimModel } from "../model/SimModel.js";
import { CALIBRATION_UNITS } from "../model/SimModel.js";
import TrackLabColors from "../../TrackLabColors.js";

const FONT = new PhetFont( 14 );
const ENDPOINT_RADIUS = 8;

export class CalibrationToolNode extends Node {
  public constructor(
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    listParent: Node,
    model: SimModel
  ) {
    super();

    // ── Connecting line ────────────────────────────────────────────────────
    const calibrationLine = new Line( 0, 0, 0, 0, {
      stroke: TrackLabColors.calibrationStrokeProperty,
      lineWidth: 2,
      lineDash: [ 8, 4 ],
    } );
    this.addChild( calibrationLine );

    // ── Endpoint circles ──────────────────────────────────────────────────
    const makeEndpoint = ( accessibleName: string ) => new Circle( ENDPOINT_RADIUS, {
      fill: TrackLabColors.calibrationFillProperty,
      stroke: TrackLabColors.textOnDarkProperty,
      lineWidth: 1.5,
      cursor: 'crosshair',
      tagName: 'div',
      focusable: true,
      accessibleName: accessibleName,
    } );
    const endpoint1 = makeEndpoint( 'Calibration Point 1' );
    const endpoint2 = makeEndpoint( 'Calibration Point 2' );
    this.addChild( endpoint1 );
    this.addChild( endpoint2 );

    // ── Keypad dialog ─────────────────────────────────────────────────────
    const keypadDialog = new KeypadDialog( {
      keypadLayout: Keypad.PositiveDecimalLayout,
      keypadOptions: {
        accumulatorOptions: {
          maxDigitsRightOfMantissa: 4,
        },
      },
      tandem: Tandem.OPT_OUT,
    } );
    // Pattern shown inside the dialog as "Range: {{min}} – {{max}} <unit>"
    const rangePatternProperty = new DerivedProperty(
      [ model.calibUnitProperty ],
      unit => `{{min}} – {{max}} ${ unit }`
    );

    // ── Midpoint panel ────────────────────────────────────────────────────
    // Button showing current value + unit; clicking it opens the keypad.
    const buttonLabelProperty = new DerivedProperty(
      [ model.calibDistanceProperty, model.calibUnitProperty ],
      ( dist, unit ) => `${ dist.toFixed( 2 ) } ${ unit }`
    );

    const distanceButton = new TextPushButton( buttonLabelProperty, {
      font: FONT,
      baseColor: TrackLabColors.buttonBaseDarkerProperty,
      textFill: TrackLabColors.textOnDarkProperty,
      listener: () => {
        keypadDialog.beginEdit(
          ( value: number ) => { model.calibDistanceProperty.value = value; },
          model.calibDistanceProperty.range,
          rangePatternProperty,
          () => {}
        );
      },
      tandem: Tandem.OPT_OUT,
    } );

    // Unit selector
    const unitItems: ComboBoxItem<typeof CALIBRATION_UNITS[ number ]>[] = CALIBRATION_UNITS.map( unit => ( {
      value: unit,
      createNode: () => new Text( unit, { font: FONT } ),
      tandemName: `${ unit }Item`,
    } ) );
    const unitComboBox = new ComboBox( model.calibUnitProperty, unitItems, listParent, {
      tandem: Tandem.OPT_OUT,
    } );

    const midpointPanel = new Panel(
      new HBox( {
        children: [ distanceButton, unitComboBox ],
        spacing: 8,
        align: 'center',
      } ),
      {
        fill: TrackLabColors.panelFillProperty,
        stroke: TrackLabColors.panelStrokeLightProperty,
        cornerRadius: 6,
        xMargin: 8,
        yMargin: 6,
      }
    );
    midpointPanel.setScaleMagnitude( 0.5 );
    this.addChild( midpointPanel );

    // ── Update geometry when endpoints move ───────────────────────────────
    const updateGeometry = () => {
      const p1 = model.calibPoint1Property.value;
      const p2 = model.calibPoint2Property.value;
      calibrationLine.setLine( p1.x, p1.y, p2.x, p2.y );
      endpoint1.translation = p1;
      endpoint2.translation = p2;
      const mid = p1.blend( p2, 0.5 );
      midpointPanel.centerX = mid.x;
      midpointPanel.bottom = mid.y - 12;
    };
    model.calibPoint1Property.link( updateGeometry );
    model.calibPoint2Property.link( updateGeometry );

    // ── Drag listeners for endpoints ──────────────────────────────────────
    endpoint1.addInputListener( new RichDragListener( {
      positionProperty: model.calibPoint1Property,
      keyboardDragListenerOptions: { dragSpeed: 200, shiftDragSpeed: 40 },
      tandem: Tandem.OPT_OUT,
    } ) );
    endpoint2.addInputListener( new RichDragListener( {
      positionProperty: model.calibPoint2Property,
      keyboardDragListenerOptions: { dragSpeed: 200, shiftDragSpeed: 40 },
      tandem: Tandem.OPT_OUT,
    } ) );

    // ── Visibility ─────────────────────────────────────────────────────────
    videoLoadedProperty.link( loaded => { this.visible = loaded; } );
  }
}
