/**
 * TrackLabKeyboardHelpContent.ts
 *
 * Keyboard help content for TrackLab, displayed inside the keyboard shortcuts dialog.
 * Uses SceneryStack's pre-built help sections so that every row is backed by the
 * actual HotkeyData / interaction model of the underlying component — not hand-written
 * key names that could drift from the real bindings.
 *
 * Left column
 *  • TimeControlsKeyboardHelpSection  — Space to play/pause (PlayControlButton hotkey)
 *  • SliderControlsKeyboardHelpSection — Left/Right arrows on the scrubber (HSlider)
 *
 * Right column
 *  • MoveDraggableItemsKeyboardHelpSection — Arrow keys on draggable overlays
 *                                            (coordinate system, calibration, tape, angle)
 *  • BasicActionsKeyboardHelpSection       — Tab, press buttons, toggle checkboxes,
 *                                            Reset All, Escape
 */

import {
  ArrowKeyIconDisplay,
  BasicActionsKeyboardHelpSection,
  MoveDraggableItemsKeyboardHelpSection,
  SliderControlsKeyboardHelpSection,
  TimeControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import TrackLabNamespace from "../../TrackLabNamespace.js";

export class TrackLabKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    super(
      [
        new TimeControlsKeyboardHelpSection(),
        // Scrubber is a horizontal HSlider — only left/right arrows apply.
        new SliderControlsKeyboardHelpSection({
          arrowKeyIconDisplay: ArrowKeyIconDisplay.LEFT_RIGHT,
        }),
      ],
      [
        // Coordinate system, calibration tool, measuring tape, angle tool are all
        // draggable via RichDragListener (arrow keys + Shift for smaller steps).
        new MoveDraggableItemsKeyboardHelpSection(),
        // Covers Tab/Shift-Tab navigation, Space/Enter to press buttons,
        // Space to toggle checkboxes, Reset All hotkey, and Escape.
        new BasicActionsKeyboardHelpSection({ withCheckboxContent: true }),
      ],
    );
  }
}

TrackLabNamespace.register("TrackLabKeyboardHelpContent", TrackLabKeyboardHelpContent);
