import { DerivedProperty } from "scenerystack/axon";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import type { SimModel } from "../model/SimModel.js";
import { CalibrationToolNode } from "./CalibrationToolNode.js";
import { ControlPanel } from "./ControlPanel.js";
import { CoordinateSystemNode } from "./CoordinateSystemNode.js";
import { DataTableNode } from "./DataTableNode.js";
import { TrackListPanel } from "./TrackListPanel.js";
import { VideoPlayerNode } from "./VideoPlayerNode.js";

export class SimScreenView extends ScreenView {
  private readonly videoPlayerNode: VideoPlayerNode;

  public constructor( model: SimModel, options?: ScreenViewOptions ) {
    super( options );

    // True once a video with a finite duration has been loaded.
    const videoLoadedProperty = new DerivedProperty( [ model.durationProperty ], d => d > 0 );

    // Combined visibility: video loaded AND user-toggled model flag.
    const axesShownProperty = new DerivedProperty(
      [ videoLoadedProperty, model.axesVisibleProperty ],
      ( loaded, visible ) => loaded && visible
    );
    const calibrationShownProperty = new DerivedProperty(
      [ videoLoadedProperty, model.calibrationVisibleProperty ],
      ( loaded, visible ) => loaded && visible
    );

    // ── Coordinate system overlay ─────────────────────────────────────────
    // Reads/writes model.coordOriginProperty and model.coordAngleProperty.
    const coordinateSystemNode = new CoordinateSystemNode( axesShownProperty, model );
    this.addChild( coordinateSystemNode );

    // ── Calibration tool overlay ──────────────────────────────────────────
    // Reads/writes model.calibPoint1/2Property, model.calibDistanceProperty,
    // and model.calibUnitProperty.
    const calibrationToolNode = new CalibrationToolNode( calibrationShownProperty, this, model );
    this.addChild( calibrationToolNode );

    // ── Video player ──────────────────────────────────────────────────────
    // Uses model.modelViewTransformProperty (a DerivedProperty computed inside
    // SimModel from the tool state properties above).
    this.videoPlayerNode = new VideoPlayerNode( model, this );
    this.videoPlayerNode.center = this.layoutBounds.center.plusXY( 0, -20 );
    this.addChild( this.videoPlayerNode );

    // ── Control panel (left side) ─────────────────────────────────────────
    const controlPanel = new ControlPanel( model );
    controlPanel.left    = this.layoutBounds.left + 10;
    controlPanel.centerY = this.layoutBounds.centerY;
    this.addChild( controlPanel );

    // ── Track list panel (right of the video) ────────────────────────────
    const trackListPanel = new TrackListPanel( model, videoLoadedProperty );
    this.addChild( trackListPanel );
    trackListPanel.left = this.videoPlayerNode.right + 12;
    trackListPanel.top  = this.videoPlayerNode.top;

    // ── Data table (beneath the track list panel, same column) ───────────
    const dataTableNode = new DataTableNode( model, videoLoadedProperty, model.calibUnitProperty );
    this.addChild( dataTableNode );
    dataTableNode.left = trackListPanel.left;
    trackListPanel.boundsProperty.link( () => {
      dataTableNode.top = trackListPanel.bottom + 8;
    } );

    // ── Reset all ─────────────────────────────────────────────────────────
    const resetAllButton = new ResetAllButton( {
      listener: () => {
        model.reset(); // resets all model state including tool positions
        this.reset();
      },
      right:  this.layoutBounds.maxX - 10,
      bottom: this.layoutBounds.maxY - 10,
    } );
    this.addChild( resetAllButton );
  }

  public override step( dt: number ): void {
    super.step( dt );
    this.videoPlayerNode.step();
  }
}
