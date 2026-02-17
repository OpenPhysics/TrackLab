import { Node } from "scenerystack/scenery";
import { BasicActionsKeyboardHelpSection } from "scenerystack/scenery-phet";

export class KeyboardShortcutsNode extends Node {
  public constructor() {
    super();

    this.addChild( new BasicActionsKeyboardHelpSection() );
  }
}
