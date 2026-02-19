import type { TReadOnlyProperty } from "scenerystack/axon";
import { DerivedProperty } from "scenerystack/axon";
import {
  Circle,
  HBox,
  Line,
  Node,
  RichDragListener,
  Text,
} from "scenerystack/scenery";
import { Shape } from "scenerystack/kite";
import { Keypad, PhetFont } from "scenerystack/scenery-phet";
import { KeypadDialog } from "scenerystack/sim";
import {
  ButtonNode,
  ComboBox,
  type ComboBoxItem,
  Panel,
  TextPushButton,
} from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import type { SimModel } from "../model/SimModel.js";
import { CALIBRATION_UNITS } from "../model/SimModel.js";

const FONT = new PhetFont(14);
const ENDPOINT_RADIUS = 4;
const ENDPOINT_TOUCH_DILATION = 12; // extra pixels for easier pickup (mouseArea/touchArea)
const LINE_WIDTH = 2;
const LINE_DASH: number[] = [8, 4];
const ENDPOINT_LINE_WIDTH = 1.5;
const MAX_KEYPAD_DECIMALS = 4;
const MIDPOINT_PANEL_SCALE = 0.5;
const MIDPOINT_PANEL_CORNER_RADIUS = 6;
const MIDPOINT_PANEL_X_MARGIN = 8;
const MIDPOINT_PANEL_Y_MARGIN = 6;
const MIDPOINT_PANEL_SPACING = 8;
const MIDPOINT_Y_OFFSET = 12; // pixels above midpoint where the panel sits
const ENDPOINT_DRAG_SPEED = 200; // pixels/s for normal keyboard drag
const ENDPOINT_SHIFT_DRAG_SPEED = 40; // pixels/s for shift-key keyboard drag

export class CalibrationToolNode extends Node {
  public constructor(
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    listParent: Node,
    model: SimModel,
  ) {
    super();

    // ── Connecting line ────────────────────────────────────────────────────
    const calibrationLine = new Line(0, 0, 0, 0, {
      stroke: TrackLabColors.calibrationStrokeProperty,
      lineWidth: LINE_WIDTH,
      lineDash: LINE_DASH,
    });
    this.addChild(calibrationLine);

    // ── Endpoint circles ──────────────────────────────────────────────────
    const makeEndpoint = (accessibleName: string) =>
      new Circle(ENDPOINT_RADIUS, {
        fill: TrackLabColors.calibrationFillProperty,
        stroke: TrackLabColors.textOnDarkProperty,
        lineWidth: ENDPOINT_LINE_WIDTH,
        cursor: "crosshair",
        tagName: "div",
        focusable: true,
        accessibleName: accessibleName,
      });
    const endpoint1 = makeEndpoint("Calibration Point 1");
    const endpoint2 = makeEndpoint("Calibration Point 2");
    const endpointTouchArea = Shape.circle(
      0,
      0,
      ENDPOINT_RADIUS + ENDPOINT_TOUCH_DILATION,
    );
    endpoint1.mouseArea = endpointTouchArea;
    endpoint1.touchArea = endpointTouchArea;
    endpoint2.mouseArea = endpointTouchArea;
    endpoint2.touchArea = endpointTouchArea;
    this.addChild(endpoint1);
    this.addChild(endpoint2);

    // ── Keypad dialog ─────────────────────────────────────────────────────
    const keypadDialog = new KeypadDialog({
      keypadLayout: Keypad.PositiveDecimalLayout,
      keypadOptions: {
        accumulatorOptions: {
          maxDigitsRightOfMantissa: MAX_KEYPAD_DECIMALS,
        },
      },
      tandem: Tandem.OPT_OUT,
    });
    // Pattern shown inside the dialog as "Range: {{min}} – {{max}} <unit>"
    const rangePatternProperty = new DerivedProperty(
      [model.calibUnitProperty],
      (unit) => `{{min}} – {{max}} ${unit}`,
    );

    // ── Midpoint panel ────────────────────────────────────────────────────
    // Button showing current value + unit; clicking it opens the keypad.
    const buttonLabelProperty = new DerivedProperty(
      [model.calibDistanceProperty, model.calibUnitProperty],
      (dist, unit) => `${dist.toFixed(2)} ${unit}`,
    );

    const distanceButton = new TextPushButton(buttonLabelProperty, {
      font: FONT,
      baseColor: TrackLabColors.buttonBaseDarkerProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      textFill: TrackLabColors.textOnDarkProperty,
      listener: () => {
        keypadDialog.beginEdit(
          (value: number) => {
            model.calibDistanceProperty.value = value;
          },
          model.calibDistanceProperty.range,
          rangePatternProperty,
          () => {},
        );
      },
      tandem: Tandem.OPT_OUT,
    });

    // Unit selector
    const unitItems: ComboBoxItem<(typeof CALIBRATION_UNITS)[number]>[] =
      CALIBRATION_UNITS.map((unit) => ({
        value: unit,
        createNode: () =>
          new Text(unit, { font: FONT, fill: TrackLabColors.textOnDarkProperty }),
        tandemName: `${unit}Item`,
      }));
    const unitComboBox = new ComboBox(
      model.calibUnitProperty,
      unitItems,
      listParent,
      {
        tandem: Tandem.OPT_OUT,
      },
    );

    const midpointPanel = new Panel(
      new HBox({
        children: [distanceButton, unitComboBox],
        spacing: MIDPOINT_PANEL_SPACING,
        align: "center",
      }),
      {
        fill: TrackLabColors.panelFillProperty,
        stroke: TrackLabColors.panelStrokeLightProperty,
        cornerRadius: MIDPOINT_PANEL_CORNER_RADIUS,
        xMargin: MIDPOINT_PANEL_X_MARGIN,
        yMargin: MIDPOINT_PANEL_Y_MARGIN,
      },
    );
    midpointPanel.setScaleMagnitude(MIDPOINT_PANEL_SCALE);
    this.addChild(midpointPanel);

    // ── Update geometry when endpoints move ───────────────────────────────
    const updateGeometry = () => {
      const p1 = model.calibPoint1Property.value;
      const p2 = model.calibPoint2Property.value;
      calibrationLine.setLine(p1.x, p1.y, p2.x, p2.y);
      endpoint1.translation = p1;
      endpoint2.translation = p2;
      const mid = p1.blend(p2, 0.5);
      midpointPanel.centerX = mid.x;
      midpointPanel.bottom = mid.y - MIDPOINT_Y_OFFSET;
    };
    model.calibPoint1Property.link(updateGeometry);
    model.calibPoint2Property.link(updateGeometry);

    // ── Drag listeners for endpoints ──────────────────────────────────────
    endpoint1.addInputListener(
      new RichDragListener({
        positionProperty: model.calibPoint1Property,
        keyboardDragListenerOptions: {
          dragSpeed: ENDPOINT_DRAG_SPEED,
          shiftDragSpeed: ENDPOINT_SHIFT_DRAG_SPEED,
        },
        tandem: Tandem.OPT_OUT,
      }),
    );
    endpoint2.addInputListener(
      new RichDragListener({
        positionProperty: model.calibPoint2Property,
        keyboardDragListenerOptions: {
          dragSpeed: ENDPOINT_DRAG_SPEED,
          shiftDragSpeed: ENDPOINT_SHIFT_DRAG_SPEED,
        },
        tandem: Tandem.OPT_OUT,
      }),
    );

    // ── Visibility ─────────────────────────────────────────────────────────
    videoLoadedProperty.link((loaded) => {
      this.visible = loaded;
    });
  }
}
