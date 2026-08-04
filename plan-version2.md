# Fireline Command — Version 2 Plan (status board)

*Updated 2026-08-04 (suite 780/780, fixture v68 — the CONTACT-LAW era). HTML twin:
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
| NPC infantry layer + POWs | ✅ ARC COMPLETE — prisons, capture, raid party, alarm guards, ambients (figure-kit r2); powPreplaced SETTLED at 0 (the 2→1→0 arc; POWS=2 = the human-session flavour, currently 25-28% A on clean terrain — under the team-keyed hunt) |
| Multi-crew "Landship" | ✅ `slice-landship` — neutral capturable fortress (select-is-capture, heavy station, either-team tow, rotating berths); battery FAIR 53.4/48.6 n=600; AI crewing doctrine = future slice, wants playtest feel first |

## Track B — Battlefield systems

| Feature | Status |
|---|---|
| **Formation primitive (group movement)** | ✅ `slice-formation` — rally near own lines → advance together, escorts lead, cohesion hold, fights-on-the-move; raid party rides it; convoy escorts reuse the follow law |
| **Mode framework + Convoy Escort v1 + Heist** | 🔶 LANDED, TUNING — post-escort-wall: convoy attackers 39% (A) / 64% (B) — the 25-pt gap is TEAM-keyed (direction exonerated); heist attackers ~8/4% AI (humans have the getaway car); Q47 bar + Q72 siege-prep with you |
| Vault + Cache machinery (Q39/Q64) | 🔶 BOTH ENGINE-COMPLETE, both live placements PULLED — vault (conviction stands), cache (exonerated of sawtooth's 68% but pulled anyway; judge specials ONLY by same-build kill-switch A/Bs). Q67: vault re-test timing. Frontier post-symmetry = the fair-map candidate |
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
| Underdog premium (58/68) | ✅ LIVE on sawtooth AND riverline (Q69 accepted — the unique pair is worth ~16 pts A on water); team B +25%, disclosed in the briefing |
| Fog ghosts / convoys | ⬜ V2.x |

## Track C — Maps

| Profile | Status |
|---|---|
| `frontier_corridor` | ✅ DEFAULT — **terrain mirror-BY-CONSTRUCTION since prompt 143** (it never was, cell-level; ~1,600 asymmetric pairs/seed for 5 weeks); symmetric-era baseline **46.2/45.5% A (in band)** |
| `riverline` | ⚠️ EXPERIMENTAL — **pacing SOLVED** (stalemate attrition + overtime cap: horn 41%→0, median ~19 min); unique-pair lean ACCEPTED with premium disclosure (Q69) |
| `blackwood` | ✅ PROMOTED — briefly regressed to 62% by the LANDSHIP FARM bug, fixed + restored to **51.0/48.3 (fair)** |
| `sawtooth` | 🔴 HELD — now ~**68% A**: the escort-wall fix lets working raids EXPRESS the structural lean (convicted same-seeds: 56.2 pre / 64.1 post). Q73 = hunt priority. Premium disclosed |
| `caldera` (circle map, item 40) | ✅ FIXED + **IDENTITY BLESSED (Q63)** — raider's clause off by map law; 54.3/51.7% in band; the 13-min elimination brawl IS the map |
| The 6-map bank | 📝 designed, unbuilt: archipelago, rail junction, urban grid, salt flat, highland ridge, fortress breach |
| Map rotation / voting | ✅ Q49/Q54 — end-screen map+mode pair voting, configurable pool (VOTE_MAPS/VOTE_MODES + /rotation) |

## Track D — Coordination & social

| Feature | Status |
|---|---|
| Context pings / public tasks / takeover confirms | ✅ `10c` / `11t` / `10b` |
| Recognition scoring + honors | ✅ `slice-11k` — rescue outranks kills |
| Category awards + death recap (B4/B7) | ✅ `slice-b4`/`slice-b7` — 8 deed counters, six honors (incl. BEST ESCORT per Q26 ruling), killer identity on the down banner |
| Quick-command wheel + auto-callouts (B5) | ✅ `slice-b5` — hold Q, full vocabulary, "thanks" ping, fog-reveal contact callouts |
| Persistent profiles / leaderboard | ⬜ V2.x — the premium MECHANISM landed; ranking premium still V2.x |
| Join flow / lobbies | 🔶 prompt 149 landed the real join screen: 2x team buttons, live team-balance gating (s_lobby, 2+ imbalance greys with tooltip, server-enforced), spectate/replay server config. Full lobbies stay V3 |

## Track E — Presentation & platforms

| Feature | Status |
|---|---|
| Direct control + targeting | ✅ `11l`/`11o` + **SURFACED prompt 149 (the Firepower homage)**: 🕹 button, low-ride zoom, howto toast, on-screen specials, ✕ EXIT; touch compass = mobile controls |
| Art rounds 1, 2c props, 2a faction palette, 2b motion, 2d baked sprites | ✅ `11q`, `14a`, `14b`, `14c`, `14d` |
| **Detail era (prompt 157)** | ✅ phases 1-3: terrain mesh v2 (blended, banded, semantic relief, AO, sheen) + species/verges/patches + low-detail mode + typed-node dressing + compound v2. 🔜 phase 4 units detail, phase 5 atmosphere |
| Base compounds / map detailing | ✅ `14g` |
| Field Encyclopedia | ✅ `14k` |
| Replay viewer / spectator | ✅ `11h` / `10a` |
| i18n (en + no) + a11y | ✅ `15b` / `15c` — key-identical catalogs enforced by test |
| Mobile touch | ✅ `slice-15a` + mobile RESILIENCE (139): token seat takeover, auto-rejoin, reconnect-on-visible |
| Fog-of-war sheen + mission UX | ✅ prompt 147 — the dark overlay's edge IS the spotting edge; mission banner + cards + rings for mode wars |
| Discovery (master server + global list) | ✅ `slice-15h` |
| **Client feel batch (playtest 8)** | ✅ `slice-18d` — honest centre-on-me, war clock, fog notice, right-drag pan, stats key |
| **Heading render fix (playtest 10)** | ✅ `slice-18h` — interpolator clobbered engine brads with radians: every mover rendered ~east since 9F; motion-facing on slides |
| Audio identity | 🔶 HUMAN COMPOSER SECURED — brief delivered (`specs/game-soundtrack-design.md` + shareable .html twin, 12 prioritized tracks); music toggle already ships; integration slice when tracks arrive. SFX stay synth-first |
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

**THE SYMMETRIC-TERRAIN ERA (2026-08-02, cff77cb) is the current
one** — frontier's terrain was never cell-symmetric before it, so
every earlier frontier number describes a map that no longer exists.
Current table (n=600/config): frontier 46.2/45.5% A (in band, small
team-keyed B tilt); blackwood 51.0/48.3 (fair); riverline 54.5/59.3
uniques-on with premium disclosure; sawtooth ~68% A (escort-wall
expression of its structural lean); caldera 54.3/51.7 in band;
POWS=2 **25-28% A (OUT OF BAND — the old 47% rested on terrain
luck)**; convoy attackers 39/64% (team-keyed). MODE WARS are a
different game — never mix their rows into standard baselines.
**A NEW ERA OPENS AT b5b5a69 (2026-08-03, the meeting-stop fix)**:
contact geometry changed for every hull on every map — all
pre-b5b5a69 numbers are last-era; the re-baseline pairs are queued
on the PC lane. Earlier eras (cell-centre reset, pool ladder,
crewing bug, people-era re-baseline) are archived in the skill and
dev-log.

## OMISSIONS REVIEW (prompt 163 — the step-back audit)

What the product has: a deterministic fair-measured engine, 5 maps,
11 chassis + factions, 3 modes, the POW arc, honors/premium/offsets,
voting, replays, spectator, discovery, mobile touch + resilience, fog
sheen, direct control, the detail-era art, i18n, a11y, encyclopedia,
lobby balance, and an industrial measurement lane. What it does NOT
have, in the order I would worry:

| # | Omission | Why it matters | Size |
|---|---|---|---|
| O1 | ✅ SHIPPED (164): sfx.js — 12 synth patches wired to the event stream, ⚙ toggle | — | — |
| O2 | ✅ SHIPPED (164): join-screen name field, transport registry via s_lobby, honors celebrate people | — | — |
| O3 | ✅ SHIPPED (164): the first-war coach — four timed beats, once ever, both locales | — | — |
| O4 | ✅ SHIPPED (171): `--difficulty easy|normal|hard` named presets + the join screen shows the host's AI level (s_lobby, both locales) | — | — |
| O5 | ✅ SHIPPED (164): 30s autosave + opt-in CLI resume (<10 min), hash-roundtrip pinned | — | — |
| O6 | ✅ SHIPPED (172): DEPLOYING.md playbook + tools/ssh-deploy.sh (multiciv's seven guards ported; host identity in gitignored deploy.env) | — | — |
| O7 | Text chat (comm wheel + pings exist) | Probably FINE for v2 — pings were the ruled design; note only | — |
| O8 | 🔶 HALF SHIPPED (176): first honest 4070 numbers — locked 144 Hz, min 143, and the art-detail era CUT triangles 65% (227k -> 79k) while raising the frame floor. Still vsync-capped: headroom + weak-hardware (MX550) runs outstanding | Numbers in tools/perf_native.md | user |

Recommended order: O2 (names — small, immediately warms every existing
system) → O1 (the SFX manifest; music integration follows the composer)
→ O3 (onboarding) → O4/O6 (host QoL) → O5.

## What is actually open

**WAVE 4 RULED (prompt 174) — see `plan-wave4.md`**: co-op-by-default,
rookie drone grace, POW/Landship mission cards, placement ghost,
direct-control juice, smoke screens, the UAV recognition-sink test,
POW-creating events (Q78), careers, night wars, Frontline Push.
Plan only — implementation awaits the Q77-Q81 sub-rulings and the
PC lane's era re-baseline verdicts.

1. **THE MERGED TEAM-KEYED HUNT — ROOT CONVICTED AND FIXED
   (prompt 170, b5b5a69)**: the line instrument proved pre-contact
   advance symmetric to a decimal and put the mover at FIRST
   CONTACT; the first-blood drill found every seed's first kill at
   t=546 on the exact centre column; the micro-trace convicted the
   MEETING-STOP LAW — sequential collision checks let the decisive
   tick's first mover park one speed quantum deeper (88 v 143 from
   the boundary) and eat mirror-support artillery 2 ticks early.
   Fixed: verdicts read start-of-tick snapshots; mirror-pair pin in
   test/collision_mirror.test.js (red pre-fix). The b5b5a69 pairs
   read FLAT (39.7/40.3 frontier_uq, 25.9/28.3 POWS=2) — correct
   fix, not the outcome channel — and exposed a SECOND phase-lock:
   Q18's lead-team emission was raw tick parity (fixed team led
   every mirror-synchronized exchange; Q71's partition was a dead
   switch enforcing the sort's own order). Fixed at a81477c: lead
   team = seeded hash bit of (tick, mapSeed); first blood now flips
   sides by seed. VERDICT (a81477c, n=300 pairs): frontier_uq
   **54.0/52.9% A — IN BAND BOTH WORLDS**; POWS=2 **39.4/36.4**
   (was ~26; residual epoch now a mid-war A-loss run t≈4250-5000 —
   the mid-war ledger is the next instrument). MPG wave-timing
   asymmetry filed. Sawtooth bench and heist bar decisions can now
   ride on a fair default baseline.
2. **Heist AI viability** — Q72 (siege prep) with you; humans have
   the getaway car already.
3. **Specials ladder** — both vault and cache engine-complete and
   homeless; Q67 (vault re-test) with you; frontier post-symmetry is
   the fair-map candidate.
4. **Music integration** — when the composer's tracks arrive (brief
   delivered; toggle ships).
5. **The Firepower homage, next steps** — direct control is surfaced;
   candidates: chase-cam polish, direct-fire feel, arcade HUD.
6. **User-side**: playtest the join flow + balance gate + 🕹 direct
   control + fog sheen + mission banners; sawtooth/riverline feel;
   rule on Q47/Q56/Q67/Q72/Q73.

## Open design questions (the clarify-and-design queue)

CLOSED since the last pass (full text in specs/07 + the git history):
Q46/Q59-Q61 (powPreplaced arc → 0), Q60/Q62/Q63 (caldera blessed),
Q64-Q66 (cache landed→pulled; mechanism kept), Q68 (blackwood
restored), Q69 (riverline premium accepted), Q70 (getaway: speed alone
insufficient — carry rule kept), Q71 (tick-parity inert), Q53 (two-lane
road walls landed), Q58 (cache brief delivered).

All five were delegated (prompt 151) and EXECUTED on data:

| # | Verdict |
|---|---|
| Q47 | The gap is THE UNIQUE PAIR (factionswap square, n=1200): Skimmer-led attacks +~35 pts regardless of team/direction (Sentinel 39/32, Skimmer 78/65). The BAR itself remains yours — but the axes are now honest: chassis value, not team bias |
| Q56 | BUILT, default OFF: light-hull regents within 12 cells claim the fortress under `rules.landshipAI` / LANDSHIPAI=1 — your playtest feel flips it |
| Q67 | ANSWERED: VAULTS=2 on symmetric terrain still convicts (41.7/42.3% A) — the vault's harm was never terrain luck; it stays pulled, ladder parked |
| Q72 | LANDED + MEASURED: the siege battery took heist attackers 8.0/3.7 → **12.7/9.3%** (n=600) — confirmed at scale; a tuning dial now, not a wall. Next rung if wanted: the unique axis (Skimmer-led heist) |
| Q73 | ANSWERED: uniques-off sawtooth is DEAD FAIR (48.5/45.1); factionswap fair (52.5/49.2) — the 68% is entirely the pair on home sides. Lever choice (per-map unique law / tune / premium-as-is) is a design call with clean data |
