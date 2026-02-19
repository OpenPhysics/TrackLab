import {
  DerivedProperty,
  EnumerationProperty,
  Property,
} from "scenerystack/axon";
import { Dimension2, Range } from "scenerystack/dot";
import { HBox, Text, VBox } from "scenerystack/scenery";
import { PhetFont, TimeControlNode, TimeSpeed } from "scenerystack/scenery-phet";
import { ButtonNode, NumberSpinner, Slider } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import { FRAME_RATE_RANGE, type SimModel } from "../model/SimModel.js";

const LABEL_FONT = new PhetFont(14);
const SMALL_FONT = new PhetFont(12);

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
    super({ spacing: 16, align: "center" });

    // ── Playback rate via TimeSpeed ────────────────────────────────────────
    const timeSpeedProperty = new EnumerationProperty(TimeSpeed.NORMAL);
    const speedMap = new Map([
      [TimeSpeed.FAST, 2.0],
      [TimeSpeed.NORMAL, 1.0],
      [TimeSpeed.SLOW, 0.5],
    ]);
    timeSpeedProperty.link((speed) => {
      videoElement.playbackRate = speedMap.get(speed) ?? 1.0;
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
        trackSize: new Dimension2(480, 4),
        thumbSize: new Dimension2(12, 24),
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
      [model.currentTimeProperty, model.durationProperty, model.frameDurationProperty],
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
          minBackgroundWidth: 35,
        },
        arrowsPosition: "leftRight",
        arrowButtonOptions: {
          scale: 0.6,
          buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
        },
        tandem: Tandem.OPT_OUT,
      },
    );

    const fpsControl = new HBox({
      children: [fpsLabel, fpsSpinner],
      spacing: 4,
      align: "center",
    });

    const infoDisplay = new VBox({
      children: [totalTimeLabel, frameCountLabel, fpsControl],
      spacing: 2,
      align: "left",
    });

    this.children = [infoDisplay, timeControlNode, scrubber];
  }

  public get scrubbing(): boolean {
    return this.isScrubbing;
  }
}
