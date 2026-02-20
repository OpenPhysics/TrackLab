import type { TReadOnlyProperty } from "scenerystack/axon";
import { Property } from "scenerystack/axon";
import { HBox, type Node, Text } from "scenerystack/scenery";
import { CameraButton, PhetFont } from "scenerystack/scenery-phet";
import { ComboBox, type ComboBoxItem } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import TrackLabColors from "../../TrackLabColors.js";
import { DEFAULT_FRAME_RATE, type SimModel } from "../model/SimModel.js";
import { WebcamPanel } from "./WebcamPanel.js";

const LABEL_FONT = new PhetFont(14);
const CONTROLS_SPACING = 12; // gap between video combo box and webcam button

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
 * Video source selection controls: combo box for bundled videos and webcam button.
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

    const selectedVideoProperty = new Property<string | null>(null);

    const comboItems: ComboBoxItem<string | null>[] = [
      {
        value: null,
        createNode: () =>
          new Text(uiStrings.selectVideoStringProperty, {
            font: LABEL_FONT,
            fill: TrackLabColors.textOnDarkProperty,
          }),
        tandemName: "selectVideoItem",
      },
      ...VIDEO_FILES.map((v) => ({
        value: v.filename,
        createNode: () =>
          new Text(v.labelProperty, {
            font: LABEL_FONT,
            fill: TrackLabColors.textOnDarkProperty,
          }),
        tandemName: v.tandemName,
      })),
    ];

    const videoComboBox = new ComboBox(
      selectedVideoProperty,
      comboItems,
      listParent,
      {
        buttonFill: TrackLabColors.comboBoxButtonFillProperty,
        listFill: TrackLabColors.comboBoxListFillProperty,
        highlightFill: TrackLabColors.comboBoxHighlightFillProperty,
      },
    );

    selectedVideoProperty.lazyLink((filename) => {
      if (filename) {
        const videoInfo = VIDEO_FILES.find((v) => v.filename === filename);
        const fps = videoInfo?.fps ?? DEFAULT_FRAME_RATE;
        // Mark as pre-recorded video (not webcam)
        model.isWebcamVideoProperty.value = false;
        onVideoSelected(`./videos/${filename}`, fps);
      }
    });

    this.webcamPanel = new WebcamPanel({
      model: model,
      onVideoReady: (blob, duration) => {
        this.webcamPanel.visible = false;
        // Mark as webcam video
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

    this.children = [videoComboBox, webcamButton];
  }
}
