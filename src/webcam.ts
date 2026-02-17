/**
 * WebcamRecorder class for camera access, preview, and recording.
 * Handles MediaStream, MediaRecorder, and device enumeration.
 */

/**
 * Get a supported MIME type for MediaRecorder.
 * Prioritizes WebM formats for best browser support, falls back to MP4.
 */
export function getSupportedMimeType(): string {
	const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
	return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

/**
 * Fix WebM blob duration by seeking to the end to force browser to calculate it.
 * WebM files from MediaRecorder often have Infinity duration until seeked.
 */
export function fixWebmDuration(blob: Blob): Promise<{ blob: Blob; duration: number }> {
	return new Promise((resolve, reject) => {
		const video = document.createElement('video');
		video.preload = 'metadata';

		const blobUrl = URL.createObjectURL(blob);
		video.src = blobUrl;

		video.onloadedmetadata = () => {
			// If duration is already valid, return immediately
			if (Number.isFinite(video.duration) && video.duration > 0) {
				const duration = video.duration;
				URL.revokeObjectURL(blobUrl);
				resolve({ blob, duration });
				return;
			}

			// Seek to a very large time to force duration calculation
			video.currentTime = Number.MAX_SAFE_INTEGER;
		};

		video.onseeked = () => {
			// Now duration should be available
			const duration = video.duration;
			video.currentTime = 0; // Reset to beginning
			URL.revokeObjectURL(blobUrl);

			if (Number.isFinite(duration) && duration > 0) {
				resolve({ blob, duration });
			} else {
				reject(new Error('Could not determine video duration'));
			}
		};

		video.onerror = () => {
			URL.revokeObjectURL(blobUrl);
			reject(new Error('Failed to load video for duration fix'));
		};

		// Timeout after 10 seconds
		setTimeout(() => {
			URL.revokeObjectURL(blobUrl);
			reject(new Error('Timeout while fixing video duration'));
		}, 10000);
	});
}

export class WebcamRecorder {
	private stream: MediaStream | null = null;
	private mediaRecorder: MediaRecorder | null = null;
	private recordedChunks: Blob[] = [];
	private previewElement: HTMLVideoElement | null = null;
	private currentDeviceId: string | null = null;

	/**
	 * Request camera permission and get available devices.
	 * Returns true if permission was granted.
	 */
	async requestPermission(): Promise<boolean> {
		try {
			// Request a temporary stream to trigger permission prompt
			const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
			// Stop the temporary stream
			for (const track of tempStream.getTracks()) {
				track.stop();
			}
			return true;
		} catch (err) {
			console.error('Camera permission denied:', err);
			return false;
		}
	}

	/**
	 * Get a list of available video input devices (cameras).
	 */
	async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter((device) => device.kind === 'videoinput');
	}

	/**
	 * Start the camera preview on the specified video element.
	 * @param previewEl - The video element to display the preview
	 * @param deviceId - Optional device ID to use a specific camera
	 */
	async startPreview(previewEl: HTMLVideoElement, deviceId?: string): Promise<void> {
		// Stop any existing stream first
		this.stopPreview();

		const constraints: MediaStreamConstraints = {
			video: deviceId ? { deviceId: { exact: deviceId } } : true,
			audio: false,
		};

		this.stream = await navigator.mediaDevices.getUserMedia(constraints);
		this.previewElement = previewEl;
		this.previewElement.srcObject = this.stream;
		this.currentDeviceId = deviceId || null;

		await this.previewElement.play();
	}

	/**
	 * Stop the camera preview and release the stream.
	 */
	stopPreview(): void {
		if (this.stream) {
			for (const track of this.stream.getTracks()) {
				track.stop();
			}
			this.stream = null;
		}
		if (this.previewElement) {
			this.previewElement.srcObject = null;
		}
	}

	/**
	 * Start recording from the current stream.
	 * Must call startPreview first.
	 */
	startRecording(): void {
		if (!this.stream) {
			throw new Error('No active stream. Call startPreview first.');
		}

		this.recordedChunks = [];
		const mimeType = getSupportedMimeType();

		const options: MediaRecorderOptions = {};
		if (mimeType) {
			options.mimeType = mimeType;
		}

		this.mediaRecorder = new MediaRecorder(this.stream, options);

		this.mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				this.recordedChunks.push(event.data);
			}
		};

		this.mediaRecorder.start(100); // Collect data every 100ms
	}

	/**
	 * Stop recording and return the recorded video as a Blob.
	 */
	stopRecording(): Promise<Blob> {
		return new Promise((resolve, reject) => {
			if (!this.mediaRecorder) {
				reject(new Error('No active recording.'));
				return;
			}

			this.mediaRecorder.onstop = () => {
				const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
				const blob = new Blob(this.recordedChunks, { type: mimeType });
				this.recordedChunks = [];
				resolve(blob);
			};

			this.mediaRecorder.onerror = (event) => {
				reject(event);
			};

			this.mediaRecorder.stop();
		});
	}

	/**
	 * Check if currently recording.
	 */
	isRecording(): boolean {
		return this.mediaRecorder?.state === 'recording';
	}

	/**
	 * Check if preview is active.
	 */
	isPreviewActive(): boolean {
		return this.stream?.active ?? false;
	}

	/**
	 * Get the current device ID being used.
	 */
	getCurrentDeviceId(): string | null {
		return this.currentDeviceId;
	}

	/**
	 * Clean up all resources.
	 */
	cleanup(): void {
		if (this.mediaRecorder?.state === 'recording') {
			this.mediaRecorder.stop();
		}
		this.stopPreview();
		this.mediaRecorder = null;
		this.recordedChunks = [];
	}
}
