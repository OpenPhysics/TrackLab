/**
 * WebcamPanel.ts
 *
 * Dialog for recording videos from a connected webcam. Handles device selection,
 * live preview, recording controls, and frame rate configuration.
 */

import { Property } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { DOM, HBox, Node, Path, Text, VBox } from "scenerystack/scenery";
import { CloseButton, PhetFont, RefreshButton, StopIconShape } from "scenerystack/scenery-phet";
import { ButtonNode, cameraSolidShape, checkSolidShape, NumberPicker, Panel } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import { createTrackLabButton } from "../../TrackLabButton.js";
import TrackLabColors from "../../TrackLabColors.js";
import { WEBCAM_PREVIEW_HEIGHT, WEBCAM_PREVIEW_WIDTH } from "../../TrackLabConstants.js";
import { estimateVideoFrameRate, type FPSEstimate, fixWebmDuration, WebcamRecorder } from "../../webcam.js";
import { FRAME_RATE_RANGE, type SimModel } from "../model/SimModel.js";

const FONT = new PhetFont(14);
const SMALL_FONT = new PhetFont(12);
const STOP_ICON_SIZE = 14;
const REFRESH_ICON_HEIGHT = 20;
const CHECK_ICON_SCALE = 0.35;
const CAMERA_ICON_SCALE = 0.4; // camera icon next to the select dropdown
const TITLE_CAMERA_ICON_SCALE = 0.6; // larger camera icon in the panel title
const RECORD_ICON_RADIUS = 8; // circle radius for the record button icon
const PANEL_CORNER_RADIUS = 10;
const PANEL_X_MARGIN = 20;
const PANEL_Y_MARGIN = 15;
const LAYER_SPACING = 10; // VBox spacing between elements within each layer
const CAMERA_ROW_SPACING = 8; // HBox spacing between camera icon and select
const FPS_CONTROL_SPACING = 6; // gap between "fps:" label and picker
const FPS_PICKER_SCALE = 0.7;
const CAMERA_SELECT_FONT = "14px sans-serif"; // CSS font for the native <select> element
const CAMERA_SELECT_PADDING = "4px"; // CSS padding for the native <select> element
const TIMER_INTERVAL_MS = 1000; // ms between recording-timer display updates
const SECONDS_PER_MINUTE = 60; // conversion factor for mm:ss timer formatting

/** Configuration passed to WebcamPanel at construction time. */
type WebcamPanelOptions = {
  /** Simulation model; used to write the detected frame rate. */
  model: SimModel;
  /** Called with the recorded blob and its duration when the user confirms the video. */
  onVideoReady: (blob: Blob, duration: number) => void;
  /** Called when the user dismisses the panel without confirming a recording. */
  onCancel: () => void;
};

/**
 * Modal panel for recording video from a webcam.
 *
 * Two phases:
 *  - **Preview**: live camera feed with camera selector, start, and stop buttons.
 *  - **Review**: recorded video playback with frame-rate estimation, a re-record
 *    option, and a "Use Video" button that fires `onVideoReady`.
 *
 * The panel is hidden by default; call `open()` to request camera permission and
 * begin the preview. Call `cleanup()` to release all camera resources.
 */
export class WebcamPanel extends Node {
  private readonly recorder = new WebcamRecorder();
  private readonly previewElement: HTMLVideoElement;
  private readonly reviewElement: HTMLVideoElement;
  private readonly cameraSelect: HTMLSelectElement;
  private readonly statusText: Text;
  private readonly fpsEstimateText: Text;
  private readonly previewLayer: Node;
  private readonly reviewLayer: Node;
  private readonly model: SimModel;

  private recordedBlob: Blob | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private recordingStart = 0;
  private fpsEstimate: FPSEstimate | null = null;

  public constructor(options: WebcamPanelOptions) {
    super();
    this.model = options.model;
    this.webcamStrings = StringManager.getInstance().getWebcam();

    // ── Camera select ─────────────────────────────────────────────────────
    this.cameraSelect = document.createElement("select");
    this.cameraSelect.style.font = CAMERA_SELECT_FONT;
    this.cameraSelect.style.padding = CAMERA_SELECT_PADDING;
    const cameraSelectDom = new DOM(this.cameraSelect, { allowInput: true });

    this.cameraSelect.addEventListener("change", async () => {
      if (!this.recorder.isRecording()) {
        await this.recorder.startPreview(this.previewElement, this.cameraSelect.value || undefined);
      }
    });

    // ── Preview video ─────────────────────────────────────────────────────
    this.previewElement = document.createElement("video");
    this.previewElement.width = WEBCAM_PREVIEW_WIDTH;
    this.previewElement.height = WEBCAM_PREVIEW_HEIGHT;
    this.previewElement.muted = true;
    this.previewElement.playsInline = true;
    this.previewElement.style.display = "block";
    TrackLabColors.videoBackgroundColorProperty.link((c) => {
      this.previewElement.style.background = c.toCSS();
    });
    const previewDom = new DOM(this.previewElement, { allowInput: false });

    // ── Review video ──────────────────────────────────────────────────────
    this.reviewElement = document.createElement("video");
    this.reviewElement.width = WEBCAM_PREVIEW_WIDTH;
    this.reviewElement.height = WEBCAM_PREVIEW_HEIGHT;
    this.reviewElement.controls = true;
    this.reviewElement.playsInline = true;
    this.reviewElement.style.display = "block";
    TrackLabColors.videoBackgroundColorProperty.link((c) => {
      this.reviewElement.style.background = c.toCSS();
    });
    const reviewDom = new DOM(this.reviewElement, { allowInput: true });

    // ── Status ────────────────────────────────────────────────────────────
    this.statusText = new Text("", {
      font: FONT,
      fill: TrackLabColors.textMutedProperty,
    });

    // ── FPS Estimate Display ──────────────────────────────────────────────
    this.fpsEstimateText = new Text("", {
      font: SMALL_FONT,
      fill: TrackLabColors.textMutedProperty,
    });

    // ── Buttons: preview phase ────────────────────────────────────────────
    const cancelButton = new CloseButton({
      baseColor: TrackLabColors.buttonBaseDarkerProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      pathOptions: { stroke: TrackLabColors.textOnDarkProperty },
      tandem: Tandem.OPT_OUT,
      accessibleName: this.webcamStrings.cancelStringProperty,
      listener: () => {
        this.cleanup();
        options.onCancel();
      },
    });

    const recordIcon = new Path(Shape.circle(0, 0, RECORD_ICON_RADIUS), {
      fill: TrackLabColors.textOnDarkProperty,
    });
    const startButton = createTrackLabButton(recordIcon, {
      baseColor: TrackLabColors.buttonRecordProperty,
      accessibleName: this.webcamStrings.startRecordingStringProperty,
      listener: () => this.startRecording(),
    });

    const stopIcon = new Path(new StopIconShape(STOP_ICON_SIZE), {
      fill: TrackLabColors.textOnDarkProperty,
    });
    const stopButton = createTrackLabButton(stopIcon, {
      baseColor: TrackLabColors.buttonStopProperty,
      accessibleName: this.webcamStrings.stopRecordingStringProperty,
      listener: () => this.stopRecording(),
    });

    // ── Buttons: review phase ─────────────────────────────────────────────
    const rerecordButton = new RefreshButton({
      baseColor: TrackLabColors.buttonBaseDarkerProperty,
      buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
      iconHeight: REFRESH_ICON_HEIGHT,
      tandem: Tandem.OPT_OUT,
      accessibleName: this.webcamStrings.reRecordStringProperty,
      listener: () => this.goToPreview(),
    });

    const useVideoIcon = new Path(checkSolidShape, {
      scale: CHECK_ICON_SCALE,
      fill: TrackLabColors.textOnDarkProperty,
    });
    const useVideoButton = createTrackLabButton(useVideoIcon, {
      baseColor: TrackLabColors.buttonSuccessProperty,
      accessibleName: this.webcamStrings.useVideoStringProperty,
      listener: () => this.useVideo(options.onVideoReady),
    });

    // ── Frame rate control (only for webcam videos) ───────────────────────
    const uiStrings = StringManager.getInstance().getUI();
    const fpsLabel = new Text(uiStrings.fpsStringProperty, {
      font: SMALL_FONT,
      fill: TrackLabColors.textMutedProperty,
    });

    const fpsPicker = new NumberPicker(this.model.frameRateProperty, new Property(FRAME_RATE_RANGE), {
      font: SMALL_FONT,
      scale: FPS_PICKER_SCALE,
      touchAreaXDilation: 10,
      touchAreaYDilation: 5,
      tandem: Tandem.OPT_OUT,
    });

    const fpsControl = new HBox({
      children: [fpsLabel, fpsPicker],
      spacing: FPS_CONTROL_SPACING,
      align: "center",
    });

    // ── Layer: preview ────────────────────────────────────────────────────
    const cameraIcon = new Path(cameraSolidShape, {
      scale: CAMERA_ICON_SCALE,
      fill: TrackLabColors.textMutedProperty,
      accessibleName: this.webcamStrings.cameraStringProperty,
    });
    this.previewLayer = new VBox({
      children: [
        new HBox({
          children: [cameraIcon, cameraSelectDom],
          spacing: CAMERA_ROW_SPACING,
          align: "center",
        }),
        previewDom,
        new HBox({
          children: [cancelButton, startButton, stopButton],
          spacing: LAYER_SPACING,
        }),
      ],
      spacing: LAYER_SPACING,
      align: "center",
    });

    // start/stop visible state managed by startRecording/stopRecording
    stopButton.visible = false;

    // ── Layer: review ─────────────────────────────────────────────────────
    this.reviewLayer = new VBox({
      children: [
        reviewDom,
        this.fpsEstimateText,
        fpsControl,
        new HBox({
          children: [rerecordButton, useVideoButton],
          spacing: LAYER_SPACING,
        }),
      ],
      spacing: LAYER_SPACING,
      align: "center",
    });
    this.reviewLayer.visible = false;

    // ── Full panel ────────────────────────────────────────────────────────
    const titleIcon = new Path(cameraSolidShape, {
      scale: TITLE_CAMERA_ICON_SCALE,
      fill: TrackLabColors.textOnDarkProperty,
      accessibleName: this.webcamStrings.recordFromWebcamStringProperty,
    });
    const content = new VBox({
      children: [titleIcon, this.previewLayer, this.reviewLayer, this.statusText],
      spacing: LAYER_SPACING,
      align: "center",
    });

    this.addChild(
      new Panel(content, {
        fill: TrackLabColors.webcamPanelFillProperty,
        stroke: TrackLabColors.panelStrokeProperty,
        cornerRadius: PANEL_CORNER_RADIUS,
        xMargin: PANEL_X_MARGIN,
        yMargin: PANEL_Y_MARGIN,
      }),
    );

    // keep button refs for toggling
    this._startButton = startButton;
    this._stopButton = stopButton;
  }

  private readonly _startButton: ReturnType<typeof createTrackLabButton>;
  private readonly _stopButton: ReturnType<typeof createTrackLabButton>;
  private readonly webcamStrings: ReturnType<StringManager["getWebcam"]>;

  // ── Public ───────────────────────────────────────────────────────────────

  /**
   * Request camera permission, populate the camera selector, and start the
   * live preview. Must be called before the panel is shown to the user.
   * If permission is denied the panel displays an error status and returns.
   */
  public async open(): Promise<void> {
    // Reset UI to preview state without starting the camera yet (no permission yet).
    this.resetPreviewUI();
    this.setStatus(this.webcamStrings.requestingAccessStringProperty.value);
    this._startButton.enabled = false;

    const granted = await this.recorder.requestPermission();
    if (!granted) {
      this.setStatus(this.webcamStrings.accessDeniedStringProperty.value);
      return;
    }

    await this.populateCameras();
    await this.recorder.startPreview(this.previewElement, this.cameraSelect.value || undefined);
    this.clearStatus();
    this._startButton.enabled = true;
  }

  // Reset visibility to preview phase without touching the camera stream.
  private resetPreviewUI(): void {
    if (this.recordedBlob) {
      URL.revokeObjectURL(this.reviewElement.src);
      this.reviewElement.src = "";
      this.recordedBlob = null;
    }
    this.fpsEstimate = null;
    this.fpsEstimateText.string = "";
    this.previewLayer.visible = true;
    this.reviewLayer.visible = false;
    this._startButton.visible = true;
    this._stopButton.visible = false;
    this.clearStatus();
  }

  /**
   * Stop the recording timer, release all camera tracks, and revoke any
   * outstanding blob URL. Safe to call multiple times.
   */
  public cleanup(): void {
    this.stopTimer();
    this.recorder.cleanup();
    if (this.recordedBlob) {
      URL.revokeObjectURL(this.reviewElement.src);
      this.recordedBlob = null;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private setStatus(msg: string): void {
    this.statusText.string = msg;
  }
  private clearStatus(): void {
    this.statusText.string = "";
  }

  private async populateCameras(): Promise<void> {
    const cameras = await this.recorder.getAvailableCameras();
    this.cameraSelect.innerHTML = "";
    cameras.forEach((cam, i) => {
      const opt = document.createElement("option");
      opt.value = cam.deviceId;
      opt.textContent =
        cam.label || this.webcamStrings.cameraLabelStringProperty.value.replace("{{number}}", String(i + 1));
      this.cameraSelect.appendChild(opt);
    });
  }

  private startRecording(): void {
    this.recorder.startRecording();
    this._startButton.visible = false;
    this._stopButton.visible = true;
    this.recordingStart = Date.now();
    this.startTimer();
  }

  private async stopRecording(): Promise<void> {
    this.stopTimer();
    this._stopButton.visible = false;
    this.setStatus(this.webcamStrings.processingStringProperty.value);

    // CRITICAL: Capture stream FPS BEFORE stopping the stream!
    // Once tracks are stopped, getSettings() returns stale/invalid data.
    const stream = this.recorder.getStream();
    const streamFps = stream ? this.recorder.getFrameRate() : null;

    this.recordedBlob = await this.recorder.stopRecording();
    this.recorder.stopPreview(); // This stops all tracks - stream settings now invalid!

    this.previewLayer.visible = false;
    this.reviewLayer.visible = true;
    this.reviewElement.src = URL.createObjectURL(this.recordedBlob);

    // Estimate FPS and update the display
    this.setStatus(this.webcamStrings.estimatingFrameRateStringProperty.value);
    try {
      // Pass the pre-captured stream FPS if available
      if (streamFps && streamFps > 0) {
        this.fpsEstimate = {
          fps: Math.round(streamFps),
          confidence: "high",
          method: "stream settings",
        };
      } else {
        // Fallback to empirical measurement from the recorded video
        this.fpsEstimate = await estimateVideoFrameRate(this.reviewElement, null);
      }
      this.updateFPSEstimateDisplay();
      // Set the estimated FPS as the initial value
      this.model.frameRateProperty.value = this.fpsEstimate.fps;
    } catch (_error) {
      this.fpsEstimateText.string = "";
    }

    this.clearStatus();
  }

  private async goToPreview(): Promise<void> {
    this.resetPreviewUI();
    this._startButton.enabled = false;
    try {
      await this.recorder.startPreview(this.previewElement, this.cameraSelect.value || undefined);
      this._startButton.enabled = true;
    } catch {
      this.setStatus(this.webcamStrings.accessDeniedStringProperty.value);
    }
  }

  private async useVideo(cb: (blob: Blob, duration: number) => void): Promise<void> {
    if (!this.recordedBlob) {
      return;
    }
    this.setStatus(this.webcamStrings.fixingMetadataStringProperty.value);

    let blob = this.recordedBlob;
    let duration = 0;

    if (blob.type.includes("webm")) {
      try {
        const fixed = await fixWebmDuration(blob);
        blob = fixed.blob;
        duration = fixed.duration;
      } catch {
        // Fall back to the raw blob with unknown duration
      }
    }

    this.cleanup();
    cb(blob, duration);
  }

  private updateFPSEstimateDisplay(): void {
    if (!this.fpsEstimate) {
      this.fpsEstimateText.string = "";
      return;
    }

    const { fps, confidence, method } = this.fpsEstimate;

    // Create confidence indicator
    const confidenceSymbol = confidence === "high" ? "✓" : confidence === "medium" ? "~" : "?";

    // Format the display string
    const confidenceText =
      confidence === "high"
        ? this.webcamStrings.highConfidenceStringProperty.value
        : confidence === "medium"
          ? this.webcamStrings.mediumConfidenceStringProperty.value
          : this.webcamStrings.lowConfidenceStringProperty.value;

    this.fpsEstimateText.string = this.webcamStrings.estimatedFpsStringProperty.value
      .replace("{{fps}}", String(fps))
      .replace("{{symbol}}", confidenceSymbol)
      .replace("{{confidence}}", confidenceText)
      .replace("{{method}}", method);
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      const secs = Math.floor((Date.now() - this.recordingStart) / TIMER_INTERVAL_MS);
      const m = Math.floor(secs / SECONDS_PER_MINUTE)
        .toString()
        .padStart(2, "0");
      const s = (secs % SECONDS_PER_MINUTE).toString().padStart(2, "0");
      this.setStatus(this.webcamStrings.recordingStringProperty.value.replace("{{time}}", `${m}:${s}`));
    }, TIMER_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public override dispose(): void {
    this.cleanup();
    super.dispose();
  }
}
