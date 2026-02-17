import { BooleanProperty, Property } from "scenerystack/axon";
import { Matrix3, Transform3 } from "scenerystack/dot";

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

  public reset(): void {
    this.isPlayingProperty.reset();
    this.currentTimeProperty.reset();
    this.durationProperty.reset();
    this.videoUrlProperty.reset();
    this.axesVisibleProperty.reset();
    this.calibrationVisibleProperty.reset();
    this.magnifyVideoProperty.reset();
    this.autoTrackingProperty.reset();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public step( _dt: number ): void {
    // video playback is driven by the HTML video element; no model stepping needed
  }
}
