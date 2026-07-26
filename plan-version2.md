# More Firepower — Version 2 Plan (status after the Rescue Update)

*Updated 2026-07-26 (suite 416/416, fixture v30). HTML twin:
`plan-version2.html`. Companion to `plan-version1.md` (v1: SHIPPED).
Sources: `specs/01–06`, `assets/asset-spec.md`, `phases/phase5–7`,
`specs/future/FUTURE_ROADMAP.md`, rulings in `dev-prompts.md` (prompts
12–25). Slice-by-slice detail: `plan-implementation-order.md` + reports.*

The V2.0 cut this file proposed — **"The Rescue Update"** — is
**essentially shipped**. This revision marks what landed, what changed
shape, and what genuinely remains.

---

## Track A — Roster & roles

| Feature | Status |
|---|---|
| Command Carrier | ✅ `slice-9a` — carrier-exclusive standard carrying, capacity-2 rescue bunks |
| Downed operators (full `operator_foot`) | ✅ `slice-9b` — crawl / redeploy / carrier rescue / delivery / auto-return; AI down-management |
| Scout Bike (courier) | ✅ `slice-11r` — cannot capture or contest; fastest standard recovery; AI courier doctrine `slice-11v` |
| Mortar Carrier (mobile indirect) | ✅ `slice-11s` — junior to artillery by pinned relative contract; AI replacement-fire-support doctrine |
| **Sentinel** (Warden unique) | ⬜ NEXT CAMPAIGN — deployable area denial; breaks mirror symmetry BY DESIGN, gated by the mirror sweep |
| **Infiltrator** (Freehold unique) | ⬜ NEXT CAMPAIGN — amphibious raider; the riverline river becomes its highway; likely the real fix for riverline standard runs |
| Factions (Warden/Freehold identity) | ⬜ arrives WITH the unique pair |
| NPC infantry layer + POWs (Q4) | ⬜ V2.x |

## Track B — Battlefield systems

| Feature | Status |
|---|---|
| Mines | ✅ `slice-9e` + AI mining/clearing doctrine `slice-11d` |
| Anti-camping drone | ✅ `slice-9g` (ruling Q7) — first flying entity |
| Minimum Playability Guarantee | ✅ `slice-9d` — Slow Manufacture wreck-rebuild |
| Damaged sites + materiel | ✅ `slice-11f` — artillery-only siege (explicit flag), truck repair loop; **depots/garages as distinct site types still open** |
| Path terrain (dirt roads/trails) | ✅ `slice-11n` — per-chassis (heavy tanks excluded); light-chassis trail patrols `slice-11v` |
| Second map: riverline | ✅ `slice-11m` + bridge relay pair `slice-11w`. **OPEN: standard-run viability** — wars there stay horn-bound; candidates: standard homes nearer the road, raider route bias, or accept as the points-war map until the Infiltrator opens the river |
| Fuel/munitions transfer (full cargo) | ⬜ V2.x — materiel shipped; the rest of the truck's cargo manifest remains |
| Route graph & congestion | ⬜ V2.x |
| Fog ghosts (last-known contacts) | ⬜ V2.x |
| Convoy events | ⬜ V2.x |
| Q2b held-standard point bleed | ⏸ armed, deferred until HUMAN standoffs appear |

## Track C — Coordination & social

| Feature | Status |
|---|---|
| Context pings | ✅ `slice-10c` + vocabulary growth + AI pings `slice-11d` |
| Public tasks | ✅ `slice-11t` — fog-safe view-model cards; "responding" rides the ping channel; explicit responder counts remain V2.x |
| Takeover confirmations | ✅ `slice-10b` |
| Rescue autopilot option (Q8) | ✅ `slice-11g` — ⚙ toggle, B board / U unboard |
| Recognition scoring | ✅ `slice-11k` — ruled table, rescue > kill, end-screen honors; persistent per-PLAYER profiles/leaderboard remain V2.x |
| Join flow / lobbies | ⛔ VERSION 3 by ruling (no-lobby stays the entry point) |

## Track D — Presentation & platforms

| Feature | Status |
|---|---|
| Direct control (Firepower homage, Q10) | ✅ `slice-11l` + targeting circle & aim-assisted clicks `slice-11o` — all chassis |
| Chase cam | ⏸ ruled (a) fixed tactical cam now, (b) rotating chase cam WITH the perspective pass later |
| Art round 1 (upgraded procedural) | ✅ `slice-11q` — APPROVED; mine/drone in the factory; 22-tile strip |
| **Art round 2c: battlefield props** | 🔜 IN QUEUE (ruled first) — trees/rocks/dressing for terrain readability |
| **Art round 2a: faction palette pass** | 🔜 IN QUEUE (ruled second) |
| Art round 2b: motion (tracks, recoil, tracers, rotor blur) | 📝 NOTED for later (prompt 25) |
| Art round 2d: baked sprite fallbacks | 📝 NOTED for later (prompt 25) |
| Camera/diorama pass (35–55°) | ⬜ V2.x — pairs with chase cam |
| Spectator | ✅ `slice-10a` |
| Replay viewer | ✅ `slice-11h` — local re-simulation, byte-exact scrubbing |
| Audio identity system | ⬜ V2.x (synth cues remain) |
| Mobile & touch (arrow steering per Q10) | ⬜ V2.x |
| Localization & accessibility | ⬜ V2.x |
| Roblox/Luau twin, native port | Horizon |

## Track E — Meta & live ops

| Feature | Status |
|---|---|
| Ops hardening | ✅ `slice-11j` — rate limits, /version; ws-upgrade limits & feature flags remain V2.x |
| Batch-PC lane + sim harnesses | ✅ `slice-11p` — agent-mail jobs, true mirror mode, sweep analyzer |
| Telemetry & heatmaps | ⬜ V2.x (`/metrics` is the seed) |
| Profiles/leaderboard (persistent) | ⬜ V2.x |
| Achievements, modding, custom modes, campaign, tournaments | ⬜ V2.x / Horizon (unchanged) |

## The open balance/design questions

Live list: `reports/2026-07-26_rulings_round2.md` (Q17+). Highest value:
**question 18** (directional arithmetic residue — the batch-PC mirror
census will give the verdict), riverline standard-run viability (above),
AI artillery siege doctrine (nobody shells relays yet), and depots as a
distinct damaged-site class.

## Version 3 (parking lot — needs play experience first)

Lobbies/matchmaking as an OPTIONAL entry beside the no-lobby flow;
whatever sustained multi-human sessions prove the game still needs.
