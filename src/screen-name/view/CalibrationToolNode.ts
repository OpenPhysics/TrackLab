import { Color } from "scenerystack";
import type { TReadOnlyProperty } from "scenerystack/axon";
import { DerivedProperty } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import {
  Circle,
  HBox,
  Line,
  Node,
  RichDragListener,
  Text,
} from "scenerystack/scenery";
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
const WARNING_FONT = new PhetFont({ size: 11, weight: "bold" });
const ENDPOINT_RADIUS = 4;
const ENDPOINT_TOUCH_DILATION = 12; // extra pixels for easier pickup (mouseArea/touchArea)
const LINE_WIDTH = 3; // Increased for better visibility
const LINE_DASH: number[] = [8, 4];
const SHADOW_LINE_WIDTH = 6; // Wider shadow stroke for contrast
const ENDPOINT_LINE_WIDTH = 2; // Increased for better visibility
const ENDPOINT_SHADOW_LINE_WIDTH = 4; // Dark outline for contrast
const MAX_KEYPAD_DECIMALS = 4;
const MIDPOINT_PANEL_SCALE = 0.5;
const MIDPOINT_PANEL_CORNER_RADIUS = 6;
const MIDPOINT_PANEL_X_MARGIN = 8;
const MIDPOINT_PANEL_Y_MARGIN = 6;
const MIDPOINT_PANEL_SPACING = 8;
const MIDPOINT_Y_OFFSET = 12; // pixels above midpoint where the panel sits
const ENDPOINT_DRAG_SPEED = 200; // pixels/s for normal keyboard drag
const ENDPOINT_SHIFT_DRAG_SPEED = 40; // pixels/s for shift-key keyboard drag
// Pixel distance below which endpoints are considered overlapping and a warning is shown.
const OVERLAP_WARNING_DISTANCE = 10;
const ENDPOINT_WARNING_COLOR = new Color(255, 60, 60);

export class CalibrationToolNode extends Node {
  public constructor(
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    listParent: Node,
    model: SimModel,
  ) {
    super();

    // ── Connecting line with shadow for visibility on all backgrounds ────
    // Shadow layer (rendered first, underneath)
    const calibrationLineShadow = new Line(0, 0, 0, 0, {
      stroke: TrackLabColors.calibrationShadowStrokeProperty,
      lineWidth: SHADOW_LINE_WIDTH,
      lineDash: LINE_DASH,
    });
    this.addChild(calibrationLineShadow);

    // Main bright line (rendered on top)
    const calibrationLine = new Line(0, 0, 0, 0, {
      stroke: TrackLabColors.calibrationStrokeProperty,
      lineWidth: LINE_WIDTH,
      lineDash: LINE_DASH,
    });
    this.addChild(calibrationLine);

    // ── Endpoint circles with shadow outlines for maximum visibility ──────
    // Shadow circles (rendered first, underneath)
    const endpoint1Shadow = new Circle(ENDPOINT_RADIUS, {
      stroke: TrackLabColors.calibrationShadowStrokeProperty,
      lineWidth: ENDPOINT_SHADOW_LINE_WIDTH,
      fill: "transparent",
    });
    const endpoint2Shadow = new Circle(ENDPOINT_RADIUS, {
      stroke: TrackLabColors.calibrationShadowStrokeProperty,
      lineWidth: ENDPOINT_SHADOW_LINE_WIDTH,
      fill: "transparent",
    });
    this.addChild(endpoint1Shadow);
    this.addChild(endpoint2Shadow);

    // Main bright circles (rendered on top with interaction)
    const makeEndpoint = (accessibleName: string) =>
      new Circle(ENDPOINT_RADIUS, {
        fill: TrackLabColors.calibrationFillProperty,
        stroke: TrackLabColors.calibrationStrokeProperty,
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
          new Text(unit, {
            font: FONT,
            fill: TrackLabColors.textOnDarkProperty,
          }),
        tandemName: `${unit}Item`,
      }));
    const unitComboBox = new ComboBox(
      model.calibUnitProperty,
      unitItems,
      listParent,
      {
        buttonFill: TrackLabColors.comboBoxButtonFillProperty,
        listFill: TrackLabColors.comboBoxListFillProperty,
        highlightFill: TrackLabColors.comboBoxHighlightFillProperty,
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

    // ── Overlap warning text ──────────────────────────────────────────────
    // Shown when endpoints are too close together to produce a valid calibration.
    const overlapWarning = new Text(
      "Points too close — move apart to calibrate",
      {
        font: WARNING_FONT,
        fill: ENDPOINT_WARNING_COLOR,
        visible: false,
      },
    );
    this.addChild(overlapWarning);

    // ── Update geometry when endpoints move ───────────────────────────────
    const updateGeometry = () => {
      const p1 = model.calibPoint1Property.value;
      const p2 = model.calibPoint2Property.value;

      // Update both shadow and main lines
      calibrationLineShadow.setLine(p1.x, p1.y, p2.x, p2.y);
      calibrationLine.setLine(p1.x, p1.y, p2.x, p2.y);

      // Update shadow circles
      endpoint1Shadow.translation = p1;
      endpoint2Shadow.translation = p2;

      // Update main circles
      endpoint1.translation = p1;
      endpoint2.translation = p2;

      const mid = p1.blend(p2, 0.5);
      midpointPanel.centerX = mid.x;
      midpointPanel.bottom = mid.y - MIDPOINT_Y_OFFSET;

      // Show warning and highlight endpoints when too close to be useful.
      const tooClose = p1.distance(p2) < OVERLAP_WARNING_DISTANCE;
      const endpointFill = tooClose
        ? ENDPOINT_WARNING_COLOR
        : TrackLabColors.calibrationFillProperty.value;
      endpoint1.fill = endpointFill;
      endpoint2.fill = endpointFill;
      overlapWarning.visible = tooClose;
      if (tooClose) {
        overlapWarning.centerX = mid.x;
        overlapWarning.top = mid.y + MIDPOINT_Y_OFFSET;
      }
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
