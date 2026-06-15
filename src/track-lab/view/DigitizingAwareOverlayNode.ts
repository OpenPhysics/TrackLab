/**
 * DigitizingAwareOverlayNode.ts
 *
 * Abstract base for overlay tool nodes that share two behaviours:
 *   - Hidden until a video is loaded (videoLoadedProperty drives visibility).
 *   - Dimmed and non-interactive while the user is manually digitizing a track
 *     (activeTrackIdProperty non-null → pickable:false + reduced opacity).
 *
 * CoordinateSystemNode and CalibrationToolNode both use this pattern identically,
 * so it is factored here to avoid duplication.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Node } from "scenerystack/scenery";
import { DIGITIZING_DIM_OPACITY } from "../../TrackLabConstants.js";

export abstract class DigitizingAwareOverlayNode extends Node {
  private readonly disposeDigitizingAwareOverlayNode: () => void;

  protected constructor(
    videoLoadedProperty: TReadOnlyProperty<boolean>,
    activeTrackIdProperty: TReadOnlyProperty<string | null>,
  ) {
    super();

    const onVideoLoaded = (loaded: boolean) => {
      this.visible = loaded;
    };
    videoLoadedProperty.link(onVideoLoaded);

    const onActiveTrackChange = (activeId: string | null) => {
      const isDigitizing = activeId !== null;
      this.pickable = !isDigitizing;
      this.opacity = isDigitizing ? DIGITIZING_DIM_OPACITY : 1;
    };
    activeTrackIdProperty.link(onActiveTrackChange);

    this.disposeDigitizingAwareOverlayNode = () => {
      videoLoadedProperty.unlink(onVideoLoaded);
      activeTrackIdProperty.unlink(onActiveTrackChange);
    };
  }

  public override dispose(): void {
    this.disposeDigitizingAwareOverlayNode();
    super.dispose();
  }
}
