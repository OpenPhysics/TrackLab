import {
  DerivedProperty,
  EnumerationProperty,
  Property,
} from "scenerystack/axon";
import { Dimension2, Range } from "scenerystack/dot";
import { HBox, Text, VBox } from "scenerystack/scenery";
import {
  PhetFont,
  TimeControlNode,
  TimeSpeed,
} from "scenerystack/scenery-phet";
import { ButtonNode, NumberSpinner, Slider } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import { FRAME_RATE_RANGE, type SimModel } from "../model/SimModel.js";

const LABEL_FONT = new PhetFont(14);
const SMALL_FONT = new PhetFont(12);
const CONTROLS_SPACING = 16; // gap between info display, time control, and scrubber
const SPEED_FAST = 2.0; // playback rate multiplier for TimeSpeed.FAST
const SPEED_NORMAL = 1.0; // playback rate multiplier for TimeSpeed.NORMAL
const SPEED_SLOW = 0.5; // playback rate multiplier for TimeSpeed.SLOW
const SCRUBBER_TRACK_WIDTH = 480;
const SCRUBBER_TRACK_HEIGHT = 4;
const SCRUBBER_THUMB_WIDTH = 12;
const SCRUBBER_THUMB_HEIGHT = 24;
const FPS_CONTROL_SPACING = 4; // gap between "fps:" label and spinner
const INFO_DISPLAY_SPACING = 2; // gap between time label, frame counter, and fps control
const FPS_SPINNER_SCALE = 0.6;
const FPS_SPINNER_MIN_WIDTH = 35;

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
    const timeSpeedProperty = new EnumerationProperty(TimeSpeed.NORMAL);
    const speedMap = new Map([
      [TimeSpeed.FAST, SPEED_FAST],
      [TimeSpeed.NORMAL, SPEED_NORMAL],
      [TimeSpeed.SLOW, SPEED_SLOW],
    ]);
    timeSpeedProperty.link((speed) => {
      videoElement.playbackRate = speedMap.get(speed) ?? SPEED_NORMAL;
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
    });

    // ── Scrubber ───────────────────────────────────────────────────────────
    const rangeProperty = new DerivedProperty(
      [model.durationProperty],
      (duration: number) => new Range(0, Math.max(duration, 1)),
    );

    const scrubber = new Slider(
      model.currentTimeProperty as unknown as Property<number>,
      rangeProperty,
      {
        trackSize: new Dimension2(SCRUBBER_TRACK_WIDTH, SCRUBBER_TRACK_HEIGHT),
        thumbSize: new Dimension2(SCRUBBER_THUMB_WIDTH, SCRUBBER_THUMB_HEIGHT),
        startDrag: () => {
          this.isScrubbing = true;
        },
        endDrag: () => {
          this.isScrubbing = false;
        },
        enabledProperty: model.videoLoadedProperty,
      },
    );

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
    });
    const frameCountLabel = new Text(frameCountTextProperty, {
      font: LABEL_FONT,
    });

    // ── Frame rate control ─────────────────────────────────────────────────
    const fpsLabel = new Text("fps:", {
      font: SMALL_FONT,
      fill: TrackLabColors.textMutedProperty,
    });

    const fpsSpinner = new NumberSpinner(
      model.frameRateProperty,
      new Property(FRAME_RATE_RANGE),
      {
        deltaValue: 1,
        numberDisplayOptions: {
          decimalPlaces: 0,
          textOptions: { font: SMALL_FONT },
          minBackgroundWidth: FPS_SPINNER_MIN_WIDTH,
        },
        arrowsPosition: "leftRight",
        arrowButtonOptions: {
          scale: FPS_SPINNER_SCALE,
          buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
        },
        tandem: Tandem.OPT_OUT,
      },
    );

    const fpsControl = new HBox({
      children: [fpsLabel, fpsSpinner],
      spacing: FPS_CONTROL_SPACING,
      align: "center",
    });

    const infoDisplay = new VBox({
      children: [totalTimeLabel, frameCountLabel, fpsControl],
      spacing: INFO_DISPLAY_SPACING,
      align: "left",
    });

    this.children = [infoDisplay, timeControlNode, scrubber];
  }

  public get scrubbing(): boolean {
    return this.isScrubbing;
  }
}
