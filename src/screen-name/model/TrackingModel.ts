/**
 * TrackingModel.ts
 *
 * Reactive state for particle track management and the OpenCV tracker facade.
 * Extracted from SimModel so that track digitizing, kinematics caching, and
 * auto-tracking logic are independent of video playback and source management.
 *
 * Track point coordinates are expressed in the model coordinate system defined
 * by OverlayToolsModel.modelViewTransformProperty. When that transform changes,
 * SimModel calls retransformTrackPoints() to keep every point anchored to the
 * same pixel on the video.
 */

import { DerivedProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { type Transform3, Vector2 } from "scenerystack/dot";
import { TRACK_COLORS } from "../../TrackLabColors.js";
import {
  MAX_TRACKS,
  TRACK_SYMBOL_FIRST_CODE,
  TRACK_SYMBOL_LAST_CODE,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../../TrackLabConstants.js";
import TrackLabNamespace from "../../TrackLabNamespace.js";
import { OpenCVTracker, type TrackerRegion } from "../../tracking/OpenCVTracker.js";
import { computeTrackKinematics } from "./KinematicsComputer.js";
import type { Track, TrackKinematics, TrackPoint } from "./Track.js";

/**
 * Owns all reactive state for particle tracks, kinematics caching, and the
 * OpenCV template-matching tracker facade.
 */
export class TrackingModel {
  // ── Manual particle tracks ────────────────────────────────────────────
  // INVARIANT: every TrackPoint's (x, y) is expressed in the coordinate
  // system defined by the *current* overlayTools.modelViewTransformProperty.
  // Whenever the MVT changes, SimModel calls retransformTrackPoints() to
  // re-express every stored point in the new coordinate system so that each
  // point remains visually anchored to the same pixel on the video.
  public readonly tracksProperty = new Property<readonly Track[]>([]);
  public readonly activeTrackIdProperty = new Property<string | null>(null);
  public readonly canAddTrackProperty: TReadOnlyProperty<boolean> = new DerivedProperty(
    [this.tracksProperty],
    (tracks) => tracks.length < MAX_TRACKS,
  );

  // ── Derived kinematics for all tracks ───────────────────────────────────
  // Cache keyed by track ID; only recomputes kinematics for tracks whose
  // point array reference has changed since the last derivation.
  //
  // CACHE INVARIANT: validity is determined by object identity
  // (`cached.points === track.points`). This is correct because every
  // mutation path (addPointToTrack, retransformTrackPoints) replaces the
  // entire Track object and its points array, so a stale entry always has a
  // different reference. removeTrack() explicitly evicts the entry for the
  // removed track to prevent an unbounded memory leak when tracks are added
  // and removed repeatedly.
  private readonly kinematicsCache = new Map<string, { points: Track["points"]; kinematics: TrackKinematics }>();

  public readonly trackKinematicsProperty: TReadOnlyProperty<readonly TrackKinematics[]> = new DerivedProperty(
    [this.tracksProperty],
    (tracks) =>
      tracks.map((track) => {
        const cached = this.kinematicsCache.get(track.id);
        if (cached && cached.points === track.points) {
          return cached.kinematics;
        }
        const kinematics = computeTrackKinematics(track);
        this.kinematicsCache.set(track.id, { points: track.points, kinematics });
        return kinematics;
      }),
  );

  // Symbols are assigned sequentially (A → Z) and intentionally not reused
  // after a track is removed.
  private nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;

  // ── OpenCV Tracker (computational service) ────────────────────────────
  private readonly tracker = new OpenCVTracker(VIDEO_WIDTH, VIDEO_HEIGHT);

  // Monotonically-increasing counter used to detect stale async initTracker
  // results.  resetTracker() increments it; initTracker() captures the value
  // before awaiting and returns false (stale) if the counter changed.
  private initVersion = 0;

  // ── Track mutation methods ────────────────────────────────────────────

  /**
   * Create a new track labelled with the next available letter (A–Z) and a
   * unique color index. Does nothing if the track limit or symbol limit is reached.
   */
  public addTrack(): void {
    if (this.tracksProperty.value.length >= MAX_TRACKS || this.nextSymbolCode > TRACK_SYMBOL_LAST_CODE) {
      return;
    }
    const symbol = String.fromCharCode(this.nextSymbolCode);
    const colorIndex = (this.nextSymbolCode - TRACK_SYMBOL_FIRST_CODE) % TRACK_COLORS.length;
    this.nextSymbolCode++;

    const track: Track = {
      id: `track-${symbol}`,
      symbol,
      colorIndex,
      points: [],
    };

    this.tracksProperty.value = [...this.tracksProperty.value, track].toSorted(
      (a, b) => a.symbol.charCodeAt(0) - b.symbol.charCodeAt(0),
    );
  }

  /**
   * Remove the track with the given `id`. If that track is currently active,
   * `activeTrackIdProperty` is cleared to null first.
   */
  public removeTrack(id: string): void {
    if (this.activeTrackIdProperty.value === id) {
      this.activeTrackIdProperty.value = null;
    }
    this.tracksProperty.value = this.tracksProperty.value.filter((t) => t.id !== id);
    this.kinematicsCache.delete(id);
  }

  /**
   * Record a digitized position for `frame` on the track identified by `id`.
   * If a point for `frame` already exists on the track, the call is a no-op
   * (deduplication policy: first recorded position wins).
   */
  public addPointToTrack(id: string, frame: number, time: number, x: number, y: number): void {
    const tracks = this.tracksProperty.value.map((track) => {
      if (track.id !== id) {
        return track;
      }

      // Skip if this frame is already recorded on the track.
      if (track.points.some((p) => p.frame === frame)) {
        return track;
      }

      const point: TrackPoint = { frame, time, x, y };
      const updated: Track = { ...track, points: [...track.points, point] };
      return updated;
    });
    this.tracksProperty.value = tracks;
  }

  /**
   * Create a new track and immediately make it the active track.
   * Does nothing if the track limit or symbol limit has been reached.
   */
  public addTrackAndActivate(): void {
    this.addTrack();
    const tracks = this.tracksProperty.value;
    const newest = tracks.at(-1);
    if (newest) {
      this.activeTrackIdProperty.value = newest.id;
    }
  }

  /**
   * Re-expresses every stored track point in the coordinate system of `newMVT`,
   * preserving the pixel-space position of each point on the video.
   * Called by SimModel whenever the model-view transform changes.
   */
  public retransformTrackPoints(prevMvt: Transform3, newMvt: Transform3): void {
    const tracks = this.tracksProperty.value;
    if (tracks.length === 0) {
      return;
    }

    this.tracksProperty.value = tracks.map((track) => ({
      ...track,
      points: track.points.map((pt) => {
        const pixelPos = prevMvt.transformPosition2(new Vector2(pt.x, pt.y));
        const newModelPt = newMvt.inversePosition2(pixelPos);
        return { ...pt, x: newModelPt.x, y: newModelPt.y };
      }),
    }));
  }

  // ── Tracker facade ──────────────────────────────────────────────────────
  // Views interact with the tracker exclusively through these methods so that
  // the tracker implementation stays encapsulated inside the model layer.

  /** True once a template has been captured and frame-to-frame tracking can begin. */
  public get isTrackerReady(): boolean {
    return this.tracker.ready;
  }

  /** Reset tracking state. Cancels any in-flight operation and clears the template. */
  public resetTracker(): void {
    this.initVersion++;
    this.tracker.dispose();
  }

  /**
   * Resize the tracker's offscreen canvas to match the video element's display dimensions.
   * Must be called whenever the displayed video size changes.
   */
  public resizeTracker(width: number, height: number): void {
    this.tracker.resize(width, height);
  }

  /**
   * Capture the tracking template from the current video frame within `region`.
   * Returns true when the worker is ready to track, or false if this call was
   * superseded by a newer initTracker call (stale — the view should discard
   * the result silently).  Throws only for genuine errors (CORS, worker crash).
   */
  public async initTracker(video: HTMLVideoElement, region: TrackerRegion): Promise<boolean> {
    const captured = ++this.initVersion;
    try {
      await this.tracker.initFromVideo(video, region);
    } catch (err) {
      // If the tracker was reset mid-flight (initVersion changed), this error
      // is a deliberate cancellation, not a real failure.
      if (this.initVersion !== captured) {
        return false;
      }
      throw err;
    }
    if (this.initVersion !== captured) {
      // A newer drag started while the worker was initialising; discard.
      this.tracker.dispose();
      return false;
    }
    return true;
  }

  /**
   * Match the stored template against the current video frame.
   * Returns the center of the best match in video-pixel coordinates, or null.
   */
  public async trackFrame(video: HTMLVideoElement): Promise<{ x: number; y: number } | null> {
    return await this.tracker.track(video);
  }

  public reset(): void {
    this.kinematicsCache.clear();
    this.tracksProperty.value = [];
    this.activeTrackIdProperty.value = null;
    this.nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;
    this.initVersion++;
    this.tracker.dispose();
  }
}

TrackLabNamespace.register("TrackingModel", TrackingModel);
