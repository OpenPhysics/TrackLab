import { DerivedProperty, EnumerationProperty } from "scenerystack/axon";
import { Dimension2, Range } from "scenerystack/dot";
import { HBox, Text, VBox } from "scenerystack/scenery";
import {
  PhetFont,
  TimeControlNode,
  TimeSpeed,
} from "scenerystack/scenery-phet";
import { Slider } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import type { SimModel } from "../model/SimModel.js";

const LABEL_FONT = new PhetFont(14);
const CONTROLS_SPACING = 16; // gap between info display, time control, and scrubber
const SPEED_FAST = 2.0; // playback rate multiplier for TimeSpeed.FAST
const SPEED_NORMAL = 1.0; // playback rate multiplier for TimeSpeed.NORMAL
const SPEED_SLOW = 0.5; // playback rate multiplier for TimeSpeed.SLOW
const SCRUBBER_TRACK_WIDTH = 320;
const SCRUBBER_TRACK_HEIGHT = 4;
const SCRUBBER_THUMB_WIDTH = 12;
const SCRUBBER_THUMB_HEIGHT = 24;
const INFO_DISPLAY_SPACING = 4; // gap between time label and frame counter

/**
 * Playback controls including time control, scrubber, and time/frame display.
 */
export class PlaybackControlsNode extends HBox {
  private isScrubbing = false;

  public constructor(
    model: SimModel,
    videoElement: HTMLVideoElement,
    onStepBackward: () => void,
    onStepForward: () => void,
  ) {
    super({ spacing: CONTROLS_SPACING, align: "center" });

    // ── Playback rate via TimeSpeed ────────────────────────────────────────
    // timeSpeedProperty is view-local (the TimeSpeed enum is a scenery-phet type
    // that cannot live in the model).  It syncs bidirectionally with the numeric
    // model.playbackRateProperty so that model.reset() resets the radio buttons.
    const speedMap = new Map([
      [TimeSpeed.FAST, SPEED_FAST],
      [TimeSpeed.NORMAL, SPEED_NORMAL],
      [TimeSpeed.SLOW, SPEED_SLOW],
    ]);
    const rateToSpeed = new Map(
      Array.from(speedMap.entries()).map(([k, v]) => [v, k]),
    );
    const timeSpeedProperty = new EnumerationProperty(TimeSpeed.NORMAL);

    // view → model
    timeSpeedProperty.link((speed) => {
      model.playbackRateProperty.value = speedMap.get(speed) ?? SPEED_NORMAL;
    });

    // model → view  (handles reset and any future programmatic rate changes)
    model.playbackRateProperty.lazyLink((rate: number) => {
      timeSpeedProperty.value = rateToSpeed.get(rate) ?? TimeSpeed.NORMAL;
    });

    // ── TimeControlNode: play/pause + step back + step forward + speed ─────
    const timeControlNode = new TimeControlNode(model.isPlayingProperty, {
      timeSpeedProperty: timeSpeedProperty,
      timeSpeeds: [TimeSpeed.NORMAL, TimeSpeed.SLOW],
      enabledProperty: model.videoLoadedProperty,
      tandem: Tandem.OPT_OUT,
      playPauseStepButtonOptions: {
        includeStepBackwardButton: true,
        stepBackwardButtonOptions: {
          listener: onStepBackward,
        },
        stepForwardButtonOptions: {
          listener: onStepForward,
        },
      },
      speedRadioButtonGroupOptions: {
        labelOptions: {
          fill: TrackLabColors.textOnDarkProperty,
        },
      },
    });

    // ── Scrubber ───────────────────────────────────────────────────────────
    const rangeProperty = new DerivedProperty(
      [model.durationProperty],
      (duration: number) => new Range(0, Math.max(duration, 1)),
    );

    const scrubber = new Slider(model.currentTimeProperty, rangeProperty, {
      trackSize: new Dimension2(SCRUBBER_TRACK_WIDTH, SCRUBBER_TRACK_HEIGHT),
      thumbSize: new Dimension2(SCRUBBER_THUMB_WIDTH, SCRUBBER_THUMB_HEIGHT),
      startDrag: () => {
        this.isScrubbing = true;
      },
      endDrag: () => {
        this.isScrubbing = false;
      },
      enabledProperty: model.videoLoadedProperty,
    });

    model.currentTimeProperty.lazyLink((time) => {
      if (this.isScrubbing) {
        videoElement.currentTime = time;
      }
    });

    // ── Time and frame info display ────────────────────────────────────────
    const formatDuration = (seconds: number): string => {
      if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${String(secs).padStart(2, "0")}`;
    };

    const totalTimeTextProperty = new DerivedProperty(
      [model.durationProperty],
      (duration: number) => formatDuration(duration),
    );

    const frameCountTextProperty = new DerivedProperty(
      [
        model.currentTimeProperty,
        model.durationProperty,
        model.frameDurationProperty,
      ],
      (time: number, duration: number, frameDuration: number) => {
        if (duration <= 0) return "0/0";
        const current = Math.round(time / frameDuration);
        const total = Math.round(duration / frameDuration);
        return `${current}/${total}`;
      },
    );

    const totalTimeLabel = new Text(totalTimeTextProperty, {
      font: LABEL_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });
    const frameCountLabel = new Text(frameCountTextProperty, {
      font: LABEL_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });

    const infoDisplay = new VBox({
      children: [totalTimeLabel, frameCountLabel],
      spacing: INFO_DISPLAY_SPACING,
      align: "left",
    });

    this.children = [infoDisplay, timeControlNode, scrubber];
  }

  public get scrubbing(): boolean {
    return this.isScrubbing;
  }
}
