import { BooleanProperty, DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { Matrix3, Range, Transform3, Vector2 } from "scenerystack/dot";
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

// ── Calibration unit type ──────────────────────────────────────────────────
export const CALIBRATION_UNITS = [ 'mm', 'cm', 'm', 'km', 'in', 'ft' ] as const;
export type CalibrationUnit = typeof CALIBRATION_UNITS[ number ];
export const CALIBRATION_DISTANCE_RANGE = new Range( 0.001, 100000 );

// ── Layout constants ───────────────────────────────────────────────────────
// SceneryStack's ScreenView.DEFAULT_LAYOUT_BOUNDS = Bounds2(0, 0, 1024, 618).
// The VideoPlayerNode is centered at layoutBounds.center + (0, -20).
const LAYOUT_CENTER_X = 512;               // 1024 / 2
const LAYOUT_CENTER_Y = 309;               // 618 / 2
const VIDEO_CENTER_X  = LAYOUT_CENTER_X;   // 512
const VIDEO_CENTER_Y  = LAYOUT_CENTER_Y - 20; // 289
const VIDEO_WIDTH     = 640;
const VIDEO_HEIGHT    = 360;
const CALIB_HALF_LEN  = 100; // pixels from center to each calibration endpoint

// Initial tool positions (view / pixel space)
const COORD_ORIGIN_INITIAL = new Vector2( VIDEO_CENTER_X - VIDEO_WIDTH / 4, VIDEO_CENTER_Y );
const CALIB_CENTER_INITIAL = new Vector2( VIDEO_CENTER_X, VIDEO_CENTER_Y + VIDEO_HEIGHT / 4 );
const CALIB_P1_INITIAL     = CALIB_CENTER_INITIAL.plusXY( -CALIB_HALF_LEN, 0 );
const CALIB_P2_INITIAL     = CALIB_CENTER_INITIAL.plusXY(  CALIB_HALF_LEN, 0 );

// ── Model-view transform builder ───────────────────────────────────────────
/**
 * Builds a Transform3 from the coordinate-system tool and calibration tool.
 *
 * Composed as:  T(origin) · R(θ) · S(s, −s)
 *
 *   S(s, −s)  — scale model units to pixels, flip Y (model +y points up)
 *   R(θ)      — rotate by the coord-system angle (clockwise on screen)
 *   T(origin) — translate so model origin lands on the coord-system view position
 *
 * where s = |p2 − p1| / calibrationDistance  (pixels per model unit).
 * Returns the identity transform when the calibration segment has zero length.
 */
function buildModelViewTransform(
  origin: Vector2,
  angle: number,
  p1: Vector2,
  p2: Vector2,
  dist: number
): Transform3 {
  const pixelDist = p1.distance( p2 );
  if ( pixelDist < 1e-6 || dist < 1e-9 ) {
    return new Transform3( Matrix3.IDENTITY );
  }
  const s = pixelDist / dist; // pixels per model unit

  const matrix = Matrix3.translationFromVector( origin )
    .timesMatrix( Matrix3.rotation2( angle ) )
    .timesMatrix( Matrix3.scaling( s, -s ) );

  return new Transform3( matrix );
}

export class SimModel {
  public readonly isPlayingProperty    = new BooleanProperty( false );
  public readonly currentTimeProperty  = new Property<number>( 0 );
  public readonly durationProperty     = new Property<number>( 0 );
  public readonly videoUrlProperty     = new Property<string | null>( null );

  // ── Overlay visibility ────────────────────────────────────────────────
  public readonly axesVisibleProperty        = new BooleanProperty( true );
  public readonly calibrationVisibleProperty = new BooleanProperty( true );

  // ── Future features (not yet implemented) ────────────────────────────
  public readonly magnifyVideoProperty = new BooleanProperty( false );
  public readonly autoTrackingProperty = new BooleanProperty( false );

  // ── Coordinate system tool state (view / pixel space) ─────────────────
  public readonly coordOriginProperty = new Property<Vector2>( COORD_ORIGIN_INITIAL.copy() );
  public readonly coordAngleProperty  = new NumberProperty( 0 );

  // ── Calibration tool state ────────────────────────────────────────────
  public readonly calibPoint1Property   = new Property<Vector2>( CALIB_P1_INITIAL.copy() );
  public readonly calibPoint2Property   = new Property<Vector2>( CALIB_P2_INITIAL.copy() );
  public readonly calibDistanceProperty = new NumberProperty( 1, { range: CALIBRATION_DISTANCE_RANGE } );
  public readonly calibUnitProperty     = new Property<CalibrationUnit>( 'm' );

  // ── Model-view transform (derived; the view never writes to this) ─────
  public readonly modelViewTransformProperty: TReadOnlyProperty<Transform3> = new DerivedProperty(
    [
      this.coordOriginProperty,
      this.coordAngleProperty,
      this.calibPoint1Property,
      this.calibPoint2Property,
      this.calibDistanceProperty,
    ],
    ( origin, angle, p1, p2, dist ) => buildModelViewTransform( origin, angle, p1, p2, dist )
  );

  // ── Manual particle tracks ────────────────────────────────────────────
  public readonly tracksProperty       = new Property<readonly Track[]>( [] );
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
  }

  public removeTrack( id: string ): void {
    if ( this.activeTrackIdProperty.value === id ) {
      this.activeTrackIdProperty.value = null;
    }
    this.tracksProperty.value = this.tracksProperty.value.filter( t => t.id !== id );
  }

  public addPointToTrack( id: string, frame: number, time: number, x: number, y: number ): void {
    const tracks = this.tracksProperty.value.map( track => {
      if ( track.id !== id ) return track;

      const point: TrackPoint = { frame, time, x, y };
      const updated: Track = { ...track, points: [ ...track.points, point ] };
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
    this.coordOriginProperty.reset();
    this.coordAngleProperty.reset();
    this.calibPoint1Property.reset();
    this.calibPoint2Property.reset();
    this.calibDistanceProperty.reset();
    this.calibUnitProperty.reset();
    this.tracksProperty.value = [];
    this.activeTrackIdProperty.value = null;
    this.nextSymbolCode = 65;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public step( _dt: number ): void {
    // video playback is driven by the HTML video element; no model stepping needed
  }
}
