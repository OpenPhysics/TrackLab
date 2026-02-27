/**
 * DigitizingOverlayNode.ts
 *
 * Overlay UI for manual particle tracking. Provides a crosshair cursor and
 * magnified view to help users precisely click on particle positions.
 */

import { type Dimension2, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { DOM, FireListener, Node, Path, Rectangle } from "scenerystack/scenery";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors, { getTrackColor } from "../../TrackLabColors.js";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import type { SimModel } from "../model/SimModel.js";

const OUTER_R = 12;
const INNER_R = 2;
const CUR_LW = 1.5;
const CUR_SHADOW_LW = 4; // wider shadow stroke for contrast on all backgrounds

const MAG_SIZE = 175;
const MAG_ZOOM = 4;
const MAG_BORDER_WIDTH = 2;
const MAG_CROSSHAIR_RADIUS = 8;
const MAG_CROSSHAIR_GAP = 2;
const MAG_CROSSHAIR_LINE_WIDTH = 1;

const MARK_DOT_RADIUS = 2; // radius of each digitized-point dot drawn on the video

// Magnifier canvas box-shadow: "offsetX offsetY blur color"
const MAG_SHADOW_OFFSET_X = 0; // px, horizontal shadow offset
const MAG_SHADOW_OFFSET_Y = 2; // px, vertical shadow offset
const MAG_SHADOW_BLUR = 8; // px, shadow blur radius

/**
 * Manual digitizing overlay for placing track points on the video.
 * Renders a custom crosshair cursor and magnifier, and places dots on click.
 */
export class DigitizingOverlayNode extends Node {
  private readonly disposeDigitizingOverlay: () => void;

  public constructor(videoElement: HTMLVideoElement, model: SimModel, onPointAdded: () => void) {
    super();

    // Cached CSS color strings for canvas drawing (updated via property links)
    let magBorderColor = TrackLabColors.digitizingMagnifierBorderProperty.value.toCSS();
    let magCrosshairColor = TrackLabColors.digitizingMagnifierCrosshairProperty.value.toCSS();
    let magShadowColor = TrackLabColors.digitizingMagnifierShadowProperty.value.toCSS();

    // Custom cursor: circle + 4 crosshair segments that stop at an empty centre.
    // Built as a single composite shape shared by both layers so positions are
    // always in sync. The shadow layer (wider, dark stroke) renders first and
    // gives the same dual-layer contrast used by CalibrationToolNode and
    // CoordinateSystemNode — visible on both dark and light video backgrounds.
    const cursorShape = new Shape();
    cursorShape.circle(0, 0, OUTER_R);
    cursorShape.moveTo(-OUTER_R, 0).lineTo(-INNER_R, 0);
    cursorShape.moveTo(INNER_R, 0).lineTo(OUTER_R, 0);
    cursorShape.moveTo(0, -OUTER_R).lineTo(0, -INNER_R);
    cursorShape.moveTo(0, INNER_R).lineTo(0, OUTER_R);

    // Shadow layer (rendered first, underneath) for contrast on all backgrounds
    const cursorShadow = new Path(cursorShape, {
      stroke: TrackLabColors.coordShadowStrokeProperty,
      lineWidth: CUR_SHADOW_LW,
    });
    // Main cursor stroke (rendered on top of shadow)
    const cursorMain = new Path(cursorShape, {
      stroke: TrackLabColors.digitizingCursorStrokeProperty,
      lineWidth: CUR_LW,
    });

    const cursorNode = new Node({
      visible: false,
      pickable: false,
      children: [cursorShadow, cursorMain],
    });

    // ── Magnifier (zoomed view near the cursor) ─────────────────────────────
    const magCanvas = document.createElement("canvas");
    magCanvas.width = MAG_SIZE;
    magCanvas.height = MAG_SIZE;
    Object.assign(magCanvas.style, {
      borderRadius: "50%",
    });

    // Update shadow style when color property changes
    const updateShadowStyle = () => {
      magCanvas.style.boxShadow = `${MAG_SHADOW_OFFSET_X}px ${MAG_SHADOW_OFFSET_Y}px ${MAG_SHADOW_BLUR}px ${magShadowColor}`;
    };
    updateShadowStyle();

    const magBorderListener = (color: import("scenerystack").Color) => {
      magBorderColor = color.toCSS();
    };
    TrackLabColors.digitizingMagnifierBorderProperty.link(magBorderListener);

    const magCrosshairListener = (color: import("scenerystack").Color) => {
      magCrosshairColor = color.toCSS();
    };
    TrackLabColors.digitizingMagnifierCrosshairProperty.link(magCrosshairListener);

    const magShadowListener = (color: import("scenerystack").Color) => {
      magShadowColor = color.toCSS();
      updateShadowStyle();
    };
    TrackLabColors.digitizingMagnifierShadowProperty.link(magShadowListener);

    const magCtx = magCanvas.getContext("2d");
    if (!magCtx) {
      throw new Error("Could not get 2D context from magnifier canvas");
    }

    const magnifierNode = new DOM(magCanvas, { allowInput: false });
    magnifierNode.visible = false;
    magnifierNode.pickable = false;

    // Track the last known cursor position so the magnifier can be redrawn
    // when the video frame changes without mouse movement.
    let lastLocalPt: Vector2 | null = null;

    /**
     * Computes the rendered video bounds within the display element,
     * accounting for letterboxing/pillarboxing when aspect ratios differ.
     * Cached and only recomputed when the video's intrinsic dimensions change.
     */
    type VideoBoundsCache = {
      renderedW: number;
      renderedH: number;
      offsetX: number;
      offsetY: number;
      videoW: number;
      videoH: number;
    };
    let cachedVideoBounds: VideoBoundsCache | null = null;

    const computeRenderedVideoBounds = (): VideoBoundsCache => {
      const displayW = videoElement.width;
      const displayH = videoElement.height;
      const videoW = videoElement.videoWidth || displayW;
      const videoH = videoElement.videoHeight || displayH;

      const displayAspect = displayW / displayH;
      const videoAspect = videoW / videoH;

      let renderedW: number;
      let renderedH: number;
      let offsetX: number;
      let offsetY: number;

      if (videoAspect > displayAspect) {
        renderedW = displayW;
        renderedH = displayW / videoAspect;
        offsetX = 0;
        offsetY = (displayH - renderedH) / 2;
      } else {
        renderedH = displayH;
        renderedW = displayH * videoAspect;
        offsetX = (displayW - renderedW) / 2;
        offsetY = 0;
      }

      return { renderedW, renderedH, offsetX, offsetY, videoW, videoH };
    };

    // Invalidate the cache whenever the video's intrinsic dimensions become available.
    const onMetadata = () => {
      cachedVideoBounds = null;
    };
    videoElement.addEventListener("loadedmetadata", onMetadata);

    const getRenderedVideoBounds = (): VideoBoundsCache => {
      if (!cachedVideoBounds) {
        cachedVideoBounds = computeRenderedVideoBounds();
      }
      return cachedVideoBounds;
    };

    const updateMagnifier = (localX: number, localY: number, crosshairX: number, crosshairY: number) => {
      const { renderedW, renderedH, offsetX, offsetY, videoW, videoH } = getRenderedVideoBounds();

      const videoX = ((localX - offsetX) / renderedW) * videoW;
      const videoY = ((localY - offsetY) / renderedH) * videoH;

      const srcW = (MAG_SIZE / MAG_ZOOM) * (videoW / renderedW);
      const srcH = (MAG_SIZE / MAG_ZOOM) * (videoH / renderedH);
      const sx = videoX - srcW / 2;
      const sy = videoY - srcH / 2;

      magCtx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
      magCtx.save();

      magCtx.beginPath();
      magCtx.arc(MAG_SIZE / 2, MAG_SIZE / 2, MAG_SIZE / 2, 0, Math.PI * 2);
      magCtx.clip();

      magCtx.drawImage(videoElement, sx, sy, srcW, srcH, 0, 0, MAG_SIZE, MAG_SIZE);

      magCtx.restore();

      magCtx.strokeStyle = magBorderColor;
      magCtx.lineWidth = MAG_BORDER_WIDTH;
      magCtx.beginPath();
      magCtx.arc(MAG_SIZE / 2, MAG_SIZE / 2, MAG_SIZE / 2 - MAG_BORDER_WIDTH / 2, 0, Math.PI * 2);
      magCtx.stroke();

      magCtx.strokeStyle = magCrosshairColor;
      magCtx.lineWidth = MAG_CROSSHAIR_LINE_WIDTH;
      magCtx.beginPath();
      magCtx.moveTo(crosshairX - MAG_CROSSHAIR_RADIUS, crosshairY);
      magCtx.lineTo(crosshairX - MAG_CROSSHAIR_GAP, crosshairY);
      magCtx.moveTo(crosshairX + MAG_CROSSHAIR_GAP, crosshairY);
      magCtx.lineTo(crosshairX + MAG_CROSSHAIR_RADIUS, crosshairY);
      magCtx.moveTo(crosshairX, crosshairY - MAG_CROSSHAIR_RADIUS);
      magCtx.lineTo(crosshairX, crosshairY - MAG_CROSSHAIR_GAP);
      magCtx.moveTo(crosshairX, crosshairY + MAG_CROSSHAIR_GAP);
      magCtx.lineTo(crosshairX, crosshairY + MAG_CROSSHAIR_RADIUS);
      magCtx.stroke();
    };

    const a11yStrings = StringManager.getInstance().getA11y();

    const digitizingOverlay = new Rectangle(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT, {
      fill: "transparent",
      cursor: "none",
      visible: false,
      tagName: "div",
      accessibleName: a11yStrings.digitizingAreaStringProperty,
    });
    digitizingOverlay.addChild(cursorNode);
    digitizingOverlay.addChild(magnifierNode);

    // ── Resize overlay to match the loaded video's display dimensions ──────
    const videoDimensionsListener = (dims: Dimension2) => {
      digitizingOverlay.setRect(0, 0, dims.width, dims.height);
    };
    model.playback.videoDimensionsProperty.link(videoDimensionsListener);

    const updateMagnifierAtLastPt = () => {
      if (!(lastLocalPt && magnifierNode.visible)) {
        return;
      }
      const { width: overlayW, height: overlayH } = model.playback.videoDimensionsProperty.value;
      const magX = Math.max(0, Math.min(lastLocalPt.x - MAG_SIZE / 2, overlayW - MAG_SIZE));
      const magY = Math.max(0, Math.min(lastLocalPt.y - MAG_SIZE / 2, overlayH - MAG_SIZE));
      const crosshairX = lastLocalPt.x - magX;
      const crosshairY = lastLocalPt.y - magY;
      updateMagnifier(lastLocalPt.x, lastLocalPt.y, crosshairX, crosshairY);
    };

    digitizingOverlay.addInputListener({
      move: (event) => {
        const localPt = digitizingOverlay.globalToLocalPoint(event.pointer.point);
        lastLocalPt = localPt;
        cursorNode.translation = localPt;
        cursorNode.visible = true;

        const { width: overlayW, height: overlayH } = model.playback.videoDimensionsProperty.value;
        const magX = Math.max(0, Math.min(localPt.x - MAG_SIZE / 2, overlayW - MAG_SIZE));
        const magY = Math.max(0, Math.min(localPt.y - MAG_SIZE / 2, overlayH - MAG_SIZE));
        magnifierNode.x = magX;
        magnifierNode.y = magY;

        if (model.overlayTools.magnifyVideoProperty.value) {
          const crosshairX = localPt.x - magX;
          const crosshairY = localPt.y - magY;
          updateMagnifier(localPt.x, localPt.y, crosshairX, crosshairY);
          magnifierNode.visible = true;
        } else {
          magnifierNode.visible = false;
        }
      },
      exit: () => {
        cursorNode.visible = false;
        magnifierNode.visible = false;
      },
    });

    // ── Mark dots layer ─────────────────────────────────────────────────────
    // One Path per track is reused across rebuilds.  This avoids allocating
    // and discarding SceneryStack nodes on every video frame (~30 Hz during
    // playback), which caused significant GC pressure with many track points.
    const marksLayer = new Node({ pickable: false });
    const trackPaths = new Map<string, Path>(); // track id → Path

    const rebuildMarks = () => {
      const frameDuration = model.playback.frameDurationProperty.value;
      const currentFrame = Math.round(model.playback.currentTimeProperty.value / frameDuration);
      const mvt = model.overlayTools.modelViewTransformProperty.value;
      const tracks = model.tracking.tracksProperty.value;
      const activeTrackIds = new Set(tracks.map((t) => t.id));

      // Update or create one Path per track.
      for (const track of tracks) {
        let path = trackPaths.get(track.id);
        if (!path) {
          path = new Path(null, { fill: getTrackColor(track.colorIndex), pickable: false });
          trackPaths.set(track.id, path);
          marksLayer.addChild(path);
        }
        const shape = new Shape();
        for (const point of track.points) {
          if (point.frame <= currentFrame) {
            const localPt = mvt.transformPosition2(new Vector2(point.x, point.y));
            shape.circle(localPt.x, localPt.y, MARK_DOT_RADIUS);
          }
        }
        path.shape = shape;
      }

      // Remove paths for tracks that have been deleted.
      for (const [id, path] of trackPaths) {
        if (!activeTrackIds.has(id)) {
          marksLayer.removeChild(path);
          path.dispose();
          trackPaths.delete(id);
        }
      }
    };

    const currentTimeListener = () => {
      rebuildMarks();
      updateMagnifierAtLastPt();
    };
    model.playback.currentTimeProperty.link(currentTimeListener);

    const tracksListener = () => rebuildMarks();
    model.tracking.tracksProperty.link(tracksListener);

    const mvtListener = () => rebuildMarks();
    model.overlayTools.modelViewTransformProperty.link(mvtListener);

    const frameRateListener = () => rebuildMarks();
    model.playback.frameRateProperty.link(frameRateListener);

    const activeTrackListener = (activeId: string | null) => {
      digitizingOverlay.visible = activeId !== null;
      if (!activeId) {
        cursorNode.visible = false;
      }
    };
    model.tracking.activeTrackIdProperty.link(activeTrackListener);

    const magnifyListener = (magnify: boolean) => {
      if (!magnify) {
        magnifierNode.visible = false;
      }
    };
    model.overlayTools.magnifyVideoProperty.link(magnifyListener);

    digitizingOverlay.addInputListener(
      new FireListener({
        fire: (event) => {
          if (!event) {
            return;
          }
          const activeId = model.tracking.activeTrackIdProperty.value;
          if (!activeId) {
            return;
          }

          const track = model.tracking.tracksProperty.value.find((t) => t.id === activeId);
          if (!track) {
            return;
          }

          const localPt = digitizingOverlay.globalToLocalPoint(event.pointer.point);

          const time = model.playback.currentTimeProperty.value;
          const frame = Math.round(time * model.playback.frameRateProperty.value);

          const modelPt = model.pixelToModelCoords(localPt);

          model.tracking.addPointToTrack(activeId, frame, time, modelPt.x, modelPt.y);
          onPointAdded();
        },
        tandem: Tandem.OPT_OUT,
      }),
    );

    this.addChild(digitizingOverlay);
    this.addChild(marksLayer);

    // Store cleanup function
    this.disposeDigitizingOverlay = () => {
      videoElement.removeEventListener("loadedmetadata", onMetadata);
      TrackLabColors.digitizingMagnifierBorderProperty.unlink(magBorderListener);
      TrackLabColors.digitizingMagnifierCrosshairProperty.unlink(magCrosshairListener);
      TrackLabColors.digitizingMagnifierShadowProperty.unlink(magShadowListener);
      model.playback.videoDimensionsProperty.unlink(videoDimensionsListener);
      model.playback.currentTimeProperty.unlink(currentTimeListener);
      model.tracking.tracksProperty.unlink(tracksListener);
      model.overlayTools.modelViewTransformProperty.unlink(mvtListener);
      model.playback.frameRateProperty.unlink(frameRateListener);
      model.tracking.activeTrackIdProperty.unlink(activeTrackListener);
      model.overlayTools.magnifyVideoProperty.unlink(magnifyListener);
      for (const path of trackPaths.values()) {
        path.dispose();
      }
      trackPaths.clear();
    };
  }

  public override dispose(): void {
    this.disposeDigitizingOverlay();
    super.dispose();
  }
}

trackLab.register("DigitizingOverlayNode", DigitizingOverlayNode);
