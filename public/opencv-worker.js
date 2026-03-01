'use strict';

/**
 * Web Worker for OpenCV template matching.
 *
 * All OpenCV operations (WASM load, cvtColor, matchTemplate) run here on a
 * dedicated OS thread, so the main thread is never blocked.
 *
 * Protocol (every message carries a numeric `id` for stale-response filtering):
 *   main → worker  { id, type: 'init',    imageData, region }
 *   worker → main  { id, type: 'init-done', templateW, templateH, centerX, centerY }
 *
 *   main → worker  { id, type: 'track',   imageData, searchX, searchY }
 *   worker → main  { id, type: 'track-result', x, y, confidence }
 *
 *   main → worker  { id: -1, type: 'dispose' }   (no response)
 *
 *   worker → main  { id, type: 'error', message }  (on any failure)
 */

let cv = null;
let templateMat = null;

// Singleton Promise so concurrent init messages share one importScripts call.
let cvLoadPromise = null;

function _doLoadOpenCV() {
  // importScripts is synchronous — it blocks this worker thread (not the main
  // thread) until opencv.js is parsed and the Emscripten wrapper is set up.
  importScripts('./opencv.js');

  return new Promise((resolve, reject) => {
    const raw = self.cv;
    if (!raw) {
      reject(new Error('cv not defined after importScripts'));
      return;
    }
    // Already fully initialised (Mat constructor available).
    if (typeof raw.Mat === 'function') {
      cv = raw;
      resolve(undefined);
      return;
    }
    // Wait for the Emscripten WASM initialisation callback.
    const timer = setTimeout(
      () => reject(new Error('OpenCV WASM initialisation timed out')),
      30_000,
    );
    raw.onRuntimeInitialized = () => {
      clearTimeout(timer);
      if (typeof raw.Mat === 'function') {
        cv = raw;
        resolve(undefined);
      } else {
        reject(new Error('OpenCV did not initialise correctly'));
      }
    };
  });
}

function ensureOpenCV() {
  if (!cvLoadPromise) {
    cvLoadPromise = _doLoadOpenCV();
    cvLoadPromise.catch(() => {
      cvLoadPromise = null; // Allow retry on next init message.
    });
  }
  return cvLoadPromise;
}

// Gaussian blur kernel applied to both the captured template and every search
// window before matching.  A 5×5 kernel (σ ≈ 1.1 px) smooths per-frame sensor
// noise and compression artefacts without blurring object edges enough to
// degrade match precision.  Because the same filter is applied at both init
// time (template) and track time (search region), the template and the search
// image remain in the same frequency domain and TM_CCOEFF_NORMED scores stay
// reliable.  This is tuned for a stationary camera where the background is
// static and sensor noise is the dominant source of inter-frame variation.
function blurGray(src, dst) {
  // cv.Size is a plain JS value type, not a WASM heap object — no .delete() needed.
  const ksize = new cv.Size(5, 5);
  cv.GaussianBlur(src, dst, ksize, 0);
}

self.onmessage = async (event) => {
  const msg = event.data;
  const { id, type } = msg;

  try {
    if (type === 'init') {
      await ensureOpenCV();

      const { imageData, region } = msg;
      const frame = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      const blurred = new cv.Mat();
      try {
        cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

        const clampedX = Math.round(Math.max(0, region.x));
        const clampedY = Math.round(Math.max(0, region.y));
        const roiW = Math.round(Math.min(region.w, imageData.width - clampedX));
        const roiH = Math.round(Math.min(region.h, imageData.height - clampedY));

        if (roiW <= 0 || roiH <= 0) {
          throw new Error(`Invalid ROI dimensions: ${roiW}x${roiH}`);
        }

        // Blur before cropping the ROI so the template is in the same
        // frequency domain as the blurred search regions used during tracking.
        blurGray(gray, blurred);

        if (templateMat) templateMat.delete();
        const roi = new cv.Rect(clampedX, clampedY, roiW, roiH);
        templateMat = blurred.roi(roi).clone();

        self.postMessage({
          id,
          type: 'init-done',
          templateW: roiW,
          templateH: roiH,
          centerX: clampedX + roiW / 2,
          centerY: clampedY + roiH / 2,
        });
      } finally {
        frame.delete();
        gray.delete();
        blurred.delete();
      }
    } else if (type === 'track') {
      if (!cv || !templateMat) {
        self.postMessage({ id, type: 'track-result', x: null, y: null, confidence: 0 });
        return;
      }

      const { imageData, searchX, searchY } = msg;
      const frame = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      const blurred = new cv.Mat();
      const result = new cv.Mat();
      try {
        cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
        // Apply the same blur used at template-capture time so that
        // TM_CCOEFF_NORMED compares apples to apples.  For a stationary
        // camera this also suppresses per-frame sensor noise that would
        // otherwise produce spurious high-scoring locations.
        blurGray(gray, blurred);
        cv.matchTemplate(blurred, templateMat, result, cv.TM_CCOEFF_NORMED);
        const { maxVal, maxLoc } = cv.minMaxLoc(result);
        const centerX = maxLoc.x + searchX + templateMat.cols / 2;
        const centerY = maxLoc.y + searchY + templateMat.rows / 2;
        self.postMessage({
          id,
          type: 'track-result',
          x: centerX,
          y: centerY,
          confidence: maxVal,
        });
      } finally {
        frame.delete();
        gray.delete();
        blurred.delete();
        result.delete();
      }
    } else if (type === 'dispose') {
      if (templateMat) {
        templateMat.delete();
        templateMat = null;
      }
      // No response — fire-and-forget.
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
