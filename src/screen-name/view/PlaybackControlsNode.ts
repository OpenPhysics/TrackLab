/**
 * PlaybackControlsNode.ts
 *
 * Controls for video playback including play/pause, frame stepping,
 * scrubber, speed selection, and frame rate adjustment.
 */

import { DerivedProperty, EnumerationProperty } from "scenerystack/axon";
import { Dimension2, Range } from "scenerystack/dot";
import { HBox, Text, VBox } from "scenerystack/scenery";
import { PhetFont, TimeControlNode, TimeSpeed } from "scenerystack/scenery-phet";
import { ButtonNode, HSlider, RectangularPushButton } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";

const a11yStrings = StringManager.getInstance().getA11y();

import { BUTTON_X_MARGIN, BUTTON_Y_MARGIN } from "../../TrackLabConstants.js";
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
const INFO_DISPLAY_WIDTH = 75; // fixed width to prevent layout shift when text changes
const REWIND_BUTTON_ICON_SIZE = 16; // font size for the rewind button icon glyph

/**
 * Playback controls including time control, scrubber, and time/frame display.
 */
export class PlaybackControlsNode extends HBox {
  private isScrubbing = false;
  private readonly disposePlaybackControlsNode: () => void;

  public constructor(
    model: SimModel,
    videoElement: HTMLVideoElement,
    onStepBackward: () => void,
    onStepForward: () => void,
  ) {
    super({ spacing: CONTROLS_SPACING, align: "center" });

    const playbackStrings = StringManager.getInstance().getPlayback();

    // ── Playback rate via TimeSpeed ────────────────────────────────────────
    // timeSpeedProperty is view-local (the TimeSpeed enum is a scenery-phet type
    // that cannot live in the model).  It syncs bidirectionally with the numeric
    // model.playbackRateProperty so that model.reset() resets the radio buttons.
    const speedMap = new Map([
      [TimeSpeed.FAST, SPEED_FAST],
      [TimeSpeed.NORMAL, SPEED_NORMAL],
      [TimeSpeed.SLOW, SPEED_SLOW],
    ]);
    const rateToSpeed = new Map(Array.from(speedMap.entries()).map(([k, v]) => [v, k]));
    const timeSpeedProperty = new EnumerationProperty(TimeSpeed.NORMAL);

    // view → model
    const onSpeedChange = (speed: TimeSpeed) => {
      model.playbackRateProperty.value = speedMap.get(speed) ?? SPEED_NORMAL;
    };
    timeSpeedProperty.link(onSpeedChange);

    // model → view  (handles reset and any future programmatic rate changes)
    const onRateChange = (rate: number) => {
      timeSpeedProperty.value = rateToSpeed.get(rate) ?? TimeSpeed.NORMAL;
    };
    model.playbackRateProperty.lazyLink(onRateChange);

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
    // Create mutable range that will be updated when duration changes
    const scrubberRange = new Range(0, model.durationProperty.value > 0 ? model.durationProperty.value : 1);

    const scrubber = new HSlider(model.currentTimeProperty, scrubberRange, {
      trackSize: new Dimension2(SCRUBBER_TRACK_WIDTH, SCRUBBER_TRACK_HEIGHT),
      thumbSize: new Dimension2(SCRUBBER_THUMB_WIDTH, SCRUBBER_THUMB_HEIGHT),
      majorTickLength: 8,
      majorTickStroke: TrackLabColors.textOnDarkProperty,
      majorTickLineWidth: 1,
      startDrag: () => {
        this.isScrubbing = true;
      },
      endDrag: () => {
        this.isScrubbing = false;
      },
      enabledProperty: model.videoLoadedProperty,
      accessibleName: a11yStrings.videoScrubberStringProperty,
    });

    // Function to update tick marks for each frame
    const updateTickMarks = () => {
      const duration = model.durationProperty.value;
      const frameRate = model.frameRateProperty.value;

      if (duration <= 0 || frameRate <= 0) {
        return;
      }

      const totalFrames = Math.round(duration * frameRate);
      for (let i = 0; i <= totalFrames; i++) {
        scrubber.addMajorTick(i / frameRate);
      }
    };

    // Update range and ticks when duration changes
    const durationListener = (duration: number) => {
      // Update scrubber range
      scrubberRange.max = duration > 0 ? duration : 1;
      // Update tick marks
      updateTickMarks();
    };
    model.durationProperty.link(durationListener);

    const frameRateListener = () => {
      updateTickMarks();
    };
    model.frameRateProperty.link(frameRateListener);

    const onTimeChange = (time: number) => {
      if (this.isScrubbing) {
        videoElement.currentTime = time;
      }
    };
    model.currentTimeProperty.lazyLink(onTimeChange);

    // ── Time and frame info display ────────────────────────────────────────
    const formatDuration = (seconds: number): string => {
      if (!Number.isFinite(seconds) || seconds <= 0) {
        return playbackStrings.durationZeroStringProperty.value;
      }
      return `${seconds.toFixed(2)} ${playbackStrings.secondsUnitStringProperty.value}`;
    };

    const totalTimeTextProperty = new DerivedProperty([model.durationProperty], (duration: number) =>
      formatDuration(duration),
    );

    const frameCountTextProperty = new DerivedProperty(
      [model.currentTimeProperty, model.durationProperty, model.frameRateProperty],
      (time: number, duration: number, frameRate: number) => {
        if (duration <= 0) {
          return "0/0";
        }
        // Multiply by frame rate directly rather than dividing by frameDuration
        // (1/fps) to avoid cascading floating-point error at non-integer fps
        // values like 29.97, matching the approach used in AutoTrackerNode.
        const current = Math.round(time * frameRate);
        const total = Math.round(duration * frameRate);
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
      preferredWidth: INFO_DISPLAY_WIDTH,
    });

    // ── Rewind-to-zero button ──────────────────────────────────────────────
    const rewindButton = new RectangularPushButton({
      content: new Text("\u23EE", {
        font: new PhetFont(REWIND_BUTTON_ICON_SIZE),
        fill: TrackLabColors.textOnDarkProperty,
      }),
      baseColor: TrackLabColors.buttonBaseDarkProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      xMargin: BUTTON_X_MARGIN,
      yMargin: BUTTON_Y_MARGIN,
      listener: () => {
        model.isPlayingProperty.value = false;
        model.currentTimeProperty.value = 0;
        videoElement.currentTime = 0;
      },
      enabledProperty: model.videoLoadedProperty,
      tandem: Tandem.OPT_OUT,
      accessibleName: a11yStrings.rewindToStartStringProperty,
    });

    this.children = [timeControlNode, scrubber, rewindButton, infoDisplay];

    this.disposePlaybackControlsNode = () => {
      timeSpeedProperty.unlink(onSpeedChange);
      model.playbackRateProperty.unlink(onRateChange);
      model.currentTimeProperty.unlink(onTimeChange);
      model.durationProperty.unlink(durationListener);
      model.frameRateProperty.unlink(frameRateListener);
      timeSpeedProperty.dispose();
      totalTimeTextProperty.dispose();
      frameCountTextProperty.dispose();
    };
  }

  public get scrubbing(): boolean {
    return this.isScrubbing;
  }

  public override dispose(): void {
    this.disposePlaybackControlsNode();
    super.dispose();
  }
}
