# Portfolio System (Showcase)

This directory contains the **Portfolio System**, the public-facing presentation layer of BrickReview.

## Architectural Note
This system creates an isolated, read-only environment for external clients. It uses **Plyr** as its underlying engine to ensure maximum compatibility across all devices and browsers (Mobile Safari, Android Chrome, etc.).

## Key Differences from Review System
-   **Engine:** Uses `Plyr` (3rd party) instead of our custom native player.
-   **State:** Completely isolated. Does not access global `VideoContext`.
-   **Goal:** Prioritizes smooth playback and streaming (HLS/Dash) over frame-accurate collaboration tools.
