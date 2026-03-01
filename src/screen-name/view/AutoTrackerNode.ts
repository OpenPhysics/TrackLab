/**
 * AutoTrackerNode.ts
 *
 * Overlay UI for the auto-tracking tool. Allows users to define a search region
 * and template, then displays the tracked trail and tracking status.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { type Dimension2, type Transform3, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { DragListener, Line, Node, Path, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import type { TrackingModel } from "../model/TrackingModel.js";

/** Narrowed dependencies passed to AutoTrackerNode at construction time. */
type AutoTrackerNodeOptions = {
  tracking: TrackingModel;
  videoDimensionsProperty: TReadOnlyProperty<Dimension2>;
  /** Converts a continuous time value to a discrete frame index. */
  timeToFrame: (time: number) => number;
  modelViewTransformProperty: TReadOnlyProperty<Transform3>;
};

const MAX_TRAIL = 150;
const CROSSHAIR_SIZE = 16;
const HINT_FONT_SIZE = 15;
const SELECTION_LINE_WIDTH = 2;
const SELECTION_LINE_DASH: number[] = [6, 3];
const CROSSHAIR_LINE_WIDTH = 2;
const CROSSHAIR_CIRCLE_RADIUS = 6; // small filled circle at crosshair centre
const MIN_REGION_SIZE = 4; // minimum pixel width/height to begin tracking
const TRAIL_DOT_RADIUS = 3; // radius of each past-position dot in the trail
const LABELS_SPACING = 8; // vertical gap between hint text and error text

/**
 * Transparent SceneryStack overlay that sits directly on top of the video element.
 *
 * Workflow:
 *  1. When visible, shows a "drag to select" hint.
 *  2. User drags a bounding box around the object to track.
 *  3. AutoTrackerNode captures the template and starts tracking.
 *  4. If no track is active, a new track is automatically created and activated.
 *  5. On each video frame (timeupdate / seeked), the best-match position is
 *     computed via OpenCV template matching and shown as a red crosshair.
 *  6. Past positions are shown as a green trail of dots.
 *  7. Each new unique frame position is recorded to the active track via
 *     addPointToTrack, transforming from video-pixel to model coordinates.
 *
 * Local coordinates of this node correspond directly to video-pixel coordinates
 * (0,0 = top-left of video) because it is added to the same layer as the video
 * DOM node at position (0,0).
 */
export class AutoTrackerNode extends Node {
  private readonly tracking: TrackingModel;

  // ── Trail: O(1) ring buffer ────────────────────────────────────────────
  // Using a fixed-size circular buffer instead of a plain array so that the
  // oldest-point eviction at 30 Hz is O(1) rather than O(n) (Array.shift).
  private readonly trailBuf: Array<{ x: number; y: number }> = new Array(MAX_TRAIL);
  private trailHead = 0; // index of the slot where the NEXT write will land
  private trailSize = 0; // number of valid entries (0 … MAX_TRAIL)

  private readonly hintText: Text;
  private readonly errorText: Text;
  private readonly selectionRect: Rectangle;
  private readonly trailPath: Path;
  private readonly crosshairH: Line;
  private readonly crosshairV: Line;
  private readonly crosshairCircle: Path;
  private selecting = false;
  private selStart = Vector2.ZERO;
  /** ID of the pending requestAnimationFrame callback (0 = none pending). */
  private pendingFrameId = 0;
  /** True while an async track() call is in flight; prevents concurrent tracking calls. */
  private trackInProgress = false;

  private readonly disposeAutoTrackerNode: () => void;

  /**
   * @param videoElement - The video element used both for pixel capture and frame events.
   * @param autoTrackingShownProperty - Combined gate (video loaded AND toggle on); controls visibility.
   * @param options - Narrowed model dependencies: tracking sub-model, specific playback properties,
   *   and the model-view transform for converting pixel coordinates to model coordinates.
   */
  public constructor(
    videoElement: HTMLVideoElement,
    autoTrackingShownProperty: TReadOnlyProperty<boolean>,
    options: AutoTrackerNodeOptions,
  ) {
    super({ visible: false });

    const { tracking, videoDimensionsProperty, timeToFrame, modelViewTransformProperty } = options;
    this.tracking = tracking;

    const autoTrackerStrings = StringManager.getInstance().getAutoTracker();

    // ── Transparent hit area (receives drag events) ───────────────────────
    const hitArea = new Rectangle(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT, {
      fill: "transparent",
      cursor: "crosshair",
      tagName: "div",
      accessibleName: autoTrackerStrings.videoTrackingAreaStringProperty,
    });
    this.addChild(hitArea);

    // ── Hint text ────────────────────────────────────────────────────────
    this.hintText = new Text(autoTrackerStrings.dragToSelectStringProperty, {
      font: new PhetFont({ size: HINT_FONT_SIZE, weight: "bold" }),
      fill: TrackLabColors.trackerHintFillProperty,
    });

    // ── Error text (shown when OpenCV fails to load or tracking init fails) ─
    this.errorText = new Text("", {
      font: new PhetFont({ size: HINT_FONT_SIZE, weight: "bold" }),
      fill: TrackLabColors.trackerCrosshairStrokeProperty,
      visible: false,
    });

    // Stack hint and error vertically so both are centred in the video area.
    const centeredLabels = new VBox({
      children: [this.hintText, this.errorText],
      spacing: LABELS_SPACING,
      align: "center",
      center: new Vector2(VIDEO_WIDTH / 2, VIDEO_HEIGHT / 2),
    });
    this.addChild(centeredLabels);

    // ── Selection rectangle ───────────────────────────────────────────────
    this.selectionRect = new Rectangle(0, 0, 0, 0, {
      stroke: TrackLabColors.trackerSelectionStrokeProperty,
      lineWidth: SELECTION_LINE_WIDTH,
      lineDash: SELECTION_LINE_DASH,
      fill: TrackLabColors.trackerSelectionFillProperty,
      visible: false,
    });
    this.addChild(this.selectionRect);

    // ── Trail (filled dots at past positions) ─────────────────────────────
    this.trailPath = new Path(null, {
      fill: TrackLabColors.trackerTrailFillProperty,
      visible: false,
    });

    // ── Crosshair at current tracked position ────────────────────────────
    const crosshairStroke = TrackLabColors.trackerCrosshairStrokeProperty;
    this.crosshairH = new Line(-CROSSHAIR_SIZE, 0, CROSSHAIR_SIZE, 0, {
      stroke: crosshairStroke,
      lineWidth: CROSSHAIR_LINE_WIDTH,
      visible: false,
    });
    this.crosshairV = new Line(0, -CROSSHAIR_SIZE, 0, CROSSHAIR_SIZE, {
      stroke: crosshairStroke,
      lineWidth: CROSSHAIR_LINE_WIDTH,
      visible: false,
    });
    this.crosshairCircle = new Path(Shape.circle(0, 0, CROSSHAIR_CIRCLE_RADIUS), {
      stroke: crosshairStroke,
      lineWidth: CROSSHAIR_LINE_WIDTH,
      visible: false,
    });
    this.addChild(this.trailPath);
    this.addChild(this.crosshairCircle);
    this.addChild(this.crosshairH);
    this.addChild(this.crosshairV);

    // ── Drag listener: region selection ──────────────────────────────────
    const dragListener = new DragListener({
      start: (event) => {
        this.trailHead = 0;
        this.trailSize = 0;
        // resetTracker() increments the model's version counter so any in-flight
        // initTracker call will be discarded when it resolves.
        this.tracking.resetTracker();
        this.setCrosshairVisible(false);
        this.trailPath.shape = null;
        this.trailPath.visible = false;
        this.hintText.visible = false;
        this.errorText.visible = false;

        this.selStart = this.globalToLocalPoint(event.pointer.point);
        this.selecting = true;
        this.selectionRect.setRect(this.selStart.x, this.selStart.y, 0, 0);
        this.selectionRect.visible = true;
      },
      drag: (event) => {
        if (!this.selecting) {
          return;
        }
        const p = this.globalToLocalPoint(event.pointer.point);
        this.selectionRect.setRect(
          Math.min(this.selStart.x, p.x),
          Math.min(this.selStart.y, p.y),
          Math.abs(p.x - this.selStart.x),
          Math.abs(p.y - this.selStart.y),
        );
      },
      end: (event) => {
        if (!this.selecting) {
          return;
        }
        this.selecting = false;
        this.selectionRect.visible = false;

        if (!event) {
          this.hintText.visible = true;
          return;
        }
        const p = this.globalToLocalPoint(event.pointer.point);
        const region = {
          x: Math.min(this.selStart.x, p.x),
          y: Math.min(this.selStart.y, p.y),
          w: Math.abs(p.x - this.selStart.x),
          h: Math.abs(p.y - this.selStart.y),
        };

        if (region.w > MIN_REGION_SIZE && region.h > MIN_REGION_SIZE) {
          // Auto-create a track if none is active
          if (!this.tracking.activeTrackIdProperty.value) {
            this.tracking.addTrackAndActivate();
          }

          // initTracker is async (loads WASM on first call); tracking begins
          // automatically once isTrackerReady becomes true.  Staleness detection
          // (new drag starting before this one resolves) is handled inside the
          // model: initTracker() returns false when superseded.
          this.tracking
            .initTracker(videoElement, region)
            .then((ready) => {
              if (!ready) {
                // Superseded by a newer drag — silently discard.
                return;
              }
              // Guard against the race condition where the user removes the
              // active track while WASM was loading.  If the track no longer
              // exists, abort tracking so the crosshair doesn't appear with
              // nowhere to record points.
              const activeId = this.tracking.activeTrackIdProperty.value;
              const trackStillExists =
                activeId !== null && this.tracking.tracksProperty.value.some((t) => t.id === activeId);
              if (!trackStillExists) {
                this.tracking.resetTracker();
                this.hintText.visible = true;
              }
            })
            .catch((err: unknown) => {
              // biome-ignore lint/suspicious/noConsole: error logging for tracker init failure
              console.error("AutoTracker: failed to initialise OpenCV tracker:", err);
              const message =
                err instanceof Error ? err.message : autoTrackerStrings.trackingInitFailedStringProperty.value;
              this.errorText.string = message;
              this.errorText.visible = true;
              this.hintText.visible = true;
            });
        } else {
          this.hintText.visible = true;
        }
      },
      tandem: Tandem.OPT_OUT,
    });
    hitArea.addInputListener(dragListener);

    // ── Resize hit-area when the loaded video's display dimensions change ──
    const videoDimensionsListener = (dims: Dimension2) => {
      hitArea.setRect(0, 0, dims.width, dims.height);
      centeredLabels.center = new Vector2(dims.width / 2, dims.height / 2);
    };
    videoDimensionsProperty.link(videoDimensionsListener);

    // ── Track on every video frame ────────────────────────────────────────
    // OpenCV template matching (track()) is a heavy synchronous operation.
    // Scheduling it via requestAnimationFrame coalesces rapid timeupdate/seeked
    // events into at most one tracking call per browser paint cycle, preventing
    // event callbacks from piling up and freezing the main thread.
    const processFrame = async () => {
      this.pendingFrameId = 0;
      if (!(this.visible && this.tracking.isTrackerReady)) {
        return;
      }

      this.trackInProgress = true;
      let pt: { x: number; y: number } | null = null;
      try {
        pt = await this.tracking.trackFrame(videoElement);
      } catch {
        // Tracker was disposed mid-flight (e.g. new selection started); skip frame.
        return;
      } finally {
        this.trackInProgress = false;
      }

      if (!pt) {
        return;
      }

      // O(1) ring-buffer write: overwrite the oldest slot when full.
      this.trailBuf[this.trailHead] = pt;
      this.trailHead = (this.trailHead + 1) % MAX_TRAIL;
      if (this.trailSize < MAX_TRAIL) {
        this.trailSize++;
      }
      this.updateTrackerVisuals(pt);

      // ── Record position to model if a track is active ─────────────────
      const activeId = tracking.activeTrackIdProperty.value;
      if (activeId) {
        const time = videoElement.currentTime;
        const frame = timeToFrame(time);
        // Convert video-local pixel coords directly to model coords.
        // The MVT operates in video-local space, matching these coordinates.
        // Deduplication (skip if frame already recorded) is enforced inside
        // TrackingModel.addPointToTrack().
        const modelPt = modelViewTransformProperty.value.inversePosition2(new Vector2(pt.x, pt.y));
        tracking.addPointToTrack(activeId, frame, time, modelPt.x, modelPt.y);
      }
    };

    const onFrame = () => {
      if (this.pendingFrameId === 0 && !this.trackInProgress) {
        this.pendingFrameId = requestAnimationFrame(processFrame);
      }
    };
    const listenerController = new AbortController();
    videoElement.addEventListener("timeupdate", onFrame, { signal: listenerController.signal });
    videoElement.addEventListener("seeked", onFrame, { signal: listenerController.signal });

    // ── Show/hide based on combined "video loaded && autoTracking" ────────
    const autoTrackingShownListener = (shown: boolean) => {
      if (!shown) {
        this.reset();
      }
      this.visible = shown;
      if (shown) {
        this.hintText.visible = true;
      }
    };
    autoTrackingShownProperty.link(autoTrackingShownListener);

    // ── Centralised cleanup (mirrors the disposeXxx pattern used elsewhere) ─
    this.disposeAutoTrackerNode = () => {
      listenerController.abort();
      this.cancelPendingFrame();
      autoTrackingShownProperty.unlink(autoTrackingShownListener);
      videoDimensionsProperty.unlink(videoDimensionsListener);
      this.tracking.resetTracker();
    };
  }

  private cancelPendingFrame(): void {
    if (this.pendingFrameId !== 0) {
      cancelAnimationFrame(this.pendingFrameId);
      this.pendingFrameId = 0;
    }
  }

  private setCrosshairVisible(visible: boolean): void {
    this.crosshairH.visible = visible;
    this.crosshairV.visible = visible;
    this.crosshairCircle.visible = visible;
  }

  private updateTrackerVisuals(pt: { x: number; y: number }): void {
    const shape = new Shape();
    // Iterate the ring buffer from oldest to newest.
    // tail = (head - size + MAX_TRAIL) % MAX_TRAIL is the index of the oldest entry.
    for (let i = 0; i < this.trailSize; i++) {
      const idx = (this.trailHead - this.trailSize + i + MAX_TRAIL) % MAX_TRAIL;
      const p = this.trailBuf[idx];
      if (p) {
        shape.circle(p.x, p.y, TRAIL_DOT_RADIUS);
      }
    }
    this.trailPath.shape = shape;
    this.trailPath.visible = true;

    const t = new Vector2(pt.x, pt.y);
    this.crosshairH.translation = t;
    this.crosshairV.translation = t;
    this.crosshairCircle.translation = t;
    this.setCrosshairVisible(true);
    this.hintText.visible = false;
  }

  /** Clear tracking state (template, trail, visuals, and any displayed error). */
  public reset(): void {
    this.cancelPendingFrame();
    this.trackInProgress = false;
    // resetTracker() increments the model's version counter so any in-flight
    // initTracker rejection is treated as a cancellation rather than a real error.
    this.tracking.resetTracker();
    this.trailHead = 0;
    this.trailSize = 0;
    this.selecting = false;
    this.selectionRect.visible = false;
    this.trailPath.shape = null;
    this.trailPath.visible = false;
    this.setCrosshairVisible(false);
    this.errorText.visible = false;
  }

  public override dispose(): void {
    this.disposeAutoTrackerNode();
    super.dispose();
  }
}

trackLab.register("AutoTrackerNode", AutoTrackerNode);
