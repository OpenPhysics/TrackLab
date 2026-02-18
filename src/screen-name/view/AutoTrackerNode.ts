import type { TReadOnlyProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import {
  DragListener,
  Line,
  Node,
  Path,
  Rectangle,
  Text,
} from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import { type SimModel, VIDEO_HEIGHT, VIDEO_WIDTH } from "../model/SimModel.js";

const MAX_TRAIL = 150;
const CROSSHAIR_SIZE = 16;
const FRAME_DURATION = 1 / 30; // assumes 30 fps

/**
 * Transparent SceneryStack overlay that sits directly on top of the video element.
 *
 * Workflow:
 *  1. When visible, shows a "drag to select" hint.
 *  2. User drags a bounding box around the object to track.
 *  3. AutoTrackerNode captures the template and starts tracking.
 *  4. On each video frame (timeupdate / seeked), the best-match position is
 *     computed via OpenCV template matching and shown as a red crosshair.
 *  5. Past positions are shown as a green trail of dots.
 *  6. If a track is active (model.activeTrackIdProperty), each new unique frame
 *     position is recorded to the model via addPointToTrack.
 *
 * Local coordinates of this node correspond directly to video-pixel coordinates
 * (0,0 = top-left of video) because it is added to the same layer as the video
 * DOM node at position (0,0).
 */
export class AutoTrackerNode extends Node {
  private readonly model: SimModel;
  private readonly trail: Array<{ x: number; y: number }> = [];

  private readonly hintText: Text;
  private readonly selectionRect: Rectangle;
  private readonly trailPath: Path;
  private readonly crosshairH: Line;
  private readonly crosshairV: Line;
  private readonly crosshairCircle: Path;

  private selecting = false;
  private selStart = Vector2.ZERO;

  public constructor(
    videoElement: HTMLVideoElement,
    autoTrackingShownProperty: TReadOnlyProperty<boolean>,
    model: SimModel,
  ) {
    super({ visible: false });

    this.model = model;

    // ── Transparent hit area (receives drag events) ───────────────────────
    const hitArea = new Rectangle(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT, {
      fill: "transparent",
      cursor: "crosshair",
      tagName: "div",
      accessibleName: "Video tracking area — drag to select object to track",
    });
    this.addChild(hitArea);

    // ── Hint text ────────────────────────────────────────────────────────
    this.hintText = new Text("Drag on video to select object to track", {
      font: new PhetFont({ size: 15, weight: "bold" }),
      fill: TrackLabColors.trackerHintFillProperty,
    });
    this.hintText.center = new Vector2(VIDEO_WIDTH / 2, VIDEO_HEIGHT / 2);
    this.addChild(this.hintText);

    // ── Selection rectangle ───────────────────────────────────────────────
    this.selectionRect = new Rectangle(0, 0, 0, 0, {
      stroke: TrackLabColors.trackerSelectionStrokeProperty,
      lineWidth: 2,
      lineDash: [6, 3],
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
      lineWidth: 2,
      visible: false,
    });
    this.crosshairV = new Line(0, -CROSSHAIR_SIZE, 0, CROSSHAIR_SIZE, {
      stroke: crosshairStroke,
      lineWidth: 2,
      visible: false,
    });
    this.crosshairCircle = new Path(Shape.circle(0, 0, 6), {
      stroke: crosshairStroke,
      lineWidth: 2,
      visible: false,
    });
    this.addChild(this.trailPath);
    this.addChild(this.crosshairCircle);
    this.addChild(this.crosshairH);
    this.addChild(this.crosshairV);

    // ── Drag listener: region selection ──────────────────────────────────
    const dragListener = new DragListener({
      start: (event) => {
        this.trail.length = 0;
        this.model.tracker.dispose();
        this.setCrosshairVisible(false);
        this.trailPath.shape = null;
        this.trailPath.visible = false;
        this.hintText.visible = false;

        this.selStart = this.globalToLocalPoint(event.pointer.point);
        this.selecting = true;
        this.selectionRect.setRect(this.selStart.x, this.selStart.y, 0, 0);
        this.selectionRect.visible = true;
      },
      drag: (event) => {
        if (!this.selecting) return;
        const p = this.globalToLocalPoint(event.pointer.point);
        this.selectionRect.setRect(
          Math.min(this.selStart.x, p.x),
          Math.min(this.selStart.y, p.y),
          Math.abs(p.x - this.selStart.x),
          Math.abs(p.y - this.selStart.y),
        );
      },
      end: (event) => {
        if (!this.selecting) return;
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

        if (region.w > 4 && region.h > 4) {
          // initFromVideo is async (loads WASM on first call); tracking begins
          // automatically once `ready` becomes true.
          this.model.tracker.initFromVideo(videoElement, region).catch((err) => {
            console.error("[AutoTracker] Tracking initialisation failed:", err);
            this.hintText.visible = true;
          });
        } else {
          this.hintText.visible = true;
        }
      },
      tandem: Tandem.OPT_OUT,
    });
    hitArea.addInputListener(dragListener);

    // ── Track on every video frame ────────────────────────────────────────
    const onFrame = () => {
      if (!this.visible || !this.model.tracker.ready) return;
      const pt = this.model.tracker.track(videoElement);
      if (!pt) return;

      this.trail.push(pt);
      if (this.trail.length > MAX_TRAIL) this.trail.shift();
      this.updateTrackerVisuals(pt);

      // ── Record position to model if a track is active ─────────────────
      const activeId = model.activeTrackIdProperty.value;
      if (activeId) {
        const time = videoElement.currentTime;
        const frame = Math.round(time / FRAME_DURATION);

        // Avoid duplicate points for the same frame.
        const activeTrack = model.tracksProperty.value.find(
          (t) => t.id === activeId,
        );
        const alreadyRecorded = activeTrack
          ? activeTrack.points.some((p) => p.frame === frame)
          : false;

        if (!alreadyRecorded) {
          // Convert video-pixel coords to global coords, then to model coords.
          const globalPt = this.localToGlobalPoint(new Vector2(pt.x, pt.y));
          const modelPt =
            model.modelViewTransformProperty.value.inversePosition2(globalPt);
          model.addPointToTrack(activeId, frame, time, modelPt.x, modelPt.y);
        }
      }
    };
    videoElement.addEventListener("timeupdate", onFrame);
    videoElement.addEventListener("seeked", onFrame);

    // ── Show/hide based on combined "video loaded && autoTracking" ────────
    autoTrackingShownProperty.link((shown) => {
      if (!shown) this.reset();
      this.visible = shown;
      if (shown) this.hintText.visible = true;
    });
  }

  private setCrosshairVisible(visible: boolean): void {
    this.crosshairH.visible = visible;
    this.crosshairV.visible = visible;
    this.crosshairCircle.visible = visible;
  }

  private updateTrackerVisuals(pt: { x: number; y: number }): void {
    const shape = new Shape();
    for (const p of this.trail) {
      shape.circle(p.x, p.y, 3);
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

  /** Clear tracking state (template, trail, visuals). */
  public reset(): void {
    this.model.tracker.dispose();
    this.trail.length = 0;
    this.selecting = false;
    this.selectionRect.visible = false;
    this.trailPath.shape = null;
    this.trailPath.visible = false;
    this.setCrosshairVisible(false);
  }
}
