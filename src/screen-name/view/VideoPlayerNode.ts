import { BooleanProperty, DerivedProperty, EnumerationProperty, Property } from "scenerystack/axon";
import { Dimension2, Range } from "scenerystack/dot";
import { DOM, HBox, Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont, TimeControlNode, TimeSpeed } from "scenerystack/scenery-phet";
import { CameraButton } from "scenerystack/scenery-phet";
import { ComboBox, type ComboBoxItem, Slider } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import type { SimModel } from "../model/SimModel.js";
import { WebcamPanel } from "./WebcamPanel.js";
import { AutoTrackerNode } from "./AutoTrackerNode.js";
import TrackLabColors from "../../TrackLabColors.js";

const LABEL_FONT = new PhetFont( 14 );
const FRAME_DURATION = 1 / 30; // assumes 30 fps

const VIDEO_FILES = [
  { label: 'Ball in Oil',        filename: 'ball_oil.mp4',         tandemName: 'ballOilItem' },
  { label: 'Bouncing Cart',      filename: 'bouncing_cart.mp4',    tandemName: 'bouncingCartItem' },
  { label: 'Cart Pendulum',      filename: 'cart_pendulum.mp4',    tandemName: 'cartPendulumItem' },
  { label: 'Cups Clips',         filename: 'CupsClips.mp4',        tandemName: 'cupsClipsItem' },
  { label: 'Parachute Monkey',   filename: 'parachute_monkey.mp4', tandemName: 'parachuteMonkeyItem' },
  { label: 'Pendulum',           filename: 'Pendulum.mp4',         tandemName: 'pendulumItem' },
  { label: 'Pendulum Drag',      filename: 'pendulum_drag.mp4',    tandemName: 'pendulumDragItem' },
  { label: 'Pucks Collide',      filename: 'PucksCollide.mp4',     tandemName: 'pucksCollideItem' },
  { label: 'Spring Wars',        filename: 'spring_wars.mp4',      tandemName: 'springWarsItem' },
] as const;

export class VideoPlayerNode extends Node {
  public readonly videoElement: HTMLVideoElement;
  private readonly model: SimModel;
  private isScrubbing = false;

  public constructor( model: SimModel, listParent: Node ) {
    super();
    this.model = model;

    // ── HTML video element ─────────────────────────────────────────────────
    this.videoElement = document.createElement( 'video' );
    this.videoElement.width = 640;
    this.videoElement.height = 360;
    this.videoElement.preload = 'metadata';
    this.videoElement.crossOrigin = 'anonymous';
    this.videoElement.style.display = 'block';
    TrackLabColors.videoBackgroundColorProperty.link( c => {
      this.videoElement.style.background = c.toCSS();
    } );

    const videoNode = new DOM( this.videoElement, { allowInput: false } );

    const updateDuration = () => {
      const d = this.videoElement.duration;
      if ( Number.isFinite( d ) && d > 0 ) {
        model.durationProperty.value = d;
      }
    };
    this.videoElement.addEventListener( 'loadedmetadata', () => {
      model.currentTimeProperty.value = 0;
      updateDuration();
    } );
    // durationchange fires again once WebM duration becomes known after a seek-to-end fix
    this.videoElement.addEventListener( 'durationchange', updateDuration );

    this.videoElement.addEventListener( 'ended', () => {
      model.isPlayingProperty.value = false;
    } );

    // ── Enabled state: only true once a video with finite duration is loaded ──
    const videoLoadedProperty = new BooleanProperty( false );
    model.durationProperty.link( d => { videoLoadedProperty.value = d > 0; } );

    // ── Auto-tracking overlay ──────────────────────────────────────────────
    // Layered directly on top of the video element at (0,0), so its local
    // coordinates correspond 1:1 to video-pixel coordinates.
    const autoTrackingShownProperty = new DerivedProperty(
      [ videoLoadedProperty, model.autoTrackingProperty ],
      ( loaded, tracking ) => loaded && tracking
    );
    const autoTrackerNode = new AutoTrackerNode( this.videoElement, autoTrackingShownProperty );

    const videoLayer = new Node( {
      children: [ videoNode, autoTrackerNode ],
    } );

    // ── Playback rate via TimeSpeed ────────────────────────────────────────
    const timeSpeedProperty = new EnumerationProperty( TimeSpeed.NORMAL );
    const speedMap = new Map( [
      [ TimeSpeed.FAST,   2.0 ],
      [ TimeSpeed.NORMAL, 1.0 ],
      [ TimeSpeed.SLOW,   0.5 ],
    ] );
    timeSpeedProperty.link( speed => {
      this.videoElement.playbackRate = speedMap.get( speed ) ?? 1.0;
    } );

    // ── Play / Pause ───────────────────────────────────────────────────────
    model.isPlayingProperty.lazyLink( isPlaying => {
      if ( isPlaying ) {
        this.videoElement.play().catch( () => {
          model.isPlayingProperty.value = false;
        } );
      }
      else {
        this.videoElement.pause();
      }
    } );

    // ── Step one frame (assumed 30 fps) ────────────────────────────────────
    const seekByFrames = ( direction: number ) => {
      model.isPlayingProperty.value = false;
      const raw = this.videoElement.currentTime + direction * FRAME_DURATION;
      const clamped = Math.max( 0, Math.min( raw, this.videoElement.duration ) );
      this.videoElement.currentTime = clamped;
      model.currentTimeProperty.value = clamped;
    };

    // ── TimeControlNode: play/pause + step back + step forward + speed ─────
    const timeControlNode = new TimeControlNode( model.isPlayingProperty, {
      timeSpeedProperty: timeSpeedProperty,
      timeSpeeds: [ TimeSpeed.NORMAL, TimeSpeed.SLOW ],
      enabledProperty: videoLoadedProperty,
      tandem: Tandem.OPT_OUT,
      playPauseStepButtonOptions: {
        includeStepBackwardButton: true,
        stepBackwardButtonOptions: {
          listener: () => seekByFrames( -1 ),
        },
        stepForwardButtonOptions: {
          listener: () => seekByFrames( 1 ),
        },
      },
    } );

    // ── Scrubber ───────────────────────────────────────────────────────────
    // Use a safe minimum of 1 so the Slider never sees a zero-width range.
    const rangeProperty = new DerivedProperty(
      [ model.durationProperty ],
      ( duration: number ) => new Range( 0, Math.max( duration, 1 ) )
    );

    const scrubber = new Slider(
      model.currentTimeProperty as unknown as Property<number>,
      rangeProperty,
      {
        trackSize: new Dimension2( 480, 4 ),
        thumbSize: new Dimension2( 12, 24 ),
        startDrag: () => { this.isScrubbing = true; },
        endDrag: () => { this.isScrubbing = false; },
        enabledProperty: videoLoadedProperty,
      }
    );

    model.currentTimeProperty.lazyLink( time => {
      if ( this.isScrubbing ) {
        this.videoElement.currentTime = time;
      }
    } );

    // ── Time and frame info display ────────────────────────────────────────
    const formatDuration = ( seconds: number ): string => {
      if ( !Number.isFinite( seconds ) || seconds <= 0 ) return '0:00';
      const mins = Math.floor( seconds / 60 );
      const secs = Math.floor( seconds % 60 );
      return `${ mins }:${ String( secs ).padStart( 2, '0' ) }`;
    };

    const totalTimeTextProperty = new DerivedProperty(
      [ model.durationProperty ],
      ( duration: number ) => formatDuration( duration )
    );

    const frameCountTextProperty = new DerivedProperty(
      [ model.currentTimeProperty, model.durationProperty ],
      ( time: number, duration: number ) => {
        if ( duration <= 0 ) return '0/0';
        const current = Math.round( time / FRAME_DURATION );
        const total = Math.round( duration / FRAME_DURATION );
        return `${ current }/${ total }`;
      }
    );

    const totalTimeLabel = new Text( totalTimeTextProperty, { font: LABEL_FONT } );
    const frameCountLabel = new Text( frameCountTextProperty, { font: LABEL_FONT } );

    const infoDisplay = new VBox( {
      children: [ totalTimeLabel, frameCountLabel ],
      spacing: 2,
      align: 'left',
    } );

    // ── Video source ComboBox ─────────────────────────────────────────────
    const selectedVideoProperty = new Property<string | null>( null );

    const comboItems: ComboBoxItem<string | null>[] = [
      {
        value: null,
        createNode: () => new Text( '— select a video —', { font: LABEL_FONT } ),
        tandemName: 'selectVideoItem',
      },
      ...VIDEO_FILES.map( v => ( {
        value: v.filename,
        createNode: () => new Text( v.label, { font: LABEL_FONT } ),
        tandemName: v.tandemName,
      } ) ),
    ];

    const videoComboBox = new ComboBox( selectedVideoProperty, comboItems, listParent );

    selectedVideoProperty.lazyLink( filename => {
      if ( filename ) {
        model.isPlayingProperty.value = false;
        autoTrackerNode.reset();
        this.loadUrl( `./videos/${ filename }` );
      }
    } );

    // ── Webcam panel ───────────────────────────────────────────────────────
    const webcamPanel = new WebcamPanel( {
      onVideoReady: ( blob, duration ) => {
        webcamPanel.visible = false;
        model.isPlayingProperty.value = false;
        autoTrackerNode.reset();
        const blobUrl = URL.createObjectURL( blob );
        this.videoElement.src = blobUrl;
        this.videoElement.load();
        if ( duration > 0 ) {
          model.durationProperty.value = duration;
        }
      },
      onCancel: () => {
        webcamPanel.visible = false;
      },
    } );
    webcamPanel.visible = false;

    const webcamButton = new CameraButton( {
      baseColor: TrackLabColors.buttonBaseDarkProperty,
      iconFill: TrackLabColors.textOnDarkProperty,
      tandem: Tandem.OPT_OUT,
      accessibleName: 'Record Webcam',
      listener: async () => {
        model.isPlayingProperty.value = false;
        webcamPanel.visible = true;
        await webcamPanel.open();
      },
    } );

    // ── Layout ─────────────────────────────────────────────────────────────
    const sourceRow = new HBox( {
      children: [ videoComboBox, webcamButton ],
      spacing: 12,
    } );

    const controlsRow = new HBox( {
      children: [ infoDisplay, timeControlNode, scrubber ],
      spacing: 16,
      align: 'center',
    } );

    const mainContent = new VBox( {
      children: [ sourceRow, videoLayer, controlsRow ],
      spacing: 10,
      align: 'center',
    } );

    this.addChild( mainContent );
    this.addChild( webcamPanel );

    // Center the webcam panel over the video after layout
    mainContent.boundsProperty.lazyLink( () => {
      webcamPanel.centerX = mainContent.centerX;
      webcamPanel.centerY = mainContent.centerY;
    } );
  }

  public step(): void {
    if ( !this.isScrubbing ) {
      const t = this.videoElement.currentTime;
      if ( Number.isFinite( t ) && Math.abs( this.model.currentTimeProperty.value - t ) > 0.016 ) {
        this.model.currentTimeProperty.value = t;
      }
    }
  }

  /** Pause playback and advance by exactly one frame (1/30 s). */
  public stepForward(): void {
    this.model.isPlayingProperty.value = false;
    const raw = this.videoElement.currentTime + FRAME_DURATION;
    const clamped = Math.max( 0, Math.min( raw, this.videoElement.duration ) );
    this.videoElement.currentTime = clamped;
    this.model.currentTimeProperty.value = clamped;
  }

  private loadUrl( url: string ): void {
    this.videoElement.src = url;
    this.videoElement.load();
  }
}
