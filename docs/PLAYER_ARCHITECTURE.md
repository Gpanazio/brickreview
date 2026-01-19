# System Architecture: The Three Core Systems

BrickReview is composed of **three distinct, independent systems**, each designed for a specific user flow and technical requirement. They share UI primitives but maintain separate logic, state management, and media handling.

## 1. The Review System (Core)
*The professional workspace for frame-accurate collaboration.*

-   **Primary Location:** `src/components/player/`
-   **Core Component:** `VideoPlayer.jsx` (Orchestrator) & `VideoPlayerCore.jsx` (Playback)
-   **Architecture:**
    -   **Custom Native Player:** Built from scratch using HTML5 `<video>` + React. No third-party player libraries.
    -   **Frame-Accuracy:** Relies on strict FPS calculations (`blocks/time.js`) for syncing comments and drawings.
    -   **State Management:** Complex global context (`VideoContext`) handling sync between drawings (`ReviewCanvas`), timeline, and comments.
-   **Key Features:**
    -   Drawing/Annotation system.
    -   Range-based comments.
    -   Version comparison (Side-by-side).
    -   Approval workflows.

## 2. The Portfolio System (Showcase)
*The public-facing presentation layer for external clients.*

-   **Primary Location:** `src/components/portfolio/`
-   **Core Component:** `PortfolioPlayerPage.jsx`
-   **Architecture:**
    -   **Adapter Pattern:** Wraps the robust `Plyr` library to ensure maximum device compatibility (mobile, Safari, older browsers).
    -   **Isolated State:** Does **not** share state with the Review system. It is a read-only experience.
    -   **Styling:** Overrides Plyr's default styles to match BrickReview's brutalist aesthetic (e.g., custom Play/Pause overlay).
-   **Key Features:**
    -   Adaptive streaming (HLS/Dash support via Plyr).
    -   Password protection (Gatekeeper logic).
    -   View tracking and analytics.

## 3. The Storage System (Asset Management)
*The file system and quick-preview utility.*

-   **Primary Location:** `src/components/storage/`
-   **Core Component:** `FileViewer.jsx` (and `StoragePage.jsx`)
-   **Architecture:**
    -   **Lightweight Previewer:** Uses simple native browser capabilities for quick "glanceability".
    -   **File-Type Agnostic:** Handles Images, PDFs, and Videos with equal weight.
    -   **Direct Drive Integration:** Logic is coupled with Google Drive/R2 backend structures rather than video metadata.
-   **Key Features:**
    -   File management (Upload, Move, Rename).
    -   Quick preview modal.
    -   Direct download/share link generation.

---

### Summary of Differences

| Feature | Review System | Portfolio System | Storage System |
| :--- | :--- | :--- | :--- |
| **Primary Goal** | Collaboration & Feedback | Presentation & Playback | File Management |
| **Player Engine** | Custom Native (React) | Plyr (3rd Party) | Native Browser |
| **State Complexity** | High (Syncs active tools) | Low (Playback only) | Low (Modal state) |
| **Access** | Authenticated Users | Public / Password | Authenticated Users |
