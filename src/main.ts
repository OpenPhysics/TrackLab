/**
 * main.ts
 *
 * Entry point for the simulation. Initializes SceneryStack, creates the
 * screen, and starts the main event loop.
 *
 * !! CRITICAL IMPORT ORDER !!
 * brand.js MUST be the first import. It triggers the full bootstrap chain:
 *
 *   brand.ts → splash.ts → assert.ts → init.ts
 *
 * SceneryStack requires this exact load order. Never reorder these imports.
 */

// brand.js MUST be first — triggers: init.ts → assert.ts → splash.ts → brand.ts
import "./brand.js";

import { onReadyToLaunch, PreferencesModel, Sim } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "./i18n/StringManager.js";
import { TrackLabPreferencesModel } from "./preferences/TrackLabPreferencesModel.js";
import { TrackLabPreferencesNode } from "./preferences/TrackLabPreferencesNode.js";
import { SimScreen } from "./screen-name/SimScreen.js";
import { KeyboardShortcutsNode } from "./screen-name/view/KeyboardShortcutsNode.js";
import TrackLabColors from "./TrackLabColors.js";

onReadyToLaunch(() => {
  const stringManager = StringManager.getInstance();
  const trackLabPreferences = new TrackLabPreferencesModel();

  const keyboardShortcutNode = new KeyboardShortcutsNode();
  const screens = [
    new SimScreen({
      tandem: Tandem.ROOT.createTandem("simScreen"),
      backgroundColorProperty: TrackLabColors.backgroundColorProperty,
      createKeyboardHelpNode: () => keyboardShortcutNode,
      trackLabPreferences,
    }),
  ];

  const simOptions = {
    webgl: true,
    preferencesModel: new PreferencesModel({
      visualOptions: {
        supportsProjectorMode: true,
        supportsInteractiveHighlights: true,
      },
      simulationOptions: {
        customPreferences: [
          {
            createContent: (_tandem: Tandem) => new TrackLabPreferencesNode(trackLabPreferences),
          },
        ],
      },
    }),
  };

  const sim = new Sim(stringManager.getTitleStringProperty(), screens, simOptions);
  sim.start();
});
