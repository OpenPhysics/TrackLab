// NOTE: brand.js needs to be the first import. This is because SceneryStack for sims needs a very specific loading
// order: init.ts => assert.ts => splash.ts => brand.ts => everything else (here)
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
            createContent: (_tandem: Tandem) =>
              new TrackLabPreferencesNode(trackLabPreferences),
          },
        ],
      },
    }),
  };

  const sim = new Sim(
    stringManager.getTitleStringProperty(),
    screens,
    simOptions,
  );
  sim.start();
});
