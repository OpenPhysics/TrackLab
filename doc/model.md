# Model - TrackLab

This document describes the model (the underlying behavior and math) for the application, in terms
appropriate for an educator. It is the companion to
[implementation-notes.md](./implementation-notes.md), which targets developers.

## Overview

TrackLab is a **video motion-analysis** tool. Unlike a typical simulation, it does not integrate
equations of motion — instead it **digitizes real motion from a video** (or webcam) and computes
kinematics from the tracked points. The workflow is: load a video, set a coordinate system, calibrate a
known length, mark (or auto-track) the moving object frame by frame, then graph and export position,
velocity, and acceleration versus time. It is conceptually similar to Tracker / Logger Pro and teaches
how real-world data becomes kinematic graphs.

## Quantities and units

| Quantity | Symbol | Units | Notes |
|---|---|---|---|
| Pixel position | (u, v) | px | Raw location of a marked point in the video frame |
| Calibration scale | s | m/px | From a user-marked known length |
| Model position | (x, y) | m | Pixel position mapped through the coordinate transform |
| Time | t | s | From frame index and the video frame rate |
| Velocity | v | m/s | Estimated from successive tracked positions |
| Acceleration | a | m/s² | Estimated from successive velocities |

## Governing equations

A **coordinate transform** maps frame pixels to physical model coordinates by combining the user's chosen
origin, axis rotation, and calibration scale:

```
(x, y) = T(origin) · R(θ) · S(s, −s) · (u, v)
```

(the `−s` on the vertical axis flips image-down into physics-up). Kinematics are then obtained by
**numerical differentiation** of the tracked position series with respect to time:

```
v ≈ Δx / Δt        a ≈ Δv / Δt
```

where `Δt` comes from the video frame interval. Auto-tracking uses OpenCV template matching to find the
object in each frame; manual digitizing lets the student click the position directly.

## Simplifications and assumptions

- Accuracy is limited by video resolution, frame rate, calibration precision, and how carefully points
  are marked — measured data carries noise, which differentiation amplifies.
- The motion is assumed to lie in the plane of the calibrated coordinate system (no out-of-plane or
  perspective correction).
- Velocity and acceleration are finite-difference estimates, not exact derivatives.
- Results are only as good as the calibration length and the steadiness of the camera.

## References

- Video-based motion analysis (e.g. the *Tracker* video analysis project, physlets, and standard lab
  curricula).
- OpenCV template matching for the auto-tracking feature.
</content>
