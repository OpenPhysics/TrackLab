import { BooleanProperty, Property } from "scenerystack/axon";
import { Matrix3, Transform3 } from "scenerystack/dot";
import type { Track, TrackPoint } from "./Track.js";

// ── Track colour palette (one per letter, repeats after 8) ─────────────────
const TRACK_COLORS = [
  '#FF8C00', // A – orange
  '#00BCD4', // B – cyan
  '#E91E8C', // C – magenta
  '#9C27B0', // D – purple
  '#CDDC39', // E – lime-yellow
  '#00E5FF', // F – light cyan
  '#FF5722', // G – deep orange
  '#76FF03', // H – light green
];

export class SimModel {
  public readonly isPlayingProperty = new BooleanProperty( false );
  public readonly currentTimeProperty = new Property<number>( 0 );
  public readonly durationProperty = new Property<number>( 0 );
  public readonly videoUrlProperty = new Property<string | null>( null );

  // ── Overlay visibility ────────────────────────────────────────────────
  public readonly axesVisibleProperty = new BooleanProperty( true );
  public readonly calibrationVisibleProperty = new BooleanProperty( true );

  // ── Future features (not yet implemented) ────────────────────────────
  public readonly magnifyVideoProperty = new BooleanProperty( false );
  public readonly autoTrackingProperty = new BooleanProperty( false );

  // Maps between real-world model coordinates and view (pixel) coordinates.
  // Updated by SimScreenView whenever the coordinate system or calibration tool changes.
  public readonly modelViewTransformProperty = new Property<Transform3>(
    new Transform3( Matrix3.IDENTITY )
  );

  // ── Manual particle tracks ────────────────────────────────────────────
  public readonly tracksProperty = new Property<readonly Track[]>( [] );

  // The track currently selected for manual digitizing (null = none).
  public readonly activeTrackIdProperty = new Property<string | null>( null );
  private nextSymbolCode = 65; // ASCII code for 'A'

  public addTrack(): void {
    if ( this.nextSymbolCode > 90 ) return; // 'Z' is the last allowed symbol
    const symbol = String.fromCharCode( this.nextSymbolCode );
    const color = TRACK_COLORS[ ( this.nextSymbolCode - 65 ) % TRACK_COLORS.length ];
    this.nextSymbolCode++;

    const track: Track = {
      id: `track-${ symbol }`,
      symbol,
      color,
      points: [],
    };

    const tracks = [ ...this.tracksProperty.value, track ];
    tracks.sort( ( a, b ) => a.symbol.localeCompare( b.symbol ) );
    this.tracksProperty.value = tracks;

    console.log( `[TrackLab] Added track ${ symbol }. Active tracks: ${ tracks.map( t => t.symbol ).join( ', ' ) }` );
  }

  public removeTrack( id: string ): void {
    if ( this.activeTrackIdProperty.value === id ) {
      this.activeTrackIdProperty.value = null;
    }
    const removed = this.tracksProperty.value.find( t => t.id === id );
    this.tracksProperty.value = this.tracksProperty.value.filter( t => t.id !== id );
    const remaining = this.tracksProperty.value.map( t => t.symbol ).join( ', ' ) || 'none';
    console.log( `[TrackLab] Removed track ${ removed?.symbol ?? id }. Remaining: ${ remaining }` );
  }

  public addPointToTrack( id: string, frame: number, time: number ): void {
    const tracks = this.tracksProperty.value.map( track => {
      if ( track.id !== id ) return track;

      const point: TrackPoint = { frame, time };
      const updated: Track = { ...track, points: [ ...track.points, point ] };
      console.log(
        `[TrackLab] Track ${ track.symbol } → frame ${ frame } (t=${ time.toFixed( 3 ) }s) | ${ updated.points.length } point(s) recorded`,
        updated.points
      );
      return updated;
    } );
    this.tracksProperty.value = tracks;
  }

  /** Returns true if another track can still be added (A–Z not yet exhausted). */
  public canAddTrack(): boolean {
    return this.nextSymbolCode <= 90;
  }

  public reset(): void {
    this.isPlayingProperty.reset();
    this.currentTimeProperty.reset();
    this.durationProperty.reset();
    this.videoUrlProperty.reset();
    this.axesVisibleProperty.reset();
    this.calibrationVisibleProperty.reset();
    this.magnifyVideoProperty.reset();
    this.autoTrackingProperty.reset();
    this.tracksProperty.value = [];
    this.activeTrackIdProperty.value = null;
    this.nextSymbolCode = 65;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public step( _dt: number ): void {
    // video playback is driven by the HTML video element; no model stepping needed
  }
}
