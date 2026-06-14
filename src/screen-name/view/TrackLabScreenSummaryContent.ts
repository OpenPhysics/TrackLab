/**
 * TrackLabScreenSummaryContent.ts
 *
 * Accessible screen summary (SceneryStack Interactive Description) for TrackLab.
 * Describes the play area and controls, gives an interaction hint, and exposes a
 * LIVE "current details" paragraph derived from the model (whether a video is
 * loaded, how many tracks are digitized, and playback state).
 *
 * Follows the OpenPhysics accessibility convention; see the canonical
 * TemplateSingleSim/SimScreenSummaryContent.ts.
 */
import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { SimModel } from "../model/SimModel.js";

export class TrackLabScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: SimModel) {
    const a11y = StringManager.getInstance().getA11yStrings();

    const currentDetailsProperty = new DerivedProperty(
      [
        a11y.currentDetailsNoVideoStringProperty,
        a11y.currentDetailsWithVideoStringProperty,
        a11y.playingLabelStringProperty,
        a11y.pausedLabelStringProperty,
        model.playback.videoLoadedProperty,
        model.tracking.tracksProperty,
        model.playback.isPlayingProperty,
      ],
      (noVideo, withVideo, playingLabel, pausedLabel, videoLoaded, tracks, isPlaying) =>
        videoLoaded
          ? StringUtils.fillIn(withVideo, {
              tracks: tracks.length,
              state: isPlaying ? playingLabel : pausedLabel,
            })
          : noVideo,
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
