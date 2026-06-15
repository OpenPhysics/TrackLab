/**
 * Creates UI controls for the configurable graph including:
 * - Title panel with axis selection combo boxes
 * - Header bar
 */

import { DerivedProperty, type Property, type ReadOnlyProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { HBox, type Node, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { ComboBox } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";
import type { PlottableProperty } from "./PlottableProperty.js";

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
  private availableProperties: PlottableProperty[];
  private readonly xPropertyProperty: Property<PlottableProperty>;
  private readonly yPropertyProperty: Property<PlottableProperty>;
  private readonly graphWidth: number;

  // Stored references needed to rebuild combo boxes without recreating the whole panel.
  private listParent: Node | null = null;
  private titleHBox: HBox | null = null;
  private xComboBox: ComboBox<PlottableProperty> | null = null;
  private yComboBox: ComboBox<PlottableProperty> | null = null;
  private leftParenNode: Text | null = null;
  private vsTextNode: Text | null = null;
  private rightParenNode: Text | null = null;

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
   * Build ComboBox items for the X-axis selector from the current available properties.
   */
  private buildXComboBox(): ComboBox<PlottableProperty> {
    const xItems = this.availableProperties.map((prop) => ({
      value: prop,
      createNode: () =>
        new Text(prop.name, {
          font: COMBO_BOX_FONT,
          fill: TrackLabColors.textProperty,
        }),
      tandemName: `${this.sanitizeTandemName(prop.name)}Item`,
    }));

    if (!this.listParent) {
      throw new Error("buildXComboBox called before createTitlePanel");
    }
    return new ComboBox(this.xPropertyProperty, xItems, this.listParent, {
      cornerRadius: COMBO_BOX_CORNER_RADIUS,
      xMargin: COMBO_BOX_X_MARGIN,
      yMargin: COMBO_BOX_Y_MARGIN,
      buttonFill: TrackLabColors.controlPanelFillProperty,
      buttonStroke: TrackLabColors.controlPanelStrokeProperty,
      listFill: TrackLabColors.controlPanelFillProperty,
      listStroke: TrackLabColors.controlPanelStrokeProperty,
      highlightFill: TrackLabColors.controlPanelStrokeProperty,
    });
  }

  /**
   * Build ComboBox items for the Y-axis selector from the current available properties.
   */
  private buildYComboBox(): ComboBox<PlottableProperty> {
    const yItems = this.availableProperties.map((prop) => ({
      value: prop,
      createNode: () =>
        new Text(prop.name, {
          font: COMBO_BOX_FONT,
          fill: TrackLabColors.textProperty,
        }),
      tandemName: `${this.sanitizeTandemName(prop.name)}Item`,
    }));

    if (!this.listParent) {
      throw new Error("buildYComboBox called before createTitlePanel");
    }
    return new ComboBox(this.yPropertyProperty, yItems, this.listParent, {
      cornerRadius: COMBO_BOX_CORNER_RADIUS,
      xMargin: COMBO_BOX_X_MARGIN,
      yMargin: COMBO_BOX_Y_MARGIN,
      buttonFill: TrackLabColors.controlPanelFillProperty,
      buttonStroke: TrackLabColors.controlPanelStrokeProperty,
      listFill: TrackLabColors.controlPanelFillProperty,
      listStroke: TrackLabColors.controlPanelStrokeProperty,
      highlightFill: TrackLabColors.controlPanelStrokeProperty,
    });
  }

  /**
   * Create title panel with "(Y vs X)" format where Y and X are combo boxes.
   * Stores internal references so that `rebuildComboBoxes` can update the panel
   * in place when the set of available properties changes.
   */
  public createTitlePanel(listParent: Node): Node {
    this.listParent = listParent;

    this.xComboBox = this.buildXComboBox();
    this.yComboBox = this.buildYComboBox();

    // Create title in format "(Y vs X)"
    this.leftParenNode = new Text("(", {
      font: TITLE_FONT,
      fill: TrackLabColors.textProperty,
    });

    this.vsTextNode = new Text(
      new DerivedProperty([StringManager.getInstance().getControls().graphVsStringProperty], (vs: string) => ` ${vs} `),
      {
        font: TITLE_FONT,
        fill: TrackLabColors.textProperty,
      },
    );

    this.rightParenNode = new Text(")", {
      font: TITLE_FONT,
      fill: TrackLabColors.textProperty,
    });

    // Arrange in horizontal layout: (Y vs X)
    this.titleHBox = new HBox({
      spacing: TITLE_SPACING,
      align: "center",
      children: [this.leftParenNode, this.yComboBox, this.vsTextNode, this.xComboBox, this.rightParenNode],
    });

    return this.titleHBox;
  }

  /**
   * Swap out the combo boxes to reflect a new set of available properties.
   * The title HBox is updated in place — no parent-level re-parenting needed.
   *
   * Must be called after `createTitlePanel`.
   */
  public rebuildComboBoxes(newProperties: PlottableProperty[]): void {
    const { titleHBox, xComboBox, yComboBox, leftParenNode, vsTextNode, rightParenNode } = this;
    if (!(titleHBox && xComboBox && yComboBox && leftParenNode && vsTextNode && rightParenNode)) {
      return;
    }

    this.availableProperties = newProperties;

    const oldX = xComboBox;
    const oldY = yComboBox;

    this.xComboBox = this.buildXComboBox();
    this.yComboBox = this.buildYComboBox();

    // Update the HBox children with the new combo boxes, keeping the static text nodes.
    titleHBox.children = [leftParenNode, this.yComboBox, vsTextNode, this.xComboBox, rightParenNode];

    // Dispose old combo boxes AFTER swapping children to avoid dangling references.
    oldX.dispose();
    oldY.dispose();
  }

  /**
   * Dispose the combo boxes owned by this panel.
   * Should be called when the parent ConfigurableGraph is disposed.
   */
  public dispose(): void {
    this.xComboBox?.dispose();
    this.yComboBox?.dispose();
  }

  /**
   * Create the header bar (without checkbox - checkbox is now in ToolsControlPanel)
   */
  public createHeaderBar(accessibleName: ReadOnlyProperty<string>): Rectangle {
    // Create header bar with dynamic fill that darkens the control panel background
    const headerFillProperty = new DerivedProperty([TrackLabColors.controlPanelFillProperty], (backgroundColor) =>
      backgroundColor.colorUtilsDarker(HEADER_DARKEN_FACTOR),
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
        stroke: TrackLabColors.controlPanelStrokeProperty,
        lineWidth: HEADER_LINE_WIDTH,
        cursor: "grab",
        pickable: true,
        tagName: "div",
        focusable: true,
        accessibleName,
      },
    );

    return headerBar;
  }

  /**
   * Update header bar width when graph is resized
   */
  public static updateHeaderBarWidth(headerBar: Rectangle, newWidth: number): void {
    headerBar.setRect(0, -HEADER_HEIGHT, newWidth, HEADER_HEIGHT);
  }
}

// Register with namespace for debugging accessibility
TrackLabNamespace.register("GraphControlsPanel", GraphControlsPanel);
