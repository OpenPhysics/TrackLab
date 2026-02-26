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
 *   worker → main  { id, type: 'track-result', x, y }
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

self.onmessage = async (event) => {
  const msg = event.data;
  const { id, type } = msg;

  try {
    if (type === 'init') {
      await ensureOpenCV();

      const { imageData, region } = msg;
      const frame = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      try {
        cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

        const clampedX = Math.round(Math.max(0, region.x));
        const clampedY = Math.round(Math.max(0, region.y));
        const roiW = Math.round(Math.min(region.w, imageData.width - clampedX));
        const roiH = Math.round(Math.min(region.h, imageData.height - clampedY));

        if (roiW <= 0 || roiH <= 0) {
          throw new Error(`Invalid ROI dimensions: ${roiW}x${roiH}`);
        }

        if (templateMat) templateMat.delete();
        const roi = new cv.Rect(clampedX, clampedY, roiW, roiH);
        templateMat = gray.roi(roi).clone();

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
      }
    } else if (type === 'track') {
      if (!cv || !templateMat) {
        self.postMessage({ id, type: 'track-result', x: null, y: null });
        return;
      }

      const { imageData, searchX, searchY } = msg;
      const frame = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      const result = new cv.Mat();
      try {
        cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
        cv.matchTemplate(gray, templateMat, result, cv.TM_CCOEFF_NORMED);
        const { maxLoc } = cv.minMaxLoc(result);
        const centerX = maxLoc.x + searchX + templateMat.cols / 2;
        const centerY = maxLoc.y + searchY + templateMat.rows / 2;
        self.postMessage({ id, type: 'track-result', x: centerX, y: centerY });
      } finally {
        frame.delete();
        gray.delete();
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
