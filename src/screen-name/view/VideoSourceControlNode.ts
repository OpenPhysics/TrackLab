import { Property } from "scenerystack/axon";
import { HBox, Node, Text } from "scenerystack/scenery";
import { CameraButton, PhetFont } from "scenerystack/scenery-phet";
import { ComboBox, type ComboBoxItem } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import TrackLabColors from "../../TrackLabColors.js";
import type { SimModel } from "../model/SimModel.js";
import { WebcamPanel } from "./WebcamPanel.js";

const LABEL_FONT = new PhetFont(14);

// Bundled video files with known frame rates
const VIDEO_FILES = [
  { label: "Ball in Oil", filename: "ball_oil.mp4", fps: 30, tandemName: "ballOilItem" },
  { label: "Bouncing Cart", filename: "bouncing_cart.mp4", fps: 30, tandemName: "bouncingCartItem" },
  { label: "Cart Pendulum", filename: "cart_pendulum.mp4", fps: 30, tandemName: "cartPendulumItem" },
  { label: "Cups Clips", filename: "CupsClips.mp4", fps: 30, tandemName: "cupsClipsItem" },
  { label: "Parachute Monkey", filename: "parachute_monkey.mp4", fps: 30, tandemName: "parachuteMonkeyItem" },
  { label: "Pendulum", filename: "Pendulum.mp4", fps: 30, tandemName: "pendulumItem" },
  { label: "Pendulum Drag", filename: "pendulum_drag.mp4", fps: 30, tandemName: "pendulumDragItem" },
  { label: "Pucks Collide", filename: "PucksCollide.mp4", fps: 30, tandemName: "pucksCollideItem" },
  { label: "Spring Wars", filename: "spring_wars.mp4", fps: 30, tandemName: "springWarsItem" },
] as const;

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
    super({ spacing: 12 });

    const selectedVideoProperty = new Property<string | null>(null);

    const comboItems: ComboBoxItem<string | null>[] = [
      {
        value: null,
        createNode: () => new Text("— select a video —", { font: LABEL_FONT }),
        tandemName: "selectVideoItem",
      },
      ...VIDEO_FILES.map((v) => ({
        value: v.filename,
        createNode: () => new Text(v.label, { font: LABEL_FONT }),
        tandemName: v.tandemName,
      })),
    ];

    const videoComboBox = new ComboBox(
      selectedVideoProperty,
      comboItems,
      listParent,
    );

    selectedVideoProperty.lazyLink((filename) => {
      if (filename) {
        const videoInfo = VIDEO_FILES.find((v) => v.filename === filename);
        const fps = videoInfo?.fps ?? 30;
        onVideoSelected(`./videos/${filename}`, fps);
      }
    });

    this.webcamPanel = new WebcamPanel({
      onVideoReady: (blob, duration) => {
        this.webcamPanel.visible = false;
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
