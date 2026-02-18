import { DerivedProperty, Multilink } from "scenerystack/axon";
import { Matrix3, Transform3, Vector2 } from "scenerystack/dot";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import type { SimModel } from "../model/SimModel.js";
import { CalibrationToolNode } from "./CalibrationToolNode.js";
import { ControlPanel } from "./ControlPanel.js";
import { CoordinateSystemNode } from "./CoordinateSystemNode.js";
import { DataTableNode } from "./DataTableNode.js";
import { TrackListPanel } from "./TrackListPanel.js";
import { VideoPlayerNode } from "./VideoPlayerNode.js";

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

export class SimScreenView extends ScreenView {
  private readonly videoPlayerNode: VideoPlayerNode;
  private readonly coordinateSystemNode: CoordinateSystemNode;
  private readonly calibrationToolNode: CalibrationToolNode;

  public constructor( model: SimModel, options?: ScreenViewOptions ) {
    super( options );

    this.videoPlayerNode = new VideoPlayerNode( model, this );
    this.videoPlayerNode.center = this.layoutBounds.center.plusXY( 0, -20 );
    this.addChild( this.videoPlayerNode );

    // True once a video with a finite duration has been loaded.
    const videoLoadedProperty = new DerivedProperty( [ model.durationProperty ], d => d > 0 );

    // The video element is 640×360.  videoCenter approximates the video element center.
    const VIDEO_WIDTH = 640;
    const VIDEO_HEIGHT = 360;
    const videoCenter = this.layoutBounds.center.plusXY( 0, -20 );

    // Combined visibility: video loaded AND user-toggled model flag.
    const axesShownProperty = new DerivedProperty(
      [ videoLoadedProperty, model.axesVisibleProperty ],
      ( loaded, visible ) => loaded && visible
    );
    const calibrationShownProperty = new DerivedProperty(
      [ videoLoadedProperty, model.calibrationVisibleProperty ],
      ( loaded, visible ) => loaded && visible
    );

    // Coord system origin: center of the left half of the video (¼ from left edge, mid-height).
    this.coordinateSystemNode = new CoordinateSystemNode(
      axesShownProperty,
      videoCenter.plusXY( -VIDEO_WIDTH / 4, 0 )
    );
    this.addChild( this.coordinateSystemNode );

    // Calibration line: horizontally centered, ¼ above the video bottom (¾ from top).
    this.calibrationToolNode = new CalibrationToolNode(
      calibrationShownProperty,
      this,
      videoCenter.plusXY( 0, VIDEO_HEIGHT / 4 )
    );
    this.addChild( this.calibrationToolNode );

    // ── ModelViewTransform: recomputed whenever either tool changes ────────
    Multilink.multilink(
      [
        this.coordinateSystemNode.viewPositionProperty,
        this.coordinateSystemNode.rotationAngleProperty,
        this.calibrationToolNode.point1Property,
        this.calibrationToolNode.point2Property,
        this.calibrationToolNode.distanceProperty,
      ],
      ( origin, angle, p1, p2, dist ) => {
        model.modelViewTransformProperty.value = buildModelViewTransform(
          origin, angle, p1, p2, dist
        );
      }
    );

    // ── Control panel (left side) ─────────────────────────────────────────
    const controlPanel = new ControlPanel( model );
    controlPanel.left = this.layoutBounds.left + 10;
    controlPanel.centerY = this.layoutBounds.centerY;
    this.addChild( controlPanel );

    // ── Track list panel (right of the video) ────────────────────────────
    const trackListPanel = new TrackListPanel( model, videoLoadedProperty );
    this.addChild( trackListPanel );
    // Position: just right of the video player, top-aligned with it.
    trackListPanel.left = this.videoPlayerNode.right + 12;
    trackListPanel.top  = this.videoPlayerNode.top;

    // ── Data table (beneath the track list panel, same column) ───────────
    const dataTableNode = new DataTableNode( model, videoLoadedProperty, this.calibrationToolNode.unitProperty );
    this.addChild( dataTableNode );
    dataTableNode.left = trackListPanel.left;
    trackListPanel.boundsProperty.link( () => {
      dataTableNode.top = trackListPanel.bottom + 8;
    } );

    const resetAllButton = new ResetAllButton( {
      listener: () => {
        model.reset();
        this.reset();
      },
      right: this.layoutBounds.maxX - 10,
      bottom: this.layoutBounds.maxY - 10,
    } );
    this.addChild( resetAllButton );
  }

  public reset(): void {
    this.coordinateSystemNode.reset();
    this.calibrationToolNode.reset();
  }

  public override step( dt: number ): void {
    super.step( dt );
    this.videoPlayerNode.step();
  }
}
