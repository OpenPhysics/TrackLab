import { DOM, HBox, Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Panel, TextPushButton } from "scenerystack/sun";
import { WebcamRecorder, fixWebmDuration } from "../../webcam.js";

const FONT = new PhetFont( 14 );
const TITLE_FONT = new PhetFont( { size: 16, weight: 'bold' } );

type WebcamPanelOptions = {
  onVideoReady: ( blob: Blob, duration: number ) => void;
  onCancel: () => void;
};

export class WebcamPanel extends Node {
  private readonly recorder = new WebcamRecorder();
  private readonly previewElement: HTMLVideoElement;
  private readonly reviewElement: HTMLVideoElement;
  private readonly cameraSelect: HTMLSelectElement;
  private readonly statusText: Text;
  private readonly previewLayer: Node;
  private readonly reviewLayer: Node;

  private recordedBlob: Blob | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private recordingStart = 0;

  public constructor( options: WebcamPanelOptions ) {
    super();

    // ── Camera select ─────────────────────────────────────────────────────
    this.cameraSelect = document.createElement( 'select' );
    this.cameraSelect.style.font = '14px sans-serif';
    this.cameraSelect.style.padding = '4px';
    const cameraSelectDOM = new DOM( this.cameraSelect, { allowInput: true } );

    this.cameraSelect.addEventListener( 'change', async () => {
      if ( !this.recorder.isRecording() ) {
        await this.recorder.startPreview( this.previewElement, this.cameraSelect.value || undefined );
      }
    } );

    // ── Preview video ─────────────────────────────────────────────────────
    this.previewElement = document.createElement( 'video' );
    this.previewElement.width = 480;
    this.previewElement.height = 270;
    this.previewElement.muted = true;
    this.previewElement.playsInline = true;
    this.previewElement.style.display = 'block';
    this.previewElement.style.background = '#000';
    const previewDOM = new DOM( this.previewElement, { allowInput: false } );

    // ── Review video ──────────────────────────────────────────────────────
    this.reviewElement = document.createElement( 'video' );
    this.reviewElement.width = 480;
    this.reviewElement.height = 270;
    this.reviewElement.controls = true;
    this.reviewElement.playsInline = true;
    this.reviewElement.style.display = 'block';
    this.reviewElement.style.background = '#000';
    const reviewDOM = new DOM( this.reviewElement, { allowInput: true } );

    // ── Status ────────────────────────────────────────────────────────────
    this.statusText = new Text( '', { font: FONT, fill: '#ddd' } );

    // ── Buttons: preview phase ────────────────────────────────────────────
    const cancelButton = new TextPushButton( 'Cancel', {
      font: FONT,
      listener: () => { this.cleanup(); options.onCancel(); },
    } );

    const startButton = new TextPushButton( 'Start Recording', {
      font: FONT,
      baseColor: '#c00',
      textFill: 'white',
      listener: () => this.startRecording(),
    } );

    const stopButton = new TextPushButton( 'Stop Recording', {
      font: FONT,
      baseColor: '#800',
      textFill: 'white',
      listener: () => this.stopRecording(),
    } );

    // ── Buttons: review phase ─────────────────────────────────────────────
    const rerecordButton = new TextPushButton( 'Re-record', {
      font: FONT,
      listener: () => this.goToPreview(),
    } );

    const useVideoButton = new TextPushButton( 'Use Video', {
      font: FONT,
      baseColor: '#2a2',
      textFill: 'white',
      listener: () => this.useVideo( options.onVideoReady ),
    } );

    // ── Layer: preview ────────────────────────────────────────────────────
    this.previewLayer = new VBox( {
      children: [
        new HBox( {
          children: [ new Text( 'Camera:', { font: FONT, fill: '#ddd' } ), cameraSelectDOM ],
          spacing: 8,
        } ),
        previewDOM,
        new HBox( {
          children: [ cancelButton, startButton, stopButton ],
          spacing: 10,
        } ),
      ],
      spacing: 10,
      align: 'center',
    } );

    // start/stop visible state managed by startRecording/stopRecording
    stopButton.visible = false;

    // ── Layer: review ─────────────────────────────────────────────────────
    this.reviewLayer = new VBox( {
      children: [
        reviewDOM,
        new HBox( {
          children: [ rerecordButton, useVideoButton ],
          spacing: 10,
        } ),
      ],
      spacing: 10,
      align: 'center',
    } );
    this.reviewLayer.visible = false;

    // ── Full panel ────────────────────────────────────────────────────────
    const content = new VBox( {
      children: [
        new Text( 'Record from Webcam', { font: TITLE_FONT, fill: 'white' } ),
        this.previewLayer,
        this.reviewLayer,
        this.statusText,
      ],
      spacing: 10,
      align: 'center',
    } );

    this.addChild( new Panel( content, {
      fill: 'rgba(20,20,40,0.97)',
      stroke: '#555',
      cornerRadius: 10,
      xMargin: 20,
      yMargin: 15,
    } ) );

    // keep button refs for toggling
    this._startButton = startButton;
    this._stopButton = stopButton;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _startButton: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _stopButton: any;

  // ── Public ───────────────────────────────────────────────────────────────

  public async open(): Promise<void> {
    // Reset UI to preview state without starting the camera yet (no permission yet).
    this.resetPreviewUI();
    this.setStatus( 'Requesting camera access…' );
    this._startButton.enabled = false;

    const granted = await this.recorder.requestPermission();
    if ( !granted ) {
      this.setStatus( 'Camera access denied.' );
      return;
    }

    await this.populateCameras();
    await this.recorder.startPreview( this.previewElement, this.cameraSelect.value || undefined );
    this.clearStatus();
    this._startButton.enabled = true;
  }

  // Reset visibility to preview phase without touching the camera stream.
  private resetPreviewUI(): void {
    if ( this.recordedBlob ) {
      URL.revokeObjectURL( this.reviewElement.src );
      this.reviewElement.src = '';
      this.recordedBlob = null;
    }
    this.previewLayer.visible = true;
    this.reviewLayer.visible = false;
    this._startButton.visible = true;
    this._stopButton.visible = false;
    this.clearStatus();
  }

  public cleanup(): void {
    this.stopTimer();
    this.recorder.cleanup();
    if ( this.recordedBlob ) {
      URL.revokeObjectURL( this.reviewElement.src );
      this.recordedBlob = null;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private setStatus( msg: string ): void { this.statusText.string = msg; }
  private clearStatus(): void { this.statusText.string = ''; }

  private async populateCameras(): Promise<void> {
    const cameras = await this.recorder.getAvailableCameras();
    this.cameraSelect.innerHTML = '';
    cameras.forEach( ( cam, i ) => {
      const opt = document.createElement( 'option' );
      opt.value = cam.deviceId;
      opt.textContent = cam.label || `Camera ${ i + 1 }`;
      this.cameraSelect.appendChild( opt );
    } );
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
    this.setStatus( 'Processing…' );

    this.recordedBlob = await this.recorder.stopRecording();
    this.recorder.stopPreview();

    this.previewLayer.visible = false;
    this.reviewLayer.visible = true;
    this.reviewElement.src = URL.createObjectURL( this.recordedBlob );
    this.clearStatus();
  }

  private async goToPreview(): Promise<void> {
    this.resetPreviewUI();
    this._startButton.enabled = false;
    await this.recorder.startPreview( this.previewElement, this.cameraSelect.value || undefined );
    this._startButton.enabled = true;
  }

  private async useVideo( cb: ( blob: Blob, duration: number ) => void ): Promise<void> {
    if ( !this.recordedBlob ) return;
    this.setStatus( 'Fixing video metadata…' );

    let blob = this.recordedBlob;
    let duration = 0;

    if ( blob.type.includes( 'webm' ) ) {
      const fixed = await fixWebmDuration( blob );
      blob = fixed.blob;
      duration = fixed.duration;
    }

    this.cleanup();
    cb( blob, duration );
  }

  private startTimer(): void {
    this.timerInterval = setInterval( () => {
      const secs = Math.floor( ( Date.now() - this.recordingStart ) / 1000 );
      const m = Math.floor( secs / 60 ).toString().padStart( 2, '0' );
      const s = ( secs % 60 ).toString().padStart( 2, '0' );
      this.setStatus( `● Recording ${ m }:${ s }` );
    }, 1000 );
  }

  private stopTimer(): void {
    if ( this.timerInterval ) {
      clearInterval( this.timerInterval );
      this.timerInterval = null;
    }
  }
}
