import { DragListener, Line, Node, Path, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Shape } from "scenerystack/kite";
import { Tandem } from "scenerystack/tandem";
import { Vector2 } from "scenerystack/dot";
import type { TReadOnlyProperty } from "scenerystack/axon";
import { OpenCVTracker } from "../../tracking/OpenCVTracker.js";

const VIDEO_W = 640;
const VIDEO_H = 360;
const MAX_TRAIL = 150;
const CROSSHAIR_SIZE = 16;

/**
 * Transparent SceneryStack overlay that sits directly on top of the video element.
 *
 * Workflow:
 *  1. When visible, shows a "drag to select" hint.
 *  2. User drags a bounding box around the object to track.
 *  3. AutoTrackerNode captures the template and starts tracking.
 *  4. On each video frame (timeupdate / seeked), the best-match position is
 *     computed via OpenCV template matching and shown as a red crosshair.
 *  5. Past positions are shown as a green trail of dots.
 *
 * Local coordinates of this node correspond directly to video-pixel coordinates
 * (0,0 = top-left of video) because it is added to the same layer as the video
 * DOM node at position (0,0).
 */
export class AutoTrackerNode extends Node {
  private readonly tracker: OpenCVTracker;
  private readonly trail: Array<{ x: number; y: number }> = [];

  private readonly hintText: Text;
  private readonly selectionRect: Rectangle;
  private readonly trailPath: Path;
  private readonly crosshairH: Line;
  private readonly crosshairV: Line;
  private readonly crosshairCircle: Path;

  private selecting = false;
  private selStart = Vector2.ZERO;

  public constructor(
    videoElement: HTMLVideoElement,
    autoTrackingShownProperty: TReadOnlyProperty<boolean>
  ) {
    super( { visible: false } );

    this.tracker = new OpenCVTracker( VIDEO_W, VIDEO_H );

    // ── Transparent hit area (receives drag events) ───────────────────────
    const hitArea = new Rectangle( 0, 0, VIDEO_W, VIDEO_H, {
      fill: 'transparent',
      cursor: 'crosshair',
    } );
    this.addChild( hitArea );

    // ── Hint text ────────────────────────────────────────────────────────
    this.hintText = new Text( 'Drag on video to select object to track', {
      font: new PhetFont( { size: 15, weight: 'bold' } ),
      fill: 'rgba(255,255,100,0.9)',
    } );
    this.hintText.center = new Vector2( VIDEO_W / 2, VIDEO_H / 2 );
    this.addChild( this.hintText );

    // ── Selection rectangle ───────────────────────────────────────────────
    this.selectionRect = new Rectangle( 0, 0, 0, 0, {
      stroke: 'rgba(255,255,0,0.9)',
      lineWidth: 2,
      lineDash: [ 6, 3 ],
      fill: 'rgba(255,255,0,0.08)',
      visible: false,
    } );
    this.addChild( this.selectionRect );

    // ── Trail (filled dots at past positions) ─────────────────────────────
    this.trailPath = new Path( null, {
      fill: 'rgba(0,255,128,0.75)',
      visible: false,
    } );

    // ── Crosshair at current tracked position ────────────────────────────
    this.crosshairH = new Line( -CROSSHAIR_SIZE, 0, CROSSHAIR_SIZE, 0, {
      stroke: 'rgba(255,60,60,0.95)',
      lineWidth: 2,
      visible: false,
    } );
    this.crosshairV = new Line( 0, -CROSSHAIR_SIZE, 0, CROSSHAIR_SIZE, {
      stroke: 'rgba(255,60,60,0.95)',
      lineWidth: 2,
      visible: false,
    } );
    this.crosshairCircle = new Path( Shape.circle( 0, 0, 6 ), {
      stroke: 'rgba(255,60,60,0.95)',
      lineWidth: 2,
      visible: false,
    } );
    this.addChild( this.trailPath );
    this.addChild( this.crosshairCircle );
    this.addChild( this.crosshairH );
    this.addChild( this.crosshairV );

    // ── Drag listener: region selection ──────────────────────────────────
    const dragListener = new DragListener( {
      start: ( event ) => {
        this.trail.length = 0;
        this.tracker.dispose();
        this.setCrosshairVisible( false );
        this.trailPath.shape = null;
        this.trailPath.visible = false;
        this.hintText.visible = false;

        this.selStart = this.globalToLocalPoint( event.pointer.point );
        this.selecting = true;
        this.selectionRect.setRect( this.selStart.x, this.selStart.y, 0, 0 );
        this.selectionRect.visible = true;
      },
      drag: ( event ) => {
        if ( !this.selecting ) return;
        const p = this.globalToLocalPoint( event.pointer.point );
        this.selectionRect.setRect(
          Math.min( this.selStart.x, p.x ),
          Math.min( this.selStart.y, p.y ),
          Math.abs( p.x - this.selStart.x ),
          Math.abs( p.y - this.selStart.y )
        );
      },
      end: ( event ) => {
        if ( !this.selecting ) return;
        this.selecting = false;
        this.selectionRect.visible = false;

        if ( !event ) {
          this.hintText.visible = true;
          return;
        }
        const p = this.globalToLocalPoint( event.pointer.point );
        const region = {
          x: Math.min( this.selStart.x, p.x ),
          y: Math.min( this.selStart.y, p.y ),
          w: Math.abs( p.x - this.selStart.x ),
          h: Math.abs( p.y - this.selStart.y ),
        };

        if ( region.w > 4 && region.h > 4 ) {
          // initFromVideo is async (loads WASM on first call); tracking begins
          // automatically once `ready` becomes true.
          this.tracker.initFromVideo( videoElement, region );
        }
        else {
          this.hintText.visible = true;
        }
      },
      tandem: Tandem.OPT_OUT,
    } );
    hitArea.addInputListener( dragListener );

    // ── Track on every video frame ────────────────────────────────────────
    const onFrame = () => {
      if ( !this.visible || !this.tracker.ready ) return;
      const pt = this.tracker.track( videoElement );
      if ( !pt ) return;

      this.trail.push( pt );
      if ( this.trail.length > MAX_TRAIL ) this.trail.shift();
      this.updateTrackerVisuals( pt );
    };
    videoElement.addEventListener( 'timeupdate', onFrame );
    videoElement.addEventListener( 'seeked', onFrame );

    // ── Show/hide based on combined "video loaded && autoTracking" ────────
    autoTrackingShownProperty.link( shown => {
      if ( !shown ) this.reset();
      this.visible = shown;
      if ( shown ) this.hintText.visible = true;
    } );
  }

  private setCrosshairVisible( visible: boolean ): void {
    this.crosshairH.visible = visible;
    this.crosshairV.visible = visible;
    this.crosshairCircle.visible = visible;
  }

  private updateTrackerVisuals( pt: { x: number; y: number } ): void {
    const shape = new Shape();
    for ( const p of this.trail ) {
      shape.circle( p.x, p.y, 3 );
    }
    this.trailPath.shape = shape;
    this.trailPath.visible = true;

    const t = new Vector2( pt.x, pt.y );
    this.crosshairH.translation = t;
    this.crosshairV.translation = t;
    this.crosshairCircle.translation = t;
    this.setCrosshairVisible( true );
    this.hintText.visible = false;
  }

  /** Clear tracking state (template, trail, visuals). */
  public reset(): void {
    this.tracker.dispose();
    this.trail.length = 0;
    this.selecting = false;
    this.selectionRect.visible = false;
    this.trailPath.shape = null;
    this.trailPath.visible = false;
    this.setCrosshairVisible( false );
  }
}
