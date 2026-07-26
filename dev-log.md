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
