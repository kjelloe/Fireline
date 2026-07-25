# Dev Log — More Firepower rebuild

Slice-by-slice rebuild of `./` from `phases/`, per decisions in `dev-prompts.md`.
Each entry maps to one local git commit tagged `marker-NNNN` in its message.

---

## marker-0001 — Baseline: green suite at milestone 0→1F (2026-07-25)

**Goal:** reconstruct a green 1E+1F baseline in `./` (49/49 tests).

**Finding:** the root tree was a chimera. `engine/server.js`, `transport.js`,
`ai_regency.js`, `snapshot.js`, `clock.js`, `commands.js`, `session.js`,
`frontier_corridor.js` were genuine 1E-era implementations, but
`shared/canonical.js`, `shared/prng.js`, `shared/fixedmath.js`,
`engine/state.js`, `engine/reducer.js`, `engine/view.js`, `engine/mapgen.js`
had been clobbered by the standalone 1F drop-in package (float math in the
reducer, a non-byte "byte writer", drifted mix32 constants). The original 1E
implementations exist nowhere in `phases/` — only their tests and byte-exact
fixtures survive. Those fixtures were used as the reconstruction spec.

**Reconstructed (fixture-verified against original pins):**
- `shared/canonical.js` — true LE byte writer (fixture 0A), FNV-1a 64 via
  16-bit limb math, no BigInt (fixture 0B), `hashToHex64`.
- `shared/prng.js` — mix32 per the algorithm documented in fixture 0C;
  `seedSfc32(seed) = {a..d} = mix32(seed+1..4)`; standard sfc32 step
  (fixture 0D incl. sequence hashes). Root's mix32 had drifted constants.
- `shared/fixedmath.js` — added `floorDivI32`, `absI32`, `cellToWorld`,
  `worldToCellFloor`, `manhattanDistanceI32` (fixture 0E). Kept `clampI32`,
  `mulFixed`, `divFixed`.
- `engine/state.js` — full 1E schema: 32 operators (16..23 = AI regency),
  8 field assets (team A cell x=7, team B x=117, rows 56/58/60/62), teamScores,
  events. Map-profile registry (`frontier_corridor`) or sandbox map object.
- `engine/reducer.js` — pure `apply(state, command)`: join/select/move/advance
  with the original event shapes incl. `rejected` events (from 1A fixture);
  integer axis-major movement, BASE_SPEED 16, 1F terrain multipliers merged in.
- `engine/view.js` — per-team fog views: `friendlyAssets`, `visibleEnemies`
  (Chebyshev radius 12 cells, minimal enemy record), `events`, `mapCells`.
- `engine/mapgen.js` — parametric generator honoring the 0F structural
  contract (road spine, protected 2x2 bases, dims 4..256).

**Fixtures:** 0I (frontier corridor 128x128) and 0A–0E pass against their
ORIGINAL pins — proof the reconstruction matches the lost originals.
Regenerated (originals unrecoverable, provenance noted in each file):
- `0F_map_8x8.json` → fixtureVersion 2 (lost mapgen algorithm; structural
  invariants still enforced by the test).
- `1A_reducer.json` → fixtureVersion 2 (hashes only; the 14-step command
  script, event payloads, ticks, and rejection cases reproduced VERBATIM by
  the reconstructed reducer before re-pinning).

**Tests rewritten (per decision: tests follow source):**
- `test/milestone1f.test.js` + `test/headless/sim1f.js` — ported from the
  standalone 1F package API to the merged engine (`advance_tick`, full asset
  schema, team-based views). Intent preserved.

**Added:** `test/baseline.test.js` — 17 self-tests: shared-layer edge cases,
rejection paths, asset handover/release, exact-arrival movement, fog boundary
at radius 12 vs 13, enemy-record minimality (no hp/target leak), 300-tick AI
determinism, human+AI interleaved reproducibility, no-eviction guarantee.

**Removed:** `shared/types.js`, `engine/ai.js` (unused stubs with conflicting
constants; recoverable via git).

**Result:** `npm test` 49/49. `node test/headless/sim1f.js` runs.

---

## marker-0002 — Slice 1G: combat, HP depletion, disablement (2026-07-25)

**Policy decision (applies to every slice from here):** the phase-folder code
for 1G+ descends from the degraded standalone-1F fork (`'tick'` commands,
fire-by-assetId with no operator authority, no events, no fog). Slices are
therefore re-implemented on the reconstructed authoritative engine: each
slice's game-design content (mechanics, rules, pinned constants, acceptance
criteria) is kept; its code is treated as reference only; its tests are ported
to the command-authority flow.

**Added:**
- `engine/combat.js` — `resolveShot` (pinned 20 hp/shot), `inFireRange`
  (1280 fixed units = 5 cells, integer squared distance), `DEFAULT_RULES`.
- `fire_order` command (`commands.js` validation + reducer handler):
  operator must be active and own an operable asset; target must exist, be
  hostile and operable, and be in range. Emits `fire_resolved` (+
  `asset_disabled` at hp 0); every rejection emits a `rejected` event with a
  specific reason. Disablement stops mid-move assets.
- `test/milestone1g.test.js` — all 7 plan acceptance criteria + 3 self-tests
  (disable-while-moving, refire-at-disabled rejected, overkill floors at 0).
- `test/headless/sim1g.js` + `sim1g` npm script.

**Result:** `npm test` 59/59.

---

## marker-0003 — Slice 1H: fog LOS + suppression visibility (2026-07-25)

**Added:** `engine/los.js` (`computeVisible(state, team)`, `sensorRadius`,
radii 12 / 6-when-suppressed); `view.js` now delegates visibility to it.
Suppression implemented as `suppressedTimer` on assets (30 ticks, set by a
non-lethal hit, decremented each advance_tick) — deliberately NOT an asset
state, since it must coexist with IDLE/MOVING; plan's `ASSET_SUPPRESSED`
constant replaced by `isSuppressed(asset)` helper (deviation logged).
Wrecks (disabled/salvaged) are always visible and never act as sensors.

**Schema:** `suppressedTimer` added to asset hash (snapshot.js + 1A test
hash fn); `1A_reducer.json` → fixtureVersion 3 (hashes only, events verbatim).

**Tests:** `milestone1h.test.js` — 6 plan criteria + 3 self-tests (suppress →
recover cycle, no timer on wrecks, wrecked sensors blind). 68/68 green.

---

## marker-0004 — Slice 1I: relay sites, capture, fog extension (2026-07-25)

**Added:** `engine/sites.js` (`SITE_RELAY`, `SITE_NEUTRAL`, `RELAY_FOG_CELLS`
16, pure `captureCheck`); three neutral relays on frontier_corridor at cells
(32,63), (63,63), (95,63); capture pass in advance_tick (stable asset order
decides same-tick contests, wrecks can't capture, no repeat events); owned
relays act as team sensors in `los.computeVisible`; views expose the public
sites array (id/type/owner/cell only).

**Schema:** `sites` hashed after assets (snapshot.js + 1A test hash);
`1A_reducer.json` → fixtureVersion 4 (hashes only, events verbatim).

**Tests:** `milestone1i.test.js` — 6 plan criteria + 3 self-tests
(captureCheck purity + wreck exclusion, no repeat capture events, sites
affect state hash). 76/76 green.

---

## marker-0005 — Slice 1J: ammo/fuel supply + base resupply (2026-07-25)

**Added:** `engine/supply.js` (AMMO_MAX 12, FUEL_MAX 600, fire cost 1,
move cost 1/tick, `inOwnBase`, pure `resupplyAt`); firing checks/deducts
ammo ("out of ammo" rejection); movement burns fuel only when it actually
moved; fuel 0 = stranded (stays MOVING, goes nowhere); resupply pass after
capture pass restores idle assets in their own base (event `resupplied`).
Design call: only IDLE assets resupply — transiting the base does not, which
keeps advance_tick event streams quiet and preserves the 1A event contract.
Base zones are hashed state (`state.bases`, from FRONTIER_CORRIDOR for the
profile, injectable in sandbox).

**Schema:** ammo/fuel per asset + bases array hashed; `1A_reducer.json` →
fixtureVersion 5 (hashes only, events verbatim).

**Refactor:** shared `test/helpers.js` (makeAsset/sandbox/joinAndSelect/
joinSelectMove) so schema growth touches one builder; 1F–1J tests migrated.

**Tests:** `milestone1j.test.js` — 6 plan criteria + 5 self-tests (stranded
at fuel 0, no transit resupply, enemy base refuses, no repeat event,
ammo-cycle back to combat-ready). 87/87 green.

---

## marker-0006 — Slice 1K: command log + replay reconstruction (2026-07-25)

**Added:** `engine/replay.js` (`recordCommand` with non-decreasing tick
enforcement, `replayLog` = plain fold of apply over the log);
`GameServer.commandLog` records every applied command — client FIFO, AI
regency, and the server-owned advance_tick — in authoritative order, making
replay an exact reproduction.

**Tests:** `milestone1k.test.js` — 5 plan criteria (incl. 50-tick live-vs-
replay hash equality with AI + human commands) + 2 self-tests (log ordering
contract, replay leaves initial state untouched). 94/94 green.
**Phase 1 complete.**

---

## marker-0007 — Slice 2A: first playable full-stack soak (2026-07-25)

**Integration slice, no new engine logic.** `test/headless/soak2a.js` runs two
scripted operators that emulate browser clients: they read only their own
fog-filtered views and answer with ordinary commands. They cross the corridor
on opposing routes, duel on contact (asset 4 disabled ~tick 867), and the
survivor captures the east relay (~tick 1556). Replay of the recorded command
log reproduces the live hash exactly.

**Tuning:** `FUEL_MAX` 600 → 2400. At BASE_SPEED (1/16 cell/tick) and
1 fuel/moving-tick, 600 fuel stranded assets after ~37 cells on a 128-cell
map; 2400 covers a full crossing with margin. `1A_reducer.json` →
fixtureVersion 6 (hashes only).

**Tests:** `milestone2a.test.js` — 6 plan criteria (soak completes, run-to-run
hash stability, replay match, ≥1 capture, ≥1 disablement, supply floors ≥ 0).
`sim2a` npm script. 100/100 green.

---

## marker-0008 — Slice 2B: WebSocket server + app entry (2026-07-25)

**Added:** `server/index.js` — `createAppServer` (express static client,
`/vendor` for local libs, `/health`, WS bridge, 10Hz clock with injectable
timers) + `npm start` production entry (PORT/MAP_SEED env, fixed default seed
2026 — no wall-clock seeding). Transport gained no-lobby slot assignment:
server picks the lowest free human slot (0–15) when the client doesn't claim
one, rejects duplicate claims, frees reservations on disconnect. (Final's
`server/ws.js` was rejected as reference: JOIN_INTERNAL bypassed validation.)

**Tests:** `milestone2b.test.js` — 7: assigned slots, duplicate rejection,
ws command dispatch + per-team snapshot broadcast, advance_tick refusal,
malformed JSON resilience, reservation release, /health. 107/107 green.

---

## marker-0009 — Slices 2C–2E: pure client modules (2026-07-25)

**Added (all node-testable, zero three.js dependency):**
- `client/js/interpolator.js` (2C) — 10Hz snapshot buffer, 100ms-behind
  linear sampling, out-of-order drop, capacity bound. Authority rule pinned:
  the newest view decides existence — interpolation never resurrects fogged
  entities, and new entities snap (never lerp from nothing).
- `client/js/input_mapper.js` (2D) — scene→cell mapping with clamping;
  click semantics: visible live enemy → fire_order (lowest id ties), wreck or
  ground → move_order; select command builder.
- `client/js/fog_culler.js` (2E) — exact add/remove/keep diffing against the
  server's visibility mask, verified against a live GameServer fog cycle.

**Tests:** milestone2c/2d/2e — 16 subtests. 123/123 green.

---

## marker-0010 — Slice 2F: browser client + e2e vertical slice (2026-07-25)

**Rewritten client** (`client/index.html` + `client/js/client.js`): join
overlay (team pick, no-lobby), instanced terrain from `mapCells`, per-frame
interpolated assets (2C module), click-to-move / click-enemy-to-fire (2D),
strict fog culling (2E), sites with ownership colors, HUD (op/tick/hash,
hp/ammo/fuel), event feed, follow camera + "Next asset" selection.
three.js vendored locally via `/vendor` (no CDN). `npm start` now launches
`server/index.js` (v0.2.6).

**Fixes found by tests:** `stop()` hung on keep-alive sockets →
`closeAllConnections` + ws terminate; ws-send-then-step races in e2e tests →
settle-before-step.

**Tests:** `milestone2f.test.js` — full ws loop (join both teams, fog at
spawn, converge, 5-shot duel, wreck visible to both sides), interpolator
over a real command-driven run, client + vendored three.js served. 126/126.
**Phase 2 complete — the game is playable in a browser.**

---

## marker-0011..0015 — Phase 3: content & gameplay depth (2026-07-25)

**3A (marker-0011)** `engine/units.js`: tank (speed 16 / range 1280 / hp 100 /
dmg 20 — pins the historical constants), scout (28/1024/60/10), artillery
(8/3072 + minRange 768 / 80/30, indirect). Spawn mix per team:
tank/tank/scout/artillery (assets 0/4 stay tanks for the 1B/1D pins).
`data/units.json` is a generated mirror pinned equal by test (engine does no
file I/O). 1A fixture → v7.

**3B (marker-0012)** Supply projection: bases (radius 20) and OWNED relays
(radius 12) project supply; out-of-supply units move half speed and cannot
fire ("out of supply"). This makes relays the operational spine of the map.
2A soak regoaled to the centre-relay race: B's shorter route wins the relay,
gains supply, and defeats the unsupplied attacker. Sandbox helper defaults to
whole-map bases so unrelated tests stay supply-neutral.

**3C (marker-0013)** AI regency rewrite: fire doctrine (nearest team-visible
enemy in range, only when supplied and stocked — same rules as humans), and
takeover of disconnected human slots (ws disconnect → `assumeRegency`;
regented assets push for the nearest unowned relay, hold when none). Fixed
1D behaviors preserved. AI wars now contest relays and shoot.

**3D (marker-0014)** Spotter doctrine: every shot needs the target visible
to the attacker's team; direct-fire chassis additionally need it inside
their own sensor radius; artillery (indirect) fires on any team-spotted
target. Wrecked spotters don't spot; min range enforced.

**3E (marker-0015)** `engine/victory.js`: elimination (fielded team fully
wrecked), domination (hold ALL relays 300 ticks), time limit (18000 ticks →
points, tie = draw). Scoring: capture +10, disable +5. War end freezes
movement/combat/capture, rejects further orders ("war is over"), emits
`game_over`. All bookkeeping hashed; 1A fixture → v8.

155/155 green. **Phase 3 complete.**
