# Model - TrackLab

This document describes the model (the underlying behavior and math) for the application, in terms
appropriate for an educator. It is the companion to
[implementation-notes.md](./implementation-notes.md), which targets developers.

## Overview

TrackLab is a **video motion-analysis** tool, not a forward physics integrator. It **digitizes real
motion** from an uploaded video, bundled sample clip, or webcam recording, then computes kinematics
from the tracked positions. The workflow mirrors classroom tools like *Tracker* or Logger Pro:

1. Load or record a video.
2. Place and rotate a **coordinate system** on the frame.
3. **Calibrate** a known length to convert pixels to physical units.
4. **Digitize** the object each frame (manual crosshair or OpenCV template matching).
5. **Graph and export** position, velocity, and acceleration versus time.

The key ideas a student should take away:

- Real-world measurements start in **pixels**; calibration and axis choice determine the physical
  (x, y) coordinates stored for each frame.
- **Velocity and acceleration are not measured directly** — they are estimated by differentiating
  the position series, which amplifies noise.
- Changing the coordinate system **re-expresses** stored points so they stay pinned to the same
  pixel on the video (the math updates; the mark on the object does not jump).

## Quantities and units

| Quantity | Symbol | Units | Notes |
|---|---|---|---|
| Pixel position | (u, v) | px | Location in the video frame (origin top-left) |
| Calibration scale | s | user unit / px | From a user-marked known length |
| Model position | (x, y) | m (or mm, cm, …) | After model-view transform |
| Time | t | s | frame / frame_rate, or video playback clock |
| Frame index | n | — | Integer frame number |
| Velocity | v_x, v_y, speed | user unit / s | Finite-difference estimate |
| Acceleration | a_x, a_y, \|a\| | user unit / s² | Finite-difference of velocity |

Up to **4 concurrent tracks** (labels drawn from A–Z; symbols are not reused after removal) can be
recorded, each with its own color for graphs and the data table.

## Governing equations

**Model-view transform.** Pixel coordinates map to model coordinates through a 2D transform built
from the user's origin, axis rotation, and calibration endpoints:

```
(x, y) = T(origin) · R(θ) · S(s, −s) · (u, v)
```

The negative vertical scale flips image-down into physics-up. The inverse transform converts a clicked
pixel to model coordinates when digitizing.

**Kinematics from positions.** For each track, `KinematicsComputer` applies **central finite
differences** on the time series (forward at the first point, backward at the last):

```
v_x(i) ≈ [x(i+1) − x(i−1)] / [t(i+1) − t(i−1)]
a_x(i) ≈ [v_x(i+1) − v_x(i−1)] / [t(i+1) − t(i−1)]
```

(same for y; speed and acceleration magnitude from components). Missing or duplicate frame entries
yield null derivatives at affected indices.

**Auto-tracking.** OpenCV **template matching** in a Web Worker finds the best match for a
user-selected ROI in each frame; the match center is converted through the same transform as manual
clicks. Tracking accuracy depends on contrast, motion blur, and ROI size.

## Simplifications and assumptions

- Motion is assumed **planar** in the calibrated coordinate system; perspective and lens distortion
  are not corrected.
- **Finite-difference derivatives** are approximate and noise-amplifying; sparse or irregular
  sampling degrades velocity and acceleration more than position.
- **First recorded position wins** if the same frame is digitized twice on a track.
- Video timing uses the user-set **frame rate** (and HTML video playback); dropped frames or
  variable frame rate in the source file introduce timing error.
- OpenCV WASM requires cross-origin isolation (COOP/COEP headers) in the dev and production builds.

## References

- Video-based motion analysis curricula (e.g. the *Tracker* video analysis tool, OpenStax lab manuals).
- OpenCV template matching documentation for the auto-track feature.
- Finite-difference numerical differentiation, any introductory numerical methods text.
