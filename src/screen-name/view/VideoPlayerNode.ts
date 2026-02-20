import { DerivedProperty } from "scenerystack/axon";
import { DOM, Node, VBox } from "scenerystack/scenery";
import TrackLabColors from "../../TrackLabColors.js";
import { type SimModel, VIDEO_HEIGHT, VIDEO_WIDTH } from "../model/SimModel.js";

const MAIN_CONTENT_SPACING = 10; // VBox gap between source control, video layer, and playback

import { AutoTrackerNode } from "./AutoTrackerNode.js";
import { DigitizingOverlayNode } from "./DigitizingOverlayNode.js";
import { PlaybackControlsNode } from "./PlaybackControlsNode.js";
import { VideoSourceControlNode } from "./VideoSourceControlNode.js";
import type { WebcamPanel } from "./WebcamPanel.js";

export class VideoPlayerNode extends Node {
  public readonly videoElement: HTMLVideoElement;
  public readonly webcamPanel: WebcamPanel;
  private readonly model: SimModel;
  private readonly disposeVideoPlayer: () => void;
  /** Tracks the current blob URL so it can be revoked when a new one is loaded. */
  private currentBlobUrl: string | null = null;

  public constructor(model: SimModel, listParent: Node) {
    super();
    this.model = model;

    // ── HTML video element ─────────────────────────────────────────────────
    this.videoElement = document.createElement("video");
    this.videoElement.width = VIDEO_WIDTH;
    this.videoElement.height = VIDEO_HEIGHT;
    this.videoElement.preload = "metadata";
    this.videoElement.crossOrigin = "anonymous";
    this.videoElement.style.display = "block";
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
    const autoTrackerNode = new AutoTrackerNode(
      this.videoElement,
      autoTrackingShownProperty,
      model,
    );

    // ── Manual digitizing overlay ─────────────────────────────────────────
    const digitizingOverlayNode = new DigitizingOverlayNode(
      this.videoElement,
      model,
      () => this.stepForward(),
    );

    const videoLayer = new Node({
      children: [videoNode, autoTrackerNode, digitizingOverlayNode],
    });

    // ── Play / Pause ───────────────────────────────────────────────────────
    const isPlayingListener = (isPlaying: boolean) => {
      if (isPlaying) {
        this.videoElement.play().catch(() => {
          model.isPlayingProperty.value = false;
        });
      } else {
        this.videoElement.pause();
      }
    };
    model.isPlayingProperty.lazyLink(isPlayingListener);

    // ── Playback controls ─────────────────────────────────────────────────
    const playbackControlsNode = new PlaybackControlsNode(
      model,
      this.videoElement,
      () => this.seekByFrames(-1),
      () => this.seekByFrames(1),
    );

    // Sync model time from video during playback (event-driven, not polled)
    const onTimeUpdate = () => {
      if (!playbackControlsNode.scrubbing) {
        model.currentTimeProperty.value = this.videoElement.currentTime;
      }
    };
    this.videoElement.addEventListener("timeupdate", onTimeUpdate);

    // ── Video source controls (webcam panel is added to SimScreenView for z-order) ─
    const videoSourceControlNode = new VideoSourceControlNode(
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
      children: [videoSourceControlNode, videoLayer, playbackControlsNode],
      spacing: MAIN_CONTENT_SPACING,
      align: "center",
    });

    this.webcamPanel = videoSourceControlNode.webcamPanel;
    this.addChild(mainContent);

    // Store cleanup function
    this.disposeVideoPlayer = () => {
      TrackLabColors.videoBackgroundColorProperty.unlink(videoBackgroundListener);
      model.isPlayingProperty.unlink(isPlayingListener);
      this.videoElement.removeEventListener("loadedmetadata", onLoadedMetadata);
      this.videoElement.removeEventListener("durationchange", updateDuration);
      this.videoElement.removeEventListener("ended", onEnded);
      this.videoElement.removeEventListener("timeupdate", onTimeUpdate);
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
      }
      autoTrackerNode.dispose();
      playbackControlsNode.dispose();
      videoSourceControlNode.dispose();
      autoTrackingShownProperty.dispose();
    };
  }

  public override dispose(): void {
    this.disposeVideoPlayer();
    super.dispose();
  }

  /** Pause playback and advance by exactly one frame. */
  public stepForward(): void {
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
