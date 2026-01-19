# Review System (Core)

This directory contains the **Video Review System**, the core collaboration engine of BrickReview.

## Architectural Note
Unlike the Portfolio or Storage systems, this component implements a **Custom Native Video Player** built from scratch on top of HTML5 `<video>`.

## Why Custom?
We do not use libraries like Plyr or Video.js here because we need:
1.  **Frame-Accuracy:** Precise control over `currentTime` for syncing comments.
2.  **Canvas Integration:** The video element must sit perfectly under the `<ReviewCanvas />` for drawing calibration.
3.  **State Complexity:** Playback state drives the entire UI (Sidebar, Timeline, Comparison Mode).
