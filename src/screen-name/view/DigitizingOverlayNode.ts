/**
 * DigitizingOverlayNode.ts
 *
 * Overlay UI for manual particle tracking. Provides a crosshair cursor and
 * magnified view to help users precisely click on particle positions.
 */

import { type Dimension2, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Circle, Color, DOM, FireListener, Node, Path, Rectangle } from "scenerystack/scenery";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../../TrackLabConstants.js";
import type { SimModel } from "../model/SimModel.js";
import type { SelectedPoint } from "../model/SimModel.js";

const OUTER_R = 12;
const INNER_R = 2;
const CUR_LW = 1.5;
const CUR_SHADOW_LW = 4; // wider shadow stroke for contrast on all backgrounds

const MAG_SIZE = 100;
const MAG_ZOOM = 4;
const MAG_BORDER_WIDTH = 2;
const MAG_CROSSHAIR_RADIUS = 8;
const MAG_CROSSHAIR_GAP = 2;
const MAG_CROSSHAIR_LINE_WIDTH = 1;

const MARK_DOT_RADIUS = 2; // radius of each digitized-point dot drawn on the video
const MARK_HIT_RADIUS = 10; // enlarged hit area for clicking dots
const SELECTION_RING_RADIUS = 6; // radius of the selection ring
const SELECTION_RING_LINE_WIDTH = 2; // stroke width of selection ring

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
    model.videoDimensionsProperty.link(videoDimensionsListener);

    digitizingOverlay.addInputListener({
      move: (event) => {
        const localPt = digitizingOverlay.globalToLocalPoint(event.pointer.point);
        cursorNode.translation = localPt;
        cursorNode.visible = true;

        const { width: overlayW, height: overlayH } = model.videoDimensionsProperty.value;
        const magX = Math.max(0, Math.min(localPt.x - MAG_SIZE / 2, overlayW - MAG_SIZE));
        const magY = Math.max(0, Math.min(localPt.y - MAG_SIZE / 2, overlayH - MAG_SIZE));
        magnifierNode.x = magX;
        magnifierNode.y = magY;

        if (model.magnifyVideoProperty.value) {
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
    // Each point gets its own node group: selection ring + visible dot + hit area.
    // This enables clicking on individual points for selection and deletion.
    const marksLayer = new Node({ pickable: true });

    // Map of pointKey ("trackId:frame") → Node containing ring, dot, and hit area
    type PointNodeInfo = {
      container: Node;
      ring: Circle;
      trackId: string;
      frame: number;
    };
    const pointNodes = new Map<string, PointNodeInfo>();

    // Helper to create a unique key for a point
    const makePointKey = (trackId: string, frame: number) => `${trackId}:${frame}`;

    // Update selection ring visibility based on selectedPointProperty
    const updateSelectionRings = (selected: SelectedPoint) => {
      for (const info of pointNodes.values()) {
        const isSelected = selected !== null && info.trackId === selected.trackId && info.frame === selected.frame;
        info.ring.visible = isSelected;
      }
    };

    const selectedPointListener = (selected: SelectedPoint) => {
      updateSelectionRings(selected);
    };
    model.selectedPointProperty.link(selectedPointListener);

    const rebuildMarks = () => {
      const frameDuration = model.frameDurationProperty.value;
      const currentFrame = Math.round(model.currentTimeProperty.value / frameDuration);
      const mvt = model.modelViewTransformProperty.value;
      const tracks = model.tracksProperty.value;
      const selected = model.selectedPointProperty.value;

      // Build set of keys for points that should be visible
      const visibleKeys = new Set<string>();
      for (const track of tracks) {
        for (const point of track.points) {
          if (point.frame <= currentFrame) {
            visibleKeys.add(makePointKey(track.id, point.frame));
          }
        }
      }

      // Remove nodes for points that are no longer visible
      for (const [key, info] of pointNodes) {
        if (!visibleKeys.has(key)) {
          marksLayer.removeChild(info.container);
          info.container.dispose();
          pointNodes.delete(key);
        }
      }

      // Update or create nodes for visible points
      for (const track of tracks) {
        const trackColor = new Color(track.color);
        for (const point of track.points) {
          if (point.frame <= currentFrame) {
            const key = makePointKey(track.id, point.frame);
            const localPt = mvt.transformPosition2(new Vector2(point.x, point.y));

            let info = pointNodes.get(key);
            if (!info) {
              // Create new point node group
              const container = new Node({ cursor: "pointer" });

              // Selection ring (initially hidden)
              const ring = new Circle(SELECTION_RING_RADIUS, {
                stroke: trackColor,
                lineWidth: SELECTION_RING_LINE_WIDTH,
                fill: null,
                visible: false,
                pickable: false,
              });

              // Visible dot
              const dot = new Circle(MARK_DOT_RADIUS, {
                fill: trackColor,
                pickable: false,
              });

              // Invisible hit area for easier clicking
              const hitArea = new Circle(MARK_HIT_RADIUS, {
                fill: "transparent",
                cursor: "pointer",
              });

              // Click handler to select this point
              const trackId = track.id;
              const frame = point.frame;
              hitArea.addInputListener(
                new FireListener({
                  fire: () => {
                    const currentSelected = model.selectedPointProperty.value;
                    // Toggle selection: if already selected, deselect; otherwise select
                    if (currentSelected?.trackId === trackId && currentSelected?.frame === frame) {
                      model.selectedPointProperty.value = null;
                    } else {
                      model.selectedPointProperty.value = { trackId, frame };
                    }
                  },
                  tandem: Tandem.OPT_OUT,
                }),
              );

              container.addChild(ring);
              container.addChild(dot);
              container.addChild(hitArea);

              info = { container, ring, trackId: track.id, frame: point.frame };
              pointNodes.set(key, info);
              marksLayer.addChild(container);
            }

            // Update position
            info.container.translation = localPt;

            // Update selection ring visibility
            const isSelected = selected !== null && track.id === selected.trackId && point.frame === selected.frame;
            info.ring.visible = isSelected;
          }
        }
      }
    };

    const currentTimeListener = () => rebuildMarks();
    model.currentTimeProperty.link(currentTimeListener);

    const tracksListener = () => rebuildMarks();
    model.tracksProperty.link(tracksListener);

    const mvtListener = () => rebuildMarks();
    model.modelViewTransformProperty.link(mvtListener);

    const frameRateListener = () => rebuildMarks();
    model.frameRateProperty.link(frameRateListener);

    const activeTrackListener = (activeId: string | null) => {
      digitizingOverlay.visible = activeId !== null;
      if (!activeId) {
        cursorNode.visible = false;
      }
    };
    model.activeTrackIdProperty.link(activeTrackListener);

    const magnifyListener = (magnify: boolean) => {
      if (!magnify) {
        magnifierNode.visible = false;
      }
    };
    model.magnifyVideoProperty.link(magnifyListener);

    digitizingOverlay.addInputListener(
      new FireListener({
        fire: (event) => {
          if (!event) {
            return;
          }
          const activeId = model.activeTrackIdProperty.value;
          if (!activeId) {
            // No active track, but still clear selection on background click
            model.selectedPointProperty.value = null;
            return;
          }

          const track = model.tracksProperty.value.find((t) => t.id === activeId);
          if (!track) {
            return;
          }

          // Clear any selection when digitizing a new point
          model.selectedPointProperty.value = null;

          const localPt = digitizingOverlay.globalToLocalPoint(event.pointer.point);

          const time = model.currentTimeProperty.value;
          const frame = Math.round(time * model.frameRateProperty.value);

          const modelPt = model.pixelToModelCoords(localPt);

          model.addPointToTrack(activeId, frame, time, modelPt.x, modelPt.y);
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
      model.videoDimensionsProperty.unlink(videoDimensionsListener);
      model.currentTimeProperty.unlink(currentTimeListener);
      model.tracksProperty.unlink(tracksListener);
      model.modelViewTransformProperty.unlink(mvtListener);
      model.frameRateProperty.unlink(frameRateListener);
      model.activeTrackIdProperty.unlink(activeTrackListener);
      model.magnifyVideoProperty.unlink(magnifyListener);
      model.selectedPointProperty.unlink(selectedPointListener);
      for (const info of pointNodes.values()) {
        info.container.dispose();
      }
      pointNodes.clear();
    };
  }

  public override dispose(): void {
    this.disposeDigitizingOverlay();
    super.dispose();
  }
}
