/**
 * PlaybackControlsNode.ts
 *
 * Controls for video playback including play/pause, frame stepping,
 * scrubber, speed selection, and frame rate adjustment.
 */

import { DerivedProperty, EnumerationProperty } from "scenerystack/axon";
import { Dimension2, Range } from "scenerystack/dot";
import { HBox, HStrut, Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont, TimeControlNode, TimeSpeed } from "scenerystack/scenery-phet";
import { HSlider } from "scenerystack/sun";

import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import { createTrackLabButton } from "../../TrackLabButton.js";
import TrackLabColors from "../../TrackLabColors.js";

const a11yStrings = StringManager.getInstance().getA11y();

import trackLab from "../../TrackLabNamespace.js";
import GraphDataManager from "../graph/GraphDataManager.js";
import type { VideoPlaybackModel } from "../model/VideoPlaybackModel.js";

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
  private scrubber: HSlider;
  private scrubberRange: Range;
  private readonly disposePlaybackControlsNode: () => void;

  public constructor(
    playback: VideoPlaybackModel,
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
      playback.playbackRateProperty.value = speedMap.get(speed) ?? SPEED_NORMAL;
    };
    timeSpeedProperty.link(onSpeedChange);

    // model → view  (handles reset and any future programmatic rate changes)
    const onRateChange = (rate: number) => {
      timeSpeedProperty.value = rateToSpeed.get(rate) ?? TimeSpeed.NORMAL;
    };
    playback.playbackRateProperty.lazyLink(onRateChange);

    // ── TimeControlNode: play/pause + step back + step forward + speed ─────
    const timeControlNode = new TimeControlNode(playback.isPlayingProperty, {
      timeSpeedProperty: timeSpeedProperty,
      timeSpeeds: [TimeSpeed.NORMAL, TimeSpeed.SLOW],
      speedRadioButtonGroupPlacement: "left",
      enabledProperty: playback.videoLoadedProperty,
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
    const initDuration = playback.durationProperty.value;
    this.scrubberRange = new Range(0, Number.isFinite(initDuration) && initDuration > 0 ? initDuration : 1);

    /**
     * Calculate a "nice" tick interval for the scrubber based on total frames.
     * Targets approximately 15 major ticks. Minor ticks are added between major
     * ticks when the major interval is large enough to warrant subdivision.
     */
    const calculateTickInterval = (totalFrames: number): { majorInterval: number; minorInterval: number } => {
      const majorInterval = GraphDataManager.calculateTickSpacing(totalFrames, 15);

      // Calculate minor interval (5 minor ticks between major ticks when practical)
      let minorInterval = 0;
      if (majorInterval >= 10) {
        minorInterval = majorInterval / 5;
      } else if (majorInterval >= 5) {
        minorInterval = 1;
      }

      return { majorInterval, minorInterval };
    };

    // Helper to create/recreate the scrubber with tick marks
    const createScrubber = (): HSlider => {
      const newScrubber = new HSlider(playback.currentTimeProperty, this.scrubberRange, {
        trackSize: new Dimension2(SCRUBBER_TRACK_WIDTH, SCRUBBER_TRACK_HEIGHT),
        thumbSize: new Dimension2(SCRUBBER_THUMB_WIDTH, SCRUBBER_THUMB_HEIGHT),
        thumbTouchAreaXDilation: 6,
        thumbTouchAreaYDilation: 6,
        thumbMouseAreaXDilation: 4,
        thumbMouseAreaYDilation: 4,
        majorTickLength: 8,
        majorTickStroke: TrackLabColors.textOnDarkProperty,
        majorTickLineWidth: 1,
        minorTickLength: 4,
        minorTickStroke: TrackLabColors.textOnDarkProperty,
        minorTickLineWidth: 1,
        startDrag: () => {
          this.isScrubbing = true;
        },
        endDrag: () => {
          this.isScrubbing = false;
        },
        enabledProperty: playback.videoLoadedProperty,
        accessibleName: a11yStrings.videoScrubberStringProperty,
      });
      newScrubber.addInputListener({ down: () => newScrubber.focus() });

      // Add tick marks based on calculated intervals
      const duration = playback.durationProperty.value;
      const frameRate = playback.frameRateProperty.value;

      if (Number.isFinite(duration) && duration > 0 && frameRate > 0) {
        const knownCount = playback.totalFrameCountProperty.value;
        const totalFrames = knownCount > 0 ? knownCount : Math.round(duration * frameRate);
        const { majorInterval, minorInterval } = calculateTickInterval(totalFrames);

        // Add major ticks
        for (let i = 0; i <= totalFrames; i += majorInterval) {
          newScrubber.addMajorTick(i / frameRate);
        }

        // Add minor ticks if interval is defined
        if (minorInterval > 0) {
          for (let i = 0; i <= totalFrames; i += minorInterval) {
            // Skip if this is already a major tick
            if (i % majorInterval !== 0) {
              newScrubber.addMinorTick(i / frameRate);
            }
          }
        }
      }

      return newScrubber;
    };

    this.scrubber = createScrubber();

    // Update range and ticks when duration changes
    const durationListener = (duration: number) => {
      // Update scrubber range — guard against Infinity (reported by WebM files)
      this.scrubberRange.max = Number.isFinite(duration) && duration > 0 ? duration : 1;
      // Recreate scrubber with new tick marks
      this.replaceScrubber(createScrubber());
    };
    playback.durationProperty.link(durationListener);

    // Recreate scrubber when frame rate changes
    const frameRateListener = () => {
      this.replaceScrubber(createScrubber());
    };
    playback.frameRateProperty.lazyLink(frameRateListener);

    // Recreate scrubber when the exact frame count becomes known
    const totalFrameCountListener = () => {
      this.replaceScrubber(createScrubber());
    };
    playback.totalFrameCountProperty.lazyLink(totalFrameCountListener);

    const onTimeChange = (time: number) => {
      if (this.isScrubbing) {
        videoElement.currentTime = time;
      }
    };
    playback.currentTimeProperty.lazyLink(onTimeChange);

    // ── Time and frame info display ────────────────────────────────────────
    const formatDuration = (seconds: number): string => {
      if (!Number.isFinite(seconds) || seconds <= 0) {
        return playbackStrings.durationZeroStringProperty.value;
      }
      return `${seconds.toFixed(2)} ${playbackStrings.secondsUnitStringProperty.value}`;
    };

    const totalTimeTextProperty = new DerivedProperty([playback.durationProperty], (duration: number) =>
      formatDuration(duration),
    );

    const frameCountTextProperty = new DerivedProperty(
      [
        playback.currentTimeProperty,
        playback.durationProperty,
        playback.frameRateProperty,
        playback.totalFrameCountProperty,
      ],
      (time: number, duration: number, frameRate: number, totalFrameCount: number) => {
        if (duration <= 0) {
          return "0/0";
        }
        // Multiply by frame rate directly rather than dividing by frameDuration
        // (1/fps) to avoid cascading floating-point error at non-integer fps
        // values like 29.97, matching the approach used in AutoTrackerNode.
        const current = Math.round(time * frameRate);
        if (!Number.isFinite(duration)) {
          return `${current}/?`;
        }
        const total = totalFrameCount > 0 ? totalFrameCount : Math.round(duration * frameRate);
        return `${current}/${total}`;
      },
    );

    const totalTimeText = new Text(totalTimeTextProperty, {
      font: LABEL_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });
    // Node([HStrut, text]): Scenery unions children bounds, so the container
    // width = max(INFO_DISPLAY_WIDTH, text.width) — always INFO_DISPLAY_WIDTH
    // as long as the text fits, preventing layout shifts as the text changes.
    const totalTimeLabel = new Node({ children: [new HStrut(INFO_DISPLAY_WIDTH), totalTimeText] });

    const frameCountText = new Text(frameCountTextProperty, {
      font: LABEL_FONT,
      fill: TrackLabColors.textOnDarkProperty,
    });
    const frameCountLabel = new Node({ children: [new HStrut(INFO_DISPLAY_WIDTH), frameCountText] });

    const infoDisplay = new VBox({
      children: [totalTimeLabel, frameCountLabel],
      spacing: INFO_DISPLAY_SPACING,
      align: "left",
    });

    // ── Rewind-to-zero button ──────────────────────────────────────────────
    const rewindButton = createTrackLabButton(
      new Text("\u23EE", {
        font: new PhetFont(REWIND_BUTTON_ICON_SIZE),
        fill: "black",
      }),
      {
        baseColor: TrackLabColors.playbackButtonBaseProperty,
        // Dim the whole button (background + icon) when disabled so the light-blue
        // base colour doesn't stay fully saturated and look "washed out".
        enabledAppearanceStrategy: (enabled: boolean, button: import("scenerystack/scenery").Node) => {
          button.opacity = enabled ? 1 : 0.45;
        },
        enabledProperty: playback.videoLoadedProperty,
        accessibleName: a11yStrings.rewindToStartStringProperty,
        listener: () => {
          playback.isPlayingProperty.value = false;
          playback.currentTimeProperty.value = 0;
          videoElement.currentTime = 0;
        },
      },
    );

    this.children = [timeControlNode, this.scrubber, rewindButton, infoDisplay];

    this.disposePlaybackControlsNode = () => {
      timeSpeedProperty.unlink(onSpeedChange);
      playback.playbackRateProperty.unlink(onRateChange);
      playback.currentTimeProperty.unlink(onTimeChange);
      playback.durationProperty.unlink(durationListener);
      playback.frameRateProperty.unlink(frameRateListener);
      playback.totalFrameCountProperty.unlink(totalFrameCountListener);
      timeSpeedProperty.dispose();
      totalTimeTextProperty.dispose();
      frameCountTextProperty.dispose();
    };
  }

  /**
   * Replace the current scrubber with a new one.
   * Disposes the old scrubber and updates the children array using proper Node methods
   * to avoid memory leaks.
   */
  private replaceScrubber(newScrubber: HSlider): void {
    const oldScrubber = this.scrubber;
    const scrubberIndex = this.children.indexOf(oldScrubber);

    if (scrubberIndex !== -1) {
      // Remove old scrubber from scene graph first
      this.removeChild(oldScrubber);

      // Update reference
      this.scrubber = newScrubber;

      // Insert new scrubber at the same position
      this.insertChild(scrubberIndex, newScrubber);

      // Dispose old scrubber after it's removed from scene graph
      oldScrubber.dispose();
    }
  }

  public get scrubbing(): boolean {
    return this.isScrubbing;
  }

  public override dispose(): void {
    this.disposePlaybackControlsNode();
    this.scrubber.dispose();
    super.dispose();
  }
}

trackLab.register("PlaybackControlsNode", PlaybackControlsNode);
