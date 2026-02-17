import { DerivedProperty } from "scenerystack/axon";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import type { SimModel } from "../model/SimModel.js";
import { CalibrationToolNode } from "./CalibrationToolNode.js";
import { CoordinateSystemNode } from "./CoordinateSystemNode.js";
import { VideoPlayerNode } from "./VideoPlayerNode.js";

export class SimScreenView extends ScreenView {
  private readonly videoPlayerNode: VideoPlayerNode;
  private readonly coordinateSystemNode: CoordinateSystemNode;
  private readonly calibrationToolNode: CalibrationToolNode;

  public constructor( model: SimModel, options?: ScreenViewOptions ) {
    super( options );

    this.videoPlayerNode = new VideoPlayerNode( model, this );
    this.videoPlayerNode.center = this.layoutBounds.center.plusXY( 0, -20 );
    this.addChild( this.videoPlayerNode );

    // Both overlay tools appear once a video with a finite duration is loaded.
    const videoLoadedProperty = new DerivedProperty( [ model.durationProperty ], d => d > 0 );

    // The video element is 640×360.  videoCenter is the VideoPlayerNode center, which
    // approximates the video element center (VBox source row ≈ controls row in height).
    const VIDEO_WIDTH = 640;
    const VIDEO_HEIGHT = 360;
    const videoCenter = this.layoutBounds.center.plusXY( 0, -20 );

    // Coord system origin: center of the left half of the video (¼ from left edge, mid-height).
    this.coordinateSystemNode = new CoordinateSystemNode(
      videoLoadedProperty,
      videoCenter.plusXY( -VIDEO_WIDTH / 4, 0 )
    );
    this.addChild( this.coordinateSystemNode );

    // Calibration line: horizontally centered, ¼ above the video bottom (¾ from top).
    this.calibrationToolNode = new CalibrationToolNode(
      videoLoadedProperty,
      this,
      videoCenter.plusXY( 0, VIDEO_HEIGHT / 4 )
    );
    this.addChild( this.calibrationToolNode );

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
