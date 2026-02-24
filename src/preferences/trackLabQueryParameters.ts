/**
 * Query parameters for TrackLab startup configuration.
 */

import { QueryStringMachine } from "scenerystack/query-string-machine";
import trackLab from "../TrackLabNamespace.js";

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

trackLab.register("trackLabQueryParameters", trackLabQueryParameters);

export default trackLabQueryParameters;
