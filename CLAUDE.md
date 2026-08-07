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
  Integer/fixed-point math (256 units per cell). **Entities sit at cell
  CENTRES: `cellToWorld(c) = c*256 + 128`** (2026-07-30). Left edges do
  not reflect onto left edges, so the old convention made mirror
  equivariance unreachable and every mirror measurement carried a ~1-cell
  artifact. Centres reflect exactly about the map's centre line
  (`x' = W*256 - x`). Never pin a world coordinate as a literal in a
  test — write `cellToWorld(c)` or the convention change churns it.
  BOUNDARY-PARITY LAW (2026-08-01): plain floor does NOT commute with
  the mirror at exact boundaries (x%256===0) — DECISIONS keyed to a
  continuous x-position use `sampleCellX(x, mapWidth)`
  (shared/fixedmath; east half rounds down; the centre is self-mirror).
  Plain worldToCellFloor stays for y/UI/cell-latticed values. The A*
  carries the ORIGIN-SIDE tie law (pop + parent selection). Residue
  ladder: divergence 2 → 107 → 903; RUNG 3 DONE (78 x-floor decision
  sites law-compliant across 8 engine files, ENFORCED by
  test/boundary_law.test.js source lint — new sites fail the suite).
  LADDER CLOSED (8 rungs, 2026-08-02): + park-east chirality,
  segmentBlocked floors, baseCentreCol (5 sites), centre-facing
  rebuilds, probe centre-anchor exceptions. Horizon 2 → 6280; the
  remaining drift is the DESIGNED half-cell of centre-anchored
  objectives (landship berth, B6 drop — rule-equal at col 64). The
  three tie laws live in specs/08 §7/§7b; two lints enforce. Payoff:
  POWS fairness 24% → 47.1%. RE-BASELINED: default 48.8/53.5% A
  (fair both worlds).
  Deterministic PRNG
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
  consumption, FORMATION party law — rally near own lines, phase latch
  in AI memory, escorts lead, fights-on-the-move; the prison raid
  party rides it, Convoy Escort is next). Phase 12-17 modules: `shared/factions.js` (Directorate/
  Outliers identity), `engine/route_graph.js` (13C equivariant Dijkstra
  waypoints), body collision + parity march order in the reducer (17),
  hybrid ticket bleed 13H (hashed `tickets`; B1 ticketPerDisable — a wreck
  costs its owner a ticket, refunded on recovery; B3 mercy accelerates a
  decided war and overtime holds an empty pool open while a play is
  live), respawn law
  15/15G (hashed respawnTicks/carrierSpawnAt/abandonTimer), session
  rules 13F/13G/13H (`RULES=` presets; default ticketPool 315, pool
  ladder 2026-07-31). SALVAGE ERA (2026-07-31): recovered wrecks bank
  hashed per-team salvage (1/recovery) that discounts the next MPG
  wave (100 ticks/pt, cap 6, consumed at launch); `engine/drops.js`
  (B6 neutral supply drop — own hashed array, NOT a site, seed-
  scheduled on the exact mirror line, exclusive 10 s hold = +15
  tickets); LAST CONVOY (hashed per-team {active,need,done,ids} — the
  mercy trigger flips the loser's endgame to "N=ceil(fielded/3)
  clamp 3..5 hulls home", SUSPENDS mercy while live); B4/B7/Q26
  honors: 8 hashed deed counters per operator + killer identity
  (by/byType/dir) on asset_disabled; `engine/premium.js`: the underdog
  premium (+25% recognition, generated by tools/gen_premium.mjs — LIVE
  on sawtooth + riverline) AND, since the D+C ruling (prompt 154),
  MAP_TICKET_OFFSET — measured, disclosed OUTCOME offsets: the
  disadvantaged team starts +N tickets on battery-convicted maps
  (ladder-tuned; rules.handicap=false / HANDICAP env; briefing
  disclosure both directions). Both tables name only battery-convicted
  maps — an entry without a conviction is a lie about the map.
  MEASUREMENT LAW: live-config batteries on convicted maps now include
  the offset — use HANDICAP=0 for mechanism reads.
  MODE FRAMEWORK (2026-08-01): `engine/mission.js` — asymmetric modes
  via session rules (`rules.mode`; MODE=convoy MODEATTACKER=0|1 env);
  `state.mission` null in standard wars, hashed only when live (the
  bridges pattern, no repin); mode wars spawn NO standards and tickets
  neither bleed nor win (mercy/Last Convoy would fire mid-mission
  otherwise); reasons 6/7. HEIST GETAWAY (Q70, prompt 145): the ATTACKER'S SCOUT
  may carry the Asset in heist wars — the ruled exception to 9A
  carrier-exclusivity (standards.js, GETAWAY=0/rules.heistGetaway
  reverts); HUMAN-facing only — the AI scout-raider trial read 1%
  attacker (suicide doctrine) and was reverted; siege prep is the
  named next lever, awaiting GO. WEAPONS CACHE (Q64-66): KIND_CACHE=5
  reload aura (R5, -25%, fireReloadTicks in the reducer, CACHE=0
  switch) — engine-complete, sandbox-tested, on NO live map (the
  sawtooth trial was exonerated of the 68% read but pulled anyway;
  judge specials ONLY by same-build kill-switch A/Bs). CONVOY ESCORT v1: one truck to the enemy
  compound's near-edge gate, 9000-tick clock, defender radio ping
  every 300, RESTART law (truck beside the wreck 8 s → half hull, in
  place; the convoy wreck is never towed), driver rolls only escorted
  (dash inside 12 cells), hard-designated wrecker, whole-army mode
  posture, defender MPG x2. Battery lane: `batch_send.sh convoy
  <attacker> 300`.
  copyState deep-copies EVERY nested mutable array (deeds, waypoints,
  bridges, convoy ids, prison pows) — three aliasing bugs came from
  forgetting. PEOPLE ERA (2026-08-01): CREW STATIONS (prompt-100 —
  carrier MG ring + scout AT rack; hashed stationOp/stationAmmo/
  stationReload/ejectTimer; board_station mirrors select semantics,
  drivers step across, eject = server-run 2.5s warning, station kills
  SPLIT with deed to trigger seat; AI never mans stations); POW ARC
  slice 1 (`engine/prisons.js` — hashed prisons, OP_CAPTIVE seat
  locks, 10s raid springs POWs as freedPow-downed who must be CARRIED
  home; powPreplaced rule DEFAULT 0 until AI raids work — ruling
  prompt 106; POWS=2 env serves the designed experience); B2 TYPED
  NODES (hashed site.kind: RADAR +6 sensors post-weather / DEPOT
  4-cell forward resupply / FACTORY -180 wave ticks, mirror-paired);
  `engine/caldera.js` (item-40 circle map — EXPERIMENTAL, RED gate:
  raider's-clause-on-a-ring stomp factory, fix-first); Q31 raider
  clause + AI seat-swap; splash (`client/js/splash_model.js`, pure
  tested controller). Full rulings: specs/12. MAP (terrain law,
  prompt 143: every profile's TERRAIN is mirror-symmetric BY
  CONSTRUCTION, cell-tested by map_symmetry.test.js): frontier has EIGHT mirrored
  relays — road 32/58/69/95 + lateral 44/83 at rows 40/86 — mirrored
  spawns (A x=7, B x=120). Mirror symmetry is a TESTED balance invariant
  (specs/08): never move one side without its mirror, and tie-breaks
  must commute with the mirror. FOUR profiles (MAP= env; per-profile
  layout in `MAP_LAYOUTS`, graphs in `route_graph.js` GRAPHS, patrols
  in `ai_regency.js` PATROLS — all three mirror-closed, enumeration-
  tested): `frontier_corridor` (default), `blackwood` (PROMOTED
  2026-07-31 — battery + corridors + playtest all passed), `riverline`
  (EXPERIMENTAL; PACING SOLVED prompt 136: layout-declared STALEMATE
  ATTRITION — joined war, nobody at bleed majority → both pools grind
  on `stalemateBleedTicks` — plus heart-relay bleed [bridge pair =
  majority-equivalent; AI-war-redundant by geometry, kept for human
  mutual-crossings]; horn 34%→0 local, post-ladder battery pair
  pending) + `sawtooth` (**HOLD LIFTS 2026-08-05**:
  54.8/54.4 on a81477c, IN BAND — the 68-69% was the two phase-lock
  bugs, which its tight chokes amplified hardest by producing the most
  head-on meetings per war. Every pre-a81477c sawtooth number is
  last-era. ITS +25% PREMIUM IS NOW UNCONVICTED and must be pulled —
  premium.js's own law: an entry without a live conviction is a lie
  about the map). B3 overtime is CAPPED (prompt 136): hashed `overtime`
  counter, 600 ticks total (rules.overtimeCapTicks), fixture v67 —
  an empty pool can no longer be held open forever by capture churn.
  Design of record + hard profile constraints + 6-map bank:
  specs/10_map_roster.md. Wall rule (18B/18E): impassable (0-speed)
  cells REFUSE entry (speed samples the CURRENT cell, so entering would
  trap a unit forever). A glancing step SLIDES — fallbacks ordered by
  AXIS (x-only, then y-only), never by sign, so slides commute with the
  mirror; a head-on step sets ASSET_IDLE so the planner re-engages.
  ENEMY HULLS are obstacles under the SAME axis-ordered slide law
  (prompt 160.7 — the four-hulls-behind-one-truck stall); only a full
  box-in stalls. THE COMPOUND WATCHES ITSELF (160.2): an enemy inside
  or hard against (+1) a team's base rect is ALWAYS seen — bases with
  width < map width only (sandbox whole-map bases have no walls);
  fog_model mirrors the law exactly (agreement pinned by test).
  Objectives must sit within `CAPTURE_SEEK_CELLS` (16) of real traffic
  or they are never captured at all (18C). `engine/bridges.js` (13E):
  riverline's spans are hashed {id,hp}; artillery breaches, ANY team's
  truck rebuilds, and a breached span becomes T_WATER — so the Skimmer
  crosses what a tank must ford. Empty on every other profile, which is
  why it needed no fixture repin. AI doctrine (13E-2) drops a span only
  when LOSING that crossing, one besieger per span.
- Roster (10 chassis, ids 0-9): tank/scout/artillery/logistics/carrier/
  bike/mortar/sentinel/skimmer/LANDSHIP. Per team: 4/3/2/3/2/1/1 + the
  faction unique in garage slot idx 10. The LANDSHIP (Q42) is the 33rd
  asset (id 32, team -1, NEUTRAL): select IS the capture (either team,
  uncrewed only), either-team tow, own hashed respawn law
  {respawnTicks, spawnIdx} — 100 s clock, centre-column berths via
  landshipBerth (terrain-aware column walk, x fixed = mirror-exact),
  MPG excluded, AI neither claims nor shoots team -1, and team -1 is
  EXEMPT from anti-camping (the LANDSHIP FARM, 2026-08-02: the camp
  pass drafted the idle neutral hull and `team === 0 ? 1 : 0` minted
  its drone for TEAM A — a free scored kill loop worth ~10 pts of
  blackwood A-rate; LANDSHIP=0 = kill-switch. BUG CLASS: audit every
  foe computation reachable with team -1 when adding neutral
  entities). Contract flags are EXPLICIT on every
  chassis: canTow, canCarryStandard, capacity, canMine, canClearMines,
  heavy (11N paths), canCapture (11R — bikes neither capture nor
  contest), siege (11R — only artillery breaches sites), deployable
  (12B Sentinel), amphibious (12C Skimmer), raider (Q31 — double
  capture speed on unguarded flags only).
- W4 (the FUN wave, plan-wave4.md): W4-1 TEAM BALANCE is a transport
  SETTING, default OFF (friends stack a team vs the Regency;
  TEAMBALANCE=1/--teambalance restores the competitive gate; s_lobby
  carries `balance`). W4-2 hashed `operator.rookie` (fixture v69) —
  a first-war player draws no anti-camping drone (client sets it
  from mf_coached; absence = veteran, so AI sims are tick-identical),
  and `campTicks` rides the view so every player gets a 20 s
  "drone incoming" warning. W4-3 mission cards for the two hidden
  systems (prison raid / unclaimed landship — client-only, fog-legit).
  W4-4 PLACEMENT GHOST: `client/js/build_model.js` calls the ENGINE'S
  OWN buildRejection/deployRejection through a view-shaped state (NOT
  a mirror — placement law needs only public geography, unlike LOS).
  VIEW-CONTRACT LINT (test/view_contract.test.js): every own-asset
  field client.js reads must be in the per-team projection — a gate on
  an unprojected field fails CLOSED and SILENTLY (the sandbag button
  was dead from Q50 until W4-4 found it). TWO projections exist
  (per-team + spectator); adding a field to one is not adding it to
  the other. W4-5 juice (own-shot camera kick + tracers, clock-driven,
  Low tier opts out). W4-6 SMOKE (`engine/smoke.js`, fixture v70):
  hashed `smokes[]`/`nextSmokeId`/`smokeLeft`; trucks+mortars carry 2;
  3x3 patch, 30 s, cap 6/team. CONCEALMENT, not line-blocking — LOS is
  a Chebyshev radius, NOT a raycast, and a ray march would put the
  equivariance ladder at risk; a hull in smoke is seen only from
  SMOKE_SEE_CELLS, and a sensor in smoke reaches only that far. BLIND
  TO TEAM by design. COMPLETE: truck-laid (`deploy_smoke`) + mortar
  alt-fire (`fire_order {smoke:true, targetCellX/Y}`, full tube
  discipline incl. minRange) + SMOKE=0 (`rules.smoke`).
  W4-7 UAV SWEEP (`engine/uav.js` holds the radius; command + pool in
  the reducer; fixture v71): 25 Recognition -> 10 s radius-8 reveal.
  Hashed `uavSweeps[]`/`nextUavId`/`operator.recogAvailable`. THE
  HONESTY RULE: honors judge EARNED `score`; spending draws from the
  separate `recogAvailable` wallet that earning also fills — a sink
  must never cost a medal. The sweep BEATS smoke by design. The WALLET
  IS PRIVATE to its own team in the view (the scoreboard is public,
  what you can afford is not). UAV=0 / `rules.uavCost` knobs.
  W4-8 POW CREATORS (Q78): deep-down capture law (nerve expiring INSIDE
  an enemy compound), failed heist, failed raid (alarm-gated), convoy
  driver (60 s undefended). No new hashed field — new routes to
  OP_CAPTIVE. Q84 RULED: the deep-down law is HUMAN-ONLY DRAMA (0
  firings in AI wars, accepted); note any change at the code site.
  W4-10 NIGHT WARS (Q80): `rules.nightWar` / `--night` / NIGHT=1 — a
  night war is a STORM THAT NEVER LIFTS (weatherActive returns true
  unconditionally), reusing the 16G sensor halving wholesale so it
  inherits an already-tested fairness+mirror argument. Nothing hashed.
  HUMAN-RESERVE LAW (prompt 195, ai_regency plan()): a regent claims a
  free hull only while stock remains for every WAITING human (slot
  0-15, active, bodiless, not on foot, not under regency takeover;
  respawn countdowns count) — 17 hulls serve 16 seats, and without the
  law the AI ladder took the spare and won the race to every factory
  wave, leaving a respawned human spectating their own war. Within-tick
  aiClaims counter; both claim sites gated (bodiless ladder + Q31
  seat-swap); Q56 landship claim stays free (it ADDS a hull). Inert in
  AI-only sims (no human slot joins; events unhashed). The client YOU
  marker follows EMBODIMENT via whereAmI (driving/stationed/aboard/
  downed — prompt 197), the downed figure is terrain-anchored via
  heightAt (it sank into relief at fixed y), and a bodiless seat NAMES
  its state in the status panel. /healthz aliases /health (siblings'
  convention); /health falls back to package.json version (prompt 198)
  and reports rssMb + a live tickJitter digest (prompt 206/208 —
  memory pressure and noisy-neighbour steal visible from outside).
  OPS INSTRUMENTS: tools/profile_run.mjs (per-map RAM/CPU + --players
  marginal human cost; humans cost CPU not memory), tools/host_probe.mjs
  (candidate-box verdict: real war at 10 Hz, tick lateness + event-loop
  delay + write stalls). Autosave is ATOMIC (tmp+rename);
  REPLAY_KEEP caps the disk archive; unit templates cap V8 heap BELOW
  MemoryMax (the cgroup is invisible to GC — without it the first
  pressure sign is a mid-write SIGKILL).
  W4-12 TUTORIAL (prompt 192, client-only, nothing hashed):
  `client/js/tutorial_model.js` pure controller — INTRO → 7-stop arrow
  TOUR of real HUD ids → 12 sequential QUESTS detected from real play
  (send() hook, UI actions, own-view events; fog-legit by construction);
  mf_tutorial persists; SKIP falls back to the O3 coach beats; ⚙
  replay. The ladder is a QUEUE (prompt 200): quests carry attemptKey
  (tow/special), the DOM answers caps per snapshot, and an
  unattemptable quest ROTATES TO THE BACK with a one-time defer note —
  numbering counts done, never rotations. TWO LINTS in
  test/tutorial_model.test.js (tour targetIds exist in index.html;
  tut.* keys in both locales incl. derived `tut.q.<id>` and
  `tut.defer.<id>`); ui_acceptance walks the whole flow — its clickHud
  force-hides tutorial-overlay, so tutorial buttons use an inline
  hit-tester. GOLDEN LINE (prompt 201): real task-strip cards wear
  gold per KIND until first clicked (mf_goldline, cross-war,
  client-only). IMPORT-REALITY LINT (prompt 202, lints.test.js #5):
  every engine/shared export called bare in a client module must be
  imported there — the stations slice shipped getUnitStats unimported
  and the WHOLE seat-facing UI threw on first touch from day one. The
  silently-dead-feature ledger: unprojected view field (W4-4), missing
  validate case (W4-6), unimported helper (202).
  MOBILE ERA (prompts 211-212): `client/js/keybar_model.js` PURE — the
  on-screen KEY BAR (context-curated ≤8 per embodiment, gray=carried-
  but-unavailable, hidden=never-applicable, blink=banner/tutorial
  suggestion ONLY when ready; taps synthesize real keydown — one
  dispatch contract; touch default, mf_keybar/⚙ override). MOBILE
  LAYOUT: body.mobile (matchMedia max-width:700px) + index.html
  mobile-css block with !important (the HUD is inline-styled — plain
  media queries cannot win); hint-bar+supply-bar HIDE on mobile (key
  bar + status panel carry their jobs); op-info uses the faction LOGO
  glyph (⛨/➳) on ALL platforms; team board starts collapsed on
  phones. Lint #6 pins every mobile-css id to a real element.
  GARAGE (211): art-only open bay built AROUND the reserve-spawn strip
  (baseCentreCol × RESERVE_ROWS, exported) — spawns/sims untouched.
  Acceptance runs at 640px = the MOBILE layout is gate-exercised;
  state-surgery pattern (engine constructors on gameServer.state,
  capture+mutate synchronously — it is REPLACED each tick; 99999
  ticket pools keep the harness war unendable; ensureSeated() heals
  organic deaths). debugging/mobile_shot.mjs renders a phone-viewport
  screenshot for layout work.
  MOBILE ROUND 3 (prompt 214): transport heartbeat 5s→30s + LOGGED
  drops (5 s kicked phone-radio wakes and WiFi/5G handovers — the tick
  counter rising through every CONNECTION LOST proved the server never
  died); client netDiag ledger + ⚙ Connection check (your gaps vs
  /healthz tickJitter → network/host/clean verdict;
  __mfDebug.netDiag/runNetCheck). RUNAWAY-CORNER LAW:
  scenePointToCell(..., {strict:true}) — an off-map tap is DROPPED,
  never clamped (the clamp manufactured un-resettable corner orders).
  Touch compass: arrows +224 brads so they drive SCREEN directions
  under the iso camera. HOLD-tap 700 ms = touch SHIFT-click (waypoint;
  400-700 ms stays a pan). Pings 1/2/3 are key-bar buttons (cap 11;
  downed = rescue ping alone). Garage REVERTED to open spawn strip +
  buildings nudged off it symmetric-by-distance + lit windows. Mobile
  bottom anchors cap at min(px, vh) — 352px bottoms pushed cards off a
  360px-tall viewport (landscape phones + the acceptance viewport).
  CONVOY ROUTE (Q82): `CONVOY_ROUTE_SCALE` default 80 — the truck
  starts 20% forward, measured 38.3% attacker (classic 100 = 18.7%).
  The ladder is NOT monotonic (65 -> 15.3%): the knob moves the TRUCK
  ALONE while escorts still rally at their own lines, so 80 is a local
  optimum set by escort geometry.
- A NEW COMMAND NEEDS FOUR ENTRIES (W4-6 lesson): the constant, the
  **`validate()` case in commands.js** (an ALLOWLIST — an unknown type
  is refused before the reducer's switch, event type `"rejected"`), the
  dispatch case, and the handler. Miss the validate case and the
  command is a SILENT no-op.
- Commands: join/select(confirm)/move(+queue:true = waypoint leg, 34)/
  fire(asset|drone|site)/tow/crawl/
  redeploy(+carrierAssetId 15F)/respawn(15)/satchel(16F, downed AT
  charge)/deploy_mine/clear_mine/deploy_caltrops (Q45: light units,
  slow-only 30%/45s patches, hashed racks+list, truck rake)/
  build_sandbag (Q50: trucks, 5s channel → T_BLOCKING via the bridges
  terrain-mutation precedent; placement law in engine/sandbags.js
  incl. ROADS allowed under the TWO-LANE LAW since prompt 145 — a
  road build must leave >=2 open road cells in its column
  cross-section; destruction restores ground)/ping/
  board_carrier/unboard/drive/
  deploy_hardpoint/undeploy/transfer_cargo (+ inert call_medic).
  fire(...) also takes `targetBridgeId` (13E, siege chassis only)
  and `targetSandbagId` (ANY gun — bags are cover, not
  infrastructure). ALARM GUARDS (Q38): prison.alarmTicks hashed; the
  watchman is NOT an entity — toTeam ping kind prison_alarm on a 30s
  cooldown + defender response doctrine in ai_regency. LOBBY
  (prompt 149): transport-level s_lobby broadcast (live per-team human
  counts + server config) to EVERY socket incl. pre-join; fresh joins
  refused at a 2-human imbalance (token reclaims exempt);
  SPECTATE=0/REPLAYS=0 disable the booth + archive end-to-end. VOTING
  (Q49/Q54): transport-level c_vote/s_vote_open (nothing hashed);
  the pump applies the plurality pick via
  resetWar(seed, {mapProfile, modeRules}); the pool lives in
  engine/vote.js — VOTE_MAPS/VOTE_MODES env at start, GET/POST
  /rotation at runtime (POST loopback-only). MODE FRAMEWORK: see the
  2026-08-01 block above; convoy battery `batch_send.sh convoy`;
  bisection kill-switches RAIDPARTY=0/POWARC=0 + the `ab` job kind.
  THE RESIDUE, RESOLVED INTO PARTS (2026-08-02, prompt 143): the
  UNDESIGNED root was FRONTIER'S TERRAIN — never cell-symmetric
  (noise drawn whole-map; 1,615/8,192 asymmetric mirror pairs/seed).
  Mirror-BY-CONSTRUCTION since cff77cb (west-half noise reflected
  east, budgets 550/55); test/map_symmetry.test.js pins ALL profiles
  cell-for-cell — the invariant is now tested at the level it is
  claimed. Every pre-cff77cb frontier measurement describes a map
  that no longer exists. DESIGNED remainder: the col-64 centre
  anchors (ruled half-cell). THE TEAM-KEYED
  REMAINDER, DISSOLVED INTO UNIQUE ECONOMICS (2026-08-03, prompt 151
  squares at n=1200): the convoy gap (Skimmer-led attacks +~35 pts
  over Sentinel-led, any team/direction), sawtooth's 68% (uniques-off
  = dead fair), and riverline's lean are ALL the unique pair.
  Tick-parity ruled INERT (Q18 dead); the vault convicts on clean
  terrain too (never terrain luck). THE MERGED TEAM-KEYED HUNT,
  ROOT CONVICTED (2026-08-03, prompt 170 — the line instrument):
  pre-contact advance symmetric to a decimal; the line moves at
  FIRST CONTACT because sequential collisionVerdict checks let the
  first mover of the decisive tick park one speed quantum deeper
  (88 v 143 from the boundary, measured) and eat mirror-support
  artillery ~2 ticks early; parity march only alternated WHICH team
  and mirror-pair meetings have fixed decisive parity. FIXED:
  verdicts read START-OF-TICK snapshot positions
  (collisionVerdict._prevX, set in applyAdvanceTick); mutual closers
  may undershoot the block radius one step each, symmetrically;
  pinned by test/collision_mirror.test.js (the 19-cell scout
  skew-window geometry, verified red pre-fix). b5b5a69 batteries
  read FLAT (frontier_uq 39.7/40.3, POWS=2 25.9/28.3 — correct fix,
  not the outcome channel) and the ORDERPARITY arms were
  BIT-IDENTICAL → DEAD-SWITCH LAW (sim-campaign skill): Q71's
  partition was a no-op all along (plan() already sorts emission by
  lead team since Q18) — the old "tick-parity inert" verdict judged
  a dead switch. SECOND CONVICTION, same class (a81477c): the Q18
  lead-team law was RAW TICK PARITY and mirror-synchronized
  exchanges land on a fixed parity — one team led every dominant
  simultaneous exchange (the 546/547 duel). Fixed: lead team =
  seeded hash bit of (tick, mapSeed) (ai_regency ~985; AI-only,
  nothing hashed; tick_parity.test.js pins the hash law). THE
  PHASE-LOCK CLASS now has two members (march order, emission
  order) — audit any parity-alternated order against
  mirror-synchronized events. VERDICT (a81477c pairs, n=300):
  frontier_uq 54.0/52.9% A — IN BAND BOTH WORLDS (first time since
  the obstacle-slide era; upper half, watch the slight A lean);
  POWS=2 39.4/36.4 (was ~26 — still below band). The b5b5a69-only
  flat reads prove the two channels INTERACT. POWS residual epoch:
  even to t=4000, then a one-sided A-loss run t≈4250-5000. ROOT
  CONVICTED 2026-08-05: **THE AI RAID PARTY** — POWS=2 baseline
  39.4% -> RAIDPARTY=0 **54.2/51.2% (in band BOTH worlds)**, while
  POWARC=0 reaches only 41.5%. Next: a raid-party census (hulls
  committed per team, party lifetime, losses while live) to name
  what inside the party is team-keyed; the mid-war REBUILD OVERSHOOT
  is likely downstream. STALE-EXONERATION LAW (sim-campaign skill):
  this same switch read "identical, exonerated" last era because the
  phase locks masked it — re-run every exoneration after a root fix.
  Still filed: MPG wave-timing asymmetry (B refills earlier despite
  fewer losses).
  Also open: the east-pusher residual (+7-13 side-keyed);
  heist attackers 12.7/9.3% (a dial — the bar is the designer's). powPreplaced SETTLED at 0
  (the full arc 2→1→0, prompts 130/131/133: classic tempo default,
  POWS=2 = the human-session flavour; the POW-era doctrine tempo and
  a POW×unique×ring caldera coupling both dissolved at 0).
  PRISONS: rear-edge geometry (5 in from the edge AWAY from map
  centre — mirror-pinned by test across all profiles).
  Faction uniques crew BY DEFAULT (16B — TRUE ONLY SINCE 2026-07-31:
  a `=== true` coercion in GameServer + server/index had the SERVED
  game and every 5-seed gate running uncrewed since 16B, while sweeps
  measured crewing-ON; when a probe and a sweep disagree, CHECK THE
  CONFIG PLUMBING first). UNIQUES=0 disables (sweeps + server env).
  Band at 416/pool-315: 52.9-55.2% A frontier; sawtooth's old
  "69% uniques-linked" verdict is DEAD (it was the phase locks —
  see the map block). Weather fronts (16G): seed-scheduled sensor-halving
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
4. GATE BY LAYER — the suite alone has never been enough:
   - gameplay/engine → the backend sim gate (`sim-campaign` skill); a new
     MAP profile also needs 30+30 mirrored locally and a 300-war PC
     battery (`batch_send.sh map <profile> 300`) before it leaves
     EXPERIMENTAL.
   - client → `node tools/client_smoke.mjs` (page errors, join, ticks)
     AND `node tools/ui_acceptance.mjs` (buttons actually DO their
     thing). Between them these caught the keydown TDZ that killed every
     keybind and the z-index that buried the whole HUD — neither of
     which any unit test could see. Acceptance hit-tests with
     `elementFromPoint` and dispatches separately, because headless
     SwiftShader starves Playwright's actionability wait.
   - a measured claim about tempo/balance → sweep data, never 5 seeds.
5. Commit locally with `marker-NNNN:` prefix (next number after the last in
   `git log`), update `dev-log.md`. NEVER push — the user handles remotes.

## Commands
- `npm test` | `node --test test/<file>` | `npm start` (server on :8080)
- Sims: `npm run sim2a` (duel soak), `npm run simv1` (32-participant war)
