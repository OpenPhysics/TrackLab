/**
 * VideoSourceModel.ts
 *
 * Reactive state for video source management: webcam recordings, uploaded
 * videos, the currently active video blob, and whether the active video is
 * user-provided. Extracted from SimModel to keep source management concerns
 * separate from playback and track management.
 */

import { BooleanProperty, Property } from "scenerystack/axon";
import trackLab from "../../TrackLabNamespace.js";
import { extractVideoFileMetadata } from "../../webcam.js";
import { DEFAULT_FRAME_RATE } from "./VideoPlaybackModel.js";

// ── Webcam recording entry ────────────────────────────────────────────────
export type WebcamRecording = {
  id: string;
  blob: Blob;
  num: number;
  duration: number;
  fps: number;
  timestamp: number;
};

// ── Uploaded video entry ─────────────────────────────────────────────────
export type UploadedVideo = {
  id: string;
  blob: Blob;
  num: number;
  name: string;
  duration: number;
  fps: number;
  /** Actual frame count from countWebmFrames / getAnimatedWebPInfo, or undefined if unknown. */
  frameCount?: number;
  timestamp: number;
};

/**
 * Owns all reactive state for video source management: the list of webcam
 * recordings, the list of uploaded videos, the currently active blob, and
 * the flag that indicates whether the current video is user-provided.
 */
export class VideoSourceModel {
  // True when the active video is user-provided (webcam recording or upload);
  // false for bundled sample videos. Controls FPS editing and download button.
  public readonly isUserVideoProperty = new BooleanProperty(false);

  // ── Webcam recordings storage ──────────────────────────────────────────
  public readonly webcamRecordingsProperty = new Property<readonly WebcamRecording[]>([]);
  public readonly currentWebcamBlobProperty = new Property<Blob | null>(null);
  private nextRecordingNumber = 1;

  // ── Uploaded videos storage ────────────────────────────────────────────
  public readonly uploadedVideosProperty = new Property<readonly UploadedVideo[]>([]);
  private nextUploadNumber = 1;

  public addWebcamRecording(blob: Blob, duration: number, fps: number): WebcamRecording {
    const num = this.nextRecordingNumber;
    this.nextRecordingNumber++;
    const recording: WebcamRecording = {
      id: `recording-${num}`,
      blob,
      num,
      duration,
      fps,
      timestamp: Date.now(),
    };
    this.webcamRecordingsProperty.value = [...this.webcamRecordingsProperty.value, recording];
    return recording;
  }

  public addUploadedVideo(
    blob: Blob,
    name: string,
    duration: number,
    fps = DEFAULT_FRAME_RATE,
    frameCount?: number,
  ): UploadedVideo {
    const num = this.nextUploadNumber;
    this.nextUploadNumber++;
    const upload: UploadedVideo = {
      id: `upload-${num}`,
      blob,
      num,
      name,
      duration,
      fps,
      ...(frameCount !== undefined ? { frameCount } : {}),
      timestamp: Date.now(),
    };
    this.uploadedVideosProperty.value = [...this.uploadedVideosProperty.value, upload];
    return upload;
  }

  /**
   * Extract metadata from an uploaded file and add it to the uploads list.
   * Handles animated WebP, WebM, and generic video formats.
   * The view is responsible for creating a blob URL and loading it into the
   * video element after receiving the returned UploadedVideo.
   */
  public async addUploadedVideoFromFile(file: File): Promise<UploadedVideo> {
    const meta = await extractVideoFileMetadata(file, DEFAULT_FRAME_RATE);
    return this.addUploadedVideo(file, file.name, meta.duration, meta.fps, meta.frameCount);
  }

  public reset(): void {
    this.isUserVideoProperty.reset();
    this.webcamRecordingsProperty.value = [];
    this.currentWebcamBlobProperty.value = null;
    this.nextRecordingNumber = 1;
    this.uploadedVideosProperty.value = [];
    this.nextUploadNumber = 1;
  }
}

trackLab.register("VideoSourceModel", VideoSourceModel);
