# 🏗️ BrickReview Architecture

## Core Principles

BrickReview is a high-fidelity video review platform designed for professional workflows. Unlike consumer platforms (YouTube/Vimeo) that prioritize aggressive compression and adaptive bitrate (HLS), BrickReview prioritizes **frame accuracy**, **color consistency**, and **original file integrity**.

---

## 🎥 Video Pipeline (High-Fidelity)

### 1. Ingestion Strategy

All uploads are treated as professional masters. The system attempts to serve the **Original File** whenever possible to avoid re-encoding artifacts.

### 2. Intelligent Analysis & Decision Matrix

Upon upload, `ffprobe` analyzes the file's metadata (Bitrate, Resolution, Color Space). The system then decides between serving the original or generating a "Streaming High" version.

#### The Bitrate Matrix

| Detected Profile | Original Threshold | Action (if > Threshold) | Streaming High Target | Audio Target |
| :--------------- | :----------------- | :---------------------- | :-------------------- | :----------- |
| **4K (2160p)**   | **50 Mbps**        | Generate Streaming High | **35 Mbps** (H.264)   | AAC 320k     |
| **FHD (1080p)**  | **20 Mbps**        | Generate Streaming High | **15 Mbps** (H.264)   | AAC 320k     |
| **Other**        | **15 Mbps**        | Generate Streaming High | **10 Mbps** (H.264)   | AAC 320k     |

- **Scenario A (Optimized Original):** If the uploaded file is below the threshold (e.g., a 12 Mbps 1080p export), it becomes the **Default Stream**. No re-encoding occurs.
- **Scenario B (Heavy Master):** If the file exceeds the threshold (e.g., a 400 Mbps ProRes), the system generates a **Streaming High** MP4 at the target bitrate while keeping the original for download.

### 3. Color Consistency Pipeline

When re-encoding is necessary (Streaming High or Proxy), FFmpeg is strictly configured to prevent gamma shifts:

- **Pixel Format:** `yuv420p` (Ensures browser compatibility).
- **Color Primaries:** `bt709` (Forces standard Rec.709 interpretation).
- **Flags:** `-color_primaries 1 -color_trc 1 -colorspace 1` (Explicitly tags the video stream).

### 4. Proxy Generation (Always On)

Regardless of the original quality, a lightweight **720p Proxy** is always generated for mobile viewing or slow connections.

- **Target:** 720p @ 3 Mbps.
- **Audio:** AAC 192k.

---

## 🏗️ Backend Infrastructure (Async Processing)

To support high-quality encoding (which is CPU-intensive), the architecture avoids blocking the main HTTP server.

### 1. Queue System (BullMQ + Redis)

- **Upload Route:** Receives the file, saves to R2, creates a DB record with `status: pending`, and immediately returns `202 Accepted`.
- **Job Queue:** Adds a `process-video` job with the file ID and R2 path.

### 2. Processing Worker (Isolated)

A dedicated Node.js process consumes the queue:

1.  Downloads the master file from R2.
2.  Runs `ffprobe` analysis.
3.  Executes the **Bitrate Matrix** logic.
4.  Generates Thumbnails, Sprite Sheets, Proxy, and Streaming High (if needed).
5.  Updates DB record to `status: ready`.
6.  Cleans up local temp files.

---

## 🎨 Frontend Architecture (Modular Player)

The `VideoPlayer.jsx` is a modular orchestrator composed of specialized sub-components, sharing state via `VideoContext`.

### Component Structure

- **`VideoPlayerCore`**: Wraps the `Plyr` instance. Handles playback events and buffering.
- **`ReviewCanvas`**: An independent layer for drawing. Handles coordinate math (0-1 normalization) and renders strokes synchronized with `currentTime`.
- **`CommentSidebar`**: Manages the comment feed, threads, and guest inputs.
- **`Timeline`**: A custom progress bar rendering comment markers and drawing points.

### State Management (VideoContext)

Centralizes the "Single Source of Truth":

- `currentTime` & `duration`
- `isPlaying` & `volume`
- `drawings` & `comments`
- `playerRef` (Direct access to Plyr API)

---

## 🔐 Security & Access Control

- **JWT Authentication:** Standard for registered users.
- **Share Tokens:** Public links generate unique tokens with granular permissions (View-Only vs. Comment).
- **Guest Identity:** Visitors store `visitorName` in `localStorage` for session persistence across comments.
