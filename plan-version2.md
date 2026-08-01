# Fireline Command — Version 2 Plan (status board)

*Updated 2026-08-02 (suite 728/728, fixture v63). HTML twin:
`plan-version2.html` — keep both in step. Companion to
`plan-version1.md` (v1: SHIPPED) and `plan-wave3.md` (the wave-3
ledger). Design rulings: `specs/07_rulings_register.md`. Map design:
`specs/10_map_roster.md`. Slice detail: `dev-log.md` + `reports/`.*

**V2.0 "The Rescue Update" shipped long ago.** So did the faction era,
the pacing era, and the map roster. This board now tracks what is
genuinely left, and it is mostly ECONOMY, NPCs, and presentation —
plus three experimental maps that have not earned promotion.

---

## Track A — Roster & roles

| Feature | Status |
|---|---|
| Command Carrier | ✅ `slice-9a` — carrier-exclusive standard carrying, capacity-2 rescue bunks |
| Downed operators | ✅ `slice-9b` — crawl / redeploy / carrier rescue / delivery / auto-return |
| Scout Bike (courier) | ✅ `slice-11r` — cannot capture or contest |
| Mortar Carrier (mobile indirect) | ✅ `slice-11s` — junior to artillery by pinned contract |
| **Factions: Directorate vs Outliers** | ✅ `slice-12a` — identity, palettes, insignia (NOT the Warden/Freehold working names this file used to carry) |
| **Sentinel** (Directorate unique) | ✅ `slice-12b` — deployable hardpoint, threat-reactive doctrine |
| **Skimmer** (Outlier unique) | ✅ `slice-12c` — amphibious + Riverline Drive trail affinity |
| Unique crewing + band tuning | ✅ 16B — **CREWING BUG fixed 2026-07-31**: the served game (and every gate) ran crewing OFF since 16B; only sweeps measured the intended game. Default-ON restored. Band at 416/pool-315: 52.9% pre-walls, 55.2% post-walls (1.2σ apart — watch) |
| AT satchel (downed crew) | ✅ `slice-16f` |
| NPC infantry layer + POWs | 🔜 **ARC IN FLIGHT** — prisons + capture + raid party + **ALARM GUARDS landed** (watchman ping + defender response; raids still complete 4/5); powPreplaced flip = Q46 (battery pending); next: Landship (figure kit LANDED; vault machinery landed but live placement PULLED by battery conviction — ships on a map that measures fair) |
| Multi-crew "Landship" | ✅ `slice-landship` — neutral capturable fortress (select-is-capture, heavy station, either-team tow, rotating berths); battery FAIR 53.4/48.6 n=600; AI crewing doctrine = future slice, wants playtest feel first |

## Track B — Battlefield systems

| Feature | Status |
|---|---|
| **Formation primitive (group movement)** | ✅ `slice-formation` — rally near own lines → advance together, escorts lead, cohesion hold, fights-on-the-move; raid party rides it; convoy escorts reuse the follow law |
| **Mode framework + Convoy Escort v1** | 🔶 LANDED, TUNING — n=300 verdict: attacker 27% (A) / 19% (B), tempo clean; awaiting YOUR playtest + the designer's asymmetric bar (Q47) before touching timer/counterweights |
| Vault machinery (Q39) | 🔶 ENGINE-COMPLETE, live placement PULLED — the frontier pair measured a ~15-pt team edge (likely the residue: re-test via the VAULTS=2 ab rung after the ladder closes) |
| Mines / anti-camping drone / MPG | ✅ `9e` / `9g` / `9d` (+ MPG full waves, base-derived spawns) |
| Damaged sites + materiel repair | ✅ `slice-11f` — artillery-only siege |
| Path terrain + per-chassis speeds | ✅ `slice-11n` |
| **Ticket bleed (hybrid)** | ✅ `slice-13h` — relay majority drains the enemy pool; three live victory paths |
| **Respawn law** | ✅ `slice-15/15g` — forced respawn, self-recalling hulls, carrier field respawn |
| **Route graph + dynamic edges** | ✅ `13c`/`13d` — equivariant Dijkstra, mine-aware re-costing |
| **Body collision** | ✅ `17` — enemy hard block, friendly soft compression |
| **Weather fronts** | ✅ `slice-16g` — seed-scheduled, sensors halve, pure function |
| **Wall rule + sliding** | ✅ `18b`/`18e` — impassable terrain refuses entry; glancing steps slide, head-on stops so the planner re-engages |
| Full cargo manifest | ✅ `slice-13a` + AI resupply runner `13b` |
| **Bridge demolition (riverline)** | ✅ `slice-13e-bridges` — artillery breaches, span becomes water (Skimmer answer), either-team repair; AI doctrine landed (`slice-13e2`) |
| Meaningful deaths (B1) | ✅ `slice-b1` — a wreck costs a ticket, refunded on recovery; 600-war verdict: horn 27%->13%, standard held at 8%, fairness untouched |
| Mercy + overtime (B3) | ✅ `slice-b3` — mercy retargeted (ruled trigger was unreachable); horn 5-15%; cured blackwood's 9.3% undecided |
| Typed node classes (B2) | ✅ `slice-b2` — RADAR/DEPOT/FACTORY effects, mirror-paired on frontier+blackwood (fixture v50) |
| Field hull repair + AI doctrine | ✅ ruled + landed — capped at half hull; wrecks still need the bay |
| Waypoints (item 34) | ✅ `slice-34` — shift-click/long-press queues up to 8 legs |
| Story instrument (prompt 88) | ✅ — sweep records lead changes/comebacks/majority flips/std attempts; `analyze_story.py` |
| Salvage economy | ✅ `slice-salvage` — recoveries bank MPG-wave discounts (MPG sink as ruled; garage refit BANKED; tow double-pay awaiting ratification) |
| Last Convoy finale | ✅ `slice-last-convoy` — suspends mercy, N=ceil(fielded/3) clamp 3..5; called 5/8 wars, completed 2 |
| Neutral supply drop (B6) | ✅ `slice-b6` — mirror-line placement, 10 s exclusive hold, +15 tickets |
| **Grid pathfinding (item 39)** | ✅ `slice-18i` — A* around walls into the waypoint queue, humans+AI, mirror-equivariant |
| **Base walls + gates (item 38)** | ✅ `slice-18i` — Fireball homage on all maps; destructible walls BANKED |
| Underdog premium (58/68) | ✅ LIVE on sawtooth (team B +25%, disclosed in the briefing); generator re-runs per battery |
| Fog ghosts / convoys | ⬜ V2.x |

## Track C — Maps

| Profile | Status |
|---|---|
| `frontier_corridor` | ✅ DEFAULT — pool 315; people-era re-baseline **48.5% A both worlds (FAIR)**, horn settled 15%, median 21.7 min |
| `riverline` | ⚠️ EXPERIMENTAL — fairness PASSES (flips with mirror), **pacing FAILS: 41% horn, 27-min median** — pacing slice queued (pre-corridor-blackwood disease) |
| `blackwood` | ✅ **PROMOTED 2026-07-31** — batteries + 18G corridors + human playtest all green (specs/10 §4d) |
| `sawtooth` | 🔴 HELD — seat-economics conviction; Q31 levers keep gaining: 69→58.5→**56.7% A**; premium LIVE + disclosed; playtest pending |
| `caldera` (circle map, item 40) | 🔴 BUILT, RED gate — raider's-clause-on-a-ring stomp factory; fix-first (specs/10 §4g); CANDIDATE home for Convoy Escort once fixed (Q48 — the ring road IS a convoy route) |
| The 6-map bank | 📝 designed, unbuilt: archipelago, rail junction, urban grid, salt flat, highland ridge, fortress breach |
| Map rotation / voting | ⬜ FILED (prompt 64) — server option, minimap thumbnails per candidate, or "next map" on the end screen |

## Track D — Coordination & social

| Feature | Status |
|---|---|
| Context pings / public tasks / takeover confirms | ✅ `10c` / `11t` / `10b` |
| Recognition scoring + honors | ✅ `slice-11k` — rescue outranks kills |
| Category awards + death recap (B4/B7) | ✅ `slice-b4`/`slice-b7` — 8 deed counters, six honors (incl. BEST ESCORT per Q26 ruling), killer identity on the down banner |
| Quick-command wheel + auto-callouts (B5) | ✅ `slice-b5` — hold Q, full vocabulary, "thanks" ping, fog-reveal contact callouts |
| Persistent profiles / leaderboard | ⬜ V2.x — the premium MECHANISM landed; ranking premium still V2.x |
| Join flow / lobbies | ⛔ VERSION 3 by ruling |

## Track E — Presentation & platforms

| Feature | Status |
|---|---|
| Direct control + targeting | ✅ `11l`/`11o` |
| Art rounds 1, 2c props, 2a faction palette, 2b motion, 2d baked sprites | ✅ `11q`, `14a`, `14b`, `14c`, `14d` |
| Base compounds / map detailing | ✅ `14g` |
| Field Encyclopedia | ✅ `14k` |
| Replay viewer / spectator | ✅ `11h` / `10a` |
| i18n (en + no) + a11y | ✅ `15b` / `15c` — key-identical catalogs enforced by test |
| Mobile touch | ✅ `slice-15a` |
| Discovery (master server + global list) | ✅ `slice-15h` |
| **Client feel batch (playtest 8)** | ✅ `slice-18d` — honest centre-on-me, war clock, fog notice, right-drag pan, stats key |
| **Heading render fix (playtest 10)** | ✅ `slice-18h` — interpolator clobbered engine brads with radians: every mover rendered ~east since 9F; motion-facing on slides |
| Audio identity | ⬜ V2.x — RULED synth-first (WebAudio patch manifest) |
| Camera/diorama + chase cam | ⬜ V2.x |
| Native perf numbers | 🔜 RUNNER WORKS — `tools/perf_native.ps1` (+ `perf_native.sh` from WSL, docs in `tools/perf_native.md`); a run succeeded on the PC, **numbers not yet collected** |
| Roblox/Luau twin | Horizon |

## Track F — Meta & live ops

| Feature | Status |
|---|---|
| Ops hardening, /version, rate limits | ✅ `slice-11j` |
| Batch-PC lane (agent-mail jobs, CSV mail home) | ✅ `11p` + per-map `map` job + self-update with autostash |
| Telemetry & heatmaps | ⬜ V2.x (`/metrics` is the seed) |
| Achievements, modding, custom modes, campaign | ⬜ Horizon |

## ⚠ Measurement eras (read before trusting any number)

Cell-centre reset (2026-07-30) voided everything before it. Pool 315
landed 2026-07-31 on a full n=300 ladder. **The 16B crewing bug**
(fixed 2026-07-31) means: sweeps/batteries always measured crewing-ON;
the SERVED game and all 5-seed gates ran crewing-OFF until the fix.
Battery numbers stand; gate history and playtest feel predate the fix.
**People-era re-baseline (2026-08-01, 1,800 wars)** is the current
table: frontier 48.5% A/fair, horn 15% (stable), sawtooth 56.7%,
blackwood 49.2%. MODE WARS (convoy) are a different game — never mix
their rows into standard baselines.

## What is actually blocking progress

1. **THE DIRECTIONAL RESIDUE — rung 5.** Four rungs closed (A*
   origin-side, boundary-parity + 78-site sweep + lint, park-east
   chirality). Rung 5 = t=953 mid-flight re-target (harness ready).
   Then probe-clean 16k×5 → pows + default re-baseline → Q46 + the
   vault's return. After the ladder: YOUR Q57 queue (caldera → heist
   → figures r2/ambients → riverline) + the Q58 cache brief.
2. **Riverline pacing slice** — 41% horn; same playbook as blackwood
   18G (instrument first, then the smallest terrain/graph change).
3. **Caldera fix** — raider's-clause-on-a-ring; then it can host
   Convoy Escort (Q48).
4. **Alarm guards + figure kit** — next POW-arc slice; rulings all in
   specs/12 (visual law: no weapon silhouette, alarm-only).
5. **Sandbags/caltrops** — parameter tables recorded (Q45); awaiting
   the build GO (Q50).
6. **User-side**: sawtooth playtest (crewing is ON now), convoy mode
   playtest (MODE=convoy), uncapped perf run.

## Open design questions (the clarify-and-design queue)

Closed since the last pass: Q24 (in use = ratified), Q48 (vote pool
serves it), Q49/Q50/Q54 (built), Q52 (queued behind convoy tuning).

| # | Question | Owner | Blocked by |
|---|---|---|---|
| Q46 | RULED+SHIPPED (prompt 130): powPreplaced 2 is the default — POWS 47.1% A in band | — | — |
| Q59-Q61 | SETTLED (prompt 133): powPreplaced 0 — classic tempo default; POWS=2 = the human-session flavour | — | — |
| Q60 | DISSOLVED: on the classic default caldera reads 54.3/51.7% A in band — the lean was a POW×unique×ring coupling that Q61 removed; no uniques-off needed | — | — |
| Q62 | VERIFIED at n=600: convoy attackers 32/34% — best config yet, side gap closed | — | — |
| Q63 | Caldera identity: fairness passes but 13-min / 63%-elimination death-circle wars — bless the brawl identity or tune MPG/pool for the ring? | you + playtest | — |
| Q64 | Weapons cache (specs/13): ship on sawtooth first, or hold until your sawtooth playtest verdict? | you | — |
| Q65 | Cache aura while the site is suppressed — recommend: radiates while owned, full stop | you | — |
| Q66 | AI doctrine weight for the cache — recommend: plain capture-seek v1, measure first | you | — |
| Q67 | Specials-ladder order: VAULTS=2 re-test before the cache lands, or cache leapfrogs? | you | PC lane free |
| Q68 | DISSOLVED: blackwood restored to 51.0/48.3% fair by the landship-farm fix — promotion stands | — | — |
| Q69 | Riverline's own A-keyed lean (56.9% agg, survives the farm fix): hunt now, or after your playtest? Suspect ladder: Q18 first-strike bias converted by stalemate attrition | you | — |
| Q47 | Convoy asymmetric bar: what attacker win-rate band is "fair"? Regents read 27/19%; also ratify 15-min timer + defender-MPG ×2 | designer + your playtest | — |
| Q53 | Sandbags: current law forbids building ON roads outright (stricter than your two-lane cap, provably map-safe). Keep, or allow road walls up to the cap? | you | — |
| Q56 | AI landship doctrine: should regents claim/crew the neutral fortress, and with what priority? (Currently human-only, like stations v1) | you, after playing it | playtest feel |
| Q57 | Sequencing after rung 4: (a) riverline pacing slice, (b) caldera fix (unlocks convoy's natural home + Q39 specials), (c) heist mode, (d) figure-kit round 2 / ambient NPCs (farmhands→road workers→trader). Preference order? | you | — |
| Q58 | Q39 specials ladder: after the vault re-test, the designer's order is cache → alloys → lab (lab needs the escortable-NPC primitive, which Convoy Escort's party law mostly provides). Green-light the cache design brief? | you | vault re-test |

**Playtest asks (when you have time):** sawtooth (crewing is ON now),
Convoy Escort (`MODE=convoy`), the Landship (mid-map, click to claim,
J for the station), a POWS=2 session (`POWS=2` — the human experience
is unaffected by the regent-side bias), and the end-screen vote.

## Version 3 (parking lot)

Lobbies/matchmaking as an OPTIONAL entry beside the no-lobby flow;
whatever sustained multi-human sessions prove the game still needs.
