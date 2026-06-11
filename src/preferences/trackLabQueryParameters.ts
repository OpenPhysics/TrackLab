/**
 * Query parameters for TrackLab startup configuration.
 */

import { QueryStringMachine } from "scenerystack/query-string-machine";
import TrackLabNamespace from "../TrackLabNamespace.js";

const trackLabQueryParameters = QueryStringMachine.getAll({
  enableAutoTracking: {
    type: "boolean",
    defaultValue: false,
    public: true,
  },

  showVelocityInGraph: {
    type: "boolean",
    defaultValue: true,
    public: true,
  },

  showAccelerationInGraph: {
    type: "boolean",
    defaultValue: false,
    public: true,
  },

  enableMeasurementTools: {
    type: "boolean",
    defaultValue: false,
    public: true,
  },
});

TrackLabNamespace.register("trackLabQueryParameters", trackLabQueryParameters);

export default trackLabQueryParameters;
