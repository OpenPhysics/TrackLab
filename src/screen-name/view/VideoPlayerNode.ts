/**
 * VideoPlayerNode.ts
 *
 * Main video display component. Hosts the video element and all interactive overlays
 * (coordinate system, calibration, auto-tracker, digitizing).
 */

import { DerivedProperty } from "scenerystack/axon";
import { Bounds2, Dimension2 } from "scenerystack/dot";
import { DOM, Node } from "scenerystack/scenery";
import TrackLabColors from "../../TrackLabColors.js";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";

const MAIN_CONTENT_SPACING = 10; // VBox gap between source control, video layer, and playback

import { StringManager } from "../../i18n/StringManager.js";
import trackLab from "../../TrackLabNamespace.js";
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
  /**
   * Video content layer containing the video element and all overlays (auto-tracker,
   * digitizing, coordinate system, calibration, measurement tools). All children
   * share video-local coordinates (0,0 = top-left of video). External overlays
   * should be added via addVideoOverlay() rather than accessing this layer directly.
   */
  private readonly videoContentLayer: Node;
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
      if (d > 0) {
        model.playback.durationProperty.value = d;
      }
    };

    const onLoadedMetadata = () => {
      model.playback.currentTimeProperty.value = 0;
      updateDuration();
      // WebM files from MediaRecorder report Infinity until seeked to the end.
      // Trigger that seek here; durationchange (already listened to) will fire
      // with the real duration, and the once-handler resets the position to 0.
      if (!Number.isFinite(this.videoElement.duration)) {
        this.videoElement.addEventListener(
          "seeked",
          () => {
            this.videoElement.currentTime = 0;
          },
          { once: true },
        );
        this.videoElement.currentTime = Number.MAX_SAFE_INTEGER;
      }
    };
    this.videoElement.addEventListener("loadedmetadata", onLoadedMetadata);
    this.videoElement.addEventListener("durationchange", updateDuration);

    const onEnded = () => {
      model.playback.isPlayingProperty.value = false;
    };
    this.videoElement.addEventListener("ended", onEnded);

    // ── Auto-tracking overlay ──────────────────────────────────────────────
    const autoTrackingShownProperty = new DerivedProperty(
      [model.playback.videoLoadedProperty, model.overlayTools.autoTrackingProperty],
      (loaded, tracking) => loaded && tracking,
    );
    const autoTrackerNode = new AutoTrackerNode(this.videoElement, autoTrackingShownProperty, model);

    // ── Manual digitizing overlay ─────────────────────────────────────────
    const digitizingOverlayNode = new DigitizingOverlayNode(this.videoElement, model, () => this.stepForward());

    this.videoContentLayer = new Node({
      children: [videoNode, autoTrackerNode, digitizingOverlayNode],
      // Explicit bounds prevent overlay children (coordinate system arrows,
      // calibration tool, etc.) from inflating the layer's bounds and
      // disrupting the parent layout.
      localBounds: new Bounds2(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT),
    });

    // ── Play / Pause ───────────────────────────────────────────────────────
    const isPlayingListener = (isPlaying: boolean) => {
      if (isPlaying) {
        this.videoElement.play().catch((err: unknown) => {
          if (err instanceof DOMException) {
            if (err.name === "AbortError") {
              // play() was interrupted by pause() or a new load — element is
              // already paused/loading, no recovery needed.
              return;
            }
            if (err.name === "NotAllowedError") {
              // Autoplay blocked (no user gesture). Silently reset so the UI
              // stays consistent; expected during fuzz testing.
              model.playback.isPlayingProperty.value = false;
              return;
            }
          }
          // biome-ignore lint/suspicious/noConsole: error logging for video playback failure
          console.error("Video playback failed:", err);
          model.playback.isPlayingProperty.value = false;
        });
      } else {
        this.videoElement.pause();
      }
    };
    model.playback.isPlayingProperty.lazyLink(isPlayingListener);

    // ── Playback rate (applies model rate to the video element) ──────────
    const playbackRateListener = (rate: number) => {
      this.videoElement.playbackRate = rate;
    };
    model.playback.playbackRateProperty.link(playbackRateListener);

    // ── Playback controls (positioned by SimScreenView at screen bottom) ──
    this.playbackControlsNode = new PlaybackControlsNode(
      model.playback,
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
      model.playback.videoDimensionsProperty.value = new Dimension2(displayW, displayH);
      // Keep content layer bounds in sync so layout doesn't shift.
      this.videoContentLayer.localBounds = new Bounds2(0, 0, displayW, displayH);
      this.videoSourceControlNode.centerX = displayW / 2;
      this.playbackControlsNode.preferredWidth = displayW;
      model.tracking.resizeTracker(displayW, displayH);
    };
    this.videoElement.addEventListener("loadedmetadata", onDimensionsLoaded);

    // Sync model time from video during playback (event-driven, not polled)
    const onTimeUpdate = () => {
      if (!this.playbackControlsNode.scrubbing) {
        model.playback.currentTimeProperty.value = this.videoElement.currentTime;
      }
    };
    this.videoElement.addEventListener("timeupdate", onTimeUpdate);

    // ── Video source controls (webcam panel is added to SimScreenView for z-order) ─
    this.videoSourceControlNode = new VideoSourceControlNode(
      model,
      listParent,
      (url) => {
        model.playback.isPlayingProperty.value = false;
        autoTrackerNode.reset();
        this.loadUrl(url);
      },
      (blob, duration) => {
        model.playback.isPlayingProperty.value = false;
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
          model.playback.durationProperty.value = duration;
        }
      },
    );

    // ── Layout ─────────────────────────────────────────────────────────────
    // Manual positioning replaces the VBox so that overlay nodes added to
    // videoContentLayer (by SimScreenView) don't affect the centering of
    // the source control row.
    this.videoContentLayer.top = 0;
    this.addChild(this.videoContentLayer);

    this.videoSourceControlNode.centerX = this.videoContentLayer.width / 2;
    this.videoSourceControlNode.bottom = -MAIN_CONTENT_SPACING;
    this.addChild(this.videoSourceControlNode);

    this.webcamPanel = this.videoSourceControlNode.webcamPanel;

    // ── Apply video transform (translate + uniform scale) ────────────────
    // Driven by the model so the video and all overlays move/zoom together.
    const videoTransformListener = (matrix: import("scenerystack/dot").Matrix3) => {
      this.videoContentLayer.matrix = matrix;
    };
    model.playback.videoTransformProperty.link(videoTransformListener);

    // ── Keyboard shortcuts ─────────────────────────────────────────────────
    const onKeyDown = this.createKeyboardHandler(model);
    document.addEventListener("keydown", onKeyDown);

    // Store cleanup function
    this.disposeVideoPlayer = () => {
      document.removeEventListener("keydown", onKeyDown);
      TrackLabColors.videoBackgroundColorProperty.unlink(videoBackgroundListener);
      model.playback.isPlayingProperty.unlink(isPlayingListener);
      model.playback.playbackRateProperty.unlink(playbackRateListener);
      model.playback.videoTransformProperty.unlink(videoTransformListener);
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

  /**
   * Add an overlay node to the video content layer.
   * The overlay shares video-local coordinates with the video element and moves
   * with the video when the user pans or zooms.
   */
  public addVideoOverlay(node: Node): void {
    this.videoContentLayer.addChild(node);
  }

  /** Factory for the document-level keyboard handler for this player instance. */
  private createKeyboardHandler(model: SimModel): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Home" && model.playback.videoLoadedProperty.value) {
        this.rewindToStart();
      }
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
    this.model.playback.isPlayingProperty.value = false;
    this.model.playback.currentTimeProperty.value = 0;
    this.videoElement.currentTime = 0;
  }

  /** Pause playback and advance by exactly one frame. */
  private stepForward(): void {
    this.seekByFrames(1);
  }

  private seekByFrames(direction: number): void {
    this.model.playback.isPlayingProperty.value = false;
    const duration = this.videoElement.duration;
    if (!(duration > 0)) {
      return;
    }
    const frameDuration = this.model.playback.frameDurationProperty.value;
    const raw = this.videoElement.currentTime + direction * frameDuration;
    // Math.min(raw, Infinity) === raw, so this clamp works for both finite and
    // Infinity durations (WebM files often report Infinity until fully loaded).
    const clamped = Math.max(0, Math.min(raw, duration));
    this.videoElement.currentTime = clamped;
    this.model.playback.currentTimeProperty.value = clamped;
  }

  private loadUrl(url: string): void {
    this.videoElement.src = url;
    this.videoElement.load();
  }
}

trackLab.register("VideoPlayerNode", VideoPlayerNode);
