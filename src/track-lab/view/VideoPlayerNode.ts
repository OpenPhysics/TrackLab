/**
 * VideoPlayerNode.ts
 *
 * Main video display component. Hosts the video element and all interactive overlays
 * (coordinate system, calibration, auto-tracker, digitizing).
 */

import { DerivedProperty } from "scenerystack/axon";
import { Bounds2, Dimension2, Vector2 } from "scenerystack/dot";
import { Circle, DOM, DragListener, Node, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import TrackLabColors from "../../TrackLabColors.js";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../../TrackLabConstants.js";
import type { TrackLabModel } from "../model/TrackLabModel.js";
import type { VideoPlaybackModel } from "../model/VideoPlaybackModel.js";

// ── Frame / header geometry ────────────────────────────────────────────────────
// The "frame" is the background panel that encloses the source controls and acts
// as the primary drag target for moving the video panel.
const FRAME_INNER_PADDING = 4; // padding inside the frame above and below the source controls
const FRAME_BOTTOM_GAP = 2; // gap between frame bottom and video content top
const RESIZE_HANDLE_RADIUS = 5; // px radius of the corner resize knob

import { StringManager } from "../../i18n/StringManager.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";
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
  /** Webcam recording panel; positioned by TrackLabScreenView for correct z-ordering. */
  public readonly webcamPanel: WebcamPanel;
  /** Playback controls bar; positioned by TrackLabScreenView at the bottom of the screen. */
  public readonly playbackControlsNode: PlaybackControlsNode;
  /**
   * Video content layer containing the video element and all overlays (auto-tracker,
   * digitizing, coordinate system, calibration, measurement tools). All children
   * share video-local coordinates (0,0 = top-left of video). External overlays
   * should be added via addVideoOverlay() rather than accessing this layer directly.
   */
  private readonly videoContentLayer: Node;
  /**
   * Wrapper around videoContentLayer; its scale is driven by panelSizeScaleProperty
   * so the entire video content (including all overlays) scales uniformly.
   * The source controls are siblings of this wrapper (not inside it) so they are
   * never scaled.
   */
  private readonly videoContentWrapper: Node;
  /**
   * Background frame rectangle that encloses the source controls.  Its cursor and
   * DragListener (added by TrackLabScreenView) make the entire header area a move handle.
   * Width tracks the visual width of the scaled video content.
   */
  public readonly panelHeaderBar: Rectangle;
  private readonly playback: VideoPlaybackModel;
  private readonly disposeVideoPlayer: () => void;
  /** Tracks the current blob URL so it can be revoked when a new one is loaded. */
  private currentBlobUrl: string | null = null;
  /** Video source control node for reset functionality. */
  private readonly videoSourceControlNode: VideoSourceControlNode;

  /**
   * @param model - Simulation model providing reactive playback and track state.
   * @param listParent - Scene-graph node used as the popup list parent for combo boxes.
   */
  public constructor(model: TrackLabModel, listParent: Node) {
    super();
    this.playback = model.playback;

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

    // ── Video load-error overlay ───────────────────────────────────────────
    // Shown when the browser cannot decode the chosen video (unsupported
    // codec, network failure, etc.).  Cleared on the next loadstart so it
    // disappears as soon as the user selects a different source.
    const videoStrings = StringManager.getInstance().getVideo();
    const videoErrorText = new Text(videoStrings.loadFailedStringProperty, {
      font: new PhetFont({ size: 15, weight: "bold" }),
      fill: TrackLabColors.trackerCrosshairStrokeProperty,
      center: new Vector2(VIDEO_WIDTH / 2, VIDEO_HEIGHT / 2),
      visible: false,
    });

    const onVideoError = () => {
      videoErrorText.visible = true;
    };
    const onVideoLoadStart = () => {
      videoErrorText.visible = false;
    };

    // AbortController lets dispose() cancel all video-element listeners with a
    // single controller.abort() instead of a matching removeEventListener call.
    const listenerController = new AbortController();
    const { signal } = listenerController;

    this.videoElement.addEventListener("error", onVideoError, { signal });
    this.videoElement.addEventListener("loadstart", onVideoLoadStart, { signal });

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
    this.videoElement.addEventListener("loadedmetadata", onLoadedMetadata, { signal });
    this.videoElement.addEventListener("durationchange", updateDuration, { signal });

    const onEnded = () => {
      model.playback.isPlayingProperty.value = false;
    };
    this.videoElement.addEventListener("ended", onEnded, { signal });

    // ── Auto-tracking overlay ──────────────────────────────────────────────
    const autoTrackingShownProperty = new DerivedProperty(
      [model.playback.videoLoadedProperty, model.overlayTools.autoTrackingProperty],
      (loaded, tracking) => loaded && tracking,
    );
    const autoTrackerNode = new AutoTrackerNode(this.videoElement, autoTrackingShownProperty, {
      tracking: model.tracking,
      videoDimensionsProperty: model.playback.videoDimensionsProperty,
      timeToFrame: (time: number) => model.playback.timeToFrame(time),
      modelViewTransformProperty: model.overlayTools.modelViewTransformProperty,
    });

    // ── Manual digitizing overlay ─────────────────────────────────────────
    const digitizingOverlayNode = new DigitizingOverlayNode(
      this.videoElement,
      {
        tracking: model.tracking,
        playback: model.playback,
        magnifyVideoProperty: model.overlayTools.magnifyVideoProperty,
        modelViewTransformProperty: model.overlayTools.modelViewTransformProperty,
        recordPoint: (trackId, pixelPoint) => model.recordTrackPoint(trackId, pixelPoint),
      },
      () => this.stepForward(),
    );

    this.videoContentLayer = new Node({
      children: [videoNode, autoTrackerNode, digitizingOverlayNode, videoErrorText],
      // Explicit bounds prevent overlay children (coordinate system arrows,
      // calibration tool, etc.) from inflating the layer's bounds and
      // disrupting the parent layout.
      localBounds: new Bounds2(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT),
    });

    // ── Video content visibility (eye toggle button) ────────────────────────
    const videoContentVisibleListener = (visible: boolean) => {
      this.videoContentLayer.visible = visible;
    };
    model.overlayTools.videoContentVisibleProperty.link(videoContentVisibleListener);

    // ── Play / Pause ───────────────────────────────────────────────────────
    const isPlayingListener = (isPlaying: boolean) => {
      if (isPlaying) {
        this.videoElement.play().catch((err: unknown) => {
          if (err instanceof DOMException) {
            if (err.name === "AbortError") {
              return;
            }
            if (err.name === "NotAllowedError") {
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

    // ── Playback controls (positioned by TrackLabScreenView at screen bottom) ──
    this.playbackControlsNode = new PlaybackControlsNode(
      model.playback,
      this.videoElement,
      () => this.seekByFrames(-1),
      () => this.seekByFrames(1),
    );
    // Pin to the video width so internal text changes never shift the row.
    this.playbackControlsNode.preferredWidth = VIDEO_WIDTH;

    // ── Video source controls ─────────────────────────────────────────────
    this.videoSourceControlNode = new VideoSourceControlNode(
      model.sources,
      model.playback.isPlayingProperty,
      model,
      model.playback.frameRateProperty,
      listParent,
      (url) => {
        model.playback.isPlayingProperty.value = false;
        autoTrackerNode.reset();
        this.loadUrl(url);
      },
      (blob, duration) => {
        model.playback.isPlayingProperty.value = false;
        autoTrackerNode.reset();
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
      model.overlayTools.videoContentVisibleProperty,
      model.playback.videoLoadedProperty,
    );

    // ── videoContentWrapper: scales uniformly via panelSizeScaleProperty ──
    this.videoContentWrapper = new Node({ children: [this.videoContentLayer] });
    this.videoContentWrapper.top = 0;

    // ── Layout: source controls sit inside the header frame ───────────────
    // Position source controls first (so their height is known) then build
    // the frame rectangle to enclose them.  The frame bottom is FRAME_BOTTOM_GAP
    // above the video content; source controls sit FRAME_INNER_PADDING above
    // that, so the frame provides padding on all sides around the controls.
    this.videoSourceControlNode.centerX = VIDEO_WIDTH / 2;
    this.videoSourceControlNode.bottom = -(FRAME_BOTTOM_GAP + FRAME_INNER_PADDING);

    // Frame: covers from (source controls top − padding) to (video content top − gap)
    const frameTop = this.videoSourceControlNode.top - FRAME_INNER_PADDING;
    const frameHeight = -FRAME_BOTTOM_GAP - frameTop; // both are negative y values
    this.panelHeaderBar = new Rectangle(0, frameTop, VIDEO_WIDTH, frameHeight, {
      cursor: "move",
      tagName: "div",
      accessibleName: a11yStrings.videoPanelHandleStringProperty,
    });
    const panelHeaderColorListener = (c: import("scenerystack").Color) => {
      this.panelHeaderBar.fill = c;
    };
    TrackLabColors.panelHeaderColorProperty.link(panelHeaderColorListener);

    // ── Resize handle (corner knob at bottom-right of video content) ───────
    const resizeHandle = new Circle(RESIZE_HANDLE_RADIUS, {
      cursor: "nwse-resize",
      tagName: "div",
      accessibleName: a11yStrings.videoPanelResizeHandleStringProperty,
    });
    const resizeHandleColorListener = (c: import("scenerystack").Color) => {
      resizeHandle.fill = c;
    };
    TrackLabColors.resizeHandleColorProperty.link(resizeHandleColorListener);

    // ── Z-order: frame background, then source controls on top, then resize knob ──
    this.addChild(this.videoContentWrapper);
    this.addChild(this.panelHeaderBar); // behind source controls
    this.addChild(this.videoSourceControlNode); // on top of frame background
    this.addChild(resizeHandle);

    this.webcamPanel = this.videoSourceControlNode.webcamPanel;

    // ── Link panelSizeScaleProperty → videoContentWrapper ─────────────────
    // Scales only the video content; source controls are siblings so they
    // stay the same size.  Their centerX tracks the center of the scaled video.
    const panelSizeScaleListener = (s: number) => {
      this.videoContentWrapper.setScaleMagnitude(s);
      const dims = model.playback.videoDimensionsProperty.value;
      const scaledW = dims.width * s;
      this.panelHeaderBar.rectWidth = scaledW;
      this.videoSourceControlNode.centerX = scaledW / 2;
      resizeHandle.center = this.videoContentWrapper.rightBottom;
    };
    model.playback.panelSizeScaleProperty.link(panelSizeScaleListener);

    // ── Resize handle drag (scales video content, locked aspect ratio) ─────
    let resizeStartScale = 1;
    let resizeStartHandleX = 0;
    let resizeStartPointerX = 0;
    resizeHandle.addInputListener(
      new DragListener({
        start: (event) => {
          resizeStartScale = model.playback.panelSizeScaleProperty.value;
          resizeStartHandleX = this.videoContentWrapper.right;
          resizeStartPointerX = event.pointer.point.x;
        },
        drag: (event) => {
          const deltaX = event.pointer.point.x - resizeStartPointerX;
          // Proportional scaling: new scale = startScale × (newRightEdge / startRightEdge)
          const newScale = (resizeStartScale * (resizeStartHandleX + deltaX)) / resizeStartHandleX;
          const range = model.playback.panelSizeScaleProperty.range;
          model.playback.panelSizeScaleProperty.value = Math.max(range.min, Math.min(range.max, newScale));
        },
      }),
    );

    // ── Fit video element to its intrinsic aspect ratio ───────────────────
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
      this.videoContentLayer.localBounds = new Bounds2(0, 0, displayW, displayH);
      this.playbackControlsNode.preferredWidth = displayW;
      model.tracking.resizeTracker(displayW, displayH);
      // Update header width, source control center, and resize handle to match new video size.
      const s = model.playback.panelSizeScaleProperty.value;
      const scaledW = displayW * s;
      this.panelHeaderBar.rectWidth = scaledW;
      this.videoSourceControlNode.centerX = scaledW / 2;
      resizeHandle.center = this.videoContentWrapper.rightBottom;
    };
    this.videoElement.addEventListener("loadedmetadata", onDimensionsLoaded, { signal });

    // Sync model time from video during playback (event-driven, not polled)
    const onTimeUpdate = () => {
      if (!this.playbackControlsNode.scrubbing) {
        model.playback.currentTimeProperty.value = this.videoElement.currentTime;
      }
    };
    this.videoElement.addEventListener("timeupdate", onTimeUpdate, { signal });

    // ── Apply video transform (translate + uniform scale) ────────────────
    const videoTransformListener = (matrix: import("scenerystack/dot").Matrix3) => {
      this.videoContentLayer.matrix = matrix;
    };
    model.playback.videoTransformProperty.link(videoTransformListener);

    // ── Keyboard shortcuts ─────────────────────────────────────────────────
    const onKeyDown = this.createKeyboardHandler(model);
    document.addEventListener("keydown", onKeyDown, { signal });

    // Store cleanup function
    this.disposeVideoPlayer = () => {
      listenerController.abort(); // removes keydown + all videoElement listeners at once
      model.overlayTools.videoContentVisibleProperty.unlink(videoContentVisibleListener);
      TrackLabColors.videoBackgroundColorProperty.unlink(videoBackgroundListener);
      TrackLabColors.panelHeaderColorProperty.unlink(panelHeaderColorListener);
      TrackLabColors.resizeHandleColorProperty.unlink(resizeHandleColorListener);
      model.playback.isPlayingProperty.unlink(isPlayingListener);
      model.playback.playbackRateProperty.unlink(playbackRateListener);
      model.playback.videoTransformProperty.unlink(videoTransformListener);
      model.playback.panelSizeScaleProperty.unlink(panelSizeScaleListener);
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
  private createKeyboardHandler(model: TrackLabModel): (e: KeyboardEvent) => void {
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
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    this.videoSourceControlNode.reset();
    this.videoElement.removeAttribute("src");
    this.videoElement.load();
  }

  /** Pause playback and seek to the very beginning of the video. */
  private rewindToStart(): void {
    this.playback.seekToStart();
    this.videoElement.currentTime = 0;
  }

  /** Pause playback and advance by exactly one frame. */
  private stepForward(): void {
    this.seekByFrames(1);
  }

  private seekByFrames(direction: number): void {
    this.playback.seekByFrames(direction);
    // Sync the DOM element to the model's new time so the video frame updates immediately.
    this.videoElement.currentTime = this.playback.currentTimeProperty.value;
  }

  private loadUrl(url: string): void {
    this.videoElement.src = url;
    this.videoElement.load();
  }
}

TrackLabNamespace.register("VideoPlayerNode", VideoPlayerNode);
