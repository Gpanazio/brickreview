# Storage System (Asset Management)

This directory contains the **Storage System**, responsible for file organization, Google Drive integration, and asset management.

## Architectural Note
The "Player" in this system (`FileViewer.jsx`) is a lightweight utility designed for fast previews. It does not share architecture with either the Review System or the Portfolio System.

## Features
-   **Agnostic Preview:** Treats videos, images, and PDFs equally.
-   **Native Controls:** Uses standard browser media controls for simplicity and speed.
-   **Direct Management:** Handles CRUD operations (Move, Rename, Delete) directly on the backend file system.
