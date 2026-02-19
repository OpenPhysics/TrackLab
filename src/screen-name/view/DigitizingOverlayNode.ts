import { DerivedProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import {
  Circle,
  DOM,
  FireListener,
  Line,
  Node,
  Path,
  Rectangle,
} from "scenerystack/scenery";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import { VIDEO_HEIGHT, VIDEO_WIDTH, type SimModel } from "../model/SimModel.js";

const OUTER_R = 12;
const INNER_R = 2;
const CUR_LW = 1.5;

const MAG_SIZE = 100;
const MAG_ZOOM = 4;
const MAG_BORDER_WIDTH = 2;
const MAG_CROSSHAIR_RADIUS = 8;
const MAG_CROSSHAIR_GAP = 2;
const MAG_CROSSHAIR_LINE_WIDTH = 1;

/**
 * Manual digitizing overlay for placing track points on the video.
 * Renders a custom crosshair cursor and magnifier, and places dots on click.
 */
export class DigitizingOverlayNode extends Node {
  public constructor(
    videoElement: HTMLVideoElement,
    model: SimModel,
    onPointAdded: () => void,
  ) {
    super();

    // Cached CSS color strings for canvas drawing (updated via property links)
    let magBorderColor = TrackLabColors.digitizingMagnifierBorderProperty.value.toCSS();
    let magCrosshairColor = TrackLabColors.digitizingMagnifierCrosshairProperty.value.toCSS();
    let magShadowColor = TrackLabColors.digitizingMagnifierShadowProperty.value.toCSS();

    // Custom cursor: large circle + 4 segments that stop at the empty centre
    const cursorCircle = new Path(Shape.circle(0, 0, OUTER_R), {
      stroke: TrackLabColors.digitizingCursorStrokeProperty,
      lineWidth: CUR_LW,
    });
    const cursorLineLeft = new Line(-OUTER_R, 0, -INNER_R, 0, {
      stroke: TrackLabColors.digitizingCursorStrokeProperty,
      lineWidth: CUR_LW,
    });
    const cursorLineRight = new Line(INNER_R, 0, OUTER_R, 0, {
      stroke: TrackLabColors.digitizingCursorStrokeProperty,
      lineWidth: CUR_LW,
    });
    const cursorLineTop = new Line(0, -OUTER_R, 0, -INNER_R, {
      stroke: TrackLabColors.digitizingCursorStrokeProperty,
      lineWidth: CUR_LW,
    });
    const cursorLineBottom = new Line(0, INNER_R, 0, OUTER_R, {
      stroke: TrackLabColors.digitizingCursorStrokeProperty,
      lineWidth: CUR_LW,
    });

    const cursorNode = new Node({
      visible: false,
      pickable: false,
      children: [
        cursorCircle,
        cursorLineLeft,
        cursorLineRight,
        cursorLineTop,
        cursorLineBottom,
      ],
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
      magCanvas.style.boxShadow = `0 2px 8px ${magShadowColor}`;
    };
    updateShadowStyle();

    TrackLabColors.digitizingMagnifierBorderProperty.link((color) => {
      magBorderColor = color.toCSS();
    });
    TrackLabColors.digitizingMagnifierCrosshairProperty.link((color) => {
      magCrosshairColor = color.toCSS();
    });
    TrackLabColors.digitizingMagnifierShadowProperty.link((color) => {
      magShadowColor = color.toCSS();
      updateShadowStyle();
    });

    const magCtx = magCanvas.getContext("2d");
    if (!magCtx)
      throw new Error("Could not get 2D context from magnifier canvas");

    const magnifierNode = new DOM(magCanvas, { allowInput: false });
    magnifierNode.visible = false;
    magnifierNode.pickable = false;

    /**
     * Computes the rendered video bounds within the display element,
     * accounting for letterboxing/pillarboxing when aspect ratios differ.
     */
    const getRenderedVideoBounds = () => {
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

    const updateMagnifier = (
      localX: number,
      localY: number,
      crosshairX: number,
      crosshairY: number,
    ) => {
      const { renderedW, renderedH, offsetX, offsetY, videoW, videoH } =
        getRenderedVideoBounds();

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

      magCtx.drawImage(
        videoElement,
        sx,
        sy,
        srcW,
        srcH,
        0,
        0,
        MAG_SIZE,
        MAG_SIZE,
      );

      magCtx.restore();

      magCtx.strokeStyle = magBorderColor;
      magCtx.lineWidth = MAG_BORDER_WIDTH;
      magCtx.beginPath();
      magCtx.arc(
        MAG_SIZE / 2,
        MAG_SIZE / 2,
        MAG_SIZE / 2 - MAG_BORDER_WIDTH / 2,
        0,
        Math.PI * 2,
      );
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

    const digitizingOverlay = new Rectangle(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT, {
      fill: "transparent",
      cursor: "none",
      visible: false,
    });
    digitizingOverlay.addChild(cursorNode);
    digitizingOverlay.addChild(magnifierNode);

    digitizingOverlay.addInputListener({
      move: (event) => {
        const localPt = digitizingOverlay.globalToLocalPoint(
          event.pointer.point,
        );
        cursorNode.translation = localPt;
        cursorNode.visible = true;

        const magX = Math.max(
          0,
          Math.min(localPt.x - MAG_SIZE / 2, VIDEO_WIDTH - MAG_SIZE),
        );
        const magY = Math.max(
          0,
          Math.min(localPt.y - MAG_SIZE / 2, VIDEO_HEIGHT - MAG_SIZE),
        );
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
    const marksLayer = new Node({ pickable: false });

    const rebuildMarks = () => {
      const frameDuration = model.frameDurationProperty.value;
      const currentFrame = Math.round(
        model.currentTimeProperty.value / frameDuration,
      );
      const mvt = model.modelViewTransformProperty.value;
      const circles: Circle[] = [];
      for (const track of model.tracksProperty.value) {
        for (const point of track.points) {
          if (point.frame <= currentFrame) {
            const localPt = mvt.transformPosition2(
              new Vector2(point.x, point.y),
            );
            circles.push(
              new Circle(2, { fill: track.color, x: localPt.x, y: localPt.y }),
            );
          }
        }
      }
      marksLayer.children = circles;
    };

    model.currentTimeProperty.link(() => rebuildMarks());
    model.tracksProperty.link(() => rebuildMarks());
    model.modelViewTransformProperty.link(() => rebuildMarks());
    model.frameRateProperty.link(() => rebuildMarks());

    model.activeTrackIdProperty.link((activeId) => {
      digitizingOverlay.visible = activeId !== null;
      if (!activeId) cursorNode.visible = false;
    });

    model.magnifyVideoProperty.link((magnify) => {
      if (!magnify) magnifierNode.visible = false;
    });

    digitizingOverlay.addInputListener(
      new FireListener({
        fire: (event) => {
          if (!event) return;
          const activeId = model.activeTrackIdProperty.value;
          if (!activeId) return;

          const track = model.tracksProperty.value.find(
            (t) => t.id === activeId,
          );
          if (!track) return;

          const localPt = digitizingOverlay.globalToLocalPoint(
            event.pointer.point,
          );

          const time = model.currentTimeProperty.value;
          const frameDuration = model.frameDurationProperty.value;
          const frame = Math.round(time / frameDuration);

          const mvt = model.modelViewTransformProperty.value;
          const modelPt = mvt.inversePosition2(localPt);

          model.addPointToTrack(activeId, frame, time, modelPt.x, modelPt.y);
          onPointAdded();
        },
        tandem: Tandem.OPT_OUT,
      }),
    );

    this.addChild(digitizingOverlay);
    this.addChild(marksLayer);
  }
}
