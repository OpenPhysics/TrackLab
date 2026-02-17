// NOTE: brand.js needs to be the first import. This is because SceneryStack for sims needs a very specific loading
// order: init.ts => assert.ts => splash.ts => brand.ts => everything else (here)
import "./brand.js";

import { onReadyToLaunch, Sim, type SimOptions } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "./i18n/StringManager.js";
import { SimScreen } from "./screen-name/SimScreen.js";

onReadyToLaunch(() => {
  const stringManager = StringManager.getInstance();

  const screens = [
    new SimScreen({ tandem: Tandem.ROOT.createTandem("simScreen") }),
  ];

  const simOptions: SimOptions = {};

  const sim = new Sim(
    stringManager.getTitleStringProperty(),
    screens,
    simOptions,
  );
  sim.start();
});
