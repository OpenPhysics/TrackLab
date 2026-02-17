import { BooleanProperty, Property } from "scenerystack/axon";

export class SimModel {
  public readonly isPlayingProperty = new BooleanProperty( false );
  public readonly currentTimeProperty = new Property<number>( 0 );
  public readonly durationProperty = new Property<number>( 0 );
  public readonly videoUrlProperty = new Property<string | null>( null );

  public reset(): void {
    this.isPlayingProperty.reset();
    this.currentTimeProperty.reset();
    this.durationProperty.reset();
    this.videoUrlProperty.reset();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public step( _dt: number ): void {
    // video playback is driven by the HTML video element; no model stepping needed
  }
}
