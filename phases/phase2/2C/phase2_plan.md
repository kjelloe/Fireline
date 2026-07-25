# Phase 2: Networked Vertical Slice & Client Integration

## Overview
Phase 2 transitions the deterministic engine into a fully networked, interactive experience. It focuses on real-time state synchronization, a 2.5D three.js presentation layer, and the "no-lobby" user interface.

## Milestone 2B: WebSocket Server & State Sync
**Goal:** Expose the deterministic loop to external clients via WebSockets.
- **Exports:** `server/ws.js` (WebSocket handler), `server/state_manager.js` (World instance management).
- **Logic:** 
  - Listen for `JOIN` and `COMMAND` messages.
  - Broadcast `VIEW` snapshots (fog-filtered) to connected operators at 10Hz.
  - Maintain a `World` registry keyed by a unique `worldId`.
- **Tests:** 
  - `test/milestone2b.test.js`: Verify WebSocket message handling and state broadcasting.
  - `test/headless/sim2b.js`: Simulate multiple clients joining and receiving updates.

## Milestone 2C: Three.js Renderer Adapter
**Goal:** Build the non-authoritative 2.5D diorama renderer.
- **Exports:** `client/renderer.js` (Three.js scene setup), `client/interpolator.js` (10Hz snapshot smoothing).
- **Logic:**
  - Consume `VIEW` snapshots from the server.
  - Interpolate asset positions between ticks for smooth 60fps+ rendering.
  - Map terrain IDs to procedural or placeholder 3D geometry.
- **Tests:** 
  - `test/milestone2c.test.js`: Verify interpolator logic and scene graph updates.

## Milestone 2D: Input Overlay & Command Dispatch
**Goal:** Implement the "no-lobby" in-world UI for role selection and control.
- **Exports:** `client/ui_overlay.js` (HTML/CSS overlays), `client/input_handler.js` (Raycasting/Clicks).
- **Logic:**
  - Allow users to select a team and spawn as an operator via an in-world menu.
  - Translate mouse clicks on the 3D scene into `MOVE` or `FIRE` commands.
  - Send commands to the server via WebSocket.
- **Tests:** 
  - `test/milestone2d.test.js`: Verify command serialization and UI state transitions.

## Milestone 2E: Fog-of-War Client Culling
**Goal:** Ensure the client only renders what the operator is allowed to see.
- **Exports:** `client/fog_culler.js`.
- **Logic:**
  - Apply the server-provided `visibleIds` mask to the Three.js scene.
  - Hide or "ghost" enemy units outside the Line-of-Sight radius.
  - Visualize the "Fog of War" boundary on the terrain.
- **Tests:** 
  - `test/milestone2e.test.js`: Verify that hidden assets are not present in the renderable scene.

## Milestone 2F: Vertical Slice Polish & Deployment
**Goal:** Finalize the playable prototype for external testing.
- **Exports:** `client/main.js` (Entry point), `server/index.js` (Production entry).
- **Logic:**
  - Integrate all client-side modules into a single `index.html`.
  - Add basic sound effects and visual feedback for combat/capture.
  - Package for deployment (e.g., Docker or static build).
- **Tests:** 
  - `test/milestone2f.test.js`: End-to-end integration test (Client -> Server -> Engine -> Client).

## Contract Rules for Phase 2
1. **No Client-Side Authority:** The client never calculates game logic; it only interpolates and presents.
2. **Fog-First Rendering:** The renderer must respect the `VIEW` snapshot's visibility mask strictly.
3. **Deterministic Networking:** All state changes must originate from the server's `apply()` loop.
