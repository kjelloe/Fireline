# More Firepower: Future Roadmap & Expansion Plan

**Version:** 0.8.0+ (Post-Launch)  
**Status:** Planning Phase  
**Focus:** Community, Esports, and Platform Expansion

---

## 1. Phase 8: Community & Modding Ecosystem

The core engine is now stable. The next logical step is to empower the community to create their own content, extending the game's lifespan indefinitely.

### 8A. Modding API & Sandbox
- **Goal:** Allow users to create custom units, maps, and rules without touching the core engine code.
- **Implementation:** 
  - Create a `mod_loader.js` that safely evaluates user-provided JSON/JS configurations.
  - Implement a "Sandboxed Reducer" that runs modded logic in a separate context to prevent crashes.
  - **Deliverable:** `server/mod_loader.js` and a `mods/` directory structure.

### 8B. Map Editor & Workshop
- **Goal:** A browser-based tool for designing and sharing custom maps.
- **Implementation:**
  - Build a React-based UI that visualizes the `mapgen.js` output.
  - Allow manual placement of terrain, sites, and starting positions.
  - Integrate with a simple "Workshop" API for uploading/downloading `.json` map files.
  - **Deliverable:** `client/map_editor.js` and `server/workshop.js`.

### 8C. Custom Game Modes
- **Goal:** Support modes beyond standard conquest (e.g., King of the Hill, Capture the Flag).
- **Implementation:**
  - Refactor `engine/victory.js` to accept a "Victory Condition" plugin.
  - Add hooks for "Objective Sites" that trigger events when captured.
  - **Deliverable:** `engine/victory_plugins.js` (KOTH, CTF, Survival).

---

## 2. Phase 9: Esports & Spectator Features

To transition from a hobby project to a competitive title, we need robust tools for observers and tournament organizers.

### 9A. Spectator Mode & Fog Removal
- **Goal:** Allow observers to see the entire map without fog of war.
- **Implementation:**
  - Add a `SPECTATOR` role in `engine/commands.js`.
  - Modify `engine/view.js` to bypass fog-culling for spectator IDs.
  - **Deliverable:** `client/spectator_ui.js` (Minimap toggle, unit tracking).

### 9B. Replay Analysis & Timeline
- **Goal:** A tool to scrub through replays, view APM (Actions Per Minute), and analyze key moments.
- **Implementation:**
  - Enhance `server/replay_store.js` to index key events (kills, captures).
  - Build a timeline UI in the client that allows jumping to specific ticks.
  - **Deliverable:** `client/replay_analyzer.js`.

### 9C. Tournament Brackets & Ladders
- **Goal:** Automated matchmaking for ranked play.
- **Implementation:**
  - Implement an ELO-based ranking system in `server/player_store.js`.
  - Create a "Tournament Manager" that groups players into brackets.
  - **Deliverable:** `server/ladder_manager.js` and `client/leaderboard.js`.

---

## 3. Phase 10: Cross-Platform & Native Performance

Moving beyond the browser to reach a wider audience on mobile and console.

### 10A. Native Core Port (C++/Rust)
- **Goal:** Port the deterministic `apply` reducer to a native language for maximum performance.
- **Implementation:**
  - Rewrite `engine/reducer.js` and `engine/mapgen.js` in Rust.
  - Use WebAssembly (WASM) to run the native core in the browser.
  - **Deliverable:** `core/reducer.rs` and `core/wasm_bridge.js`.

### 10B. Mobile App Wrapper
- **Goal:** A native iOS/Android app that wraps the web client.
- **Implementation:**
  - Use Capacitor or React Native to wrap the `client/` directory.
  - Optimize touch controls further for smaller screens.
  - **Deliverable:** `mobile/` project structure.

### 10C. Offline "Skirmish" Mode
- **Goal:** Play against AI without an internet connection.
- **Implementation:**
  - Bundle the `engine/` logic directly into the client bundle.
  - Run a "Local Server" instance within the client's web worker.
  - **Deliverable:** `client/local_engine_worker.js`.

---

## 4. Technical Debt & Refactoring Targets

As we expand, we must keep the codebase clean and maintainable.

| Target | Issue | Proposed Fix |
| :--- | :--- | :--- |
| **State Schema** | `state.js` is growing large. | Move to a schema-validation library (e.g., Zod) for better type safety. |
| **AI Logic** | `ai_regent.js` is becoming complex. | Refactor into a Behavior Tree system for more modular AI behaviors. |
| **Networking** | WebSocket handling is basic. | Implement a "Reliable UDP" layer or use WebRTC for lower-latency P2P options. |
| **Testing** | Headless sims are slow. | Parallelize test execution using Node.js worker threads. |

---

## 5. Immediate Next Steps (v0.8.0)

1.  **Modding API:** Start with 8A. Define the JSON schema for custom units.
2.  **Spectator Mode:** Implement 9A. This is critical for community growth and content creation.
3.  **Documentation:** Update `README.md` to include a "For Modders" section.

---

*This roadmap is a living document. Priorities may shift based on community feedback and technical discoveries.*
