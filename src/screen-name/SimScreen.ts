import { Screen, type ScreenOptions } from "scenerystack/sim";
import type { TrackLabPreferencesModel } from "../preferences/TrackLabPreferencesModel.js";
import { SimModel } from "./model/SimModel.js";
import { SimScreenView } from "./view/SimScreenView.js";

export interface SimScreenOptions extends ScreenOptions {
  trackLabPreferences: TrackLabPreferencesModel;
}

export class SimScreen extends Screen<SimModel, SimScreenView> {
  public constructor(options: SimScreenOptions) {
    super(
      () => new SimModel(),
      (model) => new SimScreenView(model, options.trackLabPreferences),
      options,
    );
  }
}
