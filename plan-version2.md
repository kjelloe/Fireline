# Fireline Command — Version 2 Plan (status board)

*Updated 2026-07-29 (suite 547/547, fixture v40). HTML twin:
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
| Unique crewing + band tuning | ✅ 16B/16E/prompt-56 — uniques crew BY DEFAULT; normal-world split 51.3% |
| AT satchel (downed crew) | ✅ `slice-16f` |
| NPC infantry layer + POWs | ⬜ **12E/12F — the biggest unbuilt gameplay item.** POW mechanic RULED (raidable holding site); needs the NPC layer first |
| Multi-crew "Landship" | ⏸ POST-V1 FLAGSHIP (designer eval #5) — needs a seat-model rework |

## Track B — Battlefield systems

| Feature | Status |
|---|---|
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
| **Bridge demolition (riverline)** | ✅ `slice-13e-bridges` — artillery breaches, span becomes water (Skimmer answer), either-team repair; **AI doctrine deferred to 13E-2** |
| Meaningful deaths (B1) | ⬜ ruled — a disable costs a ticket unless the wreck is recovered |
| Mercy + overtime (B3) | ⬜ ruled — small victory-logic slice |
| Typed node classes (B2) | ⬜ ruled — RADAR / DEPOT / FACTORY personalities per site |
| Salvage economy | ⬜ ruled (designer eval #1); may be reshaped by B1 first |
| Last Convoy finale | ⬜ ruled (designer eval #7) |
| Fog ghosts / convoys | ⬜ V2.x |

## Track C — Maps

| Profile | Status |
|---|---|
| `frontier_corridor` | ✅ DEFAULT — 8-relay lane+lateral web, band-tuned baseline (51.3% A) |
| `riverline` | ⚠️ EXPERIMENTAL — west lean collapsed to ~58/42 by the map-aware majority; re-measure after 13E bridges |
| `blackwood` | ⚠️ EXPERIMENTAL — `slice-18a`; local gate passed, quiet positional identity; **never playtested by a human** |
| `sawtooth` | ⚠️ EXPERIMENTAL — `slice-18b/c/e`; pacing now excellent (horn 60%→13%) but a **team-linked faction lean re-opened with it**; see specs/10 §4 |
| The 6-map bank | 📝 designed, unbuilt: archipelago, rail junction, urban grid, salt flat, highland ridge, fortress breach |
| Map rotation / voting | ⬜ FILED (prompt 64) — server option, minimap thumbnails per candidate, or "next map" on the end screen |

## Track D — Coordination & social

| Feature | Status |
|---|---|
| Context pings / public tasks / takeover confirms | ✅ `10c` / `11t` / `10b` |
| Recognition scoring + honors | ✅ `slice-11k` — rescue outranks kills |
| Category awards + death recap (B4/B7) | ⬜ ruled, filler-sized |
| Quick-command wheel + auto-callouts (B5) | ⬜ ruled — client-side atop pings |
| Persistent profiles / leaderboard | ⬜ V2.x — includes the underdog-faction ranking premium (prompt 58) |
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

## What is actually blocking progress

1. **PC worker** — idle on an old commit with a diverged checkout, so no
   300-war battery has run and no experimental map can be promoted. One
   manual fix on the PC, then it self-heals (autostash).
2. **Sawtooth fairness** — pacing is now excellent, but the faction lean
   returned with it. Needs 18F.
3. **Blackwood has never been played by a human** — its identity measured
   well; whether "quiet" reads as tense or dull is a play question.
4. **Designer calls** — the numbered questions in
   `reports/2026-07-29_maps_and_playtest8.md`.

## Version 3 (parking lot)

Lobbies/matchmaking as an OPTIONAL entry beside the no-lobby flow;
whatever sustained multi-human sessions prove the game still needs.
