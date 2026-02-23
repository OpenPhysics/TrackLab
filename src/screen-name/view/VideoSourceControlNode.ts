import type { TReadOnlyProperty } from "scenerystack/axon";
import { Property } from "scenerystack/axon";
import { HBox, type Node, Text } from "scenerystack/scenery";
import { CameraButton, PhetFont } from "scenerystack/scenery-phet";
import { ButtonNode, ComboBox, type ComboBoxItem, RectangularPushButton } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { DEFAULT_FRAME_RATE, type SimModel, type WebcamRecording } from "../model/SimModel.js";
import { WebcamPanel } from "./WebcamPanel.js";

const LABEL_FONT = new PhetFont(14);
const HEADER_FONT = new PhetFont({ size: 12, style: "italic" });
const CONTROLS_SPACING = 12;
const HEADER_VALUE_PREFIX = "__header:";

// Bundled video files with known frame rates (labels resolved from StringManager)
type VideoFile = {
  labelProperty: TReadOnlyProperty<string>;
  filename: string;
  fps: number;
  tandemName: string;
};

export type VideoSelectedCallback = (url: string, fps: number) => void;
export type WebcamReadyCallback = (blob: Blob, duration: number) => void;

/**
 * Video source selection controls: combo box for bundled videos (with optional
 * "My Recordings" section), a download button (visible for webcam recordings),
 * and a webcam-record button.
 */
export class VideoSourceControlNode extends HBox {
  public readonly webcamPanel: WebcamPanel;

  public constructor(
    model: SimModel,
    listParent: Node,
    onVideoSelected: VideoSelectedCallback,
    onWebcamReady: WebcamReadyCallback,
  ) {
    super({ spacing: CONTROLS_SPACING });

    const uiStrings = StringManager.getInstance().getUI();
    const videoFileStrings = StringManager.getInstance().getVideoFiles();

    const VIDEO_FILES: VideoFile[] = [
      {
        labelProperty: videoFileStrings.ballOilStringProperty,
        filename: "ball_oil.mp4",
        fps: DEFAULT_FRAME_RATE,
        tandemName: "ballOilItem",
      },
      {
        labelProperty: videoFileStrings.bouncingCartStringProperty,
        filename: "bouncing_cart.mp4",
        fps: DEFAULT_FRAME_RATE,
        tandemName: "bouncingCartItem",
      },
      {
        labelProperty: videoFileStrings.cartPendulumStringProperty,
        filename: "cart_pendulum.mp4",
        fps: DEFAULT_FRAME_RATE,
        tandemName: "cartPendulumItem",
      },
      {
        labelProperty: videoFileStrings.cupsClipsStringProperty,
        filename: "CupsClips.mp4",
        fps: DEFAULT_FRAME_RATE,
        tandemName: "cupsClipsItem",
      },
      {
        labelProperty: videoFileStrings.parachuteMonkeyStringProperty,
        filename: "parachute_monkey.mp4",
        fps: DEFAULT_FRAME_RATE,
        tandemName: "parachuteMonkeyItem",
      },
      {
        labelProperty: videoFileStrings.pendulumStringProperty,
        filename: "Pendulum.mp4",
        fps: DEFAULT_FRAME_RATE,
        tandemName: "pendulumItem",
      },
      {
        labelProperty: videoFileStrings.pendulumDragStringProperty,
        filename: "pendulum_drag.mp4",
        fps: DEFAULT_FRAME_RATE,
        tandemName: "pendulumDragItem",
      },
      {
        labelProperty: videoFileStrings.pucksCollideStringProperty,
        filename: "PucksCollide.mp4",
        fps: DEFAULT_FRAME_RATE,
        tandemName: "pucksCollideItem",
      },
      {
        labelProperty: videoFileStrings.springWarsStringProperty,
        filename: "spring_wars.mp4",
        fps: DEFAULT_FRAME_RATE,
        tandemName: "springWarsItem",
      },
    ];

    // ── Shared selection state (survives combo box rebuilds) ───────────────
    const selectedVideoProperty = new Property<string | null>(null);
    let lastLoadedValue: string | null = null;

    // ── Selection handler for both bundled videos and recordings ───────────
    selectedVideoProperty.lazyLink((value) => {
      // Revert section-header selections immediately
      if (value?.startsWith(HEADER_VALUE_PREFIX)) {
        selectedVideoProperty.value = lastLoadedValue;
        return;
      }

      // Skip if same video is reselected (e.g. after a header revert)
      if (value === lastLoadedValue) {
        return;
      }

      if (!value) {
        return;
      }

      // Check webcam recordings first
      const recording = model.webcamRecordingsProperty.value.find((r) => r.id === value);
      if (recording) {
        lastLoadedValue = value;
        model.isWebcamVideoProperty.value = true;
        model.frameRateProperty.value = recording.fps;
        model.currentWebcamBlobProperty.value = recording.blob;
        onWebcamReady(recording.blob, recording.duration);
        return;
      }

      // Bundled video
      const videoInfo = VIDEO_FILES.find((v) => v.filename === value);
      if (videoInfo) {
        lastLoadedValue = value;
        model.isWebcamVideoProperty.value = false;
        model.currentWebcamBlobProperty.value = null;
        onVideoSelected(`./videos/${value}`, videoInfo.fps);
      }
    });

    // ── Combo box (rebuilt when recordings change) ─────────────────────────
    let videoComboBox: ComboBox<string | null> | null = null;

    const buildComboBox = (recordings: readonly WebcamRecording[]): ComboBox<string | null> => {
      const hasRecordings = recordings.length > 0;
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

      // Sample videos header (only shown when recordings exist to separate sections)
      if (hasRecordings) {
        items.push({
          value: `${HEADER_VALUE_PREFIX}samples`,
          createNode: () =>
            new Text(uiStrings.sampleVideosStringProperty, {
              font: HEADER_FONT,
              fill: TrackLabColors.textMutedProperty,
            }),
          tandemName: "sampleVideosHeader",
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
      if (hasRecordings) {
        items.push({
          value: `${HEADER_VALUE_PREFIX}recordings`,
          createNode: () =>
            new Text(uiStrings.myRecordingsStringProperty, {
              font: HEADER_FONT,
              fill: TrackLabColors.textMutedProperty,
            }),
          tandemName: "myRecordingsHeader",
        });

        for (const rec of recordings) {
          items.push({
            value: rec.id,
            createNode: () =>
              new Text(rec.label, {
                font: LABEL_FONT,
                fill: TrackLabColors.textOnDarkProperty,
              }),
            tandemName: rec.id.replace("-", ""),
          });
        }
      }

      return new ComboBox(selectedVideoProperty, items, listParent, {
        buttonFill: TrackLabColors.comboBoxButtonFillProperty,
        listFill: TrackLabColors.comboBoxListFillProperty,
        highlightFill: TrackLabColors.comboBoxHighlightFillProperty,
      });
    };

    const rebuildComboBox = (recordings: readonly WebcamRecording[]): void => {
      const oldBox = videoComboBox;
      videoComboBox = buildComboBox(recordings);

      if (oldBox) {
        const idx = this.children.indexOf(oldBox);
        if (idx >= 0) {
          this.removeChild(oldBox);
          this.insertChild(idx, videoComboBox);
        }
        oldBox.dispose();
      }
    };

    // Build the initial ComboBox (no recordings yet)
    videoComboBox = buildComboBox([]);

    // Rebuild when recordings change
    model.webcamRecordingsProperty.lazyLink((recordings) => {
      rebuildComboBox(recordings);
    });

    // ── Download button (visible only for webcam recordings) ──────────────
    const downloadIcon = new Text("\u2B07", {
      font: new PhetFont({ size: 11 }),
      fill: TrackLabColors.textOnDarkProperty,
    });
    const downloadButton = new RectangularPushButton({
      content: downloadIcon,
      baseColor: TrackLabColors.buttonBaseDarkProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      tandem: Tandem.OPT_OUT,
      accessibleName: "Download Recording",
      listener: () => {
        const blob = model.currentWebcamBlobProperty.value;
        if (!blob) {
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = blob.type.includes("webm") ? "webm" : "mp4";
        a.download = `recording.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
    downloadButton.visible = false;
    model.isWebcamVideoProperty.link((isWebcam) => {
      downloadButton.visible = isWebcam;
    });

    // ── Webcam panel and button ───────────────────────────────────────────
    this.webcamPanel = new WebcamPanel({
      model: model,
      onVideoReady: (blob, duration) => {
        this.webcamPanel.visible = false;
        // Store the recording in the model (this triggers a ComboBox rebuild)
        const recording = model.addWebcamRecording(blob, duration, model.frameRateProperty.value);
        model.currentWebcamBlobProperty.value = blob;
        // Select the new recording — the lazyLink handler loads it into the player
        lastLoadedValue = recording.id;
        selectedVideoProperty.value = recording.id;
        model.isWebcamVideoProperty.value = true;
        onWebcamReady(blob, duration);
      },
      onCancel: () => {
        this.webcamPanel.visible = false;
      },
    });
    this.webcamPanel.visible = false;

    const webcamButton = new CameraButton({
      baseColor: TrackLabColors.buttonBaseDarkProperty,
      iconFill: TrackLabColors.textOnDarkProperty,
      tandem: Tandem.OPT_OUT,
      accessibleName: "Record Webcam",
      listener: async () => {
        model.isPlayingProperty.value = false;
        this.webcamPanel.visible = true;
        await this.webcamPanel.open();
      },
    });

    this.children = [videoComboBox, downloadButton, webcamButton];
  }
}
