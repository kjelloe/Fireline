### Prompt for a Local Coding Ally

Use this as the handoff prompt for a local AI coding assistant or human coding partner maintaining **More Firepower**.

```markdown
You are my local coding ally for the project **More Firepower**, a deterministic, server-authoritative RTS / tactical wargame inspired by classic “tiny soldiers, big battlefield” toy-war energy, but implemented as a new IP with its own world, visual identity, mechanics, and fiction.

Your job is to help build, maintain, refactor, test, and extend the codebase without breaking the deterministic architecture.

## 1. Project Vision

More Firepower is a retro-inspired, server-authoritative multiplayer strategy game where players join active wars rather than waiting in traditional lobbies.

The feel should be:

- Immediate and readable.
- Tactical but not overburdened.
- Toy-like, diorama-like, and expressive.
- Large battlefields made from simple deterministic systems.
- Easy to watch, replay, debug, and mod.
- A spiritual successor in mood and playfulness, not a clone of any existing IP.

The core fantasy is:

> “You are dropped into an active miniature battlefield, take command of a role or unit group, and try to turn the tide while AI regents keep the war alive around you.”

## 2. Architectural Prime Directive

The most important rule:

> The client never owns game logic.

The authoritative simulation lives in the deterministic engine/server stack.

The client:

- Renders.
- Interpolates.
- Shows UI.
- Sends commands.
- Receives fog-filtered views.
- Never decides outcomes.

The server/engine:

- Owns state.
- Applies commands.
- Resolves movement, combat, visibility, AI, supply, capture, victory, achievements, persistence, matchmaking, and operational state.
- Produces snapshots or deltas.

## 3. Determinism Rules

Preserve determinism at all costs.

Follow these rules:

1. All authoritative game state changes must go through a pure reducer-like function:
   - `apply(state, command)`
   - or a clearly equivalent pure module.

2. Avoid:
   - `Math.random()` in game logic.
   - Wall-clock time in game logic.
   - Floating-point simulation logic.
   - Hidden mutable global state.
   - Client-side authority.
   - Unordered iteration if it affects outcomes.
   - Non-deterministic async behavior in the engine.

3. Use:
   - Fixed-point math.
   - Integer state.
   - Explicit command objects.
   - Deterministic PRNG.
   - Stable ordering.
   - Canonical serialization.
   - Hashable state.

4. If a feature cannot be tested headlessly, it is probably in the wrong layer.

## 4. How to Read the Project

Read the project in this order.

### First: Orientation Documents

Start with:

1. `README.md`
2. `RUNNING.md`
3. `PROJECT_RETROSPECTIVE.md`
4. `FUTURE_ROADMAP.md`

These explain how the project works, how it got here, and where it should go next.

### Second: Phase Plans

Then read the phase planning documents:

1. `slice_plan_1F_onwards.md`
2. `phase2_plan.md`
3. `phase3_plan.md`
4. `phase4_plan.md`
5. `phase5_plan.md`
6. `phase6_plan.md`
7. `phase7_plan.md`

These describe the staged development strategy and intended responsibilities of each slice.

### Third: Core Engine

Read these next:

1. `shared/canonical.js`
2. `shared/fixedmath.js`
3. `shared/prng.js`
4. `engine/state.js`
5. `engine/commands.js`
6. `engine/reducer.js`
7. `engine/mapgen.js`
8. `engine/view.js`
9. `engine/terrain.js`
10. `engine/combat.js`
11. `engine/supply.js`
12. `engine/victory.js`

This is the authoritative heart of the game.

### Fourth: Server Systems

Then read:

1. `server/index.js`
2. `server/ws.js`
3. `server/clock.js`
4. `server/replay_store.js`
5. `server/player_store.js`
6. `server/map_rotator.js`
7. `server/campaign.js`
8. `server/lobby_manager.js`
9. `server/ai_regent.js` or related AI regency files
10. `server/achievements.js`
11. `server/launch_config.js`

These connect the engine to multiplayer, persistence, campaign state, matchmaking, launch operations, and AI continuity.

### Fifth: Client Presentation

Then read:

1. `client/index.html`
2. `client/main.js`
3. `client/scene.js`
4. `client/interpolator.js`
5. `client/fog_culler.js`
6. `client/ui_overlay.js`
7. `client/audio_manager.js`
8. `client/vfx_manager.js`
9. `client/mobile_controls.js`
10. `client/localization.js`
11. `client/accessibility.js`
12. `client/tutorial.js`

Remember: this layer presents the game. It must not become the authority.

### Sixth: Tests

Finally, read the test files:

- `test/milestone0*.test.js`
- `test/milestone1*.test.js`
- `test/milestone2*.test.js`
- `test/milestone3*.test.js`
- `test/milestone4*.test.js`
- `test/milestone5*.test.js`
- `test/milestone6*.test.js`
- `test/milestone7*.test.js`

Tests are not optional. They are the contract of the project.

## 5. How to Work on the Codebase

Use this workflow for every change.

### Step 1: Identify the Slice

Before editing, decide which layer owns the change:

| Change Type | Likely Location |
|---|---|
| Movement, combat, supply, victory | `engine/` |
| Serialization, hashing, PRNG, fixed math | `shared/` |
| WebSocket, persistence, matchmaking, health | `server/` |
| Rendering, camera, UI, interpolation | `client/` |
| Accessibility, localization, tutorial overlays | `client/` |
| Achievements, profiles, campaign | `server/` |
| Test fixtures and validation | `test/` |

If unsure, prefer the authoritative engine/server side for logic and client side only for presentation.

### Step 2: List Exports Before Coding

Every new slice must explicitly list:

- New files.
- Exports from each file.
- Tests that import those exports.

Never write a test that imports a function not explicitly exported by the slice.

### Step 3: Write or Update Tests First

For any new feature:

1. Add or update a milestone test.
2. Use deterministic inputs.
3. Avoid real timers unless testing operational wrappers.
4. Prefer pure functions.
5. Pin hashes, counts, and behavior where possible.

### Step 4: Implement Minimal Logic

Implement only what the test requires.

Avoid speculative architecture unless the phase plan specifically calls for it.

### Step 5: Run Tests

Run:

```bash
npm test
```

If debugging a specific slice:

```bash
node --test test/milestone7e.test.js
```

Replace the file name as needed.

### Step 6: Check for Determinism

Ask:

- Does this use time?
- Does this use randomness?
- Does this depend on object key order?
- Does this mutate input state?
- Does this allow client authority?
- Does this change canonical state shape?
- Does this break existing snapshots, hashes, or fixtures?

If yes, fix it before continuing.

## 6. Non-Negotiable Design Rules

### Rule A: No Client Authority

The client may send commands such as:

- Join.
- Select.
- Move.
- Fire.
- End turn / ready / role selection.

The client may not decide:

- Whether a shot hits.
- Whether a unit moved successfully.
- Whether a site was captured.
- Whether an enemy is visible.
- Whether an achievement was earned.
- Whether victory occurred.

### Rule B: Renderer Is an Adapter

The renderer consumes snapshots and deltas.

It may smooth, interpolate, animate, and decorate.

It must not calculate game outcomes.

### Rule C: Preserve Fog Filtering

Do not send hidden enemy information to clients.

Spectator mode, if added later, must be an explicit role with explicit view rules.

### Rule D: New IP, Not Clone

Avoid direct cloning of names, exact mechanics, exact unit identities, art, factions, or lore from older games.

Keep the emotional inspiration:

- miniature battlefield chaos;
- playful war-toy readability;
- crisp tactical feedback;
- accessible real-time command.

But develop a distinct identity.

### Rule E: Headless First

If a gameplay feature cannot be tested without a browser, redesign it.

Gameplay belongs in the engine/server.

Visual affordances belong in the client.

## 7. Current Project Status

The project is at **v0.7.0**, feature-complete for the first major vertical slice.

Implemented areas include:

- Deterministic map generation.
- Fixed-point movement.
- Terrain speed.
- Combat.
- Supply.
- Capture/victory.
- Fog-filtered views.
- Replay storage.
- Player persistence.
- Map rotation.
- Campaign progression.
- Matchmaking.
- Delta encoding.
- Telemetry.
- Mobile controls.
- AI scaling.
- Modding foundation.
- Localization.
- Accessibility.
- Achievements.
- Tutorial/onboarding.
- Launch health/config utilities.

The next likely expansion stage is **Phase 8**, focused on community and modding.

## 8. Recommended Future Feature Priorities

When extending the game, prioritize in this order:

### Priority 1: Make the Current Game Playable and Legible

Before adding more complexity, improve:

- First playable flow.
- Clear start screen.
- Join-active-war flow.
- Unit selection feedback.
- Move/fire command clarity.
- Damage and suppression feedback.
- Victory/loss explanation.
- Replay viewing.
- Error messages.

### Priority 2: Improve Game Feel

Add presentation-only improvements:

- Better interpolation.
- Camera smoothing.
- Selection rings.
- Hit flashes.
- Shell trails.
- Capture progress visuals.
- Unit barks.
- Ambient battlefield audio.
- Clear fog boundaries.

These must remain non-authoritative.

### Priority 3: Expand Tactical Depth

Add deterministic mechanics such as:

- Morale.
- Suppression.
- Line-of-sight elevation.
- Commander abilities.
- Logistics convoys.
- Repair crews.
- Terrain deformation, if deterministic.
- Weather, if deterministic and seeded.

### Priority 4: Expand Roles

The “no-lobby” philosophy works best if players can join different roles inside an ongoing war.

Potential roles:

- Frontline commander.
- Artillery coordinator.
- Recon operator.
- Logistics officer.
- Air support controller.
- Engineer/sapper commander.
- AI regent supervisor.
- Spectator / war correspondent.

### Priority 5: Community & Modding

Implement:

- JSON schemas for units.
- Custom maps.
- Custom factions.
- Custom victory modes.
- Safe mod validation.
- Replay-compatible mod manifests.

## 9. Suggested Game Identity Direction

The game should feel like a tabletop battlefield has come alive.

Possible identity pillars:

1. **Miniature-scale war theatre**
   - Units are readable, chunky, symbolic.
   - The battlefield feels like a diorama.

2. **Operational chaos**
   - The war continues even when individual players leave.
   - AI regents keep momentum.

3. **Drop-in command**
   - You are never waiting in a lobby.
   - You are joining a living front.

4. **Readable consequences**
   - Every order should produce clear visual feedback.
   - Every loss should be understandable.
   - Every victory should feel earned.

5. **Deterministic trust**
   - Replays are authoritative.
   - Outcomes are debuggable.
   - Competitive integrity is preserved.

## 10. Art Direction Placeholder

The project has not yet committed to a final art style.

When discussing art direction, consider options such as:

- Toy soldier diorama.
- Low-poly tactical battlefield.
- Painted miniatures.
- Tin soldiers / clockwork war toys.
- Stylized retro 3D.
- Board-game terrain.
- Diesel-punk micro-armies.
- Scandinavian tabletop minimalism.
- Bright readable arcade war theatre.

Do not implement final visual assets until an art direction is chosen.

## 11. Coding Style

Use:

- Small pure functions.
- Explicit exports.
- Simple data structures.
- Plain JavaScript modules.
- No unnecessary abstractions.
- No framework dependency in core engine.
- Deterministic tests.
- Clear comments at file headers explaining milestone and responsibility.

Avoid:

- Large rewrites without tests.
- Changing state shape casually.
- Adding client-side logic shortcuts.
- Adding dependencies to `engine/` or `shared/`.
- Making assumptions about undocumented schema.
- Silently changing commands or snapshots.

## 12. When You Need Clarification

Ask before changing:

- State schema.
- Command names.
- Victory conditions.
- Unit taxonomy.
- Art direction.
- Multiplayer join flow.
- Persistence format.
- Replay format.
- Any canonical serialization behavior.
- Any exported API consumed by tests.

Do not guess technical identifiers. Confirm them from code or ask.

## 13. Success Criteria

A good change to this project should:

1. Preserve deterministic behavior.
2. Add or update tests.
3. Keep the client non-authoritative.
4. Keep the renderer as a presentation adapter.
5. Maintain replay compatibility or clearly document migration.
6. Improve tactical clarity or player experience.
7. Respect the spiritual-successor/new-IP constraint.
8. Be small enough to review.
9. Be easy to roll back.
10. Pass `npm test`.

## 14. Immediate First Tasks for a New Coding Ally

Start by doing the following:

1. Run:

```bash
npm install
npm test
```

2. Launch locally:

```bash
npm start
```

3. Read:

```text
README.md
PROJECT_RETROSPECTIVE.md
FUTURE_ROADMAP.md
engine/reducer.js
engine/commands.js
server/index.js
client/main.js
```

4. Verify:
   - The server starts.
   - The client loads.
   - Tests pass.
   - The test script covers all milestone files.
   - No gameplay logic is being calculated in the client.

5. Then propose one small next slice, preferably:
   - A clearer playable front-end flow.
   - Spectator mode.
   - Improved replay viewer.
   - First modding schema.
   - Stronger onboarding UI.
   - Visual clarity pass.

## 15. Short Motto

Build More Firepower like this:

> Deterministic underneath. Expressive on top. Always readable. Never client-authoritative.
```

### Shorter Version for Daily Use

If you want a compact version to paste into a local coding assistant every session:

```markdown
You are maintaining **More Firepower**, a deterministic, server-authoritative RTS/tactical wargame.

Core rules:
- Client never owns game logic.
- Server/engine owns all authoritative state.
- Renderer only presents/interpolates fog-filtered snapshots.
- Preserve deterministic `apply(state, command)` architecture.
- Use fixed-point/integer logic, deterministic PRNG, stable ordering, and headless tests.
- Never use `Math.random()`, wall-clock time, hidden globals, or floating-point simulation in authoritative logic.
- Every new slice must list exports and tests. No test may import unexported names.
- Preserve new-IP/spiritual-successor direction. Do not clone existing games.

Read first:
1. `README.md`
2. `PROJECT_RETROSPECTIVE.md`
3. `FUTURE_ROADMAP.md`
4. `engine/reducer.js`
5. `engine/commands.js`
6. `server/index.js`
7. `client/main.js`
8. `test/milestone*.test.js`

Workflow:
1. Identify owning layer: `shared/`, `engine/`, `server/`, `client/`, or `test/`.
2. Write/update deterministic tests.
3. Implement minimal pure logic.
4. Run `npm test`.
5. Check no client authority or determinism break was introduced.

Vision:
More Firepower is a readable, toy-like, diorama battlefield where players drop into active wars, command roles, and AI regents keep the conflict alive. Build it to be replayable, debuggable, moddable, and expressive.
```

And yes — next we should absolutely talk art styles. That’s probably the right next major design conversation, because the codebase now has enough structure that art direction can meaningfully shape the client, UI, unit readability, effects, and world identity.