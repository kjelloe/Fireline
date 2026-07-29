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

---

## marker-0016..0020 — Phase 4, 5A, v1 pull-ins, 32-scale, acceptance (2026-07-25)

**Phase 4 (marker-0016)** Pure client modules with thin three.js wiring:
4A `overlay_model.js` (supply rings for own bases/relays, weapon-range ring
with min-range, health bars — enemy hp stays fogged), 4B `audio_cues.js` +
synth placeholder tones, 4C `vfx_cues.js` (muzzle/explosion/capture pulse
with ttl aging), 4D interpolator headings + mesh rotation, 4E Dockerfile,
.dockerignore, enriched `/health`.

**5A (marker-0017)** `server/replay_store.js`: content-hash replay ids,
`replay_index.json`, `GET /replays` + `GET /replay/:id`, archive-once on
game over; loaded replays reproduce the archived final hash byte-exactly.

**32-scale (marker-0018)** 32 field assets (ids 0-7 keep the pinned original
arrangement; 8-19 / 20-31 are team reserves in the base garages), 16 fixed AI
regents (ops 16-31). 32 operator slots = up to 16 humans + 16 AI. 1A fixture
→ v9.

**Pull-ins (marker-0019)** decided per user mandate to scan phases 5-7:
- 5B slim: persistent `playerId` → reconnect reattaches your operator slot
  and releases AI regency; live duplicates refused.
- 6A slim: terrain ships once per session (`s_map`); per-tick snapshots are
  stripped of mapCells (the dominant payload).
- 6D: AI difficulty 0/1/2 (easy = half fire rate; hard = relay pushes instead
  of patrols). `AI_DIFFICULTY` env.
- 7E slim: graceful shutdown (`s_server_closing`, war archived even
  unfinished, SIGTERM/SIGINT hooks).
Deferred to post-v1: 5C biomes/rotation, 5D campaign, 5E lobbies (contradicts
no-lobby v1), 6B telemetry, 6C mobile, 6E modding, 7A i18n, 7B accessibility,
7C achievements, 7D tutorial.

**Acceptance (marker-0020)** `soak_v1.js`: 16 scripted view-driven human
operators + 16 AI regents = 32 active operators crewing all 32 assets.
Measured: relays change hands (3 captures), 20 disablements, supply floors
hold, byte-exact replay of the full 32-participant war, ~7,800 ticks/sec
(≈780× real-time). Suite: **182/182 green.**

**Remaining manual acceptance (user):** browser playthrough vs AI, and the
2-human LAN session (see RUNNING.md → LAN play).

---

## marker-0021 — Consolidation: docs, gap tests, v1 plan (2026-07-25)

**Docs:** root `README.md` (repo orientation; flags `phases/` +
`initial-prompt.md` as historical reference), project `CLAUDE.md` (working
rules: determinism, fixture regen policy, marker commits, layer map),
historical-note preface on `specs/PROJECT_RETROSPECTIVE.md`, and
`plan-version1.md` — the v1 gap plan (P0: Command Standard flag mechanic,
war lifecycle/rotation, wreck recovery, fire cooldown; P1: legibility kit,
order feedback, balance pass, session robustness; P2 + art track).

**Gap tests added (17 subtests → 199/199):**
- `unit_gaps.test.js` — optional-u32 encoding, hex padding, terrain/unit
  table fallbacks + frozen-ness, contested domination, captureCheck edges,
  command validation boundaries.
- `component_gaps.test.js` — call_medic/respawn pinned as validated inert
  no-ops, view score/phase exposure with defensive copies, snapshot leak
  audit, AI never drives wrecks, AI holds fire out of supply, suppression
  timer cadence.
- `integration_gaps.test.js` — post-rejoin control of the same asset,
  ws-level game-over delivery + post-war join refusal, crash recovery
  (rebuild from command log, then continue in lockstep), 4000-tick invariant
  sweep (integer fields, bounds, link symmetry, non-negative pools, replay).

---

## marker-0022..0026 — Phase 8 P0: Core Fantasy Retrofit (2026-07-26)

Designer-approved plan archived in `specs/phase8_core_fantasy_retrofit.md`;
prompt 6 in dev-prompts.md. Vision now centres on physical Command Standards.

**8A (marker-0022)** `engine/standards.js` — per-team physical standard
(position, carrier, home, status AT_BASE/CARRIED/DROPPED/SCORED), hashed
(1A fixture → v10), publicly visible in views (deliberate fog exception),
homes at cells (14,59)/(113,59) inside the command zones.

**8B (marker-0023)** The loop: drive-over pickup of grounded ENEMY standards,
carrier slowed to 0.75x, standard rides the carrier, drops where a disabled
carrier died, own dropped standard returns home instantly on friendly touch,
scoring gated on carrier-in-own-zone AND own-standard-AT_BASE. Events:
standard_taken/dropped/returned/scored. Return and score can land the same
tick (return pass precedes scoring pass).

**8C (marker-0024)** `WIN_STANDARD` is the primary victory (checked before
elimination/domination/clock). War lifecycle in `server/index.js pump()`:
game_over → archive → postgame (default 300 ticks) → `GameServer.resetWar`
with deterministic mix32 seed rotation → transport re-joins every connected
session on its old slot (`s_war_reset` + fresh `s_map`). `warsStarted`
counter; second war archives and rotates again (tested).

**8D (marker-0025)** `engine/recovery.js` + `tow_order` command: adjacency
tow with full rejection taxonomy ("no such wreck"/"not a wreck"/"enemy
wreck"/"already under tow"/"already recovering"/"already towing"/"wreck out
of reach"), 0.5x tow speed (stacks with carrier/supply penalties), wreck
follows tower, reaching own base starts a 100-tick repair, restored at half
hull with original crew link intact, tow line cut when the tower is
disabled. Fields towedBy/recoverTimer hashed (1A → v11).

**8E (marker-0026)** Reducer-enforced fire cooldown: reloadTicks tank 15 /
scout 8 / artillery 40; "reloading" rejection; reloadTimer hashed (1A → v12),
ticks down while moving, visible only to the owning team. AI fires only when
loaded; easy difficulty (6D) redefined as a duty cycle (fires only in the
first half of each double-reload window) since tick-parity throttling became
meaningless under reload. Updated: 1G double-shot test, sim1g, 2F volleys,
6D pull-in test window, data/units.json mirror.

Suite: 229/229. **P0 complete — the game now has its core fantasy.**

---

## marker-0027 — Phase 8 P1: legibility + robustness (8F-8I) (2026-07-26)

**8F Minimap** — `client/js/minimap_model.js` (pure, fog-mirroring: can only
plot what the view contains; standards always shown per the 8A exception) +
canvas renderer, zones/relays/dots/standards/viewport, click-to-jump.

**8G Free camera + click-select** — `client/js/camera_model.js` (pan/zoom
clamps, follow toggle, jump targets) wired to WASD/arrows, wheel zoom,
F follow, Home = own zone, X = enemy standard, minimap click. Click mapping
extended with priority select-free-friendly > fire-enemy > tow-wreck > move
(input_mapper; recovering/towed wrecks excluded; teammates' assets excluded).

**8H Order feedback + end screen** — `client/js/feedback_model.js`: every
reducer rejection reason has human text (pinned by a source-sweep test),
team-perspective event lines ("WE HAVE THEIR STANDARD!"), end-of-war overlay
(VICTORY/DEFEAT/DRAW, reason, scores, next-war countdown) shown on game_over
and cleared on s_war_reset; terrain rebuilt on new-war s_map.

**8I Heartbeats + instrumentation** — transport ping/pong with lastSeen
bookkeeping, `checkHeartbeats(now, timeout)` terminates silent sessions
(→ normal close path → AI regency), production sweep timer (injectable,
cleared on stop). `server/metrics.js`: war durations, standard activity,
relay captures, disables, tows/recoveries, rejection frequencies, first
contact tick; `GET /metrics`.

Suite: 247/247. **Phase 8 complete — designer's P0+P1 retrofit delivered.**
v0.10.0. Remaining human acceptance: browser + LAN sessions (now with the
Command Standard loop to actually playtest).

---

## marker-0030 — Field-bug fix + consolidation: docs, skills, phase-8 gap tests (2026-07-26)

**FIELD BUG (user's Firefox test):** client modules importing engine data
(`overlay_model.js` → `/engine/units.js`, `/engine/supply.js`) 404'd because
express served only `client/` — Firefox blocked the text/html response as a
module, the whole graph failed, and no click handler ever bound. Fix:
`/engine` and `/shared` are now static mounts (pure ESM data for the client;
authority unchanged), `/favicon.ico` → 204. Regression test walks every
client module's import graph over HTTP and demands 200 + JS MIME.

**Docs:** RUNNING.md rewritten for Phase 8 (objective, click semantics,
camera keys, supply/reload/tow rules, /metrics); CLAUDE.md gained the
phase-8 layer map + repin tool pointer; dev-prompts prompt 7.

**Tooling/skills:** `tools/repin_1a.mjs` (aborts on event drift) and three
project skills in `.claude/skills/`: `fixture-repin` (the re-pin ritual),
`slice-workflow` (end-to-end slice delivery contract), `playtest-report`
(pull /metrics + replays into the P1-G balance-pass format after sessions).

**Tests (+9 → 256/256, verified stable twice):** *(see marker-0031 below for the art pipeline)*

---

## marker-0031 — Art Slice A: Painted Low-Poly Hybrid pipeline (2026-07-26)

Designer's art direction confirmed (`assets/asset-spec.md`); pipeline doc in
`assets/PIPELINE.md`. Everything visual now flows through four artifacts:

- **`style_tokens.json`** — palette, matte material params, team identity
  (color AND symbol per team — colorblind rule §7): green/square,
  red/triangle. Single source of truth.
- **`asset_manifest.json`** — every visual key with GLB path (future),
  procedural key (today), sprite fallback, minimap icon, triBudget.
  Reserved slots for spec chassis the engine doesn't field yet
  (infantry_carrier, vehicle_recovery — flagged deviation: our roster is
  tank/scout/artillery and every chassis tows/carries).
- **`anchor_points.json`** — tow/banner offsets per chassis.
- **`tools/build_assets.mjs`** — generates 20 SVG icons + fallback sprites
  FROM tokens; validates manifest references; idempotent.

**Renderer** now resolves through `asset_resolver.js` (visualKeyFor /
standardVisualKey / resolveVisual: GLB → procedural → sprite) and
`asset_factory.js` (chunky procedural stand-ins, 48-164 tris, 15-40x under
spec budgets; `team_panel` tint slot; wrecks slumped/tilted/faded). New
readability: tow cables drawn between towers and wrecks; carried standards
bob; scored standard tints gold. No hardcoded model paths or unit shapes
remain in client.js (pinned by test).

**Tests (+10 → 266/266):** `art_pipeline.test.js` — chassis/manifest/anchor
completeness, color+symbol rule, per-key poly budgets, panel-only tinting,
wreck readability, state→key mapping, resolution order, build idempotency,
no-hardcoded-paths sweep, HTTP serving of metadata/icons.

**Next art slices (see PIPELINE.md):** painted GLBs drop into
`client/assets/models/` and are auto-preferred — B: standard + capture VFX,
C: unit kit GLBs, D: order/selection markers, E: canvas sprite renderer.

---

## PLAYTEST RESULT — first 2-human LAN session (2026-07-26)

**User verdict: "Two human players could move on the map. Other than that
the game made little sense in current form."**

Technical acceptance passed (join, seats, movement, sync over LAN). The
EXPERIENCE failed: the game does not communicate itself. Working hypotheses
(to confirm with the user before fixing): no onboarding beyond a small hint
bar; no auto-assigned asset on join; objective (enemy standard) is ~100
cells away and effectively invisible; at tank pace (1/16 cell/tick) nothing
happens for many minutes; supply/relay logic is invisible until it punishes
you; feed lines lack context. This is the designer's predicted P1-G reality
check — pacing and first-five-minutes legibility, not systems, are the gap.
Next: targeted questions to the user, then a "make it make sense" slice.

**Debrief answers:** enemy standard was visible (by design — but nothing said
so); shots WERE fired; relays were anonymous polygons ("no text on screen");
10 minutes played; tank pace felt slow.

---

## marker-0034/0035 — Playtest response: pace x2 + legibility kit (2026-07-26)

**Pace (marker-0034):** global x2 — tank 32 / scout 56 / artillery 16
units/tick (designer-sanctioned P1-G lever). Reload unchanged (combat pace
in seconds holds); fuel now covers two crossings; every speed pin updated;
1A fixture → v13.

**Legibility (marker-0035):** new pure `client/js/objective_model.js`
(status lines, relay tally, ONE prioritized hint, briefing text, auto-crew
picker) + wiring:
- Auto-crew on join: lowest free operable asset selected automatically,
  feed line tells you what you drive. Re-crews after war rotation; rejoin
  keeps the old seat.
- Mission briefing overlay on join (win condition, relays/supply, fog,
  click controls) — dismiss with Enter/Escape/button.
- Persistent objective strip (top centre): prioritized hint ("Capture RELAY
  masts — they project the supply you need to fight forward" → "ESCORT the
  carrier into your command zone to WIN"), both standard status lines,
  relay tally.
- Floating world labels: "RELAY — YOURS/ENEMY/NEUTRAL" above every mast,
  "ENEMY STANDARD — STEAL IT" / "YOUR STANDARD" above the banners.

Tests: `legibility.test.js` (+6 → 272/272): hint priority order, status
line coverage, briefing content, auto-crew rules, pace pin.

---

## PLAYTEST 2 RESULT (2026-07-26)

**User verdict: objective strip hint "actually leads somewhere useful — YES";
×2 pace "felt right".** The legibility + pacing slice landed.

Two notes recorded for later:
1. **Direct tank control mode (backlog)** — user wants an optional
   direct-drive mode for some tanks as homage to the original Firepower's
   easy action/fire feel. Architecture note: this is a CLIENT INPUT mode
   (WASD→continuous move_orders + aim-fire), not an engine change — the
   reducer already accepts a command stream; a "drive mode" maps keys to
   frequent short move orders. Needs design pass on feel + command rate.
2. **Identity observation** — current perspective reads as "a low-poly
   Syndicate with tanks". Worth revisiting camera angle/height in the art
   pass (spec §3 wants 35-55° diorama feel) once painted assets land. `phase8_gaps.test.js` —
penalty stacking 16→12→6 (which caught that whole-map sandbox bases
auto-repair towed wrecks — test design issue, mechanics correct),
same-tick contested grab (lowest id), tower-carrier death drops flag AND
cuts tow, resetWar produces a byte-identical fresh war and drops queued
commands, postgame countdown exact, full standard-capture win over ws with
rotation and standards home, pure-command raid replaying hash-exactly, and
a 3000-tick hard-AI war with per-tick standard invariants. Plus module-graph
regression (2F) and two ws settle-flakes hardened into poll-waits (2B).

---

## marker-0037 — Logistics Truck (roster middle path) + v1 plan refresh (2026-07-26)

**Decision (playtest 2 follow-up, option c):** field the Logistics Truck now;
defer Command Carrier / Sentinel / Infiltrator. **Tow is now a logistics
role** — `towRejection` leads with "needs a logistics truck"; standard
carrying stays any-chassis until the Command Carrier exists.

**Engine:** `UNIT_LOGISTICS = 3` (speed 40, range 768, dmg 5, reload 20,
hp 80, `canTow: true`; other chassis `canTow: false`). Reserves now cycle
tank/scout/artillery/logistics → per team: 5 tanks, 4 scouts, 4 artillery,
3 trucks (asset ids 0-7 untouched, pins hold). 1A fixture → v14.

**Client:** click-to-tow only offered when driving a truck (others fall
through to move); chassis name map + feedback text; truck procedural model
(flatbed, cab, crane + hook, 6 wheels), manifest/anchors/icons entries —
art_pipeline completeness tests enforced the whole checklist automatically.

**Docs:** `plan-version1.md` rewritten to current status (+ NEW
`plan-version1.html`, styled self-contained twin). v0.11.0. 272/272.

**Process note (user):** helper scripts go to /tmp or ./debugging as files —
no inline python/node heredocs in Bash (saved to memory).

---

## marker-0038 — plan-version2 (.md + .html) (2026-07-26)

Compiled the complete post-v1 design inventory into `plan-version2.md` and a
styled `plan-version2.html` twin. Five tracks: A roster/roles (Command
Carrier, downed operators, Sentinel, Infiltrator, factions, NPC infantry),
B battlefield depth (mines, cargo/materiel economy, depots + Minimum
Playability Guarantee, route graph, crossings/water, fog ghosts, convoys),
C coordination (context pings, public tasks, takeover confirmations, join
flow/balance), D presentation/platforms (art B-E, camera pass,
direct-control homage, audio identity, mobile, i18n/a11y, Luau twin,
native port), E meta/live-ops (profiles/recognition, spectator + replay
viewer, achievements, rotation/biomes, campaign/offline, telemetry,
modding/workshop, custom modes, tournaments, ops hardening).
Suggested V2.0 cut: "The Rescue Update". Four designer tensions flagged.

---

## marker-0039 — Rulings, AI objective doctrine, backend sims, wiggle fix (2026-07-26)

**Rulings applied to plan-version2 (.md + .html):** (1) no-lobby stays the
entry point, lobbies → Version 3 after real play experience; (2) artillery
confirmed permanent; (3) standard carrying goes Carrier-exclusive when the
Carrier ships, validated FIRST via AI-only backend sims; (4) anti-camping:
modern DRONE recommended over a literal helicopter (new-IP rule, diorama
aesthetic, EW synergy; helicopter as later skin) — pending veto.

**AI objective doctrine (`engine/ai_regency.js`):** designated scout raiders
steal grounded enemy standards, carriers escort themselves home, per-team
recoverers reclaim dropped standards, roles re-designate deterministically
when assets die (fallback raiders drawn from fixed agents only — lone
regented slots keep playing relays). Two real bugs found BY the sims and
fixed: a global recoverer pick left team B unable to recover; the
scout-alive sentinel got clobbered so fallback raiding never engaged.

**Backend sim harness:** `npm run simwar` (SEED/TICKS/DIFFICULTY env) — full
AI-vs-AI standard wars with event timeline + replay verification. Findings
logged in the plan: mutual-steal standoffs possible, contested-relay
ownership churns tick-to-tick, lazy role reassignment stalls raids.

**Playtest 3 wiggle fix:** `client/js/heading.js` (shortest-arc bounded-rate
smoothing, pure + tested) wired into the renderer; authoritative turn-rate
model queued as V2.x in the plan.

**Consolidation:** `new-chassis` skill (checklist proven by the truck slice);
`roster_gaps.test.js` (chassis contract completeness incl. explicit canTow,
truck fielding pins, AI-never-tows pin, ws truck rescue incl. same-tick
depot handoff, teaching rejection for tank tows); `ai_objective.test.js`
(raider/carrier/recoverer/reassignment + determinism + heading math).
Memories + manifest note refreshed. v0.12.0. Suite 283/283 (x2).

---

## marker-0040 — Implementation order + design-gap review (2026-07-26)

`plan-implementation-order.md`: dependency-ordered waves for the remaining
v1/v2 items. Principles: engine-before-client with simwar verification per
slice; design-blocked slices flagged not scheduled; spectator/replay viewer
and ops hardening identified as zero-design gap-fillers; art as a parallel
track. Slim-model proposals written for the six under-designed systems
(Carrier deadlock rule, downed operators, cargo, public tasks, mines,
drone). Q1-Q12 questionnaire with defaults so work proceeds without
blocking on answers.

---

## marker-0041 — Q1-Q12 rulings applied + demo asset strip renderer (2026-07-26)

**All twelve design questions ruled** (dev-prompts prompt 14). Deviations
from defaults: Q3 full walking `operator_foot` (slice 1.2 grows); Q9 (b)
upgraded procedurals + committed demo strip PNG; Q10 direct control = WASD +
mouse with CHASE cam, gamepad later, mobile arrow-steering (tap unit to
stop). Drone confirmed. Turn-rate model locked into Wave 1. Plans updated.

**New tool: `npm run strip`** (`tools/render_asset_strip.mjs`) — pure-code
software rasterizer (no GPU): extracts triangles from the procedural
factory, isometric projection at the art-spec ~34°, flat lambert shading,
painter's algorithm, 3x5 bitmap labels, hand-rolled PNG encoder (zlib +
CRC32). Renders all 12 keys + a red-team standard to
`client/assets/preview/asset_strip.png` (13 labeled tiles, 2288x194,
~12 KB, byte-deterministic — pinned by test). Visually verified: silhouettes
and team tints read; wrecks clearly slumped.

Suite 284/284. Wave 1 (Rescue Update) is now fully unblocked.

---

## v1.0 TAGGED — playtest 3 PASSED (2026-07-26)

User: "playtest-3 completed. Works." Full loop confirmed on LAN. Follow-ups
1-3 confirmed on defaults (downed operators unshootable in v2.0; mobile
arrow-steering lands with 6C; chase cam keeps minimap/strip, Esc/F returns
to tactical). Wave 0 closed. Night session begins on branch dev_night:
Wave 1 slices as phase 9 (9A carrier ... 9G drone), one git tag per slice,
session report in ./reports.

---

## slice-9a — Command Carrier + Carrier-exclusive carrying (night session, 2026-07-26)

**Engine:** `UNIT_CARRIER = 4` (Q1: hp 120, speed 24, dmg 5/range 768/reload
25, capacity 2, canCarryStandard: true — the ONLY one). Explicit
canCarryStandard/capacity on every chassis (roster contract test enforces).
Fielding: explicit 12-slot reserve mix [4,3,1,0,0,1,2,3,2,3,0,4] — AI slots
get carrier+truck+scout+tank; per team: 5t/3s/3a/3trk/2car; trucks now ids
9/15/17 (+12 for B), carriers 8/19 (20/31). Anti-deadlock (Q2):
`droppedTimer` on standards (hashed, 1A → v15); DROPPED ≥ 600 ticks →
auto-return home with `standard_returned {auto:true}`; timer clears on
pickup/manual return. AI raider role = first controlled operable carrier
(scouts no longer raid); pinned limitation: when the lone AI-crewed carrier
dies there is NO replacement raid (garage carriers uncrewed) → QUESTION.

**Client/art:** carrier hint ("Only a COMMAND CARRIER can take their
standard"), briefing rewrite, carrier procedural model (hull/cab/ramp/
beacon), manifest+anchors+icons, strip now 15 tiles.

**Sim finding (carrier era):** seed 2026 → MUTUAL CARRY STANDOFF: both AI
carriers hold each other's standard at tick 9000; neither can score (own
not AT_BASE), auto-return doesn't apply to CARRIED. War resolves only at
the 18000-tick points horn → QUESTION for designer.

Suite 291/291 (x2). Tagged slice-9a.

---

## slice-9f — Authoritative heading + turn-rate movement (night session, 2026-07-26)

**Engine (Q11, Wave 1):** headings are brads (u8, 0=east, 64=south) in hashed
state; per-chassis turnRate (tank 8, scout 14, artillery 5, truck 10,
carrier 6 brads/tick). Movement rewritten from axis-major to
pivot-then-drive: integer bearing16 (rational tan boundaries), shortest-arc
turn clamped by turnRate, 16-direction fixed-point velocity table, drive only
within 45 degrees of bearing, snap-arrival (|dx|+|dy| <= step) prevents
orbiting. Aligned straight-line motion is bit-identical to before, so every
historical movement pin (7*256+32 etc.) survives. 1A fixture → v16.

**Views/client:** both friendly and enemy records expose heading (a vehicle's
facing is externally observable); renderer converts brads → radians and keeps
the visual smoothing as the last-step filter. The playtest-3 wiggle is now
fixed at the SOURCE: units physically arc through turns.

**Feel notes for the user:** direct-control mode (Wave 3.3) now has real
vehicle handling to build on; artillery visibly labors through turns
(5 brads/tick = 3.6 deg — very deliberate), scouts whip around.

Suite 297/297 (x2). Tagged slice-9f.

---

## slice-9b — Downed operators, full operator_foot (night session, 2026-07-26)

**The Rescue Update's heart (ruling Q3: full walking entities).**
Engine: crews BAIL OUT when a crewed asset is disabled — seat goes OP_DOWN,
wreck becomes crewless (8D wrecks now repair to UNCREWED; pre-staged wrecks
with crew keep the old contract), `state.downed` entities (hashed) walk the
field. Lifecycle: crawl (`crawl_order`, radius 3 cells, 6 units/tick, no
heading — feet), fast redeploy (`redeploy`, gated 100 ticks, "still
recovering nerve"), carrier rescue (capacity-2 `aboard1/aboard2` bunks,
adjacent auto-board, idle-in-base delivery frees seats), auto-return at 600
ticks. Downed operators are visible to their OWN team only and cannot be
targeted (follow-up ruling 1). Events: operator_downed/rescued/delivered/
redeployed/returned (+ feedback lines + metrics counters). 1A → v17.

**AI down-management doctrine:** regents redeploy when the gate opens, then
re-crew — fixed agents retake their PAIRED asset when operable+free;
regented seats take the lowest free operable asset. Found by the v1 soak:
without this, seats bled out of the war (24/32 active). Acceptance updated:
all 32 seats participate as active, downed, or aboard.

**Client:** downed figure render + labels ("YOU ARE DOWN — R TO REDEPLOY"),
clicks crawl while down, R redeploys, hint bar updated. Strip → 16 tiles.

Suite 306/306 (x2). Tagged slice-9b.

---

## slice-9d — Minimum Playability Guarantee (night session, 2026-07-26)

Spec 01 §9 with ruling Q5 cadence: when a team fields fewer than 6 operable
assets, its home base Slow Manufacture timer runs; at 900 ticks the oldest
eligible wreck (not towed, not in the repair bay) is REBUILT at its original
spawn — half hull, full stores, crewless, facing home. Fits the fixed
32-asset roster (manufacture = rebuild, no id churn). Timers `manufacture[2]`
hashed (1A → v18); event `asset_manufactured` + feedback + metrics. Healthy
teams never trigger; with no eligible hull the timer holds and fires the
moment one frees up. `fieldSpawnFor(id)` exposes the deterministic spawn
layout (a test walks all 32 ids against the fielded state — which caught my
wrong id→team assumption on the first pass).

Design note: the cargo/materiel half of old 9C is DEFERRED — it needs the
damaged-sites design round (new question 9). MPG stands alone.

Suite 312/312 (x2). Tagged slice-9d.

---

## slice-9e — Mines (night session, 2026-07-26)

Slim model per ruling Q6, honoring the spec-04 mine contract (bounded route
denial WITH counterplay). Tanks get an explicit `canMine` contract + 2-mine
rack (`minesLeft`, hashed); `deploy_mine` lays on the tank's own cell —
bases and sites are protected no-deploy ground. Arms in 30 ticks (no
drive-by dropping), then detonates on enemy entry: 60 damage + suppression,
lethal hits go through the extracted `disableAsset()` — the ONE disable path
fire and mines now share, so crew bail-out/tow-release/standard-drop can
never diverge. Counterplay: enemy scouts within 3 cells auto-mark
(permanent team knowledge), trucks (`canClearMines`) clear adjacent
marked/own mines via `clear_mine`. Fog safety: mine events broadcast no
coordinates; positions travel only in team-filtered views (own always,
enemy only once marked). Client: M/C keys, mine discs (dark = own, red =
marked enemy), feedback lines, metrics. 1A → v19.

AI regents do not yet lay or clear mines (question for the design round).

Suite 320/320 (x2), simwar + replay OK. Tagged slice-9e.

---

## slice-9g — Anti-camping drone (night session, 2026-07-26)

Ruling Q7 (modern drone over the helicopter homage — helicopter may return
as a skin). Camping = idling OUTSIDE your own supply umbrella: per-asset
`campTicks` (hashed) counts 300 ticks, then the enemy's nearest owned relay
launches a drone at you (no enemy relay = no drone; the toll restarts the
clock, one drone per target). First flying entity: terrain-blind straight
integer chase at speed 72 (outruns every chassis), public to BOTH teams
(loud and low — no fog games), stings 4 hp every 10 ticks on station,
lethal stings go through the shared `disableAsset()` path. Counterplay is
the design: MOVE (or resupply) and it recalls instantly; or shoot it —
`fire_order {targetDroneId}` downs it in one hit from any direct gun
(artillery "cannot track aircraft"); 600-tick endurance, and a stubborn
camper just draws the next one. Flight runs before launches so spawn
positions pin deterministically. Client: hovering rotor meshes, click a
drone to shoot it (outranks the asset under it), feed lines, metrics.
1A → v20.

Suite 329/329 (x2), simwar + replay OK. Tagged slice-9g.

---

## slice-10b — Takeover confirmations (night session, 2026-07-26)

First Wave-2 item (plan 2.2, spec 02 §9) — pulled forward as the smallest
no-design-blocker slice. Claiming an UNCREWED asset in a consequential
state (carrying the Command Standard, towing a wreck, passengers aboard)
now demands `confirm: true` on select_asset; plain assets keep the
friction-free single click, and reselecting the asset you already drive
never re-asks. AI regents always confirm (spec: regency continues safely).
Client: the rejection arms an Enter-confirm / Esc-cancel retry; friendly
views now expose aboard1/2 so the UI can say what you'd inherit. No new
hashed state — no fixture repin. `joinAndSelect` test helper confirms by
default (staging convenience); gate tests issue raw commands.

Suite 334/334 (x2), simwar + replay OK. Tagged slice-10b.

---

## slice-10c — Context pings (night session, 2026-07-26)

Plan 2.3, spec 02 §14, v2.0 subset chosen: attack / defend / rally /
need_escort / recovery_in_progress / mines_detected / need_rescue. New
`ping` command: driving seats ping a named cell or their own; downed seats
may ONLY cry need_rescue, pinned at their body; garage seats must name a
cell. Anti-spam is deterministic — per-operator `lastPingTick` in hashed
state (1A → v21), 30-tick cooldown. **Structural addition: toTeam-scoped
events** — buildView now withholds events carrying `toTeam` from the other
team, so pings ride the normal event wire with zero enemy leakage (first
use of per-team events; nothing existing carried the field). Client:
`ping_model.js` pure context-option module (the 1/2/3 keys mean what your
seat is doing), cyan world labels with 50-tick TTL via `activePings`.
AI regents don't ping yet.

Suite 340/340 (x2), simwar + replay OK. Tagged slice-10c.

---

## slice-10a — Spectator role (night session, 2026-07-26)

Plan 2.1 slim (the replay VIEWER half remains future work — noted as a
question). `buildSpectatorView(state)`: omniscient, player-shaped (all 32
assets ride in friendlyAssets with full telemetry, so the renderer needs no
special path), sees both teams' downed/mines/drones and toTeam-scoped
pings. Transport: `c_spectate` handshake → read-only session (team -1, no
operator slot, commands bounce with "spectators only watch"), spectator
view built at most once per tick and only when a spectator is connected;
disconnects skip regency/reservation bookkeeping; war resets re-ship the
map without a join. Client: third button on the join screen. No hashed
state touched — no repin. Main value tonight: the designer can WATCH
AI-vs-AI wars live (the question-2 standoff) instead of reading sim logs.

Suite 343/343 (x2), simwar + replay OK. Tagged slice-10a.

---

## slice-11a — Artillery turn retune (2026-07-26, prompt 16 Q4)

turnRate 5 → 2: a half turn (128 brads) now takes 64 ticks ≈ 6.4 s — the
user's "approx 6 seconds" ruling. Siege guns must be emplaced facing the
threat; repositioning under fire is a real decision. Pins updated (9F stat
table, data/units.json mirror). No hashed-state change, no repin.

Suite 343/343. Tagged slice-11a.

---

## slice-11b — BF2 capture countdown (2026-07-26, prompt 16 Q3)

Battlefield-2-inspired relay capture replaces the instant flip. A lone team
on a relay first drains the enemy flag to NEUTRAL (`SITE_NEUTRALIZE_TICKS`
30 ≈ 3 s, event `site_neutralized`), then raises its own
(`SITE_CAPTURE_TICKS` 30 ≈ 3 s) — both configurable constants in
engine/sites.js. CONTESTED ground (both teams present, wrecks don't count)
freezes the clock — the ruled fix for tick-to-tick relay churn. Empty
ground drains attacker progress; a defender standing home heals its flag's
clock. Per-site `captureProgress`/`capturingTeam` hashed (1A → v22) and
public in views (flip-bar telemetry, like ownership itself).

Consequences absorbed: 1I/3B tests rewritten to the countdown contract; the
1I recapture test needed a second relay (a frozen lone relay = domination
win — the countdown makes standoffs REAL); v1 soak active floor 24 → 20
with rationale (slower flips → less supply → more seats legitimately
mid-rescue at any sampled tick: 22 active / 6 walking / 4 aboard, all 32
participating). 5B reattach test hardened from fixed settles to poll-waits
(load flake made consistent, then fixed — lazy `ai` needed optional
chaining).

Suite 348/348 (x3), simwar + replay OK. Tagged slice-11b.

---

## slice-11c — AI hunt & guard + the balance hunt (2026-07-26, prompt 16 Q1/Q2d/Q14)

Doctrine: fire priority targets enemy STANDARD-CARRIERS (Q2d — the ruled
standoff counter); a unit stung by a drone swats it first (Q14, direct guns
only); role-based garage crewing — with no crewed operable carrier
team-wide (humans count), any free AI seat pulls the spare carrier from the
garage before its default pick (Q1).

The sim campaign then dragged three real bugs into the light, each found by
5-seed evidence and fixed:
1. **11B killed drive-by captures** → whichever team's patrol happened to
   dwell on a relay won 55-0 every seed. Fix: designated capturer roles —
   ONE nearest agent per (team, unowned relay) within 16 cells diverts and
   stands on the flag; it won't stare down an enemy-held flag it can't
   shoot at (a naive everyone-diverts froze 4/5 seeds at 0-0, both teams
   contesting one flag out of supply).
2. **The map was not mirror-symmetric**: B spawned at x=117 (mirror of A's
   7 is 120) and the single centre relay at x=63 is un-mirrorable on a
   128 map — B's patrol landed ON it, A's mirror landed beside it. Fix:
   spawns mirrored (120, reserves 119/118) and FOUR relays in exact mirror
   pairs (32<->95, 58<->69) with mirrored patrols. Result: every seed
   became a two-sided war.
3. **Laden carriers ran dry mid-map** (fuel is per tick, so slow chassis
   pay more per cell; a standard round trip costs ~3200 vs FUEL_MAX 2400 —
   seed 777's winning carrier stranded with the flag aboard). Fix:
   FUEL_MAX 2400 → 4000 until 11F fuel logistics; MPG rebuild now uses the
   constant.

**Outcome: all 5 seeds end DECISIVELY by standard capture at tick
3400-4000 (~6 min wars).** Residual: team B still wins 5/5 — much smaller
margin, hypothesis recorded (cell-floor boundary favors west-movers by one
edge per leg; needs a mirrored-teams harness to quantify). 1A → v25 (three
repins: spawns, relays, fuel). 2A/8F/1I pins updated to the new map.

Suite 351/351 (x2), campaign + replay OK. Tagged slice-11c.

---

## slice-11d — Alive-world doctrine (2026-07-26, prompt 16 Q11/Q16)

The user's design goal verbatim: "We want the game world to be as alive as
possible even with 1 or 2 humans playing."

- **Tanks fortify** (Q11): idle within 3 cells of an owned relay (never on
  the protected site cell, never in a base), rack loaded, ground clean →
  lay a mine; a tank standing ON its just-captured relay steps one cell
  south first so the fortify rule can fire.
- **Trucks clear en route** (Q11): any AI truck adjacent to a MARKED enemy
  mine defuses it — no clairvoyance, doctrine only sees marked mines.
- **Regents ping** (Q16): raider calls need_escort while carrying, the
  recoverer announces recovery_in_progress at the dropped standard, scouts
  flag marked mines — throttled to one ping per seat per 30 s
  (AI_PING_INTERVAL_TICKS, via the hashed lastPingTick).
- **Vocabulary grows** (Q16): carrier_under_attack, road_blocked,
  safe_route — engine kinds + client context options (carrier offers
  CARRIER UNDER ATTACK, towing trucks ROAD BLOCKED, scouts SAFE ROUTE).

Campaign result: mines now shape AI wars (deployed AND detonated with zero
humans), and the winner column finally mixed — **team A takes seeds 777
and 31337, B takes 4242**, two seeds run long with close scores. The
5/5-team-B pattern is dead. No hashed-state change — no repin.

Suite 356/356 (x2). Tagged slice-11d.

---

## slice-11e — Full AI rescue play (2026-07-26, prompt 16 Q5, sim-gated)

Doctrine between standard objectives and capture-seek: **trucks** hook the
nearest claimable wreck within 24 cells (tow_order when adjacent, else
drive to it) and haul it to the base centre — the repair bay does the
rest; **carriers** ferry aboard passengers home to deliver, and when not
the team's on-duty raider, fetch walking downed teammates nearby. The old
"towing is human work" pin in roster_gaps was overruled by ruling Q5 and
now asserts the opposite.

Sim gate (5 seeds x 12000): tows fire every seed (2-8), wrecks come back
(up to 6 restored — seed 9001's winner had 12 operable at the horn), war
tempo and mixed winners unchanged. Carrier pickups stay near zero in
AI-only wars because AI seats redeploy in 10 s — that path exists for
HUMAN downed players, which is the alive-world point. **GATE: PASS.**

Suite 356/356. Tagged slice-11e.

---

## slice-11f — Damaged sites + materiel (2026-07-26, prompt 16 Q9)

Old 9C revived per the Q9 greenlight. Sites get `hp` (SITE_HP_MAX 60,
hashed): artillery — and only artillery — can shell them via `fire_order
{targetSiteId}` (public infrastructure, no fog gates, normal
ammo/reload/supply/range discipline; two 30-damage shells). At 0 the site
is DAMAGED: keeps its owner, projects no supply, extends no fog, cannot
flip (capture pass skips it, clock cleared) — events site_shelled /
site_damaged. Repair: trucks carry ONE materiel slot (hashed), loaded
SILENTLY when idle in own base (the repin guard rightly refused a new
event inside the 1A fixture steps — loading is not news), and spend it on
any adjacent damaged own/neutral site → full hp, site_repaired. Enemy
ruins are not ours to fix. Bases stay sacred (Q19 default — flagged).
AI trucks run repair errands (park beside the ruin; the materiel pass does
the rest). Client: ruins render dark and flattened; feed lines. 1A → v26.

Suite 362/362 (x2), campaign unchanged (no AI artillery siege doctrine yet
— noted as a future question). Tagged slice-11f.

---

## slice-11g — Rescue autopilot option (2026-07-26, prompt 16 Q8 / prompt 19)

Boarding stays automatic BY DEFAULT; per-operator `autoRescue` flag
(hashed, default 1, 1A → v27) via new `set_option` command (whitelisted
options — only auto_rescue so far). Manual seats are skipped by the
automatic boarding pass (`boardableBy` gains the check; the manual
`board_carrier` path passes `manualToo`) and climb in via `board_carrier`
(adjacency/bunk/team rejections) — `unboard` hops out anywhere, back on
foot beside the carrier. Delivery at base stays automatic (arriving home
IS the goal). Client: ⚙ settings overlay with the checkbox, B/U keys, and
the downed label upgrades to "CARRIER HERE — B TO BOARD" when a boardable
carrier is adjacent. AI seats keep the default.

Suite 368/368 (x2), simwar + replay OK. Tagged slice-11g.

---

## slice-11i — War-rotation regression (2026-07-26, prompt 18 plan)

Nothing had verified that a war ROTATION cleanly resets the phase-9/10/11
state. New integration test dirties one war with every system at once —
mines, drones, ruins, half-flipped flags, materiel, passengers, camp
clocks, manufacture timers, downed bodies, ping cooldowns, autoRescue —
forces game over, rides out postgame stopping EXACTLY at the reset, and
asserts the rotated battlefield is spotless AND byte-identical
(hashState) to a cold start on the rotated seed. Passes against the
current resetWar (fresh createInitialState — clean by construction); now
it can never silently regress when someone "optimizes" rotation later.

Suite 369/369 (x2). Tagged slice-11i.

---

## slice-11h — Replay viewer (2026-07-26, prompt 16 Q15 / prompt 19 controls)

The determinism dividend: the engine is pure browser-safe JS, so the
viewer re-simulates the archived command log LOCALLY — no server
streaming, free scrubbing. `client/js/replay_engine.js` (pure, node-
tested): checkpointed seek — backward scrubs and random jumps are
byte-exact against live hashes at every probe, and checkpoint density
provably never changes outcomes. `replay.html` + `replay.js`: war picker
from /replays, top-down 2D tactical canvas (deliberately map-like — this
tool exists for balance study): terrain, bases, relays with capture bars
and ruin state, mines, drones, downed, standards, heading-oriented units,
white boxes marking human-crewed assets; major-event ticker;
play/pause/×1/×4/×16/scrub/±100-tick arrows.

Suite 373/373 (x2). Tagged slice-11h.

---

## slice-11k — Recognition scoring (2026-07-26, prompt 19 table)

Per-operator credit for verified reducer facts, rescue > kill by design
(spec 04 §4): tow-complete 8 (the tower's seat, at repair-bay entry),
operator rescue 10 (the carrier's seat, at DELIVERY — boarding alone pays
nothing, so no board/unboard farming), manual standard return 10,
standard capture 25, relay capture 10 (every seat standing the flag out),
kill 5 (trigger seat only — mine and drone kills award nobody; no seat
sits behind a mine). Auto-returns thank no one. `operator.score` was
already hashed — no repin. Views gain a minimal PUBLIC scoreboard
(id/team/score; the leak-guard pin now asserts minimality instead of
absence). End screen shows HONORS (top 3, humans and regents alike).

Suite 379/379 (x2), simwar + replay OK. Tagged slice-11k.

---

## slice-11l — Direct control, all chassis (2026-07-26, Q10 + prompt 19)

The Firepower homage, server-authoritative: the client streams WASD
INTENT (`drive {throttle, turn}` in {-1,0,1}, sent only on change); the
reducer owns the physics. `driveStep`: A/D pivot at the chassis turnRate,
W drives along the heading at chassis speed, S reverses at half — terrain
/ supply / carrying / towing multipliers all reuse the stepAsset math;
map edges clamp; fuel bills per moving tick as ever. Intent preempts the
click-move target and hands back cleanly when zeroed. "All chassis" cost
nothing extra — speed and turnRate were already per-chassis contracts
(the per-chassis pivot test sweeps all five). A wreck's wheel clears on
disablement; a seat at the wheel is NOT camping (no drone for pivoting in
place). driveThrottle/driveTurn hashed (1A → v28). Client: G toggles the
mode (WASD otherwise pans the camera), keyup streaming, hint-bar note.
Chase-cam rotation deliberately deferred — the ortho camera stays fixed;
noted as a question.

Suite 385/385 (x2), simwar + replay OK. Tagged slice-11l.

---

## slice-11m — Second map prep: riverline (2026-07-26, prompt 19)

Layout went per-profile (`MAP_LAYOUTS`: relays + standard homes;
per-profile AI patrols; bases/spawns shared) with frontier values
unchanged — no repin. `state.mapProfile` rides the state, survives war
rotation, and is archived in replay meta so the viewer re-simulates the
right world. New map `engine/riverline.js`: a rough-ground river splits
the field, three road bridges (rows 20-23 / 62-65 / 104-107), relays in
mirrored pairs north and south (44↔83 at y 32/95). **Fairness by
construction**: random terrain generates on the west half and mirrors
east — and the 11C lesson is now LAW: a test sweeps every registered
layout for the mirror invariant, and riverline's terrain mirror is
asserted cell-by-cell. `MAP=riverline npm start`. AI wars on it are
fought, deterministic, and replay byte-exactly; they decide slower than
frontier (relays sit off the standard route) — tuning after the first
human playtest.

Suite 390/390 (x2). Tagged slice-11m.

---

## slice-11n — PATH terrain (2026-07-26, prompt 20 Q22)

New terrain id 5: dirt roads / woodland trails at ~1.2x — slower than the
road (1.4x), faster than open — for every chassis EXCEPT the tank. First
per-chassis terrain rule: `speedMultiplier(terrain, stats)` consults an
explicit `heavy` contract flag (tank true, everyone else false; pinned in
3A/9A and data/units.json); a heavy hull crosses trails at rough speed
(128). Both maps grew mirrored trails: frontier gets flanking woodland
loops north and south of the corridor (rows 40/41 and 86/87, x 24..103),
riverline gets vertical trails linking the road to each relay pair
(columns 44/83). The 11M mirror tests extend to trails. 0I map fixture
re-pinned (v2, terrain id 5 registered, `debugging/repin_0i.mjs`); the 1A
fixture did NOT drift — no reducer contract change, and no fixture unit
crosses the new rows. Light chassis now genuinely flank: a scout does 67
units/tick on a trail where a tank does 16.

Suite 390/390 (x2, +3 new = 393 on next count), simwar + replay OK.
Tagged slice-11n.

---

## slice-11o — Direct-drive targeting (2026-07-26, prompt 20 Q23)

"Not an FPS": in direct mode, clicks are WEAPONS ONLY with aim assist —
`buildCommandForClick` gains a directMode contract: the nearest visible
enemy (or drone) within DIRECT_ASSIST_CELLS (3) of the cursor snaps as
the target; empty ground returns null — never a move, never a seat
switch, so a stray click cannot yank the tank off its line. A red
targeting circle (true weapon range, per chassis) rides the asset every
frame while driving, with a center reticle. Normal-mode click semantics
are untouched (pinned by test). Engine unchanged — pure client/model
slice, no repin.

Suite 394/394 (x2). Tagged slice-11o.

---

## slice-11p — BATCH_PC agent-mail lane + true mirror mode (2026-07-26, prompt 20)

The gaming-PC job flow, agent-mail semantics as ruled: `tools/agent-mail.py`
deployed into the repo (single file, no deps; `.agent-mail/` gitignored).
`tools/batch_send.sh` queues jobs (sweep/mirror/matrix/perf) and collects
results; `tools/batch_worker.sh` is the batch-pc lane — refuses a red
suite, sits in blocking `flag wait`, takes queued JSON jobs (whitelisted
kinds only, never arbitrary text), auto-shards sweeps across cores,
merges CSVs, mails back one-line summaries, posts status while running.
Round-trip verified locally both ways (ONCE=1 drain mode).

The smoke test caught that the old MIRROR swap made dead 0-0 wars (team
swaps broke fixed AI pairings). Replaced with a TRUE world reflection:
terrain mirrored cell-for-cell, every entity reflected across x'=W-1-x,
headings across the vertical axis, AI patrol tables swapped (legal — they
are exact mirrors). In a bias-free engine the mirrored outcome
distribution must be the exact flip of the normal run; any residue is
directional arithmetic (question 18). First 2-seed probe already shows
residue: normal seeds 1-2 end in A standard-captures ~tick 3500; mirrored
same-seeds run past 6000 undecided. The 600-war census will say whether
that is real. Known caveat noted: MPG rebuilds use unmirrored spawns.

Suite 394/394. Tagged slice-11p.

---

## slice-11q — Art pass, round 1 (2026-07-26, prompt 19 "art pass start", Q9b)

Upgraded procedural models — chunky low-poly with real character, all far
inside their manifest triangle budgets:
- TANK: twin track assemblies with visible road wheels, sloped glacis,
  turret + mantlet, muzzle brake, cupola, antenna, twin exhausts.
- SCOUT: open recon buggy — hood, roll cage, spare wheel on the tail,
  whip antenna.
- ARTILLERY: split trail legs with spades, two-stage tube + muzzle brake,
  elevation quadrant, ammo crates on the deck.
- LOGISTICS: crew cab with windshield/mirrors/bumper, laden bed (crates),
  two-stage crane with cable and hook, six wheels.
- CARRIER: reads as RESCUE at a glance — white cross beams on the roof
  module, twin beacons, side skirts, sloped prow, ramp, crew hatches.
- NEW factory keys `mine` (disc + sensor prongs + team panel) and `drone`
  (quad pod + rotors + camera eye) — the client's inline mine/drone
  geometry replaced with factory builds (team-panel tinting: own mines
  team-colored, marked enemy mines red; drones spin slowly).

Pipeline: mine/drone icons + fallback sprites generated (28 SVGs),
manifest entries with budgets, asset strip now 18 tiles — regenerated
`client/assets/preview/asset_strip.png` IS the review artifact: open it
and judge; round 2 follows your verdict. team_panel tint contract and all
art pins hold (strip width pin updated 16→18).

Suite 394/394 (x2). Tagged slice-11q.

---

## slice-11r — The Scout Bike (2026-07-26, prompt 22)

New chassis id 5: speed 72 (outruns everything including the drone's
chase), hp 30 (dies to any hit), damage 5, turnRate 20, path-loving —
and the headline: **`canCapture: false`**, a new explicit contract flag
on every chassis. A bike on a flag neither captures NOR contests it — it
sees the war, it cannot hold it. It still returns its own dropped
standard (any chassis may) — the fastest standard-recovery in the war,
its courier role. Fielding: garage reserve slot idx 4 traded from tank
to bike (ids 12/24; AI-paired slots 8-11/20-23 untouched); roster now 4
tanks / 3 scouts / 3 artillery / 3 trucks / 2 carriers / 1 bike per
team. Also landed the **`siege` flag** (mortar prep): site-breaching is
no longer "indirect" but explicitly artillery-only, per ruling Q9.
Capture pass and AI capturer roles skip canCapture:false chassis. Art:
bike builder (hunched rider, panniers), wreck, icon/sprite, strip → 20
tiles. 1A → v29.

Suite 394/394 (x2, 399 with the new file), simwar + replay OK.
Tagged slice-11r.

---

## slice-11s — The Mortar Carrier (2026-07-26, prompt 22)

New chassis id 6: artillery's little brother — indirect fire that keeps
up with a push. speed 28 / turnRate 12 (nearly twice the siege gun's
mobility), range 1792 / minRange 512 / damage 15 / reload 25 (junior in
reach, punch, and dead zone — all pinned relative to artillery, so a
future artillery retune can't silently invert the relationship). Bound
by the spotter doctrine like all indirect tubes; `siege: false` — the
11R flag doing its job: mortars cannot breach infrastructure (Q9), and
being indirect they cannot track aircraft. Fielding: garage slot idx 6
traded from artillery to mortar (ids 14/26). Roster per team is now:
4 tanks / 3 scouts / 2 artillery / 3 trucks / 2 carriers / 1 bike /
1 mortar. Art: stubby high-angle tube + baseplate + shell-arc icon;
strip → 22 tiles. 1A → v30.

Sim gate: AI-war outcomes byte-identical to baseline (both new chassis
are garage stock — humans and role-crewing reach them, fixed AI pairings
don't). Suite 403/403 (x2). Tagged slice-11s.

---

## slice-11j — Ops hardening (2026-07-26, plan 2.6, prompt 23 window)

Two protections for LAN playtests and BATCH_PC provenance:
- **Per-connection rate limit** (transport-level token bucket: 30
  commands/s sustained, burst 60 — generous for direct-drive intent
  streams, fatal to runaway scripts). Purely a transport concern: a
  dropped command never reaches the reducer, so determinism and replays
  are untouched; flood test pins that the reducer queue holds at most
  one burst.
- **GET /version**: name, package version, 1A fixtureVersion, map
  profile/seed, AI difficulty — exact provenance for bug reports and
  batch results.
Also: `debugging/analyze_sweep.py` — turns BATCH_PC CSVs into findings
(win rates, decided-war length percentiles, per-system activity, and the
question-18 mirror flip-rate verdict); smoke-verified against live runs
(early signal: mirrored wars mostly stop deciding — residue is real).

Suite 407/407 (x2). Tagged slice-11j.

---

## slice-11t — Public tasks (2026-07-26, plan 2.4, prompt 23 window)

Mission cards as a PURE view-model (`client/js/tasks_model.js`): tasks
derive from the team's fog-filtered view only, so fog safety is inherited
— an engine view goes in, cards come out, and the test proves the enemy's
wrecks never card for you. Urgency ladder (what loses the war fastest):
STOP THE THIEF (own standard carried) > secure dropped standard > escort
the standard run > rescue walkers (your own body is the R-prompt, not a
mission) > defend a flipping relay > tow claimable wrecks > rebuild
ruins. "Responding" for v2.0 is the 10C ping channel: clicking a card
jumps the camera and sends the task's matching context ping (all standing
-legal kinds — never need_rescue). HUD: top-3 card strip, DOM-diffed by
stable task ids. No engine changes, no new state, no repin.

Suite 411/411 (x2). Tagged slice-11t.

---

## slice-11u — Playtest-4 fixes (2026-07-26, prompt 24)

1. **Orientation bug (the real one)**: vehicles drove 90° right of their
   travel direction. Root cause: the brads→radians conversion assumed
   models face +x; every builder authors them facing +z (barrels at +z).
   Fix: `rotation.y = π/2 − θ`. The replay viewer was already correct
   (canvas basis differs) — untouched.
2. **Downed UX**: bottom-center action banner — "YOU ARE DOWN — redeploy
   in Ns" counting the 10 s gate down, then a clickable green "REDEPLOY
   NOW (R)". On YOUR redeploy the camera jumps home, auto-select re-arms
   and follow mode resumes — the answer to "my view stayed on my corpse"
   (ruled: move automatically, no edge arrows needed yet).
3. **Tow UX**: same banner offers "TOW ASSET N (T)" when a truck stands
   beside a claimable wreck; T and the click both hook it. The mission
   card flips to a green "Towing asset N — head home" in-progress state
   (model-tested: a teammate's tow is a claimed wreck, not your mission).
4. **Labels**: world-label sprites now take two lines; live countdowns
   everywhere they matter — relay flips ("RAISING 2s" / "DROPPING 2s —
   DEFEND!"), damaged relays ("truck + materiel rebuilds"), repair bays
   ("REPAIRING 4s"), dropped standards ("auto-returns in 38s").

Suite 412/412 (x2). Tagged slice-11u.

---

## slice-11v — AI doctrine: bike / mortar / paths (2026-07-26, prompt 24)

Approved trio, all sim-gated:
- **Courier**: the recoverer role now goes to the FASTEST controlled seat
  (ties: lowest operator) — a crewed bike is automatically the standard
  courier; and a dropped own standard pulls the garage bike into service
  (role-crewing rule between carrier and fire-support priority).
- **Replacement fire support**: a team with no crewed operable indirect
  tube crews a free mortar/artillery from the garage — dead artillery no
  longer means silent guns for the rest of the war.
- **Trails**: light chassis (fast + not heavy: scout, bike) patrol
  LIGHT routes along the woodland trails (frontier rows 40/86 flanking
  loops; riverline leans up and down the relay trail columns) — heavy
  hulls keep the road. Mirrored tables, mirror-mode aware.

Along the way, two latent bugs shaken out: the replay scrubber's
checkpoint selection could return a MID-TICK state (checkpoint recorded
between same-tick commands; `<=` → strictly `<` so seeks always cross the
advance boundary — found because 11V's extra AI commands shifted a
checkpoint into a command cluster), and the 11J flood test now asserts
the rate-limit PROPERTY (rejected+queued accounts for the flood) instead
of load-sensitive fixed thresholds.

Gate: winners stay mixed; three of five seeds become long high-scoring
slugfests (185-190 on seed 777) — the flank patrols generate real
contact. Suite 416/416 (x2). Tagged slice-11v.

---

## slice-11w — Riverline bridge relays (2026-07-26, prompt 25 ruling b)

The central crossing gets a relay PAIR (58<->69, exact mirrors) — six
relays on riverline, the bridges now the contested heart. Mirror
invariant covered automatically by the 11M layout sweep. HONEST GATE
RESULT: wars are livelier (relay churn at the bridges, 80-80 to 115-100
scores) but still reach the horn undecided across 3 seeds — the bridge
pair alone does not unlock standard captures; a carrier raid across a
single contested choke rarely completes. Open item for the next design
round: riverline standard-run viability (candidates: move standard homes
nearer the road, a south-bridge route bias for raiders, or accept that
riverline is the points-war map until the amphibious Infiltrator opens
the river itself).

Suite 416/416. Tagged slice-11w.

---

## slice-11x / slice-11y — Art round 2 (2026-07-26, prompt 25 rulings c then a)

**11X — battlefield props (2c)**: `client/js/props_model.js`, a PURE
deterministic placement model (integer cell hash — cross-client identical,
zero Math.random): forest cells grow cone trees (~1/3 density), rough
grows rocks, trails get trodden ruts, each with jittered position/scale/
rotation. Rendered as three InstancedMeshes appended to the terrain group
— hundreds of props, three draw calls. Test pins determinism,
terrain-correctness per prop, and density bounds. Terrain now reads at a
glance — the original playtest-2 legibility complaint, closed.

**11Y — faction palette pass (2a)**: `applyFactionScheme(group, color,
assetId)` blends every PAINTED body mesh (paintToken "paintedMatte" —
never worn metal, never the team panel) 30% toward the faction hue with a
deterministic per-hull value jitter as weathering — a column of tanks no
longer reads as clones. Wrecks stay ashen. The `applyTeamColor`
panel-only contract is untouched and re-pinned alongside the new scheme
test (factions read apart / same id same paint / metal is metal).

NOTED for later (prompt 25): art 2b motion (tracks, recoil, tracers,
rotor blur) and 2d baked sprite fallbacks.

Suite 418/418 (x2). Tagged slice-11x, slice-11y.

---

## slice-14a / slice-13e / slice-15b — Wave-3 openers (2026-07-27, prompt 27)

**13E fog ghosts**: pure `ghosts_model.js` — a spotted enemy that slips
into fog leaves a fading spectral hull at its last pose for 10 s; born
only from what the view delivered, cleared instantly on reappearance,
nothing crosses the wire. Rendered as translucent faction-less memories.

**14A props round 2**: `s_map` now carries `mapProfile` (public info);
riverline dresses itself — water sheen tiles over the river band, rails
on every bridge span, reeds along the banks (all deterministic,
cell-hash placed, terrain-correctness tested); every relay gets crate
clutter and both standard homes get plinths (one-time war dressing,
rebuilt on rotation).

**15B string extraction, part 1**: `client/js/strings.js` — t(key,
params) over key-identical en/no catalogs (~110 strings: every rejection
reason, ping labels, mission cards, banners, world labels, UI toasts).
REJECTION_TEXT became a locale-aware proxy so the historic 8H sweep
contract holds; ping/tasks/client speak the active locale; ⚙ gains a
Language/Språk selector persisted in localStorage (switching flushes
labels + HUD). Norwegian is a full first-class catalog, parity-enforced
by test. PART 2 remains: describeEvent's ~30 parameterized feed lines
and the static index.html/briefing text.

Suite 422/422 (x2). Tagged slice-13e, slice-14a, slice-15b.

---

## slice-12a — Faction identity: The Directorate vs The Outliers (2026-07-27, prompt 29)

The designer's ruling, landed exactly as directed — IDENTITY ONLY, zero
gameplay change, zero hashed-state change, no repin:
- `shared/factions.js`: names, palettes (Directorate slate #5a6472 /
  police blue #4a7dc9 / pale cyan; Outliers terracotta #c96a4a /
  sun-bleached tan / warm yellow), symbols, tactical identities, the two
  approved tone lines, blurbs, and the unique-unit/ability names
  (Sentinel / Deploy Hardpoint; Skimmer / Riverline Drive).
- Style tokens: team colors + symbols are now the faction ones — every
  unit tint, panel, minimap dot, and the 11Y paint scheme re-key
  automatically. New symbol SVGs: GRID SHIELD (order, territory) and
  OFFSET ARROW through a broken circle (movement outside the system).
- Join screen sells the choice ("fortify · contain · stabilize" vs
  "bypass · improvise · disrupt"); the briefing opens with your faction's
  line; op-info says Directorate/Outliers, not Team A/B.
- Asset strip regenerated in faction colors. Art pins updated
  (green/red → directorate/outliers; symbol whitelist grew).
- 10A ws test hardened to poll-waits (load flake, same family as before).

Suite 422/422 (x2). Tagged slice-12a. Next per directive: 12B Sentinel,
12C Skimmer, each replacing one garage slot, no 17th asset.

---

## slice-12b — The Directorate Sentinel (2026-07-27, prompt 29)

Deploy Hardpoint, exactly as the designer framed it. Mobile: a crawling,
lightly-armed hull (speed 12, range 1024, damage 8, hp 150, heavy — no
trail bonus). DEPLOYED: an immobile hardpoint with artillery-class
DIRECT reach (range 2048, damage 25) — fortify · contain · stabilize.
Transition is 3 s each way (HARDPOINT_TRANSITION_TICKS): immobile, guns
cold, no double-commands. Engine shape: `deployable` contract flag on
every chassis + `deployedRange/Damage/ReloadTicks` on the Sentinel;
`effectiveCombat(asset)` feeds resolveShot/inFireRange so the profile
switch is one seam; per-asset `deployed`/`deployTimer` hashed (1A → v31);
disablement folds the legs; deployed flag is PUBLIC in enemy views (a
raised hardpoint is externally obvious — baseline leak pin extended
deliberately). Fielding per directive: replaces the Directorate's garage
tank at reserve idx 10 (id 18) via per-team reserve tables — no 17th
asset; the Outliers keep that tank until 12C's Skimmer. Client: H
toggles, banner action, DEPLOYING/UNDEPLOYING/HARDPOINT ACTIVE labels
with countdowns, designer's exact UI copy in en + no. Art: squat
platform on fold-legs with twin-gun casemate; strip → 24 tiles.
NUMBERS ARE MINE — flagged for tuning (12-Q #2 asked; answer pending).

Suite 422/422 (x2, 427 with the new file), simwar + replay OK.
Tagged slice-12b.

---

## slice-12c — The Outlier Skimmer (2026-07-27, prompt 29)

Riverline Drive, and with it REAL WATER: `T_WATER` joins the terrain set
and the riverline river band converts from rough to water. Design call
(flagged for the designer): water is brutally slow but PASSABLE for
normal hulls (0.25x — misery fording) rather than impassable, because
the straight-line AI would wedge against a hard wall until the 13C route
graph exists; the amphibious Skimmer crosses at trail speed (307) — an
8x mobility gap on the river, the Outliers' highway. The Skimmer itself:
speed 56, hp 45, light gun, fast tube, agile — bypass · improvise. New
`amphibious` contract flag explicit on every chassis. Fielding per
directive: Outlier garage slot idx 10 (id 30) traded from tank — both
factions now run 3 tanks + their unique, rosters stay 16. Frontier map
untouched (0I fixture re-pinned only for the counts-array width).
Art: rag-tag airboat (fan cage, outrigger floats, exposed wiring);
strip → 26 tiles. Roster sweep test now faction-aware.
NUMBERS ARE MINE — the faction pair is UNTUNED until the faction-swap
sweep campaign (12D) runs on the batch PC.

Suite 431/431 (x2), simwar + replay OK. Tagged slice-12c.

---

## slice-15b2 — String extraction part 2 (2026-07-27, prompt 30 window)

The remaining English-only surface: all ~36 describeEvent feed lines,
win reasons (incl. reason 0, wording pinned to the historic 8H strings),
the end screen (VICTORY/DEFEAT/DRAW, next-war line, HONORS heading), and
the mission BRIEFING — which also finally gained the faction opening the
12A patch had silently missed (found because this slice's patch refused
to match: the briefing was still the plain-team version; the client call
site passed a faction arg that JS quietly ignored). Full Norwegian for
every new key; catalog parity enforced as before. Remaining en-only:
static index.html text (join headline, options panel labels) — noted,
low value until a third locale appears.

Also this window: BATCH_PC.md re-topologized — the gaming PC already
hosts a sibling project's agent-mail hub, so firepower runs its OWN hub
THERE on port 8971; the dev machine is outbound-only (WSL portproxy
dance deleted).

Suite 431/431 (x2, 432 with the new test). Tagged slice-15b2.

---

## slice-13a — Full cargo + the resupply runner (2026-07-27, prompt 31)

Trucks now haul a field-resupply hold — one full asset's worth (4000
fuel, tracking the 11C FUEL_MAX bump, + 12 shells) — reloaded SILENTLY
when idle at home (the materiel pattern keeps the 1A event contract
asleep) and delivered with `transfer_cargo` to an ADJACENT friendly:
partial fills, hold pays exactly what the target takes, honest
rejections (chassis/reach/empty hold/topped-up/enemy). The truck must
drive home to refill, so the base-return rhythm survives field
logistics. cargoFuel/cargoAmmo hashed (1A → v33, then v34 for the hold
size). **13B rode along**: the AI resupply runner — a stocked truck
tops up the thirstiest nearby teammate, tubes first (artillery/mortar
burn ammo fastest); adjacent = transfer, else drive to them; slots
between mine-clearing and towing in the errand order. Client: V key +
"RESUPPLY ASSET N (V)" banner, cargo readout in the supply bar, en/no
strings. Sim gate: decisive seeds identical, long seeds show the
runners at work (777 now 145-130), winners stay mixed — PASS. Also
hardened the 6A ws test to poll-waits (load flake family).

Suite 437/437 (x2). Tagged slice-13a.

---

## slice-15c — a11y basics (2026-07-27, prompt 31)

All ⚙-panel, all persisted, zero engine: HIGH CONTRAST mode (black
panels, white text on every HUD surface via a body class), TEXT SIZE
100/125/150% (one CSS variable scales every HUD element), and REMAPPABLE
ACTION KEYS — a pure `keybinds.js` table (redeploy/tow/board/unboard/
mine/clear/transfer/hardpoint/direct-drive) with click-then-press rows
in the panel; camera and mode keys stay fixed. Corrupt or invalid
storage falls back to defaults by test. The client key handler reads the
bind table instead of hardcoded letters. Colorblind-safe team symbols
were already in (shield/arrow per faction).

Suite 438/438 (x2). Tagged slice-15c.

---

## slice-14b + guards — faction palette r2, parse gate, join smoke (2026-07-27)

**14B faction palette round 2**: `applyFactionScheme` now takes the full
faction object — hulls lerp toward the faction PRIMARY (Directorate
slate, Outlier terracotta; the identity color stays on the panel), and
`applyInsignia` draws the faction symbol (grid shield / offset arrow) as
a canvas-texture DECAL on every team panel — headless-safe no-op where
no DOM exists (node tests, strip renderer). Hex-arg compatibility kept.
Analyzer gained the 12D `--factionswap` mode: reports the SENTINEL-side
win rate across normal+swapped runs — over 58% or under 42% = the unique
pair needs tuning; ready for the nightly CSVs.

**Playtest-5 incident**: a duplicate `factionFor` import (two overlapping
12A patch runs) crashed the client at LOAD with a SyntaxError — and no
node test imports client.js, so nothing caught it. Two guards added:
1. `test/client_sources.test.js` — every client module must PARSE as an
   ES module (`node --input-type=module --check`); this class of bug now
   fails in milliseconds, always-on, no browser.
2. `tools/client_smoke.mjs` (user's suggestion) — the Playwright
   join-flow smoke: loads the client in Chromium, joins BOTH factions +
   spectator, dismisses the briefing, asserts the war ticks and ZERO
   page errors. Optional (exit 2 without playwright); documented in
   BATCH_PC.md as the pre-playtest check on the gaming PC.

Suite 440/440 (x2). Tagged slice-14b.

---

## slice-14g — Map detailing & buildings (2026-07-27, prompt 36)

PURE PRESENTATION (zero engine, zero hash — the nightly's results stay
valid): bases become real compounds — faction-tinted HQ block with an
identity-color roof cap, two garage sheds, fuel tanks, antenna mast,
landing pad, corner posts — laid out rect-relative and MIRRORED so both
headquarters face the front line (tested exactly). Roads carry worn
center-line dashes (~150/map), forests grew undergrowth bushes
(~300/map) — all deterministic cell-hash placement, all instanced.
Review round: two new regression nets from real incident classes —
every getElementById target must exist in index.html (silent-null
wiring), and every literal t("key") must resolve in the en catalog
(typo'd keys render raw). Memory + plan updated.

Suite 443/443 (x2). Tagged slice-14g.

---

## slice-14i — Playtest-6 command UX (2026-07-27, prompt 37)

1. **Hover takeover + the encyclopedia seed**: hovering a vacant friendly
   raycasts to a name tag ("SCOUT BIKE — vacant · click to take") with an
   ⓘ shortcut opening the inline stats panel — `codex.js`, pure, derives
   every line from the UNIT_STATS contract + role blurbs; the future
   encyclopedia option button reads the same module.
2. **Order glyphs**: every click-order stamps a fading, rising glyph at
   the clicked cell — ► move (gold), ✚ fire (red), ⛓ tow (cyan), ✓ take.
3. **The status panel** (lower center): `status_model.js`, pure — HP/
   ammo/fuel bars and the exact why-nots, worst first: OUT OF AMMO/FUEL/
   SUPPLY (client-side supply mirror for display), reload and suppression
   countdowns, hardpoint state; REQUEST SUPPLIES button pings the new
   `need_supplies` kind (the AI resupply runner already hunts needy
   assets — the ping tells the humans). en+no throughout.
4. **The facing question** (east "backing in"): the brads→rotation math
   is provably side-symmetric — if east were 180° off, west would be too.
   Suspicion: the fixed SE camera hides east-side barrels (pointing away)
   so correct facing reads backwards. Instrument, not guess: every unit
   now carries a GOLD FACING CHEVRON at its nose. If playtest 7 still
   reads east as reversed, the flip is one line — but the chevron will
   almost certainly acquit the math and convict the silhouette.

Also: the DOM-id regression net caught its first dynamic-id case
(btn-request-supplies) and learned about innerHTML-created elements; 2B
ws test moved to poll-waits (flake family).

Suite 445/445 (x2). Tagged slice-14i.

---

## slice-14j — Playtest-6 mission UX, items 5-10 (2026-07-27, prompt 38)

5. **Mission toasts + team board**: your Recognition score rising IS a
   mission completing — the client diffs your public score and toasts
   "MISSION COMPLETE +N pts" center screen (2.6 s fade). Left side: the
   collapsible TEAM TOP 5 (public scoreboard, humans and regents,
   collapse state persisted).
6. **Roads are sacred**: base buildings and relay clutter check their
   footprint against the terrain and never cover road or trail cells
   (the fuel tanks that used to sit on the base's road strip are gone).
7. NOT BUILT — design question answered in the session notes: garage
   stock as session/difficulty config (queued as engine-config slice;
   NPC drivers arrive naturally with 12E).
8. **⌖ center-on-me** button on the status panel (same as F).
9. **Golden target rings**: applicable mission targets within 15 cells
   get a pulsing gold ground ring — follow the gold, do the mission.
10. **Missions fit the asset**: capability filter (recover/repair need a
    truck, rescue needs bunks; combat/standard cards for everyone), ONE
    card per kind (nearest instance wins), up to FIVE visible, each card
    carrying its distance. Seatless garage viewers still see everything.

Suite 446/446 (x2). Tagged slice-14j.

---

## 14J' — order markers gone low-poly (2026-07-27, prompt 39)

The billboarded glyph sprites read as pasted images — replaced with flat
low-poly GROUND meshes in the game's own art language: a gold travel
chevron (two blades + tip, ROTATED to point along your direction of
travel), a red four-wedge attack reticle biting inward around a center
diamond, a cyan recovery clamp (prongs + crossbar), a green field
diamond for takes. RTS-style confirm: shrink into place in 180 ms, hold,
fade flat by 1.1 s. Pure presentation.

Suite 446/446 (x2). Committed on slice-14j.

---

## slice-15a — Mobile touch (2026-07-27 night 2, ruling Q10)

The ruled mobile scheme, wired end to end: an 8-direction STEERING PAD
(bottom-left, touch devices only) — tap an arrow and the unit sets off
in that compass direction, a per-frame controller converting (current
heading, desired heading) into drive intents through the SAME
authoritative 11L command as desktop WASD; tap YOUR OWN unit (raycast
hit) or the red ■ to stop, per the ruling. Canvas gestures: tap =
the normal order path, one-finger drag = camera pan, two-finger pinch =
zoom (clamped). All decision math lives in pure `touch_model.js` —
shortest-arc brad steering with deadband, tap/drag classification,
pinch factors — headless-tested including the wraparound cases. The
page already carried the viewport meta and touch-action:none from the
old 6C prep. HONEST LIMIT: feel needs a real device — first mobile
playtest will tune pad size/position/deadband.

Suite 448/448 (x2). Tagged slice-15a.

---

## slice-14k — The Field Encyclopedia (2026-07-27 night 2, playtest 6.1)

The "option button at some point" — now. 📖 opens the FIELD
ENCYCLOPEDIA: a card per chassis (all nine — stats and traits derived
live from the engine contract via codex.js, so it can never drift from
the truth) plus seven "how the war works" chapters: the Standard,
supply, rescue, mines, the drone, relays, factions — each written en+no,
parity-enforced like everything else. The hover ⓘ panel and this browser
read the same module.

Suite 449/449 (x2). Tagged slice-14k.

---

## 15B part 3 — the static page follows the locale (2026-07-27 night 2)

The last en-only surface: the join screen pitch and faction buttons, the
briefing/next-asset/center buttons, the replay link, and the hint bar
now retranslate at boot AND on a live locale switch (applyPageStrings).
The hint bar was also tightened while extracting it. i18n coverage is
now total: every string a player can see flows through the catalogs.

Suite 449/449 (x2). Committed on slice-15a/14k line.

---

## slice-13f — Session rules plumbing (2026-07-27 night 2, playtest 6.7)

The behavior-neutral half of the garage-config question: `state.rules`
(hashed — replays must re-simulate the same law) carrying
mpgMinOperable/mpgTicks, defaulting EXACTLY to today's constants — a
test pins that DEFAULT_RULES and the exported constants can never drift,
and that a no-rules state hashes identically to an explicit-defaults
one. GameServer({rules}) → survives war rotation; replay meta carries
rules; the reducer's Slow Manufacture pass reads the session law.
Custom-law test: threshold 20 puts a full team permanently below it —
the clock runs from tick one. 1A → v35. DIFFICULTY PRESETS deliberately
NOT wired — awaiting the user's verdict on the proposed numbers
(easy 8/600, normal 6/900, hard 4/1500 — see night-2 clarifications).

Suite 450/450 (x2). Tagged slice-13f.

## batch-fix — collector read the wrong field (2026-07-27)

The results-by-mail loop got its first live run and failed usefully:
the worker (updated to c7f3ea5 by the user) mailed all three nightly
CSVs correctly — tagged, `#file:` headers, 1500 wars — but `collect`
reported "no csv mails". Two schema bugs in `tools/batch_collect.py`:
it read `m["body"]` where the store field is `m["text"]`, and it acked
via a stored `hash` field that does not exist (hashes are DERIVED,
`msg_hash()`; ack now goes by `#id`). The regression test passed while
the tool failed because its fixtures invented the same wrong schema —
the test now carries one line copied VERBATIM from a live store record
so fixture-schema drift is impossible by construction.

Pipeline then ran clean end to end: queue sendresults → worker mails
3 CSVs → collect extracts → analyzer. Per-seed findings on 933064d:
- MIRROR (Q18): 511 both-decided pairs, only 47.6% flip winner under
  full world reflection (bias-free target 100%); 268 pairs keep the
  SAME winner — the outcome is decided by something reflection-
  invariant, i.e. execution order. Confirms the tick-parity diagnosis.
- FACTIONSWAP (12D gate): decided-war A rate 57.0% normal vs 57.4%
  swapped; Sentinel-side 52.2% overall — unique pair within band.

Suite 451/451 (x2).

## slice-16a — tick-parity execution order (question 18 fix, 2026-07-27)

USER GO on the census diagnosis. AI doctrine commands used to resolve in
ascending operator order every tick — team A's seats always struck first,
a ~6-point edge that survived full world reflection and faction-swapping
(1500 nightly wars; per-seed flip rate 47.6% where bias-free = 100%).
Fix in `ai_regency.js plan()`: the EMISSION loop now leads with team
(tick & 1), ascending operator id within a team; role-computation loops
stay in stable order (per-team, no cross-team strike). No reducer change,
no fixture repin — the 1A script has no AI. `test/tick_parity.test.js`
pins the alternation from the authoritative command log over a 3000-tick
war plus same-seed determinism. 5-seed gate: mixed standard-capture
winners (2026→B@3859, 31337→A@4131), close long wars, all systems firing.
Local 600+600 verification sweep launched; PC re-sweep after next push.

Suite 453/453 (x2).

## slice-13g — difficulty presets + the dropped-options regression (2026-07-27)

USER ratified the night-2 numbers: easy 8/600, normal 6/900 (= today),
hard 4/1500. `RULE_PRESETS` in engine/state.js — "normal" IS the
DEFAULT_RULES object (identity test-pinned, not just deep-equal), so the
default session can never drift. `RULES=easy|normal|hard npm start`
resolves via `rulesForPreset` (throws on garbage); /version reports the
running law. The slice also uncovered and fixed a real regression:
createAppServer never forwarded mapProfile OR rules into GameServer —
`MAP=riverline npm start` silently served frontier (11M/13F tests all
drove GameServer directly, so nothing caught the app layer). Regression
test drives createAppServer with riverline+hard and reads the state back.

Suite 457/457 (x2). Tagged slice-13g.

## 16a VERIFIED — 1200-war local sweep (2026-07-27)

Post-fix, 600 normal + 600 mirrored wars: aggregate A 550 / B 554
(49.8% of decided) — the 57/43 first-strike edge is GONE, and the two
worlds are symmetric with each other (A 44.5/B 47.7 normal vs A 47.2/
B 44.7 mirrored). Analyzer verdict logic rewritten for the post-16a
world: per-seed flip rate only measures CORRELATION of mirror pairs
(fair chaos decorrelates to ~50%); what indicts a team bias is the
same team keeping its edge in BOTH worlds. On the old baseline data
the new verdict prints "TEAM BIAS — 58.3% A of decided regardless of
side"; on post-fix data "decorrelated + balanced aggregates". PC-scale
re-confirmation (600+600 on the worker) queues after the next push.

## riverline census tooling (2026-07-27)

`MAP=` env now reaches sim_sweep (GameServer mapProfile — the 13G
app-layer fix's sibling gap), worker gains a `riverline` job kind and
batch_send the matching verb; run_sweep forwards MAP explicitly. Local
300-war riverline census running — the open question is standard-run
viability (2-seed smoke: both horn-bound at 18000). Suite 457/457
(one ws load-flake under 8 sim shards, clean on re-run x2).

## slice-16b — unique-chassis AI (DORMANT behind a flag, 2026-07-27)

The uniques were dead content in AI wars: a probe showed the Sentinel
uncrewed for ENTIRE wars (its garage id 18 never wins the lowest-free
pick), so the anchor doctrine written for it never fired. Landed, all
flag-gated off by default (`uniqueCrewing` option; `UNIQUES=1` in
sim_sweep):
- crewing rung: no crewed unique on the team + one free -> take it;
  junior to carrier/courier/tube, and a fixed agent's own seat outranks
  it. Fixed agents with dead pairs may now crew the unique (before:
  they idled until MPG rebuilt the pair).
- Sentinel doctrine: REACTIVE fortress — deploy only when anchored near
  an owned site AND the team sees an enemy inside deployed reach; stow
  when the threat clears / anchor lost / capture errand elsewhere;
  stay-put guard kills move-order spam while deployed.

Why dormant — the sweep evidence chain (all 300 seeds, frontier):
1. standing-fortress first cut: A 78/19 — area denial with no mirror.
2. 12D swap on that build: Sentinel-side 67.4% -> chassis+doctrine OP.
3. threat-reactive tune: Sentinel-side 53.1% — CHASSIS GATE PASSES
   (deploy uptime collapses to ~0-150 ticks/war).
4. but mirror probe: A 59.7% aggregate BOTH worlds on seeds whose 16a
   baseline is 47.5% — a ~12pt TEAM-linked residue, mechanism not
   isolated (hypothesis: fastest-seat recoverer distorted by the
   Skimmer + an unexplained A-keyed component). Fails the sim gate ->
   ships dormant. Chase at batch scale with UNIQUES=1 sweeps.

ALSO: riverline census landed its verdicts (300 + 300 mirrored):
standard endings 19% (viable, not horn-locked); the 58.9% B edge FLIPS
perfectly under mirroring (aggregate 50.4%) — the generated terrain's
east side is systematically stronger. Engine fair; layout needs a
symmetrization pass someday.

Suite 466/466 (x2). 5-seed gate byte-identical to pre-16B. Tagged slice-16b.

## slice-14c1 — motion pass batch 1 (art 2b PROMOTED, 2026-07-27)

User promoted 2b/2d from "noted". Batch 1, all client-side and event-
driven on the vfx_cues contract (pure `motion_cues.js`, renderer owns
meshes): turret RECOIL on fire_resolved (kick back along the barrel
line, eases exactly home — curve pinned 0 at both ends, peak at 20%),
SHELL-ARC TRACERS for indirect chassis (parabolic apex mid-flight;
fog-honest: both ends must be visible, no arcs out of nowhere), DUST
puffs behind rolling hulls (cadence model: real movement + interval),
and the drone ROTOR BLUR disc. Tests cover the curves, the fog rules,
and the cadence; parse gate + wiring nets green. Batch 2 remains:
track-scroll illusion (needs texture work on procedural hulls).
NOTE: Playwright smoke is dormant on this machine too (never a
package.json dep) — installing it is the user's dependency call.

Suite 472/472 (x2 pending commit ritual). Tagged slice-14c1.

## slice-14d — baked sprites (art 2d PROMOTED, 2026-07-27)

The strip tool's software rasterizer moved VERBATIM into
`tools/soft_raster.mjs` (asset_strip.png byte-identical across the move
— md5 pinned before/after). New `npm run sprites` bakes every
procedural key into 16-heading rotation sheets (64px frames, both team
tints, 308K total, deterministic): frame f == heading brads f*16, so
`sprite_frames.js frameForBrads` is a one-liner both sides pin by test.
Three consumers seeded:
- `sprite_renderer.js` — the 2D canvas fallback. Engages ONLY when
  WebGL is absent (probe) or ?renderer=2d: spectator-grade terrain +
  sprites view with an i18n notice; the 3D path is untouched by
  construction (fallback short-circuits init). Cue arrays prune in the
  2D loop too (they'd have grown unbounded). buildDrawList is pure and
  fog-honest (tested: wrecks pick wreck sheets, world coords get the
  half-cell offset like the 3D client).
- Minimap unit icons: YOUR hull now renders as its baked frame,
  heading and all — the seed; other dots stay dots.
- fps-floor AUTO-engage (the perf-data half of the ruling) waits for
  the PC's perf harness run (playwright install pending there).

Suite 479/479 (x2). Tagged slice-14d.

## keybind hotfix — the smoke gate's first local catch (2026-07-27)

Playwright landed on the dev machine and `node tools/client_smoke.mjs`
failed on its FIRST run: "Cannot access 'k' before initialization" on
every join path. Real pre-existing bug from the 15C keybinds refactor —
the keydown handler tested `k === BINDS.directDrive` twenty lines ABOVE
`const k = ...`, so the TDZ throw killed EVERY keypress since 15C
(direct-drive toggle, redeploy, board/unboard, camera keys). Parse gate
can't see TDZ; only a real browser could. Declaration moved to the top
of the handler; smoke now green end to end (both factions join, briefing
shows, war ticks, zero page errors). The smoke gate joins the standard
client-slice ritual now that it runs locally.

Suite 479/479 (x2). Smoke OK.

## slice-16c — mirror-symmetric movement + worker self-update (2026-07-27)

Chasing the riverline east edge produced a REAL engine bug and an
honest surprise:
- REAL BUG, FIXED: movement stepped with floorDivI32 on signed trig
  products — floor rounds toward -inf, so west/north diagonal movers
  gained exactly 1 world-unit per tick over their mirrors (test-proven:
  920 vs 880 over 40 ticks). Fix: `truncDivI32` (toward zero) for the
  DIR_COS/DIR_SIN steps in both integration paths.
  `test/move_symmetry.test.js` pins all four mirror pairs. NO 1A repin
  needed — the fixture's script never runs a long diagonal. Frontier
  post-fix: 52.5% A of decided (fair, no regression).
- SURPRISE: riverline's east edge SURVIVES (B 57.3% of decided, flip
  rate 99.6%, aggregate 49.9% team-fair). The generator was already
  symmetric; movement now is too — so a THIRD side-linked mechanism
  exists. Next diagnostic (designed, not yet run): the equivariance
  divergence probe — run seed s normal and world-mirrored side by side
  and binary-search the FIRST tick where the mirrored state stops being
  the exact mirror; that names the asymmetric subsystem directly.
  Suspects already identified: heading-snap tie (h=8 snaps to dir 1,
  its mirror snaps to dir 8, not 7) and the east-rim clamp slack
  (maxX=(w-1)*256+255 has no west preimage).
- Worker self-update (prompt 47): `batch_send.sh update` → worker
  `git pull --ff-only` + re-exec; fresh process re-validates the suite
  and mails "worker online on <commit>" (online notice is now MAIL, not
  just status — the dev side watches the store and queues on it). The
  PC bounce ritual is one-time-only from here.
- perf harness: forces ANGLE d3d11 (first PC run silently rendered on
  SwiftShader — 6fps median software floor, useful for the 2D-fallback
  question but not the 4070 number we wanted).

Suite 481/481 (x2). 5-seed gate healthy. Tagged slice-16c.

## slice-16d — equivariant heading snap (2026-07-27)

The divergence probe (dbg_mirror_diverge.mjs) caught its first culprit
at TICK 2: headings exactly between two 16-dir sectors (h ≡ 8 mod 16)
always rounded clockwise — h=248 snapped to pure east (cos 256) while
its mirror 136 snapped to a diagonal (cos -237). Fix: `dirForHeading`
tie-breaks to the EVEN direction index, which commutes with both
reflections. Probe now runs 80 ticks of EXACT mirror equivariance (the
tick-81 divergence is a transform artifact: anchor-preserving
reflection vs mid-cell floor sampling — analyzed direction-symmetric
in-world, so not a fairness bug). Frontier post-fix 48.0/46.3 (fair);
riverline mirror pairs now flip at a perfect 100.0%. BUT the east edge
itself SURVIVES (B 57.9% of decided) — mechanism still at large;
subsystem-ablation bisection is next (dbg_ablate_sweep.mjs:
nowater/nopaths/nomines/nodrones).

Suite 481/481 (x2 with prior run). Gate healthy.

## riverline investigation — checkpoint verdict (2026-07-27)

Ablation bisection (160 wars each vs baseline B 57.9% of decided):
nowater B 46.5% (EDGE GONE) · nopaths B 46.8% (EDGE GONE) ·
nomines B 57.6% (intact). The east edge requires WATER and TRAILS
TOGETHER; mines are innocent. Everything cheap to audit is now clean:
terrain symmetric by construction, movement truncDiv-symmetric (16c),
heading snap equivariant (16d), patrol tables exact mirrors, bearing16
equivariant in all quadrants (one rare turnToward 180°-tie chirality
noted, mirror-odd fix sketched: turn away from map center). The
remaining mechanism lives in the WAR SHAPE: trails deliver units to the
outer relays, cross-river capture-seek then FORDS the water band in a
straight line (no pathfinding), and that traffic pattern pays the east.

SEQUENCING CALL: 13C route graph (already the ruled next lane) replaces
straight-line fording with road/bridge routing — the exact dynamics
this edge lives in. Riverline balance gets RE-MEASURED after 13C
rather than micro-tuned against behavior that is about to be deleted.
The ablation harness stays in debugging/ for that re-measurement.

## branding — Fireline Command (2026-07-28, specs/title-and-naming.md)

Approved naming: title "Fireline Command", short "Fireline", catchphrase
"Join the battle. Turn the front." PRESENTATION-ONLY per the brief: page
titles, join-screen h1 + tagline (i18n keys page.title/page.tagline,
en/no), package.json description, server console banner, README heading
(dev-name continuity note kept), CLAUDE/RUNNING headings. Technical
identifiers unchanged by design (package name, routes, state keys,
tests, replay formats). The 2F test's brand assertion updated — it
caught the rename exactly as intended. Smoke green (title renders, both
factions join). The faction spec (faction-name-and-units.md) re-confirms
the landed 12A-12C identity — no deltas.

Suite 492/492. Tagged branding-fireline.

## slice-15d — UI acceptance harness + the buried-HUD fix (2026-07-28, playtest 7)

The playtest-7 directive ("UI buttons need acceptance tests that prove
they trigger the right functions") built `tools/ui_acceptance.mjs`
(Playwright: join, pan, click, assert via window.__mfDebug), and its
FIRST run caught item 14's root cause: #canvas-container sits at the END
of body, so the three.js canvas painted OVER every absolute HUD element
without an explicit z-index — center-on-me (and next-asset, settings,
encyclopedia) were unclickable. Fix: canvas z-index 0, hud-top z-index 5.
Also found a DUPLICATE #touch-pad div (the patch-applied-twice class the
parse gate can't see in HTML) — deduped. Harness covers: arrow pan,
follow disengage/re-engage (item 14), next-asset cycling, encyclopedia.
Harness caveat documented in-file: headless SwiftShader renders
unthrottled rAF, so the test viewport stays small to keep frames cheap.

Suite 490/490. Smoke OK. UI acceptance OK. Tagged slice-15d.

## slice-13c — THE ROUTE GRAPH (2026-07-28, wave-3 Track G centerpiece)

AI movement rides a per-profile node/edge graph: hand tables from layout
constants (mirror-closed, tested), deterministic O(n^2) Dijkstra with
per-chassis edge costs (road 7 / trail 8 light · 20 heavy / open 10),
water-barrier pricing so bridges beat fords, direct-skip under 14 cells,
amphibious skips entirely (the river IS the Skimmer's road). Stateless
consumption: routes recompute from the current cell each plan cycle;
nextWaypoint scans from the end (never backtracks a mid-chain asset).

EQUIVARIANCE, proven not hoped: dbg_route_equivariance enumerates 4800
mirrored trips — 0 violations after two real chirality fixes: (1)
nearest-node ties broke on lowest id, attaching west units to OUTER
trail ends and east units to INNER ones; fixed with the off-axis rank
(|2x-127| is mirror-invariant); (2) exact-rank ties are mirror-partner
nodes where only a TRIP-keyed rule commutes — prefer the candidate on
the trip origin's side. Same rank ladder applied to relay-seek ties.

THE TOW-ECONOMY SAGA (how a movement slice became a doctrine lesson):
routed roads marched trucks into the centre fight; team tow counts went
85 -> 0 across 300 wars. Fix attempt #1 (rearguard stationing + roleTruck
crewing) restored tows but the A/B bisection convicted rearguard of a
~25pt WEST chirality (with-it 72/28, without-it 51/49 while tows BOOM at
11.5/war) — truck SURVIVAL (the roleTruck rung) was the whole fix;
rearguard is REMOVED, the bisection recorded here in its place.

ACCEPTANCE (all local, 300-war scale):
- frontier: 51.2% aggregate, no side lean, tows 11.5/war, 0% undecided,
  standard endings ~50%, decisive-war p10 ~3000 ticks. The war finally
  plays its own fantasy: roads carry assaults, trails carry scouts,
  trucks live behind the line and haul wrecks home.
- riverline: PERFECT mirror stats (flip 100.0%, aggregate exactly 50.0)
  — but a west 73/27 side lean replaces the old east 58/42. Teams are
  side-bound, so riverline stays an EXPERIMENTAL profile pending its
  own graph-tuning campaign (ablation + equivariance harnesses ready).
- 5-seed gate: mixed winners, tow/rescue/delivery all firing, fleet
  advantage swings by seed. Four straight-line AI tests updated to
  route-aware exact expectations (test/helpers.js expectedStep).

Suite 490/490 (x2). Tagged slice-13c.

## slice-17 — body collision (2026-07-28, playtest 7 ruling)

HARD blocking vs enemies (192 units), SOFT half-speed compression
through friends (128), CLOSING moves only — separating is always legal
(the bridge-deadlock escape); wrecks/downed don't collide (v1). March
order alternates by tick parity (no first-mover team — the Q18 lesson,
physics edition). No 1A repin (the fixture's hulls never close).

The battery exposed and killed a long-documented harness caveat: MPG
rebuilds used the unmirrored constant spawn table, so mirrored-world
rebuilds spawned behind enemy lines — collision's longer wars made it
load-bearing (47 phantom dominations in one battery). Rebuild position
is now BASE-DERIVED from state (mirror-honest by construction);
type/row stay table-pinned.

Acceptance (300+300 frontier, honest mirror): aggregate 51.4% (fair),
outcome mixes match across worlds (1 vs 1 domination), tows ~10/war.
HONEST REGRESSIONS, fixes already ruled and next in queue: standard
endings collapsed to ~5% (solo raids die to body-blocks — exactly the
playtest-11 diagnosis; escort doctrine is the fix) and grind wars lean
west ~60/40 (re-measure after escorts + lateral relays + ticket bleed;
collision goes dormant behind a flag if the sequence doesn't recover).

ALSO: specs 07 (rulings register), 08 (fairness & symmetry doctrine),
09 (AI regency compendium) — the undocumented-design gap closed.

Suite 495/495 (x2). Tagged slice-17.

## slice-11x — escort doctrine + MPG waves (2026-07-28, items 11 + prompt-51)

Escort doctrine (ruled BOTH triggers) in three iterations, each forced
by a probe:
1. Passive windows (hope 2 hulls are nearby) — raids NEVER fired:
   patrol phases scatter hulls by design.
2. Escort ASSEMBLY — the two nearest idle-line combat seats (not
   capturers/train/tubes) converge on the carrier; raids launched but
   the raider outran its guard: escorts re-planned only when idle, so
   they chased STALE positions while the carrier soloed in and died.
3. TIGHT FOLLOW (pre-gate re-target the moment the carrier drifts >2
   cells from the escort's destination) + mid-raid HOLD (window closed
   with >=2 escorts inbound: stop and wait; only a truly abandoned
   raider retreats home).
Plus MPG FULL-WAVE rebuilds (prompt-51 ruling): every eligible wreck
returns together on the cadence — a gutted team counter-pushes as a
formation, and rebuilt carriers restore the raid game mid-war.

Verdict at this checkpoint: raids launch, route, hold, and abort
correctly (traced); they rarely SURVIVE a fully-manned single front —
which is the map's shape, not the doctrine: collision made one-front
flag-running impossible by design. The ruled sequence continues into
lateral relays (thin the front) + ticket bleed (relay pacing, standard
as coup de grâce), then the tempo re-measure.

Suite 501/501. Gate: competitive, dominations appearing (waves feed
decisive pushes). Tagged slice-11x.

## slice-11y2 — frontier lateral relay pairs (2026-07-28, prompt-51)

Two mirrored pairs on the trail loops — (44,40)/(83,40) and
(44,86)/(83,86); 8 relays total, appended so road-relay site ids 0-3
stay pinned. Route graph gains the four nodes (trail spans split);
mirror-closure test covers them automatically. 1A repinned v36 (sites
are hashed). The corridor becomes a conquest WEB: laterals-only sweep
restored standard endings to 25% (from collision's 5%) — the front
thins exactly as the BF2 study predicted, and escorted raids find
their windows.

## slice-13h — hybrid ticket bleed (2026-07-28, prompt-51 ruling)

Relay MAJORITY (rules.ticketMajority, default 5 of 8) drains the enemy
pool (rules.ticketPool, default 300) one ticket per cadence
(rules.ticketBleedTicks, default 20 = 2 s); empty pool = WIN_TICKETS
(reason 5); every earlier condition untouched — hybrid, not
replacement. Pools are HASHED state, ride the session rules (presets:
easy 400 / hard 250), silent per-tick (repin discipline), and travel
in the view for UI. 1A repinned v37. describeWinReason + en/no strings
+ analyzer reason table updated.

CLEAN ACCEPTANCE (300+300, laterals+tickets+collision+escorts):
aggregate 48.8% A (fair), worlds structurally match, undecided 2%/0.7%
(from 8%), median war ~14.5k ticks (from pinned 18k), endings split
tickets ~54% / standard ~24% / horn ~22% — three live victory paths,
tows 20/war. The pacing revolution the BF2 study promised.

## slice-15e — playtest-7 client batch (2026-07-28)

- item 16: victory screen runs a REAL 30 s countdown then fades out
  (reveals the postgame world; s_war_reset clears cleanly).
- item 18: hauling mission cards target the DROPOFF — towing_now aims
  at your base repair bay and the golden ring marks it at any range.
- item 19: long unit labels wrap at the nearest space around char 18.
- item 20: respawn already recentered (11U); adds the 3 s pulsing green
  locator ring on your hull.
- item 12 (move-marker direction): the travel-oriented rotation shipped
  in 14j' and reads correct — flagged for VISUAL verdict next playtest
  before touching working code.

Suite 506/506. Smoke OK.

## slice-15f2 — reconnect banner + supply depot (2026-07-28, items 21a + 13)

- Item 21a: disconnect shows a CENTRAL red banner with a live 30 s
  countdown, auto-reconnect attempts every 3 s (any server message
  clears it); after 30 s it turns actionable (retry button; the global
  server LIST arrives with the discovery slice per
  specs/game-discovery.md — the sibling master-server pattern is
  adopted as the blueprint). i18n en/no.
- Item 13: the base gains a SUPPLY DEPOT — warehouse + crate stacks at
  the base center, the exact cell rebuilds spawn at and hauls drop to,
  so the item-18 golden dropoff ring lands on its doorstep.

Suite 506/506. Smoke OK. Tagged slice-15f2.

## slice-15g — the respawn law (2026-07-28, items 15 + 15F, prompt-53)

Forced respawn (CMD_RESPAWN goes live): abandon the hull IN PLACE, seat
gated by a 10 s countdown (selection rejects "respawning"), and the
abandoned hull SELF-RECALLS — 60 s uncrewed in the field auto-wrecks it
(towable/rebuildable, no permanent litter; spared at home or when
re-crewed). Carrier field-respawn (ruled: crewed carriers only): a
downed seat past the redeploy gate spawns ABOARD a crewed friendly
carrier with a free bunk — the rescue-passenger machinery verbatim —
on a 30 s per-operator cooldown. Three new HASHED fields
(operator.respawnTicks/carrierSpawnAt, asset.abandonTimer) → fixture
v38. Client: down-banner offers "deploy aboard carrier N" when one
qualifies; status panel gains the double-click force-respawn button;
banner narrates the countdown; five new rejection texts en/no (the 8H
sweep and the inert-command net both fired and were updated —
call_medic stays the only inert command). Sim-neutral: AI never calls
either path; gate byte-identical.

Suite 511/511. Smoke OK. UI acceptance OK. Tagged slice-15g.

## 16B residue — mechanism found, verdict honest, ball to the designer (2026-07-28)

Telemetry v2 (dbg_16b_uptime) decomposed the ~11pt unique imbalance:
the Skimmer became B's designated fastest-seat recoverer in 7/12 seeds
(a 45hp airboat on standard-fetch duty) and wasted a would-be tank seat
on waterless maps; the Sentinel out-anchored it 2-4x at relays, which
the ticket era converts straight into wins. TWO DOCTRINE FIXES LANDED
(right regardless of verdict): the airboat only crews where the map has
water (mapHasWater, cached per seed), and the Sentinel is excluded from
capturer designation — it defends via reactive deploys, never squats.
VERDICT SWEEP (300+300 swap): Sentinel-side 60.2% (from 60.75) — the
doctrine levers shaved ~2pts; the rest is the HULL (150hp reactive
fortress ≈ super-tank in the routed-tickets meta). Chassis stats are
designer-pinned (12B), so 16B STAYS DORMANT per the ruling's own
condition, and the tuning question goes to the designer with options:
mobile-mode hp down (150→~100), Skimmer hp/damage up, or Riverline
Drive gaining TRAIL affinity (path-speed parity with bikes) so the
Outlier unique has a job on every map. Default wars untouched (flag
off; exclusions moot without crewing) — gate unchanged.

Suite 511/511.

## riverline in the tickets era + map-aware majority (2026-07-28)

13H's majority was frontier-tuned (5) — on 6-relay riverline that meant
domination-grade holdings to bleed. The effective majority is now capped
by the MAP's own majority (floor(sites/2)+1): 5-of-8 frontier, 4-of-6
riverline. Test pinned. RE-MEASURE on the current build (300+300):
the west lean COLLAPSED 73/27 -> ~58/42 in both worlds (aggregate
47.7% team-fair, undecided 3-5%, median ~13k, endings tickets-led,
standard ~11%) — the ticket meta diversified the war off the bridge
choke that fed the lean. Riverline stays EXPERIMENTAL at a known 58/42;
further graph tuning filed as campaign backlog (diminishing returns vs
the discovery slice next in the ruled order).

Suite 512/512.

## slice-15h — game discovery (2026-07-28, item 21b, adopted sibling spec)

The master index (`tools/master.js`, colocation ruling: runs on the game
VM): announce/probe/list, PROBE-BEFORE-LIST with the reason echoed to
the announcer ("check port forwarding for host:port" — the self-service
debugger), in-memory + 3 min TTL, per-IP announce floor, 4 KB body cap
with 16x hard abort, host:port-only addresses (schemes rejected at the
door), anti-relay internal-address guard (--allow-local for tests).
Server side: MASTER_URL/PUBLIC_ADDR/PUBLIC_NAME env → 60 s heartbeat
carrying version + fixtureVersion (our ruleset checksum) + open seats;
the master's verdict echoes on OUR console. Client: the join screen's
GLOBAL SERVERS list — mismatches GREYED never hidden (checksum hint
visible), trust model stated in the UI, actionable line when no master
is configured. Pure row model (`server_list.js`) + 7 tests including a
live end-to-end announce-probe-list loop; the TTL test caught a real
first-announce rate-floor bug before it ever shipped.

Suite 519/519 (x2). Smoke OK. UI acceptance OK. Tagged slice-15h.

## slice-16e — trail affinity + 16B DEFAULT ON (2026-07-29, prompt-54)

Designer stat ruling: Riverline Drive extends to NEGLECTED ROUTES —
T_PATH at road-grade 384 for amphibious hulls only (bikes stay 307,
heavies 128; pinned in 11N/12C tests). First verdict sweep came back
IDENTICAL to pre-buff — unmasking that the 16B water-only crewing gate
locked the Skimmer out of frontier entirely; the gate is now WATER OR
TRAILS (mapHasRunway). True verdict: Sentinel-side 60.2% -> 54.5%,
IN BAND -> unique crewing DEFAULT ON per the standing ruling
(UNIQUES=0 disables for A/B sweeps). Acceptance: default wars carry a
~55/45 Directorate lean — the SANCTIONED faction asymmetry itself (the
swap gate is the fairness authority for asymmetric factions); flagged
for the designer if the band should tighten (levers: affinity 384->400
or Sentinel mobile-hp). Suite 520/520 at flip.

## slice-16f — the AT satchel (2026-07-29, prompt-51 ruling)

One demolition charge per bail-out (hashed on the downed entry —
fixture v39): adjacent-cell, 60 damage, single-use, LOUD (event + an
automatic team ping at the blast), kill credit to the operator. Downed
players plant it by clicking an adjacent enemy hull (crawl otherwise);
four rejection texts + the feed line en/no. Sim-neutral (AI regents
don't use it — v1); the 8H rejection net fired and was fed.

Suite 524/524. Smoke OK.

## slice-13d — dynamic edges (2026-07-29, mine-aware routing)

Marked enemy mines re-cost the route graph (hazard within 2 cells of an
edge's endpoints or floor+ceil midpoints -> cost x4): the AI routes
AROUND what its scouts have marked — mine play is area denial for real.
Query-local overlay (no cache pollution, tested); midpoint sampling
uses the floor/ceil PAIR (a single >>1 midpoint is off-by-one under the
mirror — the homeCellFor lesson, caught in battery one).

METHODOLOGY FINDING (specs/08 updated): with asymmetric factions live,
the mirror-world aggregate CONFLATES side and faction — the synthetic
mirrored world shows A ~66% while the REAL world (the only one players
play; teams are side-bound) sits at A 47.8% — nearly even. Player-facing
fairness verdicts now read the NORMAL world + the swap gate; the mirror
world remains the engine-equivariance instrument, not the fairness one.
The side×faction interaction (mirror-only, predates 13D) is filed as a
methodology curiosity, not a gate-blocker.

Suite 526/526. Tempo held (tickets-led, median ~16k with denser mines).
Tagged slice-13d.

## band tuning — the lever curve and the verdict (2026-07-29, prompt-56)

Target 52/48. The curve, one pull at a time (swap-gate Sentinel-side):
base 54.5 → trail affinity 416: 54.2 → Sentinel hp 135: 54.0 → hp 120:
53.6. The stat levers SATURATE ~0.2-0.4pt per pull — the Sentinel's
edge is structural (the anchor role in the tickets meta), and reaching
52 on this metric would gut its identity (hp ~90). BUT the world
players actually play tells a better story: the NORMAL-world split at
the tuned pair (affinity 416 + hp 120) is **A 51.3% — the 52/48 target
achieved in real play**. KEPT: 416 + 120 (fixture v40; data/units.json
mirror synced — the 3A net caught it).Remaining gap on the swap metric
(53.6) documented as saturation; the structural lever if the designer
wants tighter: a Skimmer CAPTURE-SPEED affinity (fast flips on the
lateral web) — filed as a designer option, not built.

Suite 526/526 (x2).

## slice-16g — weather fronts (2026-07-29, gameplay-evolved #4b)

Once per war a deterministic WEATHER FRONT rolls in: schedule is a PURE
function of the map seed (mid-war band 6000-12000, 90 s) — no new
hashed state, no repin, replays honest by construction. Inside it every
sensor HALVES (assets and relay webs, both teams equally): scouts,
pings, and standard runs own the storm; snipe-lines and drone spotting
break. Edges announce themselves (weather_front in/out events + feed
lines en/no); the client reads the same pure schedule (seed via
/version on map load) and renders distance fog + a dimmed sky. The
sim gate holds (the front shuffles mid-war fights without breaking
tempo — the meta-flip is the point).

Suite 529/529. Smoke OK. Tagged slice-16g.

## slice-18a — blackwood, map 3 (2026-07-29, prompt 60)

Map-design round first: specs/10_map_roster.md audits both maps against
the designer's checklist (specs/gameplay-map-design.md). Verdicts: NO
geometry changes to frontier (band-tuned baseline; its identity gap is
B2's job) or riverline (13E bridges completes the chokepoint-counterplay
pattern); roster gets identities instead of any one map getting all
terrains. Full designs for maps 3+4, a 6-map bank, and a per-map
promotion gate.

Then map 3 landed: BLACKWOOD, the dense woodland profile. Forest
dominates (west-half gen mirrored east — fairness by construction); the
central corridor is the ONLY road; a trail ring (cols 36/91, rows
28/99) plus twin center alleys (cols 58/69) carry the lights; 8 relays
(ring corners + two DEEP-WOODS pairs off the road) with clearings
carved around each. Heavies must leave the pavement or stand off —
mines, scouts, satchels, and the Sentinel own this ground. Route-graph
and patrol tables mirror-closed (auto-covered by the enumeration
suites); trails satisfy the 16B runway gate.

Local gate (30 wars + 30 mirrored): mixed winners 16/13/1, decided
A-rate 55% (band edge — n=30 noise; PC battery decides promotion),
mirror flips the edge as it must, undecided 1/60. Identity is REAL and
different: quiet positional wars — downs 12/war vs frontier's 70, tows
2.8 vs 21, tickets end 87% of wars, and wars run ~12% shorter. Whether
"quiet" reads as tense or dull is a playtest question — flagged as the
map's watch item alongside the 300-war battery.

Suite 535/535 (x2). Tagged slice-18a. EXPERIMENTAL (MAP=blackwood).

## slice-18b — sawtooth, map 4 + the wall rule (2026-07-29, prompt 60)

Map 4: SAWTOOTH, the armor map and the first to use T_BLOCKING at
scale. Two impassable mesa bands (rows 40-52 / 76-88, x 20-107) split
the field into three open lanes, each pierced by two narrow T_PATH gaps
(the saw teeth, mirror pair 40-44/83-87); long exposed edge corridors
go around the mesa ends. 6 relays: canyon heart pair + a pair per outer
lane; gaps stay relay-free — pure chokes. Graph tags the gaps trail and
prices the corridors honestly, so 13D hazard-marking a gap is exactly
what unlocks the flank.

Engine rule the map forced — IMPASSABLE TERRAIN IS A WALL (18B): speed
samples the CURRENT cell, so a fast chassis could leap into a 0-speed
cell and be trapped forever. stepAsset/driveStep now refuse any move
whose destination cell is 0-speed — units stall at the mesa face.
Inert on every existing map (no blocking cells anywhere), so no repin;
drones fly over, downed crews walk terrain-free. Probe test: 4000-tick
AI war asserts NOBODY ever occupies a blocking cell.

Local gate (30 normal + 30 mirror + 30 UNIQUES=0 + 30 FACTIONSWAP):
wars active, deterministic, replay-honest, wall probe clean — and two
REAL findings, both recorded in specs/10 §4 for the 18C tuning pass:
(1) SENTINEL-ANCHOR LEAN — Sentinel-side wins 62-67%; survives the
mirror, follows the faction swap, vanishes with UNIQUES=0 (14/16).
Mesa gaps are ideal hardpoint anchors and the Skimmer has no water
here: structurally Directorate-leaning as drawn. (2) HORN-BOUND
PACING — 87% of wars reach the horn; 3-3 relay splits never reach the
ticket majority (riverline's first-landing pattern). EXPERIMENTAL
(MAP=sawtooth); promotion gate closed until 18C clears both.

Also: generic `map` job kind for the batch worker
({"kind":"map","map":"blackwood","count":300,"mirror":0}) — per-map PC
batteries without a new kind per map.

Suite 542/542 (x2). Tagged slice-18b.

## slice-18c — sawtooth tuning: the capture famine (2026-07-29, prompt 62)

18B left sawtooth with two findings. The pacing one turned out to be
something better than a stalemate — a CAPTURE FAMINE, found by
measurement rather than intuition (`debugging/dbg_18c_probe.mjs`):

  per-site: (58,63)=0/49x (69,63)=0/53x (44,20)=-1 (83,20)=-1
            (44,107)=-1 (83,107)=-1        [seed 3, 18000 ticks]

The four lane relays were NEVER captured — not once, in any seed. Owner
stayed neutral all war; every capture in the census was the two heart
relays trading. Max holding was 2 of 6, so the majority of 4 was
mathematically unreachable and the pools never lost a single ticket
(300,300 at the horn, in every seed).

Root cause is a general law, now in the rulings register and the map
constraints: an objective further than CAPTURE_SEEK_CELLS (16,
Manhattan) from anywhere units actually go is a DEAD objective — the AI
designates capturers only from assets already inside that radius, and
nothing pulls a unit toward a relay from further out. The lane-end
relays sat ~39 cells from the nearest patrol waypoint; the heavy
patrols stood off the enemy HEART relay at 18 cells, two past the
radius, so even the center pair was never deliberately contested.

Fix, map-side only (the radius is global — tuning it would reopen every
map's balance): lane relays moved to the GAP EXITS (y 34/93, within 14
of the gap centers all crossing traffic uses), graph nodes and light
patrols moved with them, heavy patrols pulled in to reach the enemy
heart. Two new tests assert both reach conditions so this class of bug
cannot come back silently.

Measured (30 wars each): ticket endings 0% → 36%, horn 87% → 60%, wars
18000 (uniformly) → ~15.9k, every relay changes hands, majority now
held 31-45% of a war in long runs. UNIQUES=0 confirms the map itself is
fair (A 13 / B 16 / 1 undecided).

THE FACTION VERDICT (4 x 30 wars: normal / mirror / UNIQUES=0 /
FACTIONSWAP): the 18B Sentinel-anchor lean is GONE. That conviction
rested on the edge FOLLOWING the faction swap; it no longer does (swap
12/18, normal 11/18 — the same side stays ahead). Moving the objectives
away from the lane ends dissolved the anchor advantage without touching
a single stat — exactly the structural fix specs/08 §3.7 prescribes —
so the planned GAP DOUBLING was NOT built and the narrow chokes stay.

What remains, honestly stated: a mild ~55-60% lean to whoever holds the
EAST, consistent in direction across all three uniques configurations
but individually insignificant at n=30, and reversing under the mirror
(so: the geometry/arithmetic class, not doctrine). That is a 300-war PC
battery question, not another local sweep. Sawtooth stays EXPERIMENTAL
with the gate closed.

Also 18C: impassable cells now carry rock mass in `props_model.js` —
units stall silently at a mesa face (the wall rule), so a flat dark
tile read as a bug.

Suite 544/544 (x2). Frontier sanity sweep unchanged (tickets-era mix,
avg 13.2k ticks). Tagged slice-18c.

## worker autostash (2026-07-29, prompt 66)

The `update` job now stashes local worker edits before `git pull
--ff-only` and restores them after — the PC has been blocked twice by a
stray local edit, each time needing a walk to the machine.

Two things the obvious version gets wrong, both found by testing rather
than reasoning (`debugging/test_worker_autostash.sh`, real git, 11/11):

1. **A conflicting pop is not harmless.** If the stashed edit touches a
   file the pull also moved, `git stash pop` leaves CONFLICT MARKERS in
   the worktree and returns non-zero. Re-exec'ing there would run every
   later job against source full of `<<<<<<<`. On conflict we now hard-
   reset to the clean pulled tree; the work stays in the stash (a
   conflicting pop keeps its entry) and the mail says so by stash ref.
2. **Divergence is a different failure and no stash fixes it.** A clean
   tree that still refuses `--ff-only` means local COMMITS; the mail now
   names them (`git log @{u}..HEAD`) instead of guessing.

Results are never at risk: OUT=reports/sweeps is gitignored, so a plain
`git stash` (never -u) cannot touch a CSV — asserted by the test.

## slice-18d — playtest 8 (2026-07-29, prompt 65)

Ten items. Three were the same bug wearing different clothes.

**Items 25/29/30 — "centre on me" and "clicking did nothing".** The
follow camera resolved the player as
`friendlyAssets.find(mine) ?? friendlyAssets[0]`. That fallback is a
lie: whenever you have no asset — DOWNED, respawning, or riding a
carrier — it confidently centred on a random teammate ("centred on the
last wreck mission", "could not see myself on any carrier"). Replaced
with `whereAmI()`, which resolves asset → downed operator → the carrier
you are aboard, and returns NULL rather than pointing somewhere wrong;
both centre buttons and F now use it. And selection while downed was
rejected by the engine ("operator not active") with the refusal landing
as raw English in a six-line corner feed — that is what "did nothing"
was. Refusals are now translated and flashed centre-screen, and the
client no longer sends selections it knows will be refused.

**Item 23 — the move marker really was 180° out.** Reported twice; my
earlier code-read cleared it because the ROTATION MATH was right. The
geometry was not: the two blades splayed to meet at -z while the tip
cone pointed +z, and the blades are far larger than the cone, so the
marker read as pointing backwards. One sign flip. The aim also refreshes
every frame now ("at all time"), and works while crawling.

Also: item 22 Next-asset greys out with a reason on hover (the base-area
RULE the user asked for is a gameplay change — the engine has no such
restriction and the AI crewing ladder depends on field swaps — so it is
filed as a design question, not smuggled in); 24 the down banner names
the crawl affordance ("CLICK THE GROUND"); 26 a fog notice on the
weather front; 27 a war clock announcing half/quarter/final and the last
30 seconds; 28 right-button drag panning; 31 stats on a key (I, not S —
s is a WASD pan key, and holding it would drag the camera while reading).

UI acceptance grew six checks and, more importantly, stopped being
flaky: it now hit-tests each button with elementFromPoint (the real
buried-HUD guard, a layout query that cannot time out) and dispatches
the click separately, instead of relying on Playwright's actionability
wait, which headless SwiftShader starves. Three consecutive clean runs.

Suite 544/544. Smoke OK. UI acceptance 12/12.

## slice-18e — wall sliding (2026-07-29, review-round gap analysis)

The review-round skill asks "what does this system touch?". Asking it of
the 18B wall rule found a bug no test could see: refusing entry keeps
units out of rock, but a unit whose target lay across a mesa pressed its
face against the same cell for up to 4681 ticks (~8 minutes) while still
reporting MOVING — an asset silently out of the war
(`debugging/dbg_wall_stall.mjs`; frontier shows no such stalls).

Fix, in two honest halves:
- A GLANCING step slides along the face. Fallbacks are ordered by AXIS
  (x-only, then y-only), never by sign — the x-mirror maps an x-only
  slide onto an x-only slide, so slides commute with the mirror.
- A HEAD-ON step (no lateral component, nothing to slide along) sets
  ASSET_IDLE so the planner re-engages and the route graph routes around
  the mesa. Picking a deflection side would be a coin-flip, and a
  coin-flip keyed to sign is exactly the chirality specs/08 forbids.

Wall stalls 4/9/6 assets per war -> 0/0/0.

THEN THE SWEEP CHANGED THE MAP'S STORY. With units actually reaching
things, sawtooth went horn 60% -> 13% and tickets 36% -> 83% (better
pacing than frontier's 22% horn) — and the faction lean came back with
it, unambiguously this time: A wins 22/30 normal AND 24/30 mirrored, so
TEAM-linked, and A is the Directorate. The mechanism is 16B's: the
Sentinel is a super-anchor in the TICKETS meta, and this map just became
ticket-decided. 18C's "the lean is gone" was true of the map as it then
played; it did not survive making the map play properly. 18F is owed —
and prompt-68's underdog premium is now an alternative to blocking it.

Suite 547/547 (two new tests: diagonal slide, head-on stop, plus a
mirror-equivariance check whose first version was wrong because it
mirrored positions but not HEADINGS).

## slice-13e-bridges — bridge demolition (2026-07-29, prompt 70 ruling)

*(Tag name note: `slice-13e` was already taken by the fog-ghosts slice —
the wave-3 plan listed 13E as fog ghosts, while the designer eval called
this one "13E-bridges". This is the bridges one; the tag matches.)*

Riverline's three crossings are now droppable and rebuildable. Design of
record: specs/11_bridge_demolition.md.

The load-bearing decision was NOT reusing `state.sites`. Sites already
carry hp, the artillery siege flag and the truck repair loop, so reuse
looked free — but 24 call sites across 21 files iterate `.sites`,
including supply projection and relay sensor fog. A bridge would have
silently projected supply, given fog, and counted toward the ticket
majority denominator unless every one of those was excluded. Bridges got
their own array instead: `state.bridges = [{id, hp}]`, hashed.

**No fixture repin.** The hash writes nothing for an empty array, and
every profile except riverline has no bridges — so frontier's 1A hashes
are byte-identical and v40 still stands. (Both hash functions updated
together, per the CLAUDE.md rule.)

Breaching turns the span to WATER rather than inventing a "broken
bridge" cell. Heavy hulls ford it in misery; the amphibious Skimmer
crosses at speed — so a Directorate demolition has an Outlier answer, on
the map built for it, with no new movement concepts. Repair is EITHER
TEAM (prompt-70): any truck with materiel beside a dropped span rebuilds
it, and the tug-of-war is the point.

Tests: geometry pinned against what the generator actually emits (so the
hand-derived spans cannot drift), breach+repair proven a byte-exact
terrain round trip, siege gated to artillery, the Skimmer completing a
crossing the tank cannot, both teams repairing, and hash/determinism
including the terrain mutation. One test I had to correct: comparing raw
distance understated the Skimmer, because it ARRIVES and stops — the
real claim is "gets across while the tank is still wallowing".

Riverline sim gate: A 6 / B 6, 0 undecided, tickets 8/12, avg 14080
ticks — healthy, and the map's lean is no longer the story it was.

Suite 560/560 (x2). AI siege/repair doctrine is NOT in this slice: the
bridges exist and humans can use them, but regents do not yet choose to
drop or rebuild one. That is 13E-2, and it carries its own sweep.

## worker report mailing (2026-07-29, prompt 73)

`reports/sweeps/` is gitignored, so mail is the ONLY way a result leaves
the gaming PC — and until now only sweep CSVs travelled. The worker now
mails any new or CHANGED report after every job: CSVs under tag `csv`,
JSON under tag `report`, deduplicated by a `.mailed` manifest keyed on
name+size+mtime, so the automatic pass is silent when nothing happened
and `sendresults` (FORCE=1) still force-resends everything.

The point of the automatic pass: `perf_native.ps1` driven from WSL
writes into this same clone, so a native GPU run started by hand now
comes home on the back of the next finished job, with nothing queued.

Fixing only the sending half would have been useless — `batch_collect.py`
filtered on the `csv` tag AND a `.csv` suffix, so every JSON report would
have arrived at the dev machine and been dropped on the floor. Both ends
now speak both tags, verified by a synthetic round trip.

`debugging/test_worker_reports.sh` (12/12) extracts the functions and
stubs the mail CLI, because this code runs unattended on another machine
where a dedup bug either spams the store every job or silently ships
nothing.

## worker observability (2026-07-29, prompt 74)

"It was running, no errors in the log" after three jobs vanished. An
audit of batch_worker.sh found five ways to fail without a word:

1. **A job whose body did not parse was DISCARDED silently** — taken off
   the queue, `[ -n "$body" ] && handle_job` skipped it, and nothing was
   logged or mailed. This matches the symptom exactly.
2. `queue take` errors went to /dev/null, so a broken hub looked idle.
3. Sweep shard exit codes were discarded by a bare `wait "${pids[@]}"`;
   a dead shard produced an empty CSV and a cheerful "0 wars" mail.
4. The red-suite refusal threw away the test output, so diagnosing a red
   PC meant asking a human to go and look.
5. My own prompt-73 bug: a FAILED result mail was still recorded in the
   `.mailed` manifest, so it would never be retried.

All five now log AND mail. Added `--verbose`/`--debug` (plus VERBOSE/
DEBUG env and `--help`) and an unconditional `reports/sweeps/worker.log`,
so even a run started without flags leaves a record.

`debugging/test_worker_reports.sh` grew to 19 checks, including that a
failed send is NOT recorded (and succeeds on retry once the hub is back).

## slice-13e2 — AI bridge doctrine (2026-07-29)

The half 13E deferred: regents now DROP and REBUILD spans themselves.

**Siege** (`pickBridgeToBreach`): a siege tube with no hull worth shooting
may drop a bridge — but only when its side is LOSING that crossing,
measured as the enemy holding more relays on the far bank. Demolition is
a momentum-breaker, not an opening move, and a team that is winning
leaves the road open because it wants to use it. ONE besieger per span,
designated by lowest operator id in range (the capture-seek pattern) —
without that every tube in the war shells the same crossing and nothing
else gets done.

**Rebuild**: the truck materiel errand now also considers a dropped span,
ranked after damaged relays. Either team may rebuild any bridge
(prompt-70), so the only question is distance; parking beside it does the
work.

Probed before trusting it (`debugging/dbg_13e2_doctrine.mjs`), because
the escort doctrine needed three iterations for exactly this reason — a
doctrine that never fires looks identical to one that works:

  3/3 wars saw a bridge dropped; 29 shells, 6 breaches, 5 rebuilds
  spans were DOWN between 2.3% and 49% of a war

Seed 2 is the fantasy working: the losing side dropped the central span
and it stayed down for half the war. Gate (16 wars): A 6 / B 10, 0
undecided, tickets 12/16, avg 14270 ticks — tempo unchanged from the
pre-doctrine run (tickets 8/12, avg 14080).

Suite 561/561.

## map selector (2026-07-29, prompt 76)

`MAP=blackwood npm start` worked but nobody remembers it. The server now
takes `--map` (and --seed/--port/--rules/--difficulty/--list-maps/--help),
with per-map npm scripts, `npm run maps`, and `npm run pick` for an
interactive list.

Everything reads the REAL registry via a new `mapProfileNames()` export,
so registering a profile makes it appear in the picker, the listing and
the error message at once — no hand-copied list to rot. A test asserts
that, plus that every `start:<map>` script names a registered profile.

Two details worth keeping: a mistyped MAP exits 2 rather than quietly
serving the default (so a playtest can never be run on the wrong map by
accident), and the near-miss suggester uses edit distance, not just
prefix matching — "blackwod" is the typo people actually make and prefix
matching misses it entirely.

Suite 567/567.

## slice-b1 — meaningful deaths (2026-07-29, designer eval #35)

A wreck now costs the owning team ONE ticket, refunded when the wreck is
recovered. Deaths were free before this, which left the rescue economy
thematically central but mechanically optional; now every tow visibly
saves the war and the game's two identities pull on the same rope.

**The ledger balances by construction.** Every transition INTO a wreck
charges, every restore refunds — including the abandoned-hull self-recall
path, which matters more than it looks: charging only combat deaths would
have let a team abandon a hull for free, tow it home and bank a refund
for a ticket nobody ever paid. Balancing both paths also avoids a
per-asset "was charged" flag, and therefore avoids a fixture repin (v40
still stands — the 14-step 1A script disables nothing).

Clamped at both ends: a pool cannot go negative, and a refund cannot mint
tickets above the starting pool. `ticketPerDisable: 0` restores the
pre-B1 world exactly.

**Measured (16 wars, frontier).** Deaths net-drain ~46 tickets of 300
(62 downs, 16 restored) — 15% of the pool, so B1 mostly converts the
ANTICLIMACTIC HORN into a decision:

| | tickets | standard | horn | avg ticks |
|---|---|---|---|---|
| baseline (300 wars) | 57% | 17% | 27% | 14267 |
| B1 (16 wars) | 87% | 12% | **0%** | 12809 |

Tows held at 20.2/war. The open question is whether the Command Standard
ending — the PRIMARY objective — is being crowded out, or whether 12% vs
17% is just n=16 noise. A 300-war battery decides it; queued.

Suite 572/572.

## slice-18f — playtest 9: the stranding, and range at a glance (2026-07-29)

**Item 35 was a real stranding, and the engine half had been there since
carriers could carry.** `disableAsset` released the crew, the tow and the
standard — and silently forgot the PASSENGERS. A player who respawned
aboard a carrier (15F) and then watched it die stayed marked `aboard` a
WRECK forever: "centre on me" pointed at the hulk, and they could never
take another asset. Nothing in the engine ever released them.

Passengers now bail out on foot exactly like the crew, which is both the
rescue fantasy (the van is gone, the people in it are not) and the fix.
The client half was mine from playtest 8: `whereAmI` treated ANY carrier
listing you as "riding", wreck or not, and `selectBlockedReason` then
refused Next-asset — so my own change had turned an engine bug into a
hard lock. Only an OPERABLE carrier counts as riding now.

Three tests pin it: passengers land on foot with crawlable entities, a
released passenger can redeploy and crew again (the stranding itself),
and a LIVING carrier still carries.

**Item 33**: hovering a visible enemy now answers "can I shoot that?"
before the click — IN RANGE / OUT OF RANGE / TOO CLOSE (dead zone) with
the distance in cells, drawn from the same `weaponRangeOverlay` model as
the targeting ring, so the tip and the ring cannot disagree.

Suite 575/575, smoke clean.

## mission card ranking (2026-07-29, prompt 79)

Cards used to sort by a hand-assigned `priority` field, which had drifted
from what the deeds are actually WORTH. They now sort by the Recognition
value of the deed, then by locality, then by cell (determinism: two
clients must never disagree about card order).

The alignment is the point — the to-do list and the scoreboard now say
the same thing. Cards that are not themselves scored deeds take the
value of what they protect: stop_thief and secure_standard sit at 25
because they deny or defend a capture. A test asserts the RECOG_*
constants directly, so retuning Recognition FAILS the suite and forces
the card values to be retuned with it.

Suite 579/579.

## resupply mission cards (2026-07-29, playtest-9 item 32)

A teammate running dry now raises a public RESUPPLY card (value 4 — below
every rescue and tow, per the prompt-79 ranking), derived from state
rather than requiring anyone to press the request button, and offered
only to a cargo chassis that can actually answer it.

The REPAIR half is deliberately not built, and the reason is worth
recording: nothing in this game repairs a damaged living hull. Base
resupply restores ammo and fuel only, trucks repair sites, and a wreck is
only fixed after a tow to the bay. A "needs repair" card would therefore
be an instruction with no possible action. Filed as an open ruling in
specs/07 with the balance risk spelled out — field repair would cut
against the recovery economy B1 has just made central — and a
recommendation (cap it at ~50% hull so a mauled hull still wants the bay).

Suite 579/579 + 2 new ranking tests.

## B1 battery verdict (2026-07-29, 600 wars)

The 16-war read was directionally right and quantitatively wrong, which
is exactly why the battery exists. At scale, on frontier:

| | tickets | horn | standard | avg ticks | A-rate |
|---|---|---|---|---|---|
| pre-B1 (300) | 63% | 27% | 10% | 14507 | 54.1% |
| B1 normal (300) | 79% | 13% | 8% | 13319 | 53.2% |
| B1 mirrored (300) | 81% | 11% | 8% | 13484 | 51.7% |

- The **horn HALVED** (27% -> 13%) rather than vanishing as n=16 implied.
- **The Command Standard is NOT being crowded out**: 10% -> 8%, about six
  wars in three hundred. That was the open question B1 shipped with, and
  the answer is "no action needed" — the primary objective survives.
- Wars ~8% shorter; the recovery loop is undisturbed (tows 20.4/war,
  15.5 restored, i.e. three quarters of wrecks get their ticket back).
- Fairness untouched: 53.2% / 51.7% across mirror worlds.

**B1 PASSES.** The sim-campaign skill's baseline has been moved to the B1
era — a stale baseline would make every future gate misread.

## 18F — the side-lean hunt found the INSTRUMENT (2026-07-30)

The hunt for blackwood's west lean and sawtooth's east lean did not find
a map bug. It found two bugs in how we MEASURE mirrors.

**1. The mirror transform was wrong.** `(W-1)*256 - x` is
anchor-preserving about cell CENTRES: exact only for cell centres, one
cell too far WEST for any mid-cell position, and it maps the map's east
edge (32767) to **-255** — off the map. The divergence probe localised it
in 38 ticks: a unit at cell 13 was being mirrored into cell 113 when its
true mirror is cell 114, so the two worlds sampled different terrain and
diverged from there. Now `(W*256-1) - x`, an involution that never leaves
the map.

**2. The 180° turn tie, the last known chirality.** `diff > 128` never
fires at exactly 128, so a unit ordered dead astern always turned the
same way — which cannot commute with the mirror, since reflection negates
the turn but not the rule. Now keyed to the unit's side of the map, which
flips under reflection. specs/08 §4 sketched this fix long ago; the
harness bug had been masking how much it mattered.

**And the finding that matters most: exact equivariance is unreachable
while entities sit on cell LEFT EDGES.** `cellToWorld(c) = c*256`, and a
left edge does not reflect onto a left edge; AI targets are always
cell-aligned and do not reflect onto each other either. After both fixes
all three maps still part company at tick 2 for this reason alone.

**Therefore the measured side leans are NOT established.** Blackwood's
~59/41 west and sawtooth's ~54-63 east were read off a harness that was
never producing a true mirror. They must be re-measured. The
normal-world verdicts (band tuning 51.3%, B1, all pacing) never used the
transform and are untouched.

The real fix is cell-CENTRED positions (`c*256+128`), which mirror onto
each other exactly — an engine change with a fixture repin. Filed as a
decision, not taken unilaterally.

Suite 582/582 (9F's 180° expectation updated with an equivariance test).

## cell-centred positions (2026-07-30) — the mirror-equivariance fix

Entities moved from cell LEFT EDGES to cell CENTRES:
`cellToWorld(c) = c*256 + 128`. One line, large blast radius.

**Why.** A left edge does not reflect onto a left edge, so no mirror
transform could ever be exact: a mirrored world started up to 255 units
(~1 cell) out of step, and AI targets — always cell-aligned — did not
reflect onto each other either. Centres DO reflect onto centres, exactly:
reflecting about the map's centre line (x' = W*256 - x) maps the centre
of cell c onto the centre of cell W-1-c for every c. The harness
transform was corrected to match.

**Safety net first** (`test/coordinate_invariants.test.js`, written and
green BEFORE the change): cell round-trip, position-inside-its-own-cell,
a move order landing in the ordered cell, capture by presence, firing in
and out of range, war determinism, and spawn/site mirror pairing. All
eight still pass — the behaviour is intact, only the encoding moved.

**Fixture repin to v41.** The repin guard refused the change, correctly:
`move_ordered` carries world coordinates, so its payload shifted. Rather
than adding a blanket force flag I taught the guard a narrow, provable
path — `--shift-coords=128` accepts drift ONLY where every difference is
that exact delta on a coordinate field and nothing else has moved. It
accepted 3 events on that basis; anything unexplained still aborts.

**Result — the hypothesis holds.** The divergence probe (same seed,
normal vs mirrored, lockstep):

| map | before | after |
|---|---|---|
| frontier | tick 2 | **tick 166** |
| blackwood | tick 2 | **tick 54** |
| sawtooth | tick 2 | **tick 58** |
| riverline | tick 2 | **tick 126** |

and the residual is now 7-16 units — SUB-CELL arithmetic drift, not the
old ~1-cell structural offset. What remains is integer rounding in
diagonal movement, a different and much smaller problem.

Test churn was all convention pins (positions off by exactly 128);
each was rewritten against `cellToWorld(...)` rather than a literal, so
this cannot churn again. Suite 590/590 double-run.

### cell-centring: what it did to the BALANCE baseline (verify-before-proceed)

The convention change moved every entity 128 units, so it changed the
GAME as well as the measurement. Re-measured at n=40 per cell (noisy,
+/-8pts — indicative only):

| map | old convention | NEW convention | reading |
|---|---|---|---|
| blackwood | 59.4 / 43.6 (side, west) | 42.1 / 35.9 | **B ahead in BOTH worlds = TEAM-linked** |
| sawtooth | 45.6 / 63.0 (side, east) | 72.5 / 65.0 | **A ahead in BOTH worlds = TEAM-linked** |
| frontier | — | 46.2 / 57.5 | edge flips; aggregate 51.9% = broadly fair |

Both new maps have flipped from SIDE-linked to TEAM-linked, in opposite
directions — and that is a coherent story rather than noise: blackwood is
a trail map (the Skimmer's affinity) and favours the Outliers; sawtooth
is a map of gap chokes (the Sentinel's anchors) and favours the
Directorate. That is exactly the specs/08 §3.7 doctrine, now with clean
evidence.

It also means the 600-war battery that "overturned" the original 30-war
sawtooth faction verdict was itself measured through the broken harness —
the first reading was right after all.

Frontier pacing needs watching: horn came back at 27% here vs B1's 13% at
600 wars, and wars ran ~5% longer. Could be n=40 noise (p~0.02) or a real
consequence of the geometry shift.

**Every pre-change balance number is now void** — band tuning (51.3%),
B1's ending mix, and both map verdicts were all measured on the old
geometry. They need re-running at battery scale before anything is tuned.

## worker `resync` (2026-07-30, prompt 83)

The re-measurement battery started on the WRONG BUILD: the worker was
seven commits behind (no cell-centred positions), so 1,800 wars would
have re-measured the exact geometry we had just declared void. Caught by
checking the worker's reported commit against HEAD before trusting a
single number; the queued jobs were dropped mid-flight.

Cause: the branch had been REBASED upstream, so the PC's commits and
origin's are permanently unrelated — `--ff-only` cannot fix that, and
`update` deliberately refuses to merge. It has now blocked the lane
twice.

`resync` is the permanent answer: fetch, hard-reset to `origin/<branch>`,
re-exec. It is safe on the WORKER in a way it would never be on a dev
machine — the worker authors nothing, and its only valuable output
(`reports/sweeps/` CSVs) is gitignored, so a hard reset cannot destroy a
result. Kept explicit and opt-in rather than folded into `update`, so
nothing ever silently discards history.

Covered by `debugging/test_worker_autostash.sh` (14/14), which now builds
a genuinely diverged clone and proves resync lands on upstream with the
gitignored results intact.

**Operational lesson, recorded because it nearly cost hours: always
check the worker's commit against HEAD before reading its numbers.** The
mail says which commit produced them; a battery is only as valid as the
build under it.

## slice-34 — waypoints (2026-07-30, playtest-9 item 34)

SHIFT-click (long-press on touch) queues a leg; a plain click still means
exactly what it always meant and wipes the plan. The unit walks the whole
route unattended.

Design notes worth keeping:
- **The AI never queues.** That is deliberate, not an oversight: regent
  behaviour is identical, so this slice cannot disturb AI-only balance
  measurements — important with a re-measurement battery pending. A test
  drives a 1200-tick war and asserts no regent ever queued a leg.
- **Only MOVEMENT queues.** A queued shot or tow is meaningless, so the
  flag is dropped for those commands rather than half-honoured.
- **Bounded at 8 legs** (`MAX_WAYPOINTS`), because the queue is hashed
  state and an unbounded one is both a hash-size and a scripting risk.
  A full queue refuses politely with human text in both locales — the 8H
  source sweep caught the missing string, as designed.
- Queuing while STANDING STILL starts the unit moving: the first queued
  leg simply is the current one, so the feature needs no special case in
  the player's head.

Fixture v42 (waypoints are hashed). Suite 596/596, smoke + UI acceptance
clean, and a 12-war AI sanity sweep is unchanged as predicted.

## field hull repair (2026-07-30, playtest-9 item 32, ruled capped)

A truck carrying materiel patches an adjacent LIVING friendly up to HALF
hull. The cap reuses `restoredHp()` — the exact figure the repair bay
gives a recovered wreck — so the number needed no invention and is
already covered by tests.

**The cap is the entire design.** B1 made recovery ticket-relevant, so an
uncapped field repair would have quietly deleted the tow economy. As
built it cannot: a WRECK is still only fixable by towing it home, and a
hull already above half gets nothing, so a patch buys a mauled unit one
more push rather than replacing the bay. Self-repair is excluded (you
cannot work on your own vehicle while driving it) and enemies are not
patched.

Recognition: `RECOG_FIELD_REPAIR = 4`, deliberately below a tow (8) — it
keeps someone fighting, it does not bring a wreck back. The mission card
(`repair_hull`) carries the same value, so the to-do list and the
scoreboard still agree, and it only appears while the target is BELOW
half — i.e. exactly when the repair would do something.

**The AI does not field-repair yet, on purpose.** A 1,800-war
re-measurement battery is running right now; leaving regent behaviour
untouched keeps those numbers a valid baseline for this change. AI
doctrine is a follow-up slice with its own sweep — the same discipline
used for waypoints.

Suite 603/603, smoke clean, 12-war AI sanity sweep unchanged (tows 19.2).

## AI field-repair doctrine (2026-07-30, ruled)

Trucks now patch mauled teammates themselves. Ranked LAST of the materiel
errands on purpose: infrastructure is worth 8 Recognition and a patch 4,
so a damaged relay or a dropped span still outranks a hurt hull — exactly
the ordering the mission cards show human players. It only targets a hull
BELOW half (above it the cap means nothing can be done) and parks BESIDE
it, since adjacency does the work and stopping on top would body-block a
wounded friendly.

Probed before trusting (`debugging/dbg_field_repair.mjs`): fired in 3/3
wars, 9.3 repairs per war.

The worry worth measuring was whether patching hulls would starve the
recovery economy B1 depends on — fewer wrecks means fewer tows means
fewer tickets coming back. It does not:

| | tickets | horn | standard | avg ticks | tows |
|---|---|---|---|---|---|
| repair OFF (n=40) | 65% | 27% | 8% | 14055 | ~20 |
| repair ON (n=24) | 67% | 17% | 17% | 12827 | 18.1 |

Tows held at 18.1, the horn fell, and Command Standard endings ROSE —
plausibly because a patched hull survives long enough to finish a run.
Small samples both sides; flagged for battery confirmation rather than
claimed.

## slice-b3 — mercy + overtime (2026-07-30)

**Mercy had to be redesigned, because the ruled version was unreachable.**
The eval said "full cap held 3 min accelerates the enemy's bleed". In
this engine holding every site already wins outright after 300 ticks
(DOMINATION_HOLD_TICKS), so a three-minute full cap ends the war six
times over first — the rule could never have fired. The drag it was
aimed at is real, so the trigger became a reachable version of the same
situation: the leader holds the majority AND the loser's pool is at or
below a quarter. It relents the instant the losing side starts a
capture, so a team fighting its way out is never punished. Pure function
of existing state — no new hashed field, no repin.

**Overtime**: an empty pool no longer ends the war while the losing side
has a play LIVE — a capture in progress, or hands on a standard. A war
decided mid-capture is a photo finish stolen by a clock.
`overtime: false` restores the hard cutoff.

Two test lessons worth keeping: a two-site sandbox cannot express
"majority without domination" (the only majority is both sites, which
trips the domination win), and setting `capturingTeam` by hand is fiction
— the capture pass recomputes it from presence every tick, so the test
has to put a real unit on the flag.

Gate (n=20): A 10 / B 10, 0 undecided, tickets 75%, **horn down to 5%**,
avg 10571 ticks. Suite 610/610.

**Flagged for the designer**: wars keep getting shorter with each pacing
addition — ~14.5k ticks before B1, 12.8k with AI field repair, now 10.6k.
That is ~17.5 minutes against a 20-30 minute design target. The lever is
the ticket pool, not any one rule.

## THE RE-MEASUREMENT BATTERY (2026-07-30, 1800 wars on a57dded)

The first balance numbers taken on the corrected geometry. Build is
cell-centred positions + waypoints, WITHOUT field repair or B3, so this
is a clean baseline for the coordinate change alone.

| run | A-rate | tickets | horn | std | undecided | avg | tows |
|---|---|---|---|---|---|---|---|
| frontier normal | 43.4% | 74% | 13% | 12% | 1% | 13390 | 21.1 |
| frontier mirror | 38.3% | 80% | 11% | 9% | 0% | 13151 | 20.2 |
| blackwood normal | 47.4% | 41% | 55% | 3% | **9.3%** | 15479 | 3.9 |
| blackwood mirror | 47.4% | 45% | 53% | 3% | **9.3%** | 15345 | 2.9 |
| sawtooth normal | 49.5% | 96% | 3% | 1% | 0.3% | 12070 | 19.5 |
| sawtooth mirror | 46.0% | 97% | 2% | 1% | 0% | 12691 | 21.2 |

**1. All three maps now lean the SAME way, and it is TEAM-linked.** B is
ahead in both mirror worlds on every profile — decisively on frontier
(~57-62%), mildly on blackwood and sawtooth. A lean that survives
mirroring is doctrine/faction, not geometry, and B is the Outliers. So
the faction pair now favours the Skimmer side, and the old band tuning
(51.3% A) was indeed an artifact of the old geometry. **The band needs
re-tuning on the new coordinates — on the DEFAULT map first.**

(Blackwood's normal and mirrored aggregates came out identical, 129/143/
28 twice, which looked like proof of perfect equivariance. It is not —
per-seed the two runs differ. Coincidence of totals; checked rather than
believed.)

**2. Sawtooth is now the best-paced map we have**: 96% ticket endings,
3% horn, 1 undecided in 600, and A-rate within a couple of points of
even. 18C and 18E did their job completely.

**3. Blackwood has REGRESSED into a horn-bound map**: 55% horn, 41%
tickets, 9.3% undecided (the bar is <5%), and only 3-4 tows per war
against ~20 elsewhere. Pre-fix it was 87% tickets. The coordinate change
moved it, and the shape — long, indecisive, almost no recovery traffic —
is the same class of problem 18C found on sawtooth. Its DIFFICULTY is
approved by playtest; its pacing is not.

### blackwood's regression is largely CURED by B3 (measured after the fact)

The battery ran on a57dded, which predates mercy/overtime. Re-running
blackwood on the current build (B3 + field repair):

| | tickets | horn | undecided | avg | A-rate |
|---|---|---|---|---|---|
| a57dded (no B3) | 41% | 55% | **9.3%** | 15479 | 47.4% |
| current (B3) | 63% | 33% | **0%** | 12643 | 53.3% |

Mercy bleed is exactly the right medicine for a map whose wars were
decided but grinding: undecided went to zero and the horn nearly halved.
So blackwood does NOT need its own 18C-style rebuild — the general rule
fixed it, which is the better outcome.

Two things remain true of the map and are probably its IDENTITY rather
than faults, given the playtest verdict ("more difficult, which was
good"): the horn still ends a third of wars (frontier: 13%), and tows run
at ~2-4 per war against ~20 elsewhere, because wrecks in dense woodland
are hard to reach. Flagged for the designer rather than tuned away.

## the story instrument (2026-07-30, prompt 88)

The designer's judging criteria for any pacing change — lead changes,
comebacks, majority swings, standard attempts, "did the extra minutes
create stories, or just delay the result?" — were things the sweep CSV
simply did not record. Per the ruling, the instrument came before the
tuning.

`tools/war_metrics.mjs`: a pure per-war collector (lead changes counted
as SIGN CROSSINGS of the ticket difference; majority flips against the
map-aware bleed threshold; the winner's max deficit as the comeback
measure; standard attempts vs scored; field repairs; bridge events;
mercy engagement — a documented HEURISTIC read off pool drops, since the
bleed is silent by repin discipline; overtime ticks). Unit-tested
against synthetic wars with known answers, plus one real war — an
untested instrument is how a broken mirror survived long enough to
manufacture a month of false side-leans. A drift test pins the column
list to the collector output.

Wired into `tools/sim_sweep.mjs` with the new columns APPENDED, so the
worker's positional awk summary and every DictReader consumer keep
working untouched. `TICKETPOOL=` env override added for the designer's
330/350/375 pool candidates. `debugging/analyze_story.py` prints the
verdict the designer asked for: median and quartile lengths, ending mix,
comeback rate, lead changes, standard attempts, mercy/overtime
engagement.

Suite 617/617.

## pool probes, first read (2026-07-30, n=20 per value — provisional)

The new instrument's first real use. Frontier, current build:

| pool | median | q75 | horn | comebacks | mercy engaged |
|---|---|---|---|---|---|
| 300 | 18.2 min | 12010 | 5% | 30% | 90% |
| 330 | 19.2 min | 14950 | 10% | 25% | 90% |
| 350 | **20.3 min** | 15275 | 15% | 25% | 80% |
| 375 | 21.2 min* | 15705 | 15%* | 21% | 79% |

*375 finalised after the table was first drafted: the partial read (14
wars) over-sampled early seeds; completed it sits at 21.2 min / 15%
horn — inside target, same horn as 350.

The trade the designer warned about is real and visible: every ticket
added buys length AND horn. 375 overshoots straight past the horn
ceiling; both **350 and 375 land inside the 20-22 minute target at 15% horn** —
too close to call at n=20. Lead changes hold steady ~2.8 across the
range, so the extra minutes are not creating extra swings — they mostly
stretch the existing arc. The PC battery decides between 350 and 375,
and it runs BEFORE the Skimmer retune (the two interact).

Also worth noting: mercy engages in 80-90% of wars — it has quietly
become a MAIN pacing mechanism rather than an edge-case rescue. Flagged
for the designer's awareness rather than action.

## pool battery lane (2026-07-31)

The worker could not run the pool candidates: `run_sweep` forwards
FACTIONSWAP/UNIQUES/MAP/MIRROR/DIFFICULTY but not TICKETPOOL, and its
legacy `UNIQUES:-0` default would have measured a different game than
the local probes (which ran the live config — uniques ON since 16B).
New `pool` job kind ({"kind":"pool","ticketPool":350,"count":300}) pins
UNIQUES=1, forwards TICKETPOOL=, labels the CSV `pool_<n>`; batch_send
grew the matching verb. Verified locally: winnerMargin above 300 proves
the override took; an empty TICKETPOOL= falls back to the default.

Queued on the PC after the standing commit check: update, then
pool 350 x300 and pool 375 x300. Decision rule (from the probe round):
pick the value with the better story numbers inside 20-22 min; on a
true tie take 350 — fewer tickets is the smaller change from the
shipped default. Skimmer retune starts only after the pool is fixed.

## slice-18G: blackwood logging roads (terrain-only recovery corridors)

The ruling: try terrain only first; goal "fewer rescues than other maps,
but more dramatic rescues than now". Instrument first (specs/08 §3.8):
`debugging/dbg_blackwood_wrecks.mjs` mapped where wrecks actually die.
The reachability story was WRONG — median wreck sits 2 cells from fast
ground (max 5). The loop leaks at the DRAG HOME: tow completion 44% on
blackwood vs 80% on frontier, because every route out of the combat
heart (wreck heat at ~52,39 / 52,52 / 65,52 + mirrors) runs through the
central crossfire. And blackwood simply has a third of frontier's
combat (10 vs 33 disables/war) — that part is identity, not fault.

Fix: two LOGGING ROADS — trail rows y=45 and y=82 spanning x 36..91,
each its own x-mirror (and the pair y-symmetric about the road). They
join the deep-woods relay pairs laterally to the ring columns, so a
loaded tow exits sideways and comes home around the fight. Route graph
grew nodes 18-21 (ring junctions at 36/91 x 45/82) and trail edges so
the AI actually routes them; layout/graph both mirror-closed
(enumeration tests pass untouched). The clearing samples in
map_blackwood.test.js moved off the new rows — the roads legitimately
run through the clearings, as the alleys always have.

Measured (5-seed probe): tow completion 44%→73%, restores/war
0.8→1.6, towStarts 1.8→2.2; disables 10→12.6/war (more traffic through
the heart — still a third of frontier). 30+30 mirrored local: mixed
winners both worlds (16/13, 18/11), undecided 1/30 each, horn 27%
(from 33% at the last battery), restored/war 1.8/1.5. Character kept:
2.5 tows/war vs frontier's ~9 — fewer rescues, but they now COMPLETE.
Suite 617/617 double-run. PC battery (300+300 mirrored) queued behind
the pool ladder for the promotion-grade read.

## pool battery, n=300 verdict (the n=20 probes under-read by ~3 min)

pool_350: median 23.1 min, horn 15%, comebacks 31%, mercy 88%.
pool_375: median 24.6 min, horn 20%, comebacks 30%, mercy 86%.
BOTH overshoot the 20-22 min target — the n=20 probes systematically
under-estimated (early seeds again, same trap as the 375 partial read;
recorded so nobody trusts a 20-seed median for pacing again). Winner
split identical 159/140 at both pools, per-seed CHECKED not believed:
lengths differ war by war, margins cap at exactly 350/375 (override
proven) — a bigger pool stretches wars, it does not flip winners.
Lead changes flat at 2.7 across the whole ladder: length is not where
swings come from. pool_330 + pool_300 (same commit, uniques ON) queued
to find the value that actually lands inside 20-22.
