/**
 * TrackingModel.ts
 *
 * Reactive state for particle track management and the OpenCV tracker facade.
 * Extracted from TrackLabModel so that track digitizing, kinematics caching, and
 * auto-tracking logic are independent of video playback and source management.
 *
 * Track point coordinates are expressed in the model coordinate system defined
 * by OverlayToolsModel.modelViewTransformProperty. When that transform changes,
 * TrackLabModel calls retransformTrackPoints() to keep every point anchored to the
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
 * Insert `point` into `points`, keeping the array sorted by ascending frame.
 * Always returns a new array so the kinematics cache (keyed on array identity)
 * invalidates.
 *
 * Sorted insertion matters because KinematicsComputer differentiates by array
 * index and assumes time increases along it.  Appending is only safe while
 * digitizing runs forwards; restoring a deleted interior point, or digitizing
 * out of order after scrubbing backwards, both break that assumption.
 */
function insertPointSorted(points: readonly TrackPoint[], point: TrackPoint): TrackPoint[] {
  const index = points.findIndex((p) => p.frame > point.frame);
  if (index === -1) {
    return [...points, point];
  }
  return [...points.slice(0, index), point, ...points.slice(index)];
}

/**
 * Owns all reactive state for particle tracks, kinematics caching, and the
 * OpenCV template-matching tracker facade.
 */
export class TrackingModel {
  // ── Manual particle tracks ────────────────────────────────────────────
  // INVARIANT: every TrackPoint's (x, y) is expressed in the coordinate
  // system defined by the *current* overlayTools.modelViewTransformProperty.
  // Whenever the MVT changes, TrackLabModel calls retransformTrackPoints() to
  // re-express every stored point in the new coordinate system so that each
  // point remains visually anchored to the same pixel on the video.
  public readonly tracksProperty = new Property<readonly Track[]>([]);
  public readonly activeTrackIdProperty = new Property<string | null>(null);
  public readonly canAddTrackProperty: TReadOnlyProperty<boolean> = new DerivedProperty(
    [this.tracksProperty],
    (tracks) => tracks.length < MAX_TRACKS,
  );

  // ── Single-level undo for point deletion ──────────────────────────────
  // Only the most recently deleted point is remembered.  A deletion is a
  // deliberate, low-stakes action (the video frame is still there to
  // re-digitize), so one level of undo covers the "wrong button" mistake
  // without introducing a general command history.
  private readonly lastDeletedPointProperty = new Property<{ trackId: string; point: TrackPoint } | null>(null);

  public readonly canRestorePointProperty: TReadOnlyProperty<boolean> = new DerivedProperty(
    [this.lastDeletedPointProperty],
    (deleted) => deleted !== null,
  );

  // ── Derived kinematics for all tracks ───────────────────────────────────
  // Cache keyed by track ID; only recomputes kinematics for tracks whose
  // point array reference has changed since the last derivation.
  //
  // CACHE INVARIANT: validity is determined by object identity
  // (`cached.points === track.points`). This is correct because every
  // mutation path (addPointToTrack, addOrReplacePointOnTrack,
  // removePointFromTrack, retransformTrackPoints) replaces the entire Track
  // object and its points array, so a stale entry always has a different
  // reference. removeTrack() explicitly evicts the entry for the removed
  // track to prevent an unbounded memory leak when tracks are added and
  // removed repeatedly.
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

    // The undo stash points at a track that no longer exists; restoring it
    // would be a silent no-op, so drop it and let the button disable.
    if (this.lastDeletedPointProperty.value?.trackId === id) {
      this.lastDeletedPointProperty.value = null;
    }
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
      const updated: Track = { ...track, points: insertPointSorted(track.points, point) };
      return updated;
    });
    this.tracksProperty.value = tracks;
  }

  /**
   * Record a digitized position for `frame` on the track identified by `id`,
   * overwriting any position already recorded for that frame.
   *
   * This is the manual-digitizing entry point.  Re-clicking a frame is the
   * natural way a user corrects a misclick, so the *last* recorded position
   * wins here — the opposite of addPointToTrack()'s first-wins policy, which
   * auto-tracking relies on to avoid clobbering hand-placed points.
   */
  public addOrReplacePointOnTrack(id: string, frame: number, time: number, x: number, y: number): void {
    const point: TrackPoint = { frame, time, x, y };

    this.tracksProperty.value = this.tracksProperty.value.map((track) => {
      if (track.id !== id) {
        return track;
      }

      const existing = track.points.some((p) => p.frame === frame);
      const points = existing
        ? track.points.map((p) => (p.frame === frame ? point : p))
        : insertPointSorted(track.points, point);

      return { ...track, points };
    });
  }

  /**
   * Delete the point recorded for `frame` on the track identified by `id`.
   * Does nothing if the track or the point does not exist.
   *
   * The removed point is stashed so that restoreLastDeletedPoint() can undo
   * this call.  Deleting an interior point leaves a gap in the frame series;
   * that is safe — KinematicsComputer differentiates against each point's
   * recorded timestamp, not against an assumed constant frame interval.
   */
  public removePointFromTrack(id: string, frame: number): void {
    const track = this.tracksProperty.value.find((t) => t.id === id);
    const removed = track?.points.find((p) => p.frame === frame);
    if (!(track && removed)) {
      return;
    }

    this.tracksProperty.value = this.tracksProperty.value.map((t) =>
      // filter() allocates a new array, which invalidates the kinematics cache.
      t.id === id ? { ...t, points: t.points.filter((p) => p.frame !== frame) } : t,
    );
    this.lastDeletedPointProperty.value = { trackId: id, point: removed };
  }

  /**
   * Re-insert the most recently deleted point. Does nothing if no point has
   * been deleted, or if its track has since been removed.
   */
  public restoreLastDeletedPoint(): void {
    const deleted = this.lastDeletedPointProperty.value;
    if (!deleted) {
      return;
    }
    const { trackId, point } = deleted;
    this.lastDeletedPointProperty.value = null;
    this.addOrReplacePointOnTrack(trackId, point.frame, point.time, point.x, point.y);
  }

  /** True when the given track has a point recorded at `frame`. */
  public hasPointAtFrame(id: string | null, frame: number): boolean {
    if (id === null) {
      return false;
    }
    const track = this.tracksProperty.value.find((t) => t.id === id);
    return track?.points.some((p) => p.frame === frame) ?? false;
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
   * Called by TrackLabModel whenever the model-view transform changes.
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

  /**
   * Re-derive every stored point's frame index from its recorded timestamp
   * using `frameRate`.  Called by TrackLabModel when the frame rate changes.
   *
   * `time` is the authoritative quantity — it is captured from the video
   * element — while `frame` is a derived index that must stay consistent with
   * `VideoPlaybackModel.currentFrameProperty`, which recomputes as
   * `round(time × fps)`.  Without this, changing the frame rate after
   * digitizing leaves stored points labelled with indices from the old rate,
   * and everything keyed on `frame` (the erase target, the current-frame ring,
   * the table row highlight) silently addresses the wrong point.
   *
   * Lowering the frame rate can map two points onto the same index.  Frames are
   * unique keys within a track, so a collision keeps the earlier point,
   * matching addPointToTrack()'s first-wins policy.
   */
  public retimeTrackPoints(frameRate: number): void {
    if (!(frameRate > 0)) {
      return;
    }
    const tracks = this.tracksProperty.value;
    if (tracks.length === 0) {
      return;
    }

    this.tracksProperty.value = tracks.map((track) => {
      const seen = new Set<number>();
      const points: TrackPoint[] = [];
      // Points are already sorted by ascending frame, and frame is monotonic in
      // time, so this walks the track in time order — the first point to claim
      // an index is the earliest one.
      for (const pt of track.points) {
        const frame = Math.round(pt.time * frameRate);
        if (seen.has(frame)) {
          continue;
        }
        seen.add(frame);
        points.push({ ...pt, frame });
      }
      return { ...track, points };
    });

    // The stash holds a point carrying an index from the previous frame rate.
    // Restoring it would place it at the wrong frame, so re-derive it too.
    const deleted = this.lastDeletedPointProperty.value;
    if (deleted) {
      this.lastDeletedPointProperty.value = {
        trackId: deleted.trackId,
        point: { ...deleted.point, frame: Math.round(deleted.point.time * frameRate) },
      };
    }
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
    this.lastDeletedPointProperty.value = null;
    this.nextSymbolCode = TRACK_SYMBOL_FIRST_CODE;
    this.initVersion++;
    this.tracker.dispose();
  }
}

TrackLabNamespace.register("TrackingModel", TrackingModel);
