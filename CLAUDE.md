# Fireline Command (dev name: More Firepower) — working rules

Deterministic, server-authoritative wargame. The client never owns game
logic; the reducer (`engine/reducer.js`, `apply(state, command)`) owns every
outcome. Renderer presents fog-filtered views only.

## Source of truth
- The repository ROOT is the verified implementation (v0.9.0, `dev-log.md`).
- `phases/` and `initial-prompt.md` are historical reference; the code there
  descends from a degraded fork — take design intent from it, never code.
- Product decisions live verbatim in `dev-prompts.md`. Append new ones.

## Determinism (non-negotiable)
- No `Math.random`, wall-clock, or floats in `shared/` or `engine/`.
  Integer/fixed-point math (256 units per cell), deterministic PRNG
  (`shared/prng.js` — algorithms pinned by fixtures 0C/0D), stable iteration
  order, canonical little-endian serialization (`shared/canonical.js`).
- No file/network I/O and no new dependencies in `shared/` or `engine/`.
- Anything gameplay-relevant must be headlessly testable.

## State schema & fixtures
- Every hashed field lives in `engine/snapshot.js` `hashState` AND the local
  hash function in `test/milestone1a.test.js` — change both together.
- Schema changes re-pin `test/fixtures/1A_reducer.json` hashes via the regen
  pattern in dev-log (bump fixtureVersion, note provenance; the 14-step
  command script and its event payloads stay VERBATIM — if events change,
  the reducer is wrong, not the fixture).
- Asset ids 0-7 keep their pinned spawn arrangement (1B/1D depend on it);
  reserves are 8-19 (team A) and 20-31 (team B). Operators: 0-15 humans,
  16-31 AI regents.
- Phase 8 modules: `engine/standards.js` (Command Standards — the primary
  objective), `engine/recovery.js` (tow-back), war lifecycle in
  `server/index.js pump()`.
- Phase 9-11 modules: `engine/downed.js` (operators on foot), `engine/mines.js`,
  `engine/drone.js` (anti-camping), `engine/pings.js` (team signals,
  toTeam-scoped events), BF2 capture countdown + site hp in
  `engine/sites.js`, materiel/repair + Slow Manufacture passes in the
  reducer, AI doctrine (roles, capture-seek, rescue, mining, pings) in
  `engine/ai_regency.js` (+ escorts 11x, roleTruck ladder, route-graph
  consumption). Phase 12-17 modules: `shared/factions.js` (Directorate/
  Outliers identity), `engine/route_graph.js` (13C equivariant Dijkstra
  waypoints), body collision + parity march order in the reducer (17),
  hybrid ticket bleed 13H (hashed `tickets`, WIN_TICKETS=5), respawn law
  15/15G (hashed respawnTicks/carrierSpawnAt/abandonTimer), session
  rules 13F/13G/13H (`RULES=` presets). MAP: frontier has EIGHT mirrored
  relays — road 32/58/69/95 + lateral 44/83 at rows 40/86 — mirrored
  spawns (A x=7, B x=120). Mirror symmetry is a TESTED balance invariant
  (specs/08): never move one side without its mirror, and tie-breaks
  must commute with the mirror. Second profile `riverline` (MAP= env,
  EXPERIMENTAL — west side lean pending graph tuning); per-profile
  layout in `MAP_LAYOUTS`.
- Roster (9 chassis, ids 0-8): tank/scout/artillery/logistics/carrier/
  bike/mortar/sentinel/skimmer. Per team: 4/3/2/3/2/1/1 + the faction
  unique in garage slot idx 10. Contract flags are EXPLICIT on every
  chassis: canTow, canCarryStandard, capacity, canMine, canClearMines,
  heavy (11N paths), canCapture (11R — bikes neither capture nor
  contest), siege (11R — only artillery breaches sites), deployable
  (12B Sentinel), amphibious (12C Skimmer).
- Commands: join/select(confirm)/move/fire(asset|drone|site)/tow/crawl/
  redeploy(+carrierAssetId 15F)/respawn(15)/satchel(16F, downed AT
  charge)/deploy_mine/clear_mine/ping/board_carrier/unboard/drive/
  deploy_hardpoint/undeploy/transfer_cargo (+ inert call_medic).
  Faction uniques crew BY DEFAULT (16B live; UNIQUES=0 in sweeps
  disables); band-tuned to normal-world ~51/49 (trail affinity 416,
  Sentinel hp 120). Weather fronts (16G): seed-scheduled sensor-halving
  in `engine/los.js weatherWindow` — pure function, never hashed.
  Re-pin the 1A fixture with `node tools/repin_1a.mjs "<reason>"` — it
  aborts on event drift (a NEW event inside the 14 steps is drift too:
  prefer silent state changes for routine ticks, e.g. materiel loading).
- Every gameplay slice ends with the backend sim gate — see the
  `sim-campaign` skill. Batch sweeps: `node tools/sim_sweep.mjs N`.

## Workflow per change
1. Identify the owning layer (shared/engine/server/client/test).
2. Write or port tests first; use `test/helpers.js` builders (sandbox states
   default to whole-map bases so supply rules stay neutral).
3. `npm test` must be fully green before commit.
4. Commit locally with `marker-NNNN:` prefix (next number after the last in
   `git log`), update `dev-log.md`. NEVER push — the user handles remotes.

## Commands
- `npm test` | `node --test test/<file>` | `npm start` (server on :8080)
- Sims: `npm run sim2a` (duel soak), `npm run simv1` (32-participant war)
