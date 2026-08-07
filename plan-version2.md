# Fireline Command — Version 2 Plan (status board)

*Updated 2026-08-06 (suite 894/894, fixture v71 — LIVE at
https://fireline.kjell.today since 2026-08-05; wave-4 ledger in
`plan-wave4.md`, now W4-1..8 + W4-10 + W4-12 tutorial + W4-13 golden line shipped,
remaining W4-9 + W4-11 now tracked in plan-version3.md). HTML twin:
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
| Underdog premium (58/68) | ✅ MECHANISM LIVE, **TABLE EMPTY AGAIN (2026-08-05)** — the phase-lock fixes retired both convictions (sawtooth 54.8/54.4, riverline 47.0/51.0), so both entries were pulled; a premium without a live lean is a lie the briefing repeats. Outcome-neutral (recognition only) |
| Fog ghosts / convoys | ⬜ V2.x |

## Track C — Maps

| Profile | Status |
|---|---|
| `frontier_corridor` | ✅ DEFAULT — **terrain mirror-BY-CONSTRUCTION since prompt 143** (it never was, cell-level; ~1,600 asymmetric pairs/seed for 5 weeks); symmetric-era baseline **46.2/45.5% A (in band)** |
| `riverline` | ⚠️ EXPERIMENTAL — **pacing SOLVED** (stalemate attrition + overtime cap: horn 41%→0, median ~19 min); **now measures FAIR (47.0/51.0 on a81477c)** — the Q69 lean is gone and its premium was pulled; east curse down to ~4 pts |
| `blackwood` | ✅ PROMOTED — briefly regressed to 62% by the LANDSHIP FARM bug, fixed + restored to **51.0/48.3 (fair)** |
| `sawtooth` | ✅ **FIXED BY THE PHASE-LOCK FIXES (2026-08-05)** — 54.8/54.4 on a81477c (was 69.3/67.1). Its tight chokes made the most head-on meetings, so it amplified the two contact-law bugs hardest. HOLD CAN LIFT (Q75 answered by measurement). **The +25% premium is now a lie about the map — pulling it is the next slice** |
| `caldera` (circle map, item 40) | ✅ IDENTITY BLESSED (Q63) — raider's clause off by map law; the 13-min elimination brawl IS the map. **Contact-law re-baseline: 45.0/44.5** — the only profile leaning to B, mirror arm a hair under the band floor. WATCH (evidence for Q74, not a chase) |
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
| **Tutorial quest-line (W4-12)** | ✅ prompt 192-200 — intro/tour/12 deferrable quests detected from REAL play; supersedes the O3 coach (SKIP falls back to it); ⚙ replay |
| **The Golden Line** | ✅ prompt 201 — untried mission-card kinds wear gold until first engaged (mf_goldline, cross-war) |
| **Seats resurrected** | ✅ prompt 202 — the stations client UI had thrown on first touch since it shipped (unimported helper); J-join/hover-ads/call-a-gunner banner live; import-reality lint guards the class |
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
| **MOBILE ERA (prompts 211-215)** | ✅ on-screen KEY BAR (context ≤11 keys, gray/blink laws, taps=real keydown, ping buttons), body.mobile layout (screenshot-driven, min(px,vh) anchors), HOLD-tap waypoint, screen-aligned touch compass, faction glyph op-info, runaway-corner fix, ⚙ Connection check |
| **Public how-to page** | ✅ Q90 (216) — /howto.html field manual linked from the join screen |
| Camera/diorama + chase cam | ⬜ V3 |
| Native perf numbers | 🔜 RUNNER WORKS — `tools/perf_native.ps1` (+ `perf_native.sh` from WSL, docs in `tools/perf_native.md`); a run succeeded on the PC, **numbers not yet collected** |
| Roblox/Luau twin | Horizon |

## Track F — Meta & live ops

| Feature | Status |
|---|---|
| Ops hardening, /version, rate limits | ✅ `slice-11j` |
| Batch-PC lane (agent-mail jobs, CSV mail home) | ✅ `11p` + per-map `map` job + self-update with autostash |
| **LIVE at fireline.kjell.today** | ✅ 2026-08-05 — gitignored ops lane, shared cert lineage x6, port 8131; sibling guide TRACKED (deploy-new-sibling-game-in-box-dos-and-donts.md) |
| **Crash/memory posture** | ✅ prompt 206 — atomic autosave, V8 heap capped below MemoryMax, REPLAY_KEEP retention, rssMb + tickJitter on /health(z) |
| **Resource + host instruments** | ✅ 207-208 — profile_run (heap ≤66MB/war, ~1% core; humans = CPU not RAM), host_probe candidate verdict |
| **Connectivity** | ✅ prompt 214 — heartbeat 5s→30s + logged kicks (the drop suspect), client netDiag + ⚙ verdict |
| Telemetry & heatmaps | ⬜ V3 (`/metrics` + tickJitter + netDiag are the seeds) |
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

## What is actually open (2026-08-07 — the LIVE era)

**V2 IS EFFECTIVELY CLOSED.** The game is deployed, onboarded (tutorial
+ golden line + how-to), mobile-playable, fair on its default map both
worlds, and instrumented end to end. What remains on THIS board:

1. **Map promotions to the voting circle** — sawtooth needs one fresh
   300-war pair on HEAD + the owner's choke playtest; riverline its
   pending pair + bridge-feel playtest; caldera a pair that either
   climbs in-band or gets ruled acceptable for a brawl map. Then three
   one-line COMPLETED_MAPS additions. THE FIRST PC-LANE SLATE.
2. **POWS residual** — raid-party census (queued SECOND on the lane):
   name what inside the party is team-keyed; suspect = rebuild
   overshoot. Also filed: MPG wave-timing, east-pusher residual.
3. **O8 second half** — uncapped + weak-hardware perf runs (user-side).
4. **Music integration** — when the composer delivers.
5. **Owner playtests** — mobile round 5 (Connection-check verdict on
   any drop), tutorial re-run, sawtooth/riverline feel for promotion.

Everything FORWARD-looking lives in **plan-version3.md** (careers,
Frontline Push, siege prep, the 6-map bank, homage completion,
live-service growth).

## Rulings ledger (current)

Q74-Q92 all resolved — tolerance band (Q74), sawtooth in band (Q75),
convoy scale 80 (Q82), raid carrier-gate (Q83), deep-down human-only
(Q84), tutorial-real (Q85), heist bar 25-40 + siege prep GO (Q87),
census queued (Q88), careers-first (Q89), how-to shipped (Q90),
golden-line design dissolved Q91/Q92. Full text: specs/07 +
dev-questions.md (gitignored working file). NOTHING awaits a ruling —
the next owner decisions are playtest-driven (promotion feel checks).
