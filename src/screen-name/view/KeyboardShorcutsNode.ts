/**
 * Keyboard shortcuts help content for TrackLab simulations.
 * Displays available keyboard shortcuts in a two-column layout.
 */

import { TwoColumnKeyboardHelpContent, KeyboardHelpSection, KeyboardHelpSectionRow } from "scenerystack/scenery-phet";
import { TextKeyNode } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";
import trackLab from '../../TrackLabNamespace.js';

export class KeyboardShortcutsNode extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const stringManager = StringManager.getInstance();
    const keyboardShortcutsStrings = stringManager.getKeyboardShortcutsStrings();

    // Create sections for simulation controls
    const simulationControlsSection = new KeyboardHelpSection(
      keyboardShortcutsStrings.simulationControlsStringProperty,
      [
        KeyboardHelpSectionRow.labelWithIcon(
          keyboardShortcutsStrings.playPauseSimulationStringProperty,
          TextKeyNode.space()
        ),
        KeyboardHelpSectionRow.labelWithIcon(
          keyboardShortcutsStrings.resetSimulationStringProperty,
          new TextKeyNode("R")
        ),
        KeyboardHelpSectionRow.labelWithIcon(
          keyboardShortcutsStrings.stepBackwardStringProperty,
          new TextKeyNode("\u2190") // Left arrow
        ),
        KeyboardHelpSectionRow.labelWithIcon(
          keyboardShortcutsStrings.stepForwardStringProperty,
          new TextKeyNode("\u2192") // Right arrow
        ),
      ]
    );

    // Create sections for graph interactions
    const graphInteractionsSection = new KeyboardHelpSection(
      keyboardShortcutsStrings.graphInteractionsStringProperty,
      [
        KeyboardHelpSectionRow.labelWithIcon(
          keyboardShortcutsStrings.resetZoomStringProperty,
          new TextKeyNode("Double-click")
        ),
        KeyboardHelpSectionRow.labelWithIcon(
          keyboardShortcutsStrings.zoomInOutStringProperty,
          new TextKeyNode("Mouse wheel")
        ),
        KeyboardHelpSectionRow.labelWithIcon(
          keyboardShortcutsStrings.panViewStringProperty,
          new TextKeyNode("Drag")
        ),
      ]
    );

    // Left column has simulation controls, right column has graph interactions
    super([simulationControlsSection], [graphInteractionsSection], {
      columnSpacing: 20,
      sectionSpacing: 15,
    });
  }
}

// Register with namespace for debugging accessibility
trackLab.register('KeyboardShortcutsNode', KeyboardShortcutsNode);