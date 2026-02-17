import { Node } from "scenerystack/scenery";
import { StringManager } from "../../i18n/StringManager.js";

export class KeyboardShortcutsNode extends Node {
  public constructor() {
    super();

    const strings = StringManager.getInstance().getKeyboardShortcutsStrings();

    // TODO: build keyboard shortcuts UI using strings
    void strings;
  }
}
