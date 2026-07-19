/**
 * main.ts
 *
 * Entry point for the simulation. Initializes SceneryStack, creates the
 * screens, and starts the main event loop.
 *
 * !! CRITICAL IMPORT ORDER !!
 * brand.js MUST be the first import. Each module imports the next, so the import nesting is
 *
 *   main → brand → splash → assert → init
 *
 * and therefore the actual EXECUTION order (deepest import runs first) is the reverse:
 *
 *   init → assert → splash → brand → main
 *
 * SceneryStack requires this exact load order. Never reorder these imports.
 */

// brand.js MUST be first; importing it runs the whole chain (init→assert→splash→brand) before main.
import "./brand.js";

import { onReadyToLaunch, PreferencesModel, Sim } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "./i18n/StringManager.js";
import { TrackLabPreferencesModel } from "./preferences/TrackLabPreferencesModel.js";
import { TrackLabPreferencesNode } from "./preferences/TrackLabPreferencesNode.js";
import TrackLabColors from "./TrackLabColors.js";
import { TrackLabScreen } from "./track-lab/TrackLabScreen.js";

onReadyToLaunch(() => {
  const stringManager = StringManager.getInstance();
  const trackLabPreferences = new TrackLabPreferencesModel();

  const screens = [
    new TrackLabScreen({
      tandem: Tandem.ROOT.createTandem("simScreen"),
      backgroundColorProperty: TrackLabColors.backgroundColorProperty,
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
      localizationOptions: {
        // Adds a language picker in Preferences → Language
        supportsDynamicLocale: true,
      },
    }),
  };

  const sim = new Sim(stringManager.getTitleStringProperty(), screens, simOptions);
  sim.start();
});
