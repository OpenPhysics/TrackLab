/**
 * TrackLabScreen.ts
 *
 * The sole simulation screen that wires together the model (TrackLabModel) and view (TrackLabScreenView)
 * for the physics video analysis tool.
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Screen, type ScreenOptions } from "scenerystack/sim";
import type { TrackLabPreferencesModel } from "../preferences/TrackLabPreferencesModel.js";
import TrackLabNamespace from "../TrackLabNamespace.js";
import { TrackLabModel } from "./model/TrackLabModel.js";
import { TrackLabKeyboardHelpContent } from "./view/TrackLabKeyboardHelpContent.js";
import { TrackLabScreenView } from "./view/TrackLabScreenView.js";

/** Extends the base ScreenOptions with the preferences model required by TrackLabScreenView. */
export interface TrackLabScreenOptions extends ScreenOptions {
  trackLabPreferences: TrackLabPreferencesModel;
}

/**
 * The sole simulation screen, wiring together TrackLabModel (state) and
 * TrackLabScreenView (layout and overlays).
 */
export class TrackLabScreen extends Screen<TrackLabModel, TrackLabScreenView> {
  public constructor(options: TrackLabScreenOptions) {
    super(
      () => new TrackLabModel(),
      (model) => new TrackLabScreenView(model, options.trackLabPreferences),
      optionize<TrackLabScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          createKeyboardHelpNode: () => new TrackLabKeyboardHelpContent(),
        },
        options,
      ),
    );
  }
}

TrackLabNamespace.register("TrackLabScreen", TrackLabScreen);
