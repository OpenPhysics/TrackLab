import { ProfileColorProperty } from "scenerystack/scenery";
import TrackLabNamespace from "./TrackLabNamespace.js";

const TrackLabColors = {
  backgroundColorProperty: new ProfileColorProperty(
    TrackLabNamespace,
    "background",
    {
      default: "black",
      projector: "white",
    },
  ),
};

export default TrackLabColors;
