# More Firepower — Slice Plan: 1F onwards
## Context

Last verified green baseline: **Milestone 1E** (27/27 tests passing).

Verified stack at 1E:
- `shared/canonical.js` — byte writer, FNV-1a, assertU32
- `shared/prng.js` — mix32, sfc32
- `shared/fixedmath.js` — fixed-point math
- `engine/mapgen.js` — generateMap, T_* terrain constants
- `engine/state.js` — createInitialState, OP_ACTIVE
- `engine/reducer.js` — apply(state, command)
- `engine/clock.js` — TickClock
- `engine/snapshot.js` — snapshot ring
- `engine/transport.js` — WebSocket router
- `engine/session.js` — operator/team session
- `engine/ai_regency.js` — AI regency ownership
- `engine/view.js` — fog-filtered view builder
- `client/index.html` + `client/js/client.js` — three.js 2.5D renderer

## The Problem We Are Solving

Every slice from 1F onwards broke because I wrote tests that imported names
that did not exist in the verified source files. ES module instantiation fails
the entire test file on the first missing name — so one wrong import kills all
subtests in that file.

## The New Rule For Every Slice

Before writing a single test, each slice document must list:
1. Every file it will ADD (new exports listed explicitly)
2. Every file it will MODIFY (existing exports that change)
3. Every import the test file will use (must match 1 or 2 exactly)

No test may import a name that is not in the explicit export list of that slice.

---

## Slice 1F — Terrain Speed Multipliers + Map Rendering

### Goal
Prove that terrain type affects movement speed and that the client can render
the map grid.

### Files added
- `engine/terrain.js`
  - exports: `speedMultiplier(terrainId)`, `TERRAIN_SPEED`

### Files modified
- `engine/reducer.js` — movement tick reads `speedMultiplier` from terrain.js
- `engine/view.js` — view includes `mapCells` array for client rendering
- `client/js/client.js` — renders coloured terrain tiles from `mapCells`

### Test imports (milestone1f.test.js)
```
import { speedMultiplier, TERRAIN_SPEED } from '../engine/terrain.js';
import { apply, createInitialState } from '../engine/reducer.js';
import { buildView } from '../engine/view.js';
import { generateMap } from '../engine/mapgen.js';
```

### Acceptance criteria (TAP subtests)
1. `1F terrain speed table has correct values` — road=1.4, open=1.0, forest=0.7, rough=0.5, blocking=0.0
2. `1F asset on road tile moves faster than on open tile` — after N ticks, road asset is further
3. `1F asset on blocking tile does not move` — position unchanged after 10 ticks
4. `1F view includes mapCells for client terrain rendering` — view.mapCells is Uint8Array, length = w*h
5. `1F reducer does not mutate input state with map argument` — deep-equal before/after

### Headless sim output
```
Tick  1 | A0 pos | A4 pos | ring N/30
...
Terrain speed multipliers: road=1.4x open=1.0x forest=0.7x rough=0.5x blocking=0.0x
```

---

## Slice 1G — Combat: Area Fire, HP Depletion, Disablement

### Goal
Prove that a FIRE command reduces target HP, that HP=0 disables the asset
(status → DISABLED), and that a disabled asset cannot move or fire.

### Files added
- `engine/combat.js`
  - exports: `resolveShot(attacker, target, rules)` → `{ hpDelta, suppressed }`

### Files modified
- `engine/state.js` — adds `ASSET_DISABLED` constant (export)
- `engine/reducer.js` — handles `FIRE` command, calls resolveShot, sets status
- `engine/view.js` — view includes `hp` and `status` per asset

### Test imports (milestone1g.test.js)
```
import { resolveShot } from '../engine/combat.js';
import { apply, createInitialState } from '../engine/reducer.js';
import { buildView } from '../engine/view.js';
import { generateMap } from '../engine/mapgen.js';
import { ASSET_DISABLED } from '../engine/state.js';
```

### Acceptance criteria (TAP subtests)
1. `1G resolveShot reduces HP by expected delta` — pinned value from rules
2. `1G repeated fire disables asset at HP=0` — status becomes ASSET_DISABLED
3. `1G disabled asset cannot move` — MOVE command rejected
4. `1G disabled asset cannot fire` — FIRE command rejected
5. `1G fire command rejected for out-of-range target` — range check
6. `1G fire command rejected for friendly target` — team check
7. `1G view reports correct hp and status after combat` — view fields match state

### Headless sim output
```
Tick N | A0 fires at A4 | A4 hp: X -> Y | status: ACTIVE/DISABLED
```

---

## Slice 1H — Fog of War: LOS Masking + Suppression Visibility

### Goal
Prove that units outside fog radius are hidden in the view, that suppressed
units have reduced visibility radius, and that disabled wrecks remain visible
(they are terrain features).

### Files added
- `engine/los.js`
  - exports: `computeVisible(state, operatorId, map)` → `Set<assetId>`

### Files modified
- `engine/view.js` — uses computeVisible; suppressed assets get half radius
- `engine/state.js` — adds `ASSET_SUPPRESSED` constant (export)

### Test imports (milestone1h.test.js)
```
import { computeVisible } from '../engine/los.js';
import { apply, createInitialState } from '../engine/reducer.js';
import { buildView } from '../engine/view.js';
import { generateMap } from '../engine/mapgen.js';
import { ASSET_SUPPRESSED, ASSET_DISABLED } from '../engine/state.js';
```

### Acceptance criteria (TAP subtests)
1. `1H enemy asset outside fog radius is hidden in view`
2. `1H enemy asset inside fog radius is visible in view`
3. `1H suppressed asset has reduced visibility radius`
4. `1H disabled wreck remains visible regardless of fog`
5. `1H computeVisible returns correct set for team 0`
6. `1H computeVisible returns correct set for team 1`

---

## Slice 1I — Relay Sites: Capture, Ownership, Fog Extension

### Goal
Prove that a neutral Relay site can be captured by moving an asset onto it,
that ownership changes team, and that owning a Relay extends fog radius for
that team.

### Files added
- `engine/sites.js`
  - exports: `SITE_RELAY`, `SITE_NEUTRAL`, `captureCheck(state, assetId)`

### Files modified
- `engine/state.js` — adds `sites` array to initial state; exports `SITE_RELAY`, `SITE_NEUTRAL`
- `engine/reducer.js` — on MOVE completion, calls captureCheck
- `engine/view.js` — view includes `sites` array (id, type, owner, pos)

### Test imports (milestone1i.test.js)
```
import { SITE_RELAY, SITE_NEUTRAL, captureCheck } from '../engine/sites.js';
import { apply, createInitialState } from '../engine/reducer.js';
import { buildView } from '../engine/view.js';
import { generateMap } from '../engine/mapgen.js';
```

### Acceptance criteria (TAP subtests)
1. `1I neutral relay has no owner in initial state`
2. `1I asset moving onto relay captures it`
3. `1I captured relay changes owner to asset team`
4. `1I owning relay extends fog radius for that team`
5. `1I enemy recapture changes owner back`
6. `1I view includes sites array with correct fields`

---

## Slice 1J — Supply: Ammo/Fuel Depletion + Resupply at Base

### Goal
Prove that firing consumes ammo, moving consumes fuel, that an asset with
ammo=0 cannot fire, and that returning to home base restores supply.

### Files added
- `engine/supply.js`
  - exports: `SUPPLY_FIRE_COST`, `SUPPLY_MOVE_COST`, `resupplyAt(state, assetId)`

### Files modified
- `engine/state.js` — assets have `ammo` and `fuel` fields in initial state
- `engine/reducer.js` — FIRE deducts ammo; MOVE deducts fuel; at base, resupply
- `engine/view.js` — view includes `ammo` and `fuel` per own asset

### Test imports (milestone1j.test.js)
```
import { SUPPLY_FIRE_COST, SUPPLY_MOVE_COST, resupplyAt } from '../engine/supply.js';
import { apply, createInitialState } from '../engine/reducer.js';
import { buildView } from '../engine/view.js';
import { generateMap } from '../engine/mapgen.js';
```

### Acceptance criteria (TAP subtests)
1. `1J firing deducts ammo by SUPPLY_FIRE_COST`
2. `1J asset with ammo=0 cannot fire`
3. `1J moving deducts fuel by SUPPLY_MOVE_COST per tick`
4. `1J asset at home base is resupplied`
5. `1J view reports correct ammo and fuel for own assets`
6. `1J enemy asset supply fields are hidden in view`

---

## Slice 1K — Replay: Command Log + Hash Reconstruction

### Goal
Prove that a recorded command log can be replayed from the initial state to
reproduce the exact final state hash — the core determinism guarantee.

### Files added
- `engine/replay.js`
  - exports: `recordCommand(log, tick, cmd)`, `replayLog(initialState, log, map)`

### Files modified
- `engine/reducer.js` — no changes needed (replay uses apply directly)
- `engine/server.js` — server records commands to an in-memory log

### Test imports (milestone1k.test.js)
```
import { recordCommand, replayLog } from '../engine/replay.js';
import { apply, createInitialState } from '../engine/reducer.js';
import { generateMap } from '../engine/mapgen.js';
```

### Acceptance criteria (TAP subtests)
1. `1K empty log replay matches initial state hash`
2. `1K single command replay matches live hash`
3. `1K 50-tick command sequence replay matches live hash`
4. `1K replay is deterministic across two runs`
5. `1K out-of-order commands are rejected by replay`

---

## Slice 2A — First Playable: Two-Asset Skirmish (Integration)

### Goal
Integration slice. No new engine logic. Proves the full stack works end-to-end:
two browser clients, one server, fog-filtered views, combat, relay capture,
supply, and replay — all in one 5-minute headless soak.

### Files added
- `test/headless/sim2a.js` — 300-tick soak, two AI operators, full ruleset

### Files modified
- None (uses all verified 1G–1K modules)

### Test imports (milestone2a.test.js)
```
import { apply, createInitialState } from '../engine/reducer.js';
import { generateMap } from '../engine/mapgen.js';
import { replayLog } from '../engine/replay.js';
```

### Acceptance criteria (TAP subtests)
1. `2A 300-tick soak completes without error`
2. `2A final state hash is stable across two runs`
3. `2A replay of soak log matches final state hash`
4. `2A at least one relay captured during soak`
5. `2A at least one asset disabled during soak`
6. `2A no asset supply goes below zero`

---

## Delivery Protocol (applies to every slice from 1F onwards)

### Before writing any code
1. List every export the new file will provide.
2. List every import the test file will use.
3. Confirm every import name exists in the export list.

### Package structure
Each slice zip contains:
- All prior verified files (unchanged)
- New/modified engine files
- New test file
- Updated `package.json` with correct test script
- `RUNNING.md` with exact commands

### Test script in package.json
```json
"test": "node --test test/milestone0.test.js test/milestone0i.test.js test/milestone1a.test.js test/milestone1b.test.js test/milestone1c.test.js test/milestone1d.test.js test/milestone1e.test.js test/milestone1f.test.js"
```
Each new slice appends its test file to this list.

### Green gate rule
A slice is only "verified" when ALL prior tests still pass AND all new tests pass.
No slice is delivered until the prior slice is green.

---

## Summary Table

| Slice | New Module | Key Mechanic | New Tests |
|-------|-----------|--------------|-----------|
| 1F | terrain.js | Speed multipliers, map render | 5 |
| 1G | combat.js | HP, fire, disable | 7 |
| 1H | los.js | LOS masking, suppression fog | 6 |
| 1I | sites.js | Relay capture, fog extension | 6 |
| 1J | supply.js | Ammo/fuel, resupply | 6 |
| 1K | replay.js | Command log, hash reconstruction | 5 |
| 2A | sim2a.js | Full integration soak | 6 |

Total new tests: **41** on top of the verified 27 from 0A–1E.
