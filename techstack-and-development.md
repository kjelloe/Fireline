# Fireline Command — Tech Stack & Development Practices

*Written 2026-08-01. What the game is built on, the tooling that
develops it, and the gotchas and practices that were earned, not
assumed. Companion to `CLAUDE.md` (working rules), `dev-log.md`
(slice history), and `specs/` (design of record).*

---

## 1. The stack

| Layer | Choice | Why |
|---|---|---|
| Language | **JavaScript (Node.js, ESM), zero runtime dependencies in the game itself** | Determinism and auditability. Everything in `shared/` and `engine/` is dependency-free by rule — a `package.json` change can never alter a war's outcome. |
| Server | **Node HTTP + `ws`** (the one server-side dependency) | One process serves static client files and the WebSocket war. |
| Client | **Vanilla ES modules + Canvas/WebGL, no framework, no bundler** | The client is a *renderer of fog-filtered views*, not a participant. Static files served as-is; an importmap instead of a build step. |
| State | **Pure reducer** — `engine/reducer.js` `apply(state, command)` | Every outcome flows through one function. The server is a thin pump: queue commands, apply, snapshot, broadcast. |
| Math | **Integer fixed-point, 256 units/cell; entities at cell CENTRES** (`cellToWorld(c) = c*256 + 128`) | No floats in `shared/`/`engine/`, ever. Centres reflect exactly about the map's centre line — mirror fairness is unreachable with edge-anchored coordinates (learned the hard way, 2026-07-30). |
| Randomness | **Deterministic PRNG** (`shared/prng.js`), algorithms pinned by fixtures | No `Math.random`, no wall clock in game code. Same seed = same war, forever. |
| Hashing | **FNV-1a 64 over canonical little-endian serialization** (`shared/canonical.js`, `engine/snapshot.js`) | The state hash is the contract: clients on different machines verify the same war. |
| i18n | Key-identical `en`/`no` catalogs, **enforced by test** | A missing key in one locale is a red suite, not a runtime fallback. |
| Testing | **`node --test`** (built-in runner), ~700 tests | No test framework dependency either. |
| Licence | MIT | |

### Non-negotiables that shaped everything

- **Server-authoritative, fog-filtered.** The client never owns logic;
  views are per-team and filtered before transport. There is no
  "trust the client" bug class because there is nothing to trust.
- **Anything gameplay-relevant must be headlessly testable.** This one
  rule is why an AI-only simulation campaign can stand in for
  playtesting at n=300.
- **No file/network I/O in `shared/` or `engine/`.** Replays, stores,
  and telemetry live in `server/` and `tools/`.

---

## 2. The determinism machinery (and its gotchas)

**The paired hash functions.** Every hashed field lives in BOTH
`engine/snapshot.js` `hashState` and a local copy in
`test/milestone1a.test.js`. They must change together — the
duplication is deliberate, so a hash change is always a conscious,
two-file act.

**The 1A fixture** pins 14 commands and every intermediate hash.
Schema changes re-pin via `node tools/repin_1a.mjs "<reason>"`, which
*aborts on event drift* — if the events change, the reducer is wrong,
not the fixture. Practice: prefer **silent state changes** for routine
ticks (materiel loading, timers); a new event inside the fixture's 14
steps is drift too.

**The hash-inert pattern** (bridges, drops, `state.mission`): a new
subsystem whose state is empty/null in the default game hashes to
nothing — the fixture never notices, no repin needed. This is the
cheapest way to land a whole feature (the mode framework shipped this
way).

**copyState must deep-copy every nested mutable array.** Three
separate aliasing bugs (deeds, waypoints, bridges) came from
forgetting — a shared nested object lets a backward replay scrub read
the future. New nested state (convoy ids, prison pows, mission) gets
its deep copy on day one now.

**Gotchas that cost real time**
- `=== true` vs `!== false`: the **crewing bug** — a config flag
  coerced strictly meant the served game and every 5-seed gate ran a
  different game than the sweeps for days. Lesson (now doctrine):
  **when a probe and a sweep disagree, check the config plumbing
  first.**
- Literal world coordinates in tests churn when conventions change —
  always write `cellToWorld(c)`.
- Floor-division on *signed* movement trig broke mirror symmetry
  (fixed with truncating division); so did clockwise heading-snap
  ties (fixed with an even-index tie-break). Mirror equivariance is a
  property of *every arithmetic choice*, not just the map.

---

## 3. The simulator — the core dev tool

The single most important development tool is the **backend sim
campaign**: full AI-vs-AI wars run headlessly, from 5 seeds
interactively to 600-war batteries on a second machine.

| Tool | What it does |
|---|---|
| `bash debugging/sim_campaign_wave1.sh` | The standard gate: 5 pinned seeds × 12-16k ticks, outcomes + scores. Every gameplay slice ends with this. |
| `SEED=… node debugging/sim_wave1_systems.mjs` | Which systems actually FIRED (event census) — features that silently never trigger are caught here. |
| `node tools/sim_sweep.mjs N` | The battery: one CSV row per war — winner, reason, tows, downs, captures, plus the story columns (lead changes, comebacks, majority flips). Env flags: `MIRROR=1`, `FACTIONSWAP=1`, `MAP=`, `UNIQUES=0`, `TICKETPOOL=`, `POWS=`, `MODE=convoy`. |
| `python3 debugging/analyze_sweep.py` / `analyze_story.py` | Verdicts and pacing narratives from the CSVs. |
| `debugging/dbg_*.mjs` | One-off probes: run `GameServer` headless, filter `state.events`, print positions/fuel/phase of suspects. Written per investigation, kept forever as documentation of past hunts. |

**Practices the simulator taught us**

- **Gate by layer.** The unit suite alone has never been enough:
  gameplay needs the sim gate; client changes need `client_smoke.mjs`
  (page errors, join, ticks) AND `ui_acceptance.mjs` (buttons DO
  things). Between them they caught a keydown TDZ that killed every
  keybind and a z-index that buried the entire HUD — invisible to any
  unit test.
- **Never tune (or convict) on 5 seeds.** Five seeds tell you systems
  fire; only a 300+ war battery tells you what's fair. Sawtooth's
  lean looked team-linked at n=30 and was geometry at n=600.
- **Mirror + factionswap are the fairness instruments.** A TEAM bias
  keeps its edge in both mirrored worlds; a GEOMETRY bias flips.
  `FACTIONSWAP=1` separates chassis strength from side.
  Corollary discovered twice: **the mirror transform itself must be
  maintained** — when a new positional subsystem lands (prisons!),
  the sweep's world-reflection must learn to mirror it, or every
  mirror battery silently measures a malformed world.
- **Instrument-first — and instruments are code too.** Telemetry that
  only records success masqueraded a dead raider as a live one for a
  whole diagnosis round; a probe filtering on the wrong event field
  reported zero tows in wars full of them. Verify the instrument
  before believing the reading. Config self-checks in the sweep
  (print what war 1 *actually* starts with) exist for the same
  reason.
- **Sandbox traps** (recurring): whole-map default bases mean
  instant supply/scoring; single-relay maps end by domination during
  long loops; a lone asset freezes elimination checks; slow chassis
  need longer test loops. Check these before debugging "engine bugs".
- **Era discipline.** Every measured number belongs to an era
  (coordinate reset, pool ladder, crewing fix, people era). Baselines
  are re-pinned per era in the sim-campaign skill and older numbers
  are treated as void. Never mix mode-war rows into standard
  baselines.

---

## 4. The two-machine batch lane

Sweeps don't run on the dev machine (a WSL laptop) — they run on a
**gaming PC (Ryzen 5600X)** driven by an agent-mail job queue:

- `tools/batch_send.sh <kind> …` queues JSON jobs
  (sweep/mirror/map/pool/pows/convoy/perf/update/…);
  `tools/batch_worker.sh` on the PC drains the queue, shards across
  cores, and **mails the CSVs home** (results are gitignored; mail is
  the only channel).
- The worker **refuses to serve on a red suite**, names its commit in
  every result, and self-updates via an `update` job (git pull +
  restart, with autostash).
- Practices learned: results must name the commit they ran on (a
  stale worker produced confusing verdicts); failure must be mailed
  as loudly as success; a collector that silently overwrites
  different same-label CSVs loses history (it now shelves `.prev`).

Native GPU perf runs use `tools/perf_native.ps1` on Windows proper —
WSL Playwright is SwiftShader-only and useless for FPS numbers
(144 fps sustained, vsync-bound, on the real 4070).

---

## 5. Client tooling

- **Playwright** (dev-only dependency) powers `client_smoke.mjs`,
  `ui_acceptance.mjs`, and the perf harness. Acceptance hit-tests
  with `elementFromPoint` and dispatches events manually, because
  headless SwiftShader starves Playwright's actionability waits.
- **Asset pipeline**: procedural sprites baked to a strip PNG
  (`tools/build_assets.mjs` + `render_asset_strip.mjs`), width pinned
  by test so a manifest change can't silently shift every sprite.
- **Model/view split in the client too**: pure, tested "model" modules
  (`objective_model.js`, `feedback_model.js`, `splash_model.js`,
  `status_model.js`…) feed a thin DOM/canvas layer — client logic
  gets unit tests even though the client owns no game logic.
- Parse/smoke guards run after a duplicate-import incident: every
  client file is import-checked in the suite.

## 6. Development workflow

- **Slices**: every change is a named slice (`slice-…` commit prefix)
  with tests written first, suite double-run green, the layer gate,
  a `dev-log.md` entry, and docs/memory sync. The dev-log is the
  real history of the project — every dead end is written down with
  its measurement.
- **Design of record**: product decisions land verbatim in
  `dev-prompts.md`; rulings in `specs/`. Code comments cite the
  ruling (prompt number) that created them.
- **Questions queue**: open design questions are numbered (Q1…Q52)
  and tracked in `plan-version2.md` — the user and a designer ally
  answer in batches; answers become specs and slices.
- **AI regency as first playtester**: 16 AI regents crew both sides
  of every sim war. Doctrine (in `engine/ai_regency.js`) is developed
  with the same rigor as rules — designations are deterministic,
  telemetry (`raidDebug`) is exposed for probes, and doctrine
  changes are gated like gameplay changes because they ARE the
  measurement instrument.
- **Autonomy loop**: long unattended sessions work through ruled
  slices, collect questions, and end with a morning report in
  `reports/` — the user reads the report, answers the questions, and
  the next loop starts.

## 7. Greatest-hits gotcha list (quick reference)

1. Probe vs sweep disagree → **config plumbing first** (the crewing
   bug; then again as batch-job env drift — the phantom regression).
   The `ab` batch job kind exists so suspects get bisected at n=300
   instead of theorized about.
2. New positional state → mirror transform, copyState, BOTH hash
   functions, view projection — four places, every time.
3. Never a new event inside the 1A fixture's 14 steps; prefer silent
   state changes for routine ticks.
4. Read the FAIL COUNT, not the exit code — a chained grep once hid
   two failing tests behind a green-looking pipeline.
5. Don't trust a 5-seed gate for balance; don't trust n=10 for
   tuning; batteries decide.
5b. VERIFY BISECT ENDPOINTS before trusting `git bisect run` — a
   probe that is red at the "good" endpoint walks the bisection into
   noise (ours landed on a doc-only commit).
6. Telemetry must record failure, not just success.
7. A probe's event-field names must be checked against the reducer
   before its zeros mean anything.
8. Whole-map sandbox bases and single-relay maps produce fake
   verdicts in tests.
9. WSL Playwright = SwiftShader: fine for correctness, useless for
   perf.
10. ws tests use poll-waits, never fixed settles — the suite runs
    under load on the PC too.
