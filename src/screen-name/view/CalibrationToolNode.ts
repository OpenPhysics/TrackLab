/**
 * CalibrationToolNode.ts
 *
 * Calibration UI for setting the real-world scale. Users measure a reference distance
 * and specify its value in desired units to establish the model-to-pixel scale.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { DerivedProperty, Multilink } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Circle, HBox, Line, Node, RichDragListener, Text } from "scenerystack/scenery";
import { Keypad, PhetFont } from "scenerystack/scenery-phet";
import { KeypadDialog } from "scenerystack/sim";
import { ButtonNode, ComboBox, type ComboBoxItem, Panel, TextPushButton } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import {
  BUTTON_X_MARGIN,
  BUTTON_Y_MARGIN,
  DIGITIZING_DIM_OPACITY,
  OVERLAY_DRAG_SPEED,
  OVERLAY_SHIFT_DRAG_SPEED,
} from "../../TrackLabConstants.js";
import { CALIBRATION_UNITS } from "../model/OverlayToolsModel.js";
import type { SimModel } from "../model/SimModel.js";

const FONT = new PhetFont(14);
const WARNING_FONT = new PhetFont({ size: 11, weight: "bold" });
const ENDPOINT_RADIUS = 4;
const ENDPOINT_TOUCH_DILATION = 10;
const ENDPOINT_MOUSE_DILATION = 4;
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
// Pixel distance below which endpoints are considered overlapping and a warning is shown.
const OVERLAP_WARNING_DISTANCE = 10;
const CALIBRATION_DECIMAL_PLACES = 2;

/**
 * Two-endpoint calibration ruler overlay for setting the real-world scale.
 *
 * The user drags the two endpoints to span a known distance, then enters the
 * value via a keypad. A midpoint panel shows the current distance and a unit
 * selector (m, cm, ft …). Endpoints turn red and a warning appears when they
 * are too close together to produce a valid calibration. Hidden until a video
 * is loaded.
 */
export class CalibrationToolNode extends Node {
  private readonly disposeCalibrationToolNode: () => void;

  /**
   * @param videoLoadedProperty - Controls visibility; node is hidden until a video is loaded.
   * @param listParent - Scene-graph node used as the popup list parent for the unit ComboBox.
   * @param model - Provides calibration properties and receives user-entered values.
   */
  public constructor(videoLoadedProperty: TReadOnlyProperty<boolean>, listParent: Node, model: SimModel) {
    super();

    const calibrationStrings = StringManager.getInstance().getCalibration();

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
    const makeEndpoint = (accessibleName: TReadOnlyProperty<string>) =>
      new Circle(ENDPOINT_RADIUS, {
        fill: TrackLabColors.calibrationFillProperty,
        stroke: TrackLabColors.calibrationStrokeProperty,
        lineWidth: ENDPOINT_LINE_WIDTH,
        cursor: "crosshair",
        tagName: "div",
        focusable: true,
        accessibleName: accessibleName,
      });
    const endpoint1 = makeEndpoint(calibrationStrings.calibrationPoint1StringProperty);
    const endpoint2 = makeEndpoint(calibrationStrings.calibrationPoint2StringProperty);
    const endpointTouchArea = Shape.circle(0, 0, ENDPOINT_RADIUS + ENDPOINT_TOUCH_DILATION);
    const endpointMouseArea = Shape.circle(0, 0, ENDPOINT_RADIUS + ENDPOINT_MOUSE_DILATION);
    endpoint1.touchArea = endpointTouchArea;
    endpoint1.mouseArea = endpointMouseArea;
    endpoint2.touchArea = endpointTouchArea;
    endpoint2.mouseArea = endpointMouseArea;
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
      [model.overlayTools.calibUnitProperty],
      (unit) => `{{min}} – {{max}} ${unit}`,
    );

    // ── Midpoint panel ────────────────────────────────────────────────────
    // Button showing current value + unit; clicking it opens the keypad.
    const buttonLabelProperty = new DerivedProperty(
      [model.overlayTools.calibDistanceProperty, model.overlayTools.calibUnitProperty],
      (dist, unit) => `${dist.toFixed(CALIBRATION_DECIMAL_PLACES)} ${unit}`,
    );

    const distanceButton = new TextPushButton(buttonLabelProperty, {
      font: FONT,
      baseColor: TrackLabColors.buttonBaseDarkerProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      xMargin: BUTTON_X_MARGIN,
      yMargin: BUTTON_Y_MARGIN,
      textFill: TrackLabColors.textOnDarkProperty,
      listener: () => {
        keypadDialog.beginEdit(
          (value: number) => {
            model.overlayTools.calibDistanceProperty.value = value;
          },
          model.overlayTools.calibDistanceProperty.range,
          rangePatternProperty,
          () => {
            /* no-op: keypad close callback not needed */
          },
        );
      },
      tandem: Tandem.OPT_OUT,
    });

    // Unit selector
    const unitItems: ComboBoxItem<(typeof CALIBRATION_UNITS)[number]>[] = CALIBRATION_UNITS.map((unit) => ({
      value: unit,
      createNode: () =>
        new Text(unit, {
          font: FONT,
          fill: TrackLabColors.textOnDarkProperty,
        }),
      tandemName: `${unit}Item`,
    }));
    const unitComboBox = new ComboBox(model.overlayTools.calibUnitProperty, unitItems, listParent, {
      buttonFill: TrackLabColors.comboBoxButtonFillProperty,
      listFill: TrackLabColors.comboBoxListFillProperty,
      highlightFill: TrackLabColors.comboBoxHighlightFillProperty,
      tandem: Tandem.OPT_OUT,
    });

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
    const overlapWarning = new Text(calibrationStrings.pointsTooCloseStringProperty, {
      font: WARNING_FONT,
      fill: TrackLabColors.calibrationWarningColorProperty,
      visible: false,
    });
    this.addChild(overlapWarning);

    // ── Update geometry when endpoints move ───────────────────────────────
    const updateGeometry = () => {
      const p1 = model.overlayTools.calibPoint1Property.value;
      const p2 = model.overlayTools.calibPoint2Property.value;

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
        ? TrackLabColors.calibrationWarningColorProperty.value
        : TrackLabColors.calibrationFillProperty.value;
      endpoint1.fill = endpointFill;
      endpoint2.fill = endpointFill;
      overlapWarning.visible = tooClose;
      if (tooClose) {
        overlapWarning.centerX = mid.x;
        overlapWarning.top = mid.y + MIDPOINT_Y_OFFSET;
      }
    };
    // A single Multilink replaces two separate link() calls so that geometry
    // is rebuilt once per change event regardless of which endpoint moved,
    // and disposal is managed in one place.
    const calibMultilink = Multilink.multilink(
      [model.overlayTools.calibPoint1Property, model.overlayTools.calibPoint2Property],
      updateGeometry,
    );

    // ── Drag listeners for endpoints ──────────────────────────────────────
    endpoint1.addInputListener(
      new RichDragListener({
        positionProperty: model.overlayTools.calibPoint1Property,
        keyboardDragListenerOptions: {
          dragSpeed: OVERLAY_DRAG_SPEED,
          shiftDragSpeed: OVERLAY_SHIFT_DRAG_SPEED,
        },
        tandem: Tandem.OPT_OUT,
      }),
    );
    endpoint2.addInputListener(
      new RichDragListener({
        positionProperty: model.overlayTools.calibPoint2Property,
        keyboardDragListenerOptions: {
          dragSpeed: OVERLAY_DRAG_SPEED,
          shiftDragSpeed: OVERLAY_SHIFT_DRAG_SPEED,
        },
        tandem: Tandem.OPT_OUT,
      }),
    );

    // ── Visibility ─────────────────────────────────────────────────────────
    const onVideoLoaded = (loaded: boolean) => {
      this.visible = loaded;
    };
    videoLoadedProperty.link(onVideoLoaded);

    // ── Lock out interaction while the user is manually digitizing ─────────
    // Dimming + pickable:false signals that the tool is temporarily inactive
    // so the user cannot accidentally move calibration points mid-session.
    const onActiveTrackChange = (activeId: string | null) => {
      const isDigitizing = activeId !== null;
      this.pickable = !isDigitizing;
      this.opacity = isDigitizing ? DIGITIZING_DIM_OPACITY : 1;
    };
    model.activeTrackIdProperty.link(onActiveTrackChange);

    this.disposeCalibrationToolNode = () => {
      calibMultilink.dispose();
      videoLoadedProperty.unlink(onVideoLoaded);
      model.activeTrackIdProperty.unlink(onActiveTrackChange);
      rangePatternProperty.dispose();
      buttonLabelProperty.dispose();
    };
  }

  public override dispose(): void {
    this.disposeCalibrationToolNode();
    super.dispose();
  }
}
