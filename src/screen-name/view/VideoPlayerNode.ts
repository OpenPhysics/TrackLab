/**
 * VideoPlayerNode.ts
 *
 * Main video display component. Hosts the video element and all interactive overlays
 * (coordinate system, calibration, auto-tracker, digitizing).
 */

import { DerivedProperty } from "scenerystack/axon";
import { Dimension2 } from "scenerystack/dot";
import { DOM, Node, VBox } from "scenerystack/scenery";
import TrackLabColors from "../../TrackLabColors.js";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";

const MAIN_CONTENT_SPACING = 10; // VBox gap between source control, video layer, and playback

import { StringManager } from "../../i18n/StringManager.js";
import { AutoTrackerNode } from "./AutoTrackerNode.js";
import { DigitizingOverlayNode } from "./DigitizingOverlayNode.js";
import { PlaybackControlsNode } from "./PlaybackControlsNode.js";
import { VideoSourceControlNode } from "./VideoSourceControlNode.js";
import type { WebcamPanel } from "./WebcamPanel.js";

/**
 * Hosts the HTML video element together with all video overlays (auto-tracker,
 * digitizing crosshair), the playback controls bar, and the video source
 * selector. Also synchronises playback between the video element and the model.
 */
export class VideoPlayerNode extends Node {
  /** The underlying HTML video element used for display and pixel capture. */
  private readonly videoElement: HTMLVideoElement;
  /** Webcam recording panel; positioned by SimScreenView for correct z-ordering. */
  public readonly webcamPanel: WebcamPanel;
  /** Playback controls bar; positioned by SimScreenView at the bottom of the screen. */
  public readonly playbackControlsNode: PlaybackControlsNode;
  private readonly model: SimModel;
  private readonly disposeVideoPlayer: () => void;
  /** Tracks the current blob URL so it can be revoked when a new one is loaded. */
  private currentBlobUrl: string | null = null;
  /** Video source control node for reset functionality. */
  private readonly videoSourceControlNode: VideoSourceControlNode;

  /**
   * @param model - Simulation model providing reactive playback and track state.
   * @param listParent - Scene-graph node used as the popup list parent for combo boxes.
   */
  public constructor(model: SimModel, listParent: Node) {
    super();
    this.model = model;

    const a11yStrings = StringManager.getInstance().getA11y();

    // ── HTML video element ─────────────────────────────────────────────────
    this.videoElement = document.createElement("video");
    this.videoElement.width = VIDEO_WIDTH;
    this.videoElement.height = VIDEO_HEIGHT;
    this.videoElement.preload = "metadata";
    this.videoElement.crossOrigin = "anonymous";
    this.videoElement.style.display = "block";
    this.videoElement.setAttribute("aria-label", a11yStrings.videoPlayerStringProperty.value);
    const videoBackgroundListener = (c: import("scenerystack").Color) => {
      this.videoElement.style.background = c.toCSS();
    };
    TrackLabColors.videoBackgroundColorProperty.link(videoBackgroundListener);

    const videoNode = new DOM(this.videoElement, { allowInput: false });

    const updateDuration = () => {
      const d = this.videoElement.duration;
      if (Number.isFinite(d) && d > 0) {
        model.durationProperty.value = d;
      }
    };

    const onLoadedMetadata = () => {
      model.currentTimeProperty.value = 0;
      updateDuration();
    };
    this.videoElement.addEventListener("loadedmetadata", onLoadedMetadata);
    this.videoElement.addEventListener("durationchange", updateDuration);

    const onEnded = () => {
      model.isPlayingProperty.value = false;
    };
    this.videoElement.addEventListener("ended", onEnded);

    // ── Auto-tracking overlay ──────────────────────────────────────────────
    const autoTrackingShownProperty = new DerivedProperty(
      [model.videoLoadedProperty, model.autoTrackingProperty],
      (loaded, tracking) => loaded && tracking,
    );
    const autoTrackerNode = new AutoTrackerNode(this.videoElement, autoTrackingShownProperty, model);

    // ── Manual digitizing overlay ─────────────────────────────────────────
    const digitizingOverlayNode = new DigitizingOverlayNode(this.videoElement, model, () => this.stepForward());

    const videoLayer = new Node({
      children: [videoNode, autoTrackerNode, digitizingOverlayNode],
    });

    // ── Play / Pause ───────────────────────────────────────────────────────
    const isPlayingListener = (isPlaying: boolean) => {
      if (isPlaying) {
        this.videoElement.play().catch((err: unknown) => {
          // biome-ignore lint/suspicious/noConsole: error logging for video playback failure
          console.error("Video playback failed:", err);
          model.isPlayingProperty.value = false;
        });
      } else {
        this.videoElement.pause();
      }
    };
    model.isPlayingProperty.lazyLink(isPlayingListener);

    // ── Playback rate (applies model rate to the video element) ──────────
    const playbackRateListener = (rate: number) => {
      this.videoElement.playbackRate = rate;
    };
    model.playbackRateProperty.link(playbackRateListener);

    // ── Playback controls (positioned by SimScreenView at screen bottom) ──
    this.playbackControlsNode = new PlaybackControlsNode(
      model,
      this.videoElement,
      () => this.seekByFrames(-1),
      () => this.seekByFrames(1),
    );
    // Pin to the video width so internal text changes never shift the row.
    this.playbackControlsNode.preferredWidth = VIDEO_WIDTH;

    // ── Fit video element to its intrinsic aspect ratio ───────────────────
    // When a new clip is loaded, scale it to fill as much of VIDEO_WIDTH ×
    // VIDEO_HEIGHT as possible while preserving aspect ratio.  Setting the
    // element to the exact content size eliminates letterbox/pillarbox bars
    // and ensures overlay hit-areas and the OpenCV canvas share the same
    // coordinate space as what the user sees.
    const onDimensionsLoaded = () => {
      const intrinsicW = this.videoElement.videoWidth;
      const intrinsicH = this.videoElement.videoHeight;
      if (!(intrinsicW && intrinsicH)) {
        return;
      }
      const scale = Math.min(VIDEO_WIDTH / intrinsicW, VIDEO_HEIGHT / intrinsicH);
      const displayW = Math.round(intrinsicW * scale);
      const displayH = Math.round(intrinsicH * scale);
      this.videoElement.width = displayW;
      this.videoElement.height = displayH;
      model.videoDimensionsProperty.value = new Dimension2(displayW, displayH);
      this.playbackControlsNode.preferredWidth = displayW;
      model.tracker.resize(displayW, displayH);
    };
    this.videoElement.addEventListener("loadedmetadata", onDimensionsLoaded);

    // Sync model time from video during playback (event-driven, not polled)
    const onTimeUpdate = () => {
      if (!this.playbackControlsNode.scrubbing) {
        model.currentTimeProperty.value = this.videoElement.currentTime;
      }
    };
    this.videoElement.addEventListener("timeupdate", onTimeUpdate);

    // ── Video source controls (webcam panel is added to SimScreenView for z-order) ─
    this.videoSourceControlNode = new VideoSourceControlNode(
      model,
      listParent,
      (url, fps) => {
        model.isPlayingProperty.value = false;
        autoTrackerNode.reset();
        model.frameRateProperty.value = fps;
        this.loadUrl(url);
      },
      (blob, duration) => {
        model.isPlayingProperty.value = false;
        autoTrackerNode.reset();
        // Revoke the previous blob URL before creating a new one to prevent
        // the browser from holding the recorded video in memory indefinitely.
        if (this.currentBlobUrl) {
          URL.revokeObjectURL(this.currentBlobUrl);
        }
        this.currentBlobUrl = URL.createObjectURL(blob);
        this.videoElement.src = this.currentBlobUrl;
        this.videoElement.load();
        if (duration > 0) {
          model.durationProperty.value = duration;
        }
      },
    );

    // ── Layout ─────────────────────────────────────────────────────────────
    const mainContent = new VBox({
      children: [this.videoSourceControlNode, videoLayer],
      spacing: MAIN_CONTENT_SPACING,
      align: "center",
    });

    this.webcamPanel = this.videoSourceControlNode.webcamPanel;
    this.addChild(mainContent);

    // ── Home key → rewind to start ────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Home" && model.videoLoadedProperty.value) {
        this.rewindToStart();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // Store cleanup function
    this.disposeVideoPlayer = () => {
      document.removeEventListener("keydown", onKeyDown);
      TrackLabColors.videoBackgroundColorProperty.unlink(videoBackgroundListener);
      model.isPlayingProperty.unlink(isPlayingListener);
      model.playbackRateProperty.unlink(playbackRateListener);
      this.videoElement.removeEventListener("loadedmetadata", onLoadedMetadata);
      this.videoElement.removeEventListener("loadedmetadata", onDimensionsLoaded);
      this.videoElement.removeEventListener("durationchange", updateDuration);
      this.videoElement.removeEventListener("ended", onEnded);
      this.videoElement.removeEventListener("timeupdate", onTimeUpdate);
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
      }
      autoTrackerNode.dispose();
      this.playbackControlsNode.dispose();
      this.videoSourceControlNode.dispose();
      autoTrackingShownProperty.dispose();
    };
  }

  public override dispose(): void {
    this.disposeVideoPlayer();
    super.dispose();
  }

  /** Reset the video source selection to the initial state. */
  public reset(): void {
    this.videoSourceControlNode.reset();
    // Clear the video element
    this.videoElement.removeAttribute("src");
    this.videoElement.load();
  }

  /** Pause playback and seek to the very beginning of the video. */
  private rewindToStart(): void {
    this.model.isPlayingProperty.value = false;
    this.model.currentTimeProperty.value = 0;
    this.videoElement.currentTime = 0;
  }

  /** Pause playback and advance by exactly one frame. */
  private stepForward(): void {
    this.seekByFrames(1);
  }

  private seekByFrames(direction: number): void {
    this.model.isPlayingProperty.value = false;
    const frameDuration = this.model.frameDurationProperty.value;
    const raw = this.videoElement.currentTime + direction * frameDuration;
    const clamped = Math.max(0, Math.min(raw, this.videoElement.duration));
    this.videoElement.currentTime = clamped;
    this.model.currentTimeProperty.value = clamped;
  }

  private loadUrl(url: string): void {
    this.videoElement.src = url;
    this.videoElement.load();
  }
}
