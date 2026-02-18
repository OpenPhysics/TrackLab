import { Node, VBox } from "scenerystack/scenery";
import {
  BasicActionsKeyboardHelpSection,
  MoveDraggableItemsKeyboardHelpSection,
} from "scenerystack/scenery-phet";

export class KeyboardShortcutsNode extends Node {
  public constructor() {
    super();

    this.addChild(
      new VBox({
        children: [
          new BasicActionsKeyboardHelpSection(),
          new MoveDraggableItemsKeyboardHelpSection(),
        ],
        spacing: 16,
        align: "left",
      }),
    );
  }
}
