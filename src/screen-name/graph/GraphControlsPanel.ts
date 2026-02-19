/**
 * Creates UI controls for the configurable graph including:
 * - Title panel with axis selection combo boxes
 * - Header bar
 */

import { Node, HBox, Text, Rectangle } from "scenerystack/scenery";
import { ComboBox } from "scenerystack/sun";
import {
  Property,
  DerivedProperty,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import type { PlottableProperty } from "./PlottableProperty.js";
import ResonanceColors from "../../ResonanceColors.js";
import { PhetFont } from "scenerystack/scenery-phet";
import resonance from "../../ResonanceNamespace.js";
import { ResonanceStrings } from "../../../i18n/ResonanceStrings.js";

// Font sizes
const COMBO_BOX_FONT = new PhetFont({ size: 12 });
const TITLE_FONT = new PhetFont({ size: 14 });

// Layout constants
const COMBO_BOX_CORNER_RADIUS = 5;
const COMBO_BOX_X_MARGIN = 6;
const COMBO_BOX_Y_MARGIN = 3;
const TITLE_SPACING = 3;
const HEADER_HEIGHT = 30;
const HEADER_CORNER_RADIUS = 5;
const HEADER_LINE_WIDTH = 2;
const HEADER_DARKEN_FACTOR = 0.1;

export default class GraphControlsPanel {
  private readonly availableProperties: PlottableProperty[];
  private readonly xPropertyProperty: Property<PlottableProperty>;
  private readonly yPropertyProperty: Property<PlottableProperty>;
  private readonly graphWidth: number;

  public constructor(
    availableProperties: PlottableProperty[],
    xPropertyProperty: Property<PlottableProperty>,
    yPropertyProperty: Property<PlottableProperty>,
    graphWidth: number,
  ) {
    this.availableProperties = availableProperties;
    this.xPropertyProperty = xPropertyProperty;
    this.yPropertyProperty = yPropertyProperty;
    this.graphWidth = graphWidth;
  }

  /**
   * Helper to get the string value from either a string or TReadOnlyProperty<string>
   */
  private getNameValue(name: string | TReadOnlyProperty<string>): string {
    return typeof name === "string" ? name : name.value;
  }

  /**
   * Sanitize a name for use as a tandem name (keep only alphanumeric characters)
   */
  private sanitizeTandemName(name: string | TReadOnlyProperty<string>): string {
    const nameValue = this.getNameValue(name);
    // Keep only alphanumeric characters (remove spaces, punctuation, etc.)
    return nameValue.replace(/[^a-zA-Z0-9]/g, "");
  }

  /**
   * Create title panel with "(Y vs X)" format where Y and X are combo boxes
   */
  public createTitlePanel(listParent: Node): Node {
    const xItems = this.availableProperties.map((prop) => ({
      value: prop,
      createNode: () =>
        new Text(prop.name, {
          font: COMBO_BOX_FONT,
          fill: ResonanceColors.textProperty,
        }),
      tandemName: this.sanitizeTandemName(prop.name) + "Item",
    }));

    const xComboBox = new ComboBox(this.xPropertyProperty, xItems, listParent, {
      cornerRadius: COMBO_BOX_CORNER_RADIUS,
      xMargin: COMBO_BOX_X_MARGIN,
      yMargin: COMBO_BOX_Y_MARGIN,
      buttonFill: ResonanceColors.controlPanelFillProperty,
      buttonStroke: ResonanceColors.controlPanelStrokeProperty,
      listFill: ResonanceColors.controlPanelFillProperty,
      listStroke: ResonanceColors.controlPanelStrokeProperty,
      highlightFill: ResonanceColors.controlPanelStrokeProperty,
    });

    const yItems = this.availableProperties.map((prop) => ({
      value: prop,
      createNode: () =>
        new Text(prop.name, {
          font: COMBO_BOX_FONT,
          fill: ResonanceColors.textProperty,
        }),
      tandemName: this.sanitizeTandemName(prop.name) + "Item",
    }));

    const yComboBox = new ComboBox(this.yPropertyProperty, yItems, listParent, {
      cornerRadius: COMBO_BOX_CORNER_RADIUS,
      xMargin: COMBO_BOX_X_MARGIN,
      yMargin: COMBO_BOX_Y_MARGIN,
      buttonFill: ResonanceColors.controlPanelFillProperty,
      buttonStroke: ResonanceColors.controlPanelStrokeProperty,
      listFill: ResonanceColors.controlPanelFillProperty,
      listStroke: ResonanceColors.controlPanelStrokeProperty,
      highlightFill: ResonanceColors.controlPanelStrokeProperty,
    });

    // Create title in format "(Y vs X)"
    const leftParen = new Text("(", {
      font: TITLE_FONT,
      fill: ResonanceColors.textProperty,
    });

    const vsText = new Text(
      new DerivedProperty(
        [ResonanceStrings.controls.graphVsStringProperty],
        (vs: string) => ` ${vs} `,
      ),
      {
        font: TITLE_FONT,
        fill: ResonanceColors.textProperty,
      },
    );

    const rightParen = new Text(")", {
      font: TITLE_FONT,
      fill: ResonanceColors.textProperty,
    });

    // Arrange in horizontal layout: (Y vs X)
    return new HBox({
      spacing: TITLE_SPACING,
      align: "center",
      children: [leftParen, yComboBox, vsText, xComboBox, rightParen],
    });
  }

  /**
   * Create the header bar (without checkbox - checkbox is now in ToolsControlPanel)
   */
  public createHeaderBar(): Rectangle {
    // Create header bar with dynamic fill that darkens the control panel background
    const headerFillProperty = new DerivedProperty(
      [ResonanceColors.controlPanelFillProperty],
      (backgroundColor) => backgroundColor.colorUtilsDarker(HEADER_DARKEN_FACTOR),
    );
    const headerBar = new Rectangle(
      0,
      -HEADER_HEIGHT,
      this.graphWidth,
      HEADER_HEIGHT,
      HEADER_CORNER_RADIUS,
      HEADER_CORNER_RADIUS,
      {
        fill: headerFillProperty,
        stroke: ResonanceColors.controlPanelStrokeProperty,
        lineWidth: HEADER_LINE_WIDTH,
        cursor: "grab",
      },
    );

    return headerBar;
  }

  /**
   * Update header bar width when graph is resized
   */
  public static updateHeaderBarWidth(
    headerBar: Rectangle,
    newWidth: number,
  ): void {
    headerBar.setRect(0, -HEADER_HEIGHT, newWidth, HEADER_HEIGHT);
  }
}

// Register with namespace for debugging accessibility
resonance.register("GraphControlsPanel", GraphControlsPanel);
