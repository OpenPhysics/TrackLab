/**
 * VideoSourceControlNode.ts
 *
 * Controls for selecting video source (upload, webcam, or sample videos) and
 * accessing the webcam recording dialog.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Property } from "scenerystack/axon";
import { HBox, type Node, Text } from "scenerystack/scenery";
import { CameraButton, PhetFont } from "scenerystack/scenery-phet";
import { ButtonNode, ComboBox, type ComboBoxItem } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import { createTrackLabButton, makeDownloadIcon, makeUploadIcon } from "../../TrackLabButton.js";
import TrackLabColors from "../../TrackLabColors.js";
import { BUTTON_X_MARGIN, BUTTON_Y_MARGIN, MOUSE_AREA_DILATION, TOUCH_AREA_DILATION } from "../../TrackLabConstants.js";
import trackLab from "../../TrackLabNamespace.js";
import { countWebmFrames, getAnimatedWebPInfo } from "../../webcam.js";
import { DEFAULT_FRAME_RATE, type SimModel, type UploadedVideo, type WebcamRecording } from "../model/SimModel.js";
import { WebcamPanel } from "./WebcamPanel.js";

const LABEL_FONT = new PhetFont(14);
const HEADER_FONT = new PhetFont({ size: 12, style: "italic" });
const CONTROLS_SPACING = 12;
const HEADER_VALUE_PREFIX = "__header:";
const LABEL_MAX_NAME_LENGTH = 25; // max chars before truncating upload filenames

// ── Label formatting helpers ─────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const totalSec = Math.round(seconds);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRecordingLabel(rec: WebcamRecording): string {
  return `Recording ${rec.num}  (${formatDuration(rec.duration)})`;
}

function formatUploadLabel(upl: UploadedVideo): string {
  const baseName = upl.name.replace(/\.[^.]+$/, "");
  const displayName =
    baseName.length > LABEL_MAX_NAME_LENGTH ? `${baseName.substring(0, LABEL_MAX_NAME_LENGTH - 3)}...` : baseName;
  return `${displayName}  (${formatDuration(upl.duration)})`;
}

// Bundled video files with known frame rates (labels resolved from StringManager)
type VideoFile = {
  labelProperty: TReadOnlyProperty<string>;
  filename: string;
  fps: number;
  frameCount: number;
  tandemName: string;
};

export type VideoSelectedCallback = (url: string) => void;
export type WebcamReadyCallback = (blob: Blob, duration: number) => void;

/**
 * Video source selection controls: combo box for bundled videos (with optional
 * "My Recordings" and "Uploaded Videos" sections), a download button (visible
 * for user-provided videos), an upload button, and a webcam-record button.
 */
export class VideoSourceControlNode extends HBox {
  public readonly webcamPanel: WebcamPanel;
  private readonly selectedVideoProperty: Property<string | null>;
  private lastLoadedValue: string | null = null;

  public constructor(
    model: SimModel,
    listParent: Node,
    onVideoSelected: VideoSelectedCallback,
    onWebcamReady: WebcamReadyCallback,
  ) {
    super({ spacing: CONTROLS_SPACING });

    const uiStrings = StringManager.getInstance().getUI();
    const videoFileStrings = StringManager.getInstance().getVideoFiles();
    const videoSourceStrings = StringManager.getInstance().getVideoSource();

    const VIDEO_FILES: VideoFile[] = [
      {
        labelProperty: videoFileStrings.ballOilStringProperty,
        filename: "ballOil.mp4",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 249,
        tandemName: "ballOilItem",
      },
      {
        labelProperty: videoFileStrings.bouncingCartStringProperty,
        filename: "bouncingCart.mp4",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 328,
        tandemName: "bouncingCartItem",
      },
      {
        labelProperty: videoFileStrings.cartPendulumStringProperty,
        filename: "cartPendulum.mp4",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 44,
        tandemName: "cartPendulumItem",
      },
      {
        labelProperty: videoFileStrings.cupsClipsStringProperty,
        filename: "cupsClips.mp4",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 52,
        tandemName: "cupsClipsItem",
      },
      {
        labelProperty: videoFileStrings.parachuteMonkeyStringProperty,
        filename: "parachuteMonkey.mp4",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 21,
        tandemName: "parachuteMonkeyItem",
      },
      {
        labelProperty: videoFileStrings.pendulumStringProperty,
        filename: "pendulum.mp4",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 62,
        tandemName: "pendulumItem",
      },
      {
        labelProperty: videoFileStrings.pendulumDragStringProperty,
        filename: "pendulumDrag.mp4",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 176,
        tandemName: "pendulumDragItem",
      },
      {
        labelProperty: videoFileStrings.pucksCollideStringProperty,
        filename: "pucksCollide.mp4",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 33,
        tandemName: "pucksCollideItem",
      },
      {
        labelProperty: videoFileStrings.collisionOneStringProperty,
        filename: "collisionOne.webm",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 191,
        tandemName: "collisionOneItem",
      },
      {
        labelProperty: videoFileStrings.collisionTwoStringProperty,
        filename: "collisionTwo.webm",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 247,
        tandemName: "collisionTwoItem",
      },
      {
        labelProperty: videoFileStrings.oscillatingCarStringProperty,
        filename: "oscillatingCar.webm",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 243,
        tandemName: "oscillatingCarItem",
      },
      {
        labelProperty: videoFileStrings.verticalTossStringProperty,
        filename: "verticalToss.webm",
        fps: DEFAULT_FRAME_RATE,
        frameCount: 77,
        tandemName: "verticalTossItem",
      },
    ];

    // ── Shared selection state (survives combo box rebuilds) ───────────────
    this.selectedVideoProperty = new Property<string | null>(null);
    const selectedVideoProperty = this.selectedVideoProperty; // local alias for callbacks

    // ── Selection handler for bundled videos, recordings, and uploads ──────
    // This is the single canonical place where a video source is activated.
    // Each branch calls a model method that sets all affected properties
    // atomically, preventing subscribers from seeing intermediate states.
    selectedVideoProperty.lazyLink((value) => {
      // Revert section-header selections immediately
      if (value?.startsWith(HEADER_VALUE_PREFIX)) {
        selectedVideoProperty.value = this.lastLoadedValue;
        return;
      }

      // Skip if same video is reselected (e.g. after a header revert)
      if (value === this.lastLoadedValue) {
        return;
      }

      if (!value) {
        return;
      }

      // Check webcam recordings
      const recording = model.webcamRecordingsProperty.value.find((r) => r.id === value);
      if (recording) {
        this.lastLoadedValue = value;
        model.activateRecording(recording);
        onWebcamReady(recording.blob, recording.duration);
        return;
      }

      // Check uploaded videos
      const upload = model.uploadedVideosProperty.value.find((u) => u.id === value);
      if (upload) {
        this.lastLoadedValue = value;
        model.activateUpload(upload);
        onWebcamReady(upload.blob, upload.duration);
        return;
      }

      // Bundled video
      const videoInfo = VIDEO_FILES.find((v) => v.filename === value);
      if (videoInfo) {
        this.lastLoadedValue = value;
        model.activateBundledVideo(videoInfo.frameCount, videoInfo.fps);
        onVideoSelected(`./videos/${value}`);
      }
    });

    // ── Combo box (rebuilt when recordings or uploads change) ──────────────
    let videoComboBox: ComboBox<string | null> | null = null;

    const buildComboBox = (
      recordings: readonly WebcamRecording[],
      uploads: readonly UploadedVideo[],
    ): ComboBox<string | null> => {
      const hasUserVideos = recordings.length > 0 || uploads.length > 0;
      const items: ComboBoxItem<string | null>[] = [];

      // Placeholder item
      items.push({
        value: null,
        createNode: () =>
          new Text(uiStrings.selectVideoStringProperty, {
            font: LABEL_FONT,
            fill: TrackLabColors.textOnDarkProperty,
          }),
        tandemName: "selectVideoItem",
      });

      // Sample videos header (only when user videos exist to separate sections)
      if (hasUserVideos) {
        items.push({
          value: `${HEADER_VALUE_PREFIX}samples`,
          createNode: () =>
            new Text(uiStrings.sampleVideosStringProperty, {
              font: HEADER_FONT,
              fill: TrackLabColors.textMutedProperty,
            }),
          tandemName: "sampleVideosHeaderItem",
        });
      }

      // Bundled videos
      for (const v of VIDEO_FILES) {
        items.push({
          value: v.filename,
          createNode: () =>
            new Text(v.labelProperty, {
              font: LABEL_FONT,
              fill: TrackLabColors.textOnDarkProperty,
            }),
          tandemName: v.tandemName,
        });
      }

      // My Recordings section
      if (recordings.length > 0) {
        items.push({
          value: `${HEADER_VALUE_PREFIX}recordings`,
          createNode: () =>
            new Text(uiStrings.myRecordingsStringProperty, {
              font: HEADER_FONT,
              fill: TrackLabColors.textMutedProperty,
            }),
          tandemName: "myRecordingsHeaderItem",
        });

        for (const rec of recordings) {
          items.push({
            value: rec.id,
            createNode: () =>
              new Text(formatRecordingLabel(rec), {
                font: LABEL_FONT,
                fill: TrackLabColors.textOnDarkProperty,
              }),
            tandemName: `${rec.id.replace("-", "")}Item`,
          });
        }
      }

      // Uploaded Videos section
      if (uploads.length > 0) {
        items.push({
          value: `${HEADER_VALUE_PREFIX}uploads`,
          createNode: () =>
            new Text(uiStrings.uploadedVideosStringProperty, {
              font: HEADER_FONT,
              fill: TrackLabColors.textMutedProperty,
            }),
          tandemName: "uploadedVideosHeaderItem",
        });

        for (const upl of uploads) {
          items.push({
            value: upl.id,
            createNode: () =>
              new Text(formatUploadLabel(upl), {
                font: LABEL_FONT,
                fill: TrackLabColors.textOnDarkProperty,
              }),
            tandemName: `${upl.id.replace("-", "")}Item`,
          });
        }
      }

      return new ComboBox(selectedVideoProperty, items, listParent, {
        buttonFill: TrackLabColors.comboBoxButtonFillProperty,
        listFill: TrackLabColors.comboBoxListFillProperty,
        highlightFill: TrackLabColors.comboBoxHighlightFillProperty,
      });
    };

    const rebuildComboBox = (): void => {
      const recordings = model.webcamRecordingsProperty.value;
      const uploads = model.uploadedVideosProperty.value;
      const oldBox = videoComboBox;
      videoComboBox = buildComboBox(recordings, uploads);

      if (oldBox) {
        const idx = this.children.indexOf(oldBox);
        if (idx >= 0) {
          this.removeChild(oldBox);
          this.insertChild(idx, videoComboBox);
        }
        oldBox.dispose();
      }
    };

    // Build the initial ComboBox (no recordings or uploads yet)
    videoComboBox = buildComboBox([], []);

    // Rebuild when either list changes
    model.webcamRecordingsProperty.lazyLink(() => rebuildComboBox());
    model.uploadedVideosProperty.lazyLink(() => rebuildComboBox());

    // ── Download button (visible for user-provided videos) ────────────────
    const downloadButton = createTrackLabButton(makeDownloadIcon(), {
      accessibleName: videoSourceStrings.downloadVideoStringProperty,
      listener: () => {
        const blob = model.currentWebcamBlobProperty.value;
        if (!blob) {
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = blob.type.includes("webm") ? "webm" : "mp4";
        a.download = `video.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
    downloadButton.visible = false;
    model.isWebcamVideoProperty.link((isUserVideo) => {
      downloadButton.visible = isUserVideo;
    });

    // ── Upload button (opens file picker for local video files) ───────────
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "video/*,image/webp";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        return;
      }
      const blob: Blob = file;
      // Reset so selecting the same file again still triggers "change"
      fileInput.value = "";

      if (file.type === "image/webp") {
        // HTMLVideoElement does not report duration for animated WebP.
        // Use ImageDecoder to count frames and derive duration from frame timing.
        const info = await getAnimatedWebPInfo(blob);
        const duration = info?.duration ?? 0;
        const fps = info?.fps ?? DEFAULT_FRAME_RATE;
        const frameCount = info?.frameCount ?? 0;
        const upload = model.addUploadedVideo(blob, file.name, duration, fps, frameCount > 0 ? frameCount : undefined);
        // Setting selectedVideoProperty triggers the lazyLink which calls
        // model.activateUpload(upload) and onWebcamReady atomically.
        selectedVideoProperty.value = upload.id;
        return;
      }

      const storeAndLoad = (duration: number, fps?: number, frameCount?: number) => {
        const upload = model.addUploadedVideo(blob, file.name, duration, fps, frameCount);
        // Setting selectedVideoProperty triggers the lazyLink which calls
        // model.activateUpload(upload) and onWebcamReady atomically.
        selectedVideoProperty.value = upload.id;
      };

      if (file.type === "video/webm" || file.name.toLowerCase().endsWith(".webm")) {
        // Count actual frames for WebM files; also fixes Infinity duration from MediaRecorder
        countWebmFrames(blob)
          .then(({ frameCount, duration }) => {
            const fps = frameCount > 0 && duration > 0 ? frameCount / duration : DEFAULT_FRAME_RATE;
            storeAndLoad(duration, fps, frameCount > 0 ? frameCount : undefined);
          })
          .catch(() => storeAndLoad(0));
      } else {
        // Read duration via a temporary video element, then store and load
        const tempUrl = URL.createObjectURL(blob);
        const tempVideo = document.createElement("video");
        tempVideo.preload = "metadata";
        tempVideo.src = tempUrl;
        tempVideo.addEventListener("loadedmetadata", () => {
          const duration = Number.isFinite(tempVideo.duration) ? tempVideo.duration : 0;
          URL.revokeObjectURL(tempUrl);
          storeAndLoad(duration);
        });
      }
    });

    const uploadButton = createTrackLabButton(makeUploadIcon(), {
      accessibleName: videoSourceStrings.openVideoFileStringProperty,
      listener: () => {
        model.isPlayingProperty.value = false;
        fileInput.click();
      },
    });

    // ── Webcam panel and button ───────────────────────────────────────────
    this.webcamPanel = new WebcamPanel({
      model: model,
      onVideoReady: (blob, duration) => {
        this.webcamPanel.visible = false;
        // Store the recording in the model (this triggers a ComboBox rebuild).
        const recording = model.addWebcamRecording(blob, duration, model.frameRateProperty.value);
        // Setting selectedVideoProperty triggers the lazyLink which calls
        // model.activateRecording(recording) and onWebcamReady atomically.
        selectedVideoProperty.value = recording.id;
      },
      onCancel: () => {
        this.webcamPanel.visible = false;
      },
    });
    this.webcamPanel.visible = false;

    const webcamButton = new CameraButton({
      baseColor: TrackLabColors.buttonBaseDarkProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      xMargin: BUTTON_X_MARGIN,
      yMargin: BUTTON_Y_MARGIN,
      touchAreaXDilation: TOUCH_AREA_DILATION,
      touchAreaYDilation: TOUCH_AREA_DILATION,
      mouseAreaXDilation: MOUSE_AREA_DILATION,
      mouseAreaYDilation: MOUSE_AREA_DILATION,
      iconFill: TrackLabColors.textOnDarkProperty,
      tandem: Tandem.OPT_OUT,
      accessibleName: videoSourceStrings.recordWebcamStringProperty,
      listener: async () => {
        model.isPlayingProperty.value = false;
        this.webcamPanel.visible = true;
        try {
          await this.webcamPanel.open();
        } catch {
          this.webcamPanel.visible = false;
        }
      },
    });

    this.children = [videoComboBox, downloadButton, uploadButton, webcamButton];
  }

  /**
   * Reset the video source selection to the initial "none" state.
   */
  public reset(): void {
    this.lastLoadedValue = null;
    this.selectedVideoProperty.value = null;
  }
}

trackLab.register("VideoSourceControlNode", VideoSourceControlNode);
