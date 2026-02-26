/**
 * AutoTrackerNode.ts
 *
 * Overlay UI for the auto-tracking tool. Allows users to define a search region
 * and template, then displays the tracked trail and tracking status.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { type Dimension2, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { DragListener, Line, Node, Path, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";

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
  private readonly model: SimModel;

  // ── Trail: O(1) ring buffer ────────────────────────────────────────────
  // Using a fixed-size circular buffer instead of a plain array so that the
  // oldest-point eviction at 30 Hz is O(1) rather than O(n) (Array.shift).
  private readonly trailBuf: Array<{ x: number; y: number }> = new Array(MAX_TRAIL);
  private trailHead = 0; // index of the slot where the NEXT write will land
  private trailSize = 0; // number of valid entries (0 … MAX_TRAIL)
  /** Frames already recorded to the active track; cleared on track change or reset. */
  private readonly recordedFrames = new Set<number>();

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
  // Monotonically increasing counter — each new initFromVideo call captures the
  // current value and only applies results if the counter hasn't changed by the
  // time the async initialisation completes, preventing stale results from a
  // previous drag from overwriting a more recent one.
  private initVersion = 0;

  private readonly disposeAutoTrackerNode: () => void;

  /**
   * @param videoElement - The video element used both for pixel capture and frame events.
   * @param autoTrackingShownProperty - Combined gate (video loaded AND toggle on); controls visibility.
   * @param model - Provides active track state and receives recorded positions via addPointToTrack.
   */
  public constructor(
    videoElement: HTMLVideoElement,
    autoTrackingShownProperty: TReadOnlyProperty<boolean>,
    model: SimModel,
  ) {
    super({ visible: false });

    this.model = model;

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
        // Bump version so any in-flight initFromVideo call is discarded when it resolves.
        this.initVersion++;
        this.model.tracker.dispose();
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
          if (!this.model.activeTrackIdProperty.value) {
            this.model.addTrack();
            // Set the newly created track as active
            const tracks = this.model.tracksProperty.value;
            if (tracks.length > 0) {
              const newTrack = tracks[tracks.length - 1];
              if (newTrack) {
                this.model.activeTrackIdProperty.value = newTrack.id;
              }
            }
          }

          // initFromVideo is async (loads WASM on first call); tracking begins
          // automatically once `ready` becomes true.
          // Capture the current version so stale results from a previous drag
          // (still awaiting WASM load) are discarded if a new drag has started.
          const capturedVersion = this.initVersion;
          this.model.tracker
            .initFromVideo(videoElement, region)
            .then(() => {
              if (this.initVersion !== capturedVersion) {
                // A newer drag has already started; discard this result.
                this.model.tracker.dispose();
                return;
              }
              // Guard against the race condition where the user removes the
              // active track while WASM was loading.  If the track no longer
              // exists, abort tracking so the crosshair doesn't appear with
              // nowhere to record points.
              const activeId = this.model.activeTrackIdProperty.value;
              const trackStillExists =
                activeId !== null && this.model.tracksProperty.value.some((t) => t.id === activeId);
              if (!trackStillExists) {
                this.model.tracker.dispose();
                this.hintText.visible = true;
              }
            })
            .catch((err: unknown) => {
              // biome-ignore lint/suspicious/noConsole: error logging for tracker init failure
              console.error("AutoTracker: failed to initialise OpenCV tracker:", err);
              if (this.initVersion === capturedVersion) {
                const message =
                  err instanceof Error ? err.message : autoTrackerStrings.trackingInitFailedStringProperty.value;
                this.errorText.string = message;
                this.errorText.visible = true;
                this.hintText.visible = true;
              }
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
    model.videoDimensionsProperty.link(videoDimensionsListener);

    // ── Track on every video frame ────────────────────────────────────────
    // OpenCV template matching (track()) is a heavy synchronous operation.
    // Scheduling it via requestAnimationFrame coalesces rapid timeupdate/seeked
    // events into at most one tracking call per browser paint cycle, preventing
    // event callbacks from piling up and freezing the main thread.
    const processFrame = async () => {
      this.pendingFrameId = 0;
      if (!(this.visible && this.model.tracker.ready)) {
        return;
      }

      this.trackInProgress = true;
      let pt: { x: number; y: number } | null = null;
      try {
        pt = await this.model.tracker.track(videoElement);
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
      const activeId = model.activeTrackIdProperty.value;
      if (activeId) {
        const time = videoElement.currentTime;
        // Multiply by frame rate directly rather than dividing by frameDuration
        // (1/fps) to avoid cascading floating-point error at non-integer fps values
        // like 29.97, which could cause two adjacent timestamps to map to the same
        // frame or skip a frame entirely.
        const frame = Math.round(time * model.frameRateProperty.value);

        // O(1) duplicate-frame check via Set (vs O(n) linear scan).
        if (!this.recordedFrames.has(frame)) {
          // pt is already in local (video-pixel) coordinates — the same space
          // pixelToModelCoords expects, matching how DigitizingOverlayNode records points.
          const modelPt = model.pixelToModelCoords(new Vector2(pt.x, pt.y));
          model.addPointToTrack(activeId, frame, time, modelPt.x, modelPt.y);
          this.recordedFrames.add(frame);
        }
      }
    };

    const onFrame = () => {
      if (this.pendingFrameId === 0 && !this.trackInProgress) {
        this.pendingFrameId = requestAnimationFrame(processFrame);
      }
    };
    videoElement.addEventListener("timeupdate", onFrame);
    videoElement.addEventListener("seeked", onFrame);

    // Clear the recorded-frames set whenever the user switches to a different
    // track so frames from the previous track don't suppress recording on the
    // new one.
    const clearRecordedFrames = () => this.recordedFrames.clear();
    model.activeTrackIdProperty.lazyLink(clearRecordedFrames);

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
      videoElement.removeEventListener("timeupdate", onFrame);
      videoElement.removeEventListener("seeked", onFrame);
      this.cancelPendingFrame();
      model.activeTrackIdProperty.unlink(clearRecordedFrames);
      autoTrackingShownProperty.unlink(autoTrackingShownListener);
      model.videoDimensionsProperty.unlink(videoDimensionsListener);
      this.model.tracker.dispose();
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
    this.model.tracker.dispose();
    this.trailHead = 0;
    this.trailSize = 0;
    this.recordedFrames.clear();
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
