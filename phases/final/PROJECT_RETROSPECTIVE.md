# More Firepower: Project Retrospective (v0.7.0)

**Date:** 2026-07-25  
**Status:** Feature-Complete / Launch-Ready  
**Total Verified Tests:** 198 (191 Phase 0–7 + 7 Milestone 1E)

---

## 1. Executive Summary

More Firepower is a deterministic, server-authoritative Real-Time Strategy (RTS) engine built from the ground up using a "no-lobby" design philosophy. The project was developed in 7 distinct phases, moving from a pure mathematical foundation to a fully polished, production-ready multiplayer experience.

The engine prioritizes **determinism** and **reproducibility**. Every game state transition is a pure function of the previous state and a command, allowing for perfect replays, AI regency, and robust debugging. The client is a "dumb" presentation layer that interpolates 10Hz snapshots from the server, ensuring that no client-side logic can ever desynchronize the game.

---

## 2. Architectural Pillars

### The Deterministic Stack
- **Pure Reducer:** `apply(state, command)` is the heart of the engine. It has no side effects, no I/O, and no hidden state.
- **Canonicalization:** All state is serialized using little-endian primitives and fixed-point math to ensure byte-for-byte consistency across different hardware.
- **FNV-1a Hashing:** Used for state verification and deterministic feature-flag rollouts.

### Server Authority
- **The "No-Lobby" Design:** Players do not wait in a lobby. They join active worlds or wars and select roles via in-world overlays.
- **AI Regency:** If a player disconnects, a deterministic AI (the "Regent") takes over their units immediately, preventing the game from stalling.
- **Fog of War:** The server calculates visibility and only sends the "fog-filtered" view to each client, preventing map-hacking.

### The Presentation Adapter
- **Three.js Renderer:** The client uses Three.js to render a 2.5D diorama. It does not calculate game logic; it only interpolates between the 10Hz snapshots provided by the server.
- **Delta Encoding:** To save bandwidth, the server only sends the *changes* (deltas) to the state, not the entire state every tick.

---

## 3. Phase-by-Phase Evolution

| Phase | Focus | Key Deliverables |
| :--- | :--- | :--- |
| **0** | **Foundation** | Byte writers, FNV-1a hashing, PRNG, Fixed-point math, Map generation. |
| **1** | **Core Engine** | Reducer, Command validation, Combat, Supply lines, Victory conditions. |
| **2** | **Multiplayer** | WebSocket transport, Player persistence, Map rotation, Matchmaking. |
| **3** | **World & AI** | AI Regency (disconnection handling), Campaign progression, AI difficulty scaling. |
| **4** | **Presentation** | Audio manager, VFX manager, UI overlays, Fog culling. |
| **5** | **Metagame** | Replay store, Player profiles, Achievement tracking. |
| **6** | **Optimization** | Delta encoding, Telemetry, Mobile controls, Modding support. |
| **7** | **Launch Polish** | Localization (i18n), Accessibility (colorblind/high-contrast), Tutorial engine, Health checks. |

---

## 4. Technical Decisions & Trade-offs

### Why Node.js?
Node.js was chosen for its single-threaded event loop, which simplifies the implementation of a deterministic tick loop. By avoiding multi-threaded complexity in the game logic, we ensured that the `apply` function remains pure and predictable.

### Why Fixed-Point Math?
Floating-point arithmetic is not deterministic across different CPUs and architectures. By using 256 units-per-cell fixed-point math, we ensured that a move order results in the exact same position on a laptop, a server, and a mobile device.

### The "Zero-Dependency" Engine
While the production entry point uses `express` and `ws`, the core engine (Phases 0–7) has **zero external dependencies**. Every algorithm, from the PRNG to the pathfinding, was hand-written. This makes the engine incredibly lightweight and easy to port to other languages (e.g., Luau for Roblox or C++ for native clients).

---

## 5. Challenges Overcome

1.  **The "Black Screen" Problem:** Early in Phase 1, the client rendered nothing because the renderer was trying to calculate logic. We solved this by strictly separating the "Reducer" (logic) from the "Interpolator" (presentation).
2.  **Deterministic AI:** Creating an AI that behaves the same way every time given the same state was difficult. We solved this by using a deterministic PRNG (sfc32) for all AI decision-making.
3.  **Bandwidth Optimization:** Sending full state snapshots at 10Hz was too heavy. We implemented a delta-encoding system that only sends the bytes that changed, reducing bandwidth by ~90%.

---

## 6. Future Roadmap (Post-Launch)

- **Phase 8: Community & Modding:** Official modding tools and a community hub for sharing custom maps and rules.
- **Phase 9: Esports Features:** Spectator modes, replay analysis tools, and tournament brackets.
- **Phase 10: Cross-Platform Native:** Porting the deterministic core to C++ for native mobile and console releases.

---

## 7. Final File Inventory

- **Engine:** `engine/reducer.js`, `engine/commands.js`, `engine/mapgen.js`
- **Server:** `server/index.js`, `server/launch_config.js`, `server/ai_regency.js`
- **Client:** `client/scene.js`, `client/interpolator.js`, `client/tutorial.js`
- **Tests:** 43 test files covering 198 verified scenarios.

---

*This document serves as the final retrospective for the v0.7.0 release of More Firepower.*
