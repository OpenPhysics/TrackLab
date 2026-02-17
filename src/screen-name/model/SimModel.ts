import { BooleanProperty, Property } from "scenerystack/axon";
import { Matrix3, Transform3 } from "scenerystack/dot";

export class SimModel {
  public readonly isPlayingProperty = new BooleanProperty( false );
  public readonly currentTimeProperty = new Property<number>( 0 );
  public readonly durationProperty = new Property<number>( 0 );
  public readonly videoUrlProperty = new Property<string | null>( null );

  // Maps between real-world model coordinates and view (pixel) coordinates.
  // Updated by SimScreenView whenever the coordinate system or calibration tool changes.
  // Initially the identity transform; becomes meaningful once the user has placed both tools.
  public readonly modelViewTransformProperty = new Property<Transform3>(
    new Transform3( Matrix3.IDENTITY )
  );

  public reset(): void {
    this.isPlayingProperty.reset();
    this.currentTimeProperty.reset();
    this.durationProperty.reset();
    this.videoUrlProperty.reset();
    // modelViewTransformProperty is intentionally not reset here;
    // it is recomputed from the view tools which reset independently.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public step( _dt: number ): void {
    // video playback is driven by the HTML video element; no model stepping needed
  }
}
