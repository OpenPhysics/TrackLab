/**
 * SimScreen.ts
 *
 * The sole simulation screen that wires together the model (SimModel) and view (SimScreenView)
 * for the physics video analysis tool.
 */

import { Screen, type ScreenOptions } from "scenerystack/sim";
import type { TrackLabPreferencesModel } from "../preferences/TrackLabPreferencesModel.js";
import TrackLabNamespace from "../TrackLabNamespace.js";
import { SimModel } from "./model/SimModel.js";
import { SimScreenView } from "./view/SimScreenView.js";

/** Extends the base ScreenOptions with the preferences model required by SimScreenView. */
export interface SimScreenOptions extends ScreenOptions {
  trackLabPreferences: TrackLabPreferencesModel;
}

/**
 * The sole simulation screen, wiring together SimModel (state) and
 * SimScreenView (layout and overlays).
 */
export class SimScreen extends Screen<SimModel, SimScreenView> {
  public constructor(options: SimScreenOptions) {
    super(
      () => new SimModel(),
      (model) => new SimScreenView(model, options.trackLabPreferences),
      options,
    );
  }
}

TrackLabNamespace.register("SimScreen", SimScreen);
