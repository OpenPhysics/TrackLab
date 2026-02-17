// cv type is 'any' — the OpenCV.js WASM API is dynamic and not fully typed.
let cvPromise: Promise<any> | null = null;

function loadCV(): Promise<any> {
  if ( !cvPromise ) {
    cvPromise = import( '@techstark/opencv-js' ).then( mod => {
      const cv = ( mod as any ).default ?? mod;
      // WASM may already be ready (e.g. in test environments)
      if ( typeof cv.Mat === 'function' ) return cv;
      return new Promise<any>( resolve => {
        cv.onRuntimeInitialized = () => resolve( cv );
      } );
    } );
  }
  return cvPromise;
}

export type TrackerRegion = { x: number; y: number; w: number; h: number };

/**
 * Tracks a user-selected object across video frames using OpenCV template matching.
 * The template is captured once from the user's selection and then matched against
 * each subsequent frame using normalised cross-correlation (TM_CCOEFF_NORMED).
 */
export class OpenCVTracker {
  private cv: any = null;
  private templateMat: any = null;
  private readonly offscreen: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  public constructor( videoWidth: number, videoHeight: number ) {
    this.offscreen = document.createElement( 'canvas' );
    this.offscreen.width = videoWidth;
    this.offscreen.height = videoHeight;
    this.ctx = this.offscreen.getContext( '2d' )!;
  }

  public get ready(): boolean {
    return this.cv !== null && this.templateMat !== null;
  }

  /**
   * Capture the template from the currently visible video frame inside `region`,
   * loading OpenCV (WASM) on first call.
   */
  public async initFromVideo( video: HTMLVideoElement, region: TrackerRegion ): Promise<void> {
    this.cv = await loadCV();

    this.ctx.drawImage( video, 0, 0 );
    const imageData = this.ctx.getImageData( 0, 0, this.offscreen.width, this.offscreen.height );
    const frame = this.cv.matFromImageData( imageData );
    const gray = new this.cv.Mat();
    this.cv.cvtColor( frame, gray, this.cv.COLOR_RGBA2GRAY );

    if ( this.templateMat ) this.templateMat.delete();

    const roi = new this.cv.Rect(
      Math.round( Math.max( 0, region.x ) ),
      Math.round( Math.max( 0, region.y ) ),
      Math.round( Math.min( region.w, this.offscreen.width - region.x ) ),
      Math.round( Math.min( region.h, this.offscreen.height - region.y ) )
    );
    this.templateMat = gray.roi( roi ).clone();

    frame.delete();
    gray.delete();
  }

  /**
   * Match the stored template against the current video frame.
   * Returns the center of the best match in video-pixel coordinates, or null if not ready.
   */
  public track( video: HTMLVideoElement ): { x: number; y: number } | null {
    if ( !this.ready ) return null;

    this.ctx.drawImage( video, 0, 0 );
    const imageData = this.ctx.getImageData( 0, 0, this.offscreen.width, this.offscreen.height );
    const frame = this.cv.matFromImageData( imageData );
    const gray = new this.cv.Mat();
    this.cv.cvtColor( frame, gray, this.cv.COLOR_RGBA2GRAY );

    const result = new this.cv.Mat();
    this.cv.matchTemplate( gray, this.templateMat, result, this.cv.TM_CCOEFF_NORMED );
    const { maxLoc } = this.cv.minMaxLoc( result );

    frame.delete();
    gray.delete();
    result.delete();

    return {
      x: maxLoc.x + this.templateMat.cols / 2,
      y: maxLoc.y + this.templateMat.rows / 2,
    };
  }

  public dispose(): void {
    if ( this.templateMat ) {
      this.templateMat.delete();
      this.templateMat = null;
    }
  }
}
