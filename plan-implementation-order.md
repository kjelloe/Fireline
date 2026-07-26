# Implementation Order — v1 close-out through V2

*Written 2026-07-26 (marker-0040). Orders the remaining `plan-version1.md` +
`plan-version2.md` items by dependency and by what can be verified in backend
sims while art/design runs in parallel. Flags where design is missing and
where user/designer rulings are needed (questionnaire at the end).*

## Ordering principles

1. **Engine before client** — every mechanic lands headless + sim-verified
   (`simwar`) before its UI, so design evaluation never waits on art.
2. **Design-blocked items are flagged, not scheduled** — slices only enter a
   wave once their questionnaire items are answered.
3. **No-design-needed engineering** (spectator/replay viewer, ops hardening)
   fills the gaps whenever a design answer is pending.
4. Art production (painted GLBs) runs as a **parallel track** — the pipeline
   consumes models whenever they appear, zero code changes.

---

## Wave 0 — v1 close-out (now)

| # | Item | Status / blocker |
|---|---|---|
| 0.1 | Playtest 3: full loop (steal → lose unit → truck rescue → war end → rotation) | **User** — in progress |
| 0.2 | Balance pass P1-G from `/metrics` + replays (`/playtest-report`) | needs 0.1 data |
| 0.3 | Fix whatever 0.1 surfaces; then tag **v1.0** | — |

## Wave 1 — Rescue Update core (engine, sim-verifiable)

| # | Slice | Depends on | Design state |
|---|---|---|---|
| 1.1 | **Command Carrier chassis** (`canCarryStandard` flag on all chassis; carrying rule flip; simwar A/B old-vs-new rule) | new-chassis skill | **DESIGN NEEDED**: Q1, Q2 |
| 1.2 | **Downed operators** (disable → operator entity/timer, redeploy ~10s / rescue / ~60s return) | 1.1 (Carrier rescues) | **DESIGN NEEDED**: Q3, Q4 |
| 1.3 | **Cargo & materiel economy — slim cut** (truck carries cargo, repairs sites, salvages wrecks) | — | **DESIGN NEEDED**: Q5 |
| 1.4 | **Depots + Minimum Playability Guarantee** (Slow Manufacture reserve) | 1.3 (materiel) | design mostly in spec 01 §9; cadence numbers needed (Q5) |
| 1.5 | **Mines** (tank deploys, scout detects, clearance) | — | **DESIGN NEEDED**: Q6 |
| 1.6 | **Engine turn-rate model** (authoritative heading, per-chassis turn rates) | — | numbers only (Q11); unblocks 3.3 feel |
| 1.7 | **Drone anti-camping** | Q7 confirmation | **DESIGN NEEDED**: Q7 (air-unit targeting is new ground) |

Every Wave-1 slice ends with a `simwar` campaign across seeds — that is the
"simulate plays in the backend" methodology now standard.

## Wave 2 — Coordination & meta (server + client)

| # | Slice | Depends on | Design state |
|---|---|---|---|
| 2.1 | **Spectator role + replay viewer** | — | no design blockers — the gap-filler while Wave-1 questions are open; can start ANYTIME |
| 2.2 | **Takeover confirmations** | 1.1 | clear from spec 02 §9 |
| 2.3 | **Context pings** | — | vocabulary per context in spec 02 §14; v2.0 subset choice is ours |
| 2.4 | **Public tasks** | 2.3, 1.2 (rescue tasks) | **DESIGN NEEDED**: task auto-generation rules (proposal below) |
| 2.5 | **Profiles/leaderboard + Recognition scoring** | — | **DESIGN NEEDED**: Q8 (score table) |
| 2.6 | Ops hardening (rate limits, feature flags, version manifest) | — | none — gap-filler |

## Wave 3 — Presentation (parallel track, merges when assets exist)

| # | Slice | Depends on | Design state |
|---|---|---|---|
| 3.1 | **Art B/C: painted GLBs** (standard, 4-chassis kit + Carrier, wrecks) + GLTFLoader preload | asset production | **CLARIFICATION**: Q9 (who makes models?) |
| 3.2 | **Camera/diorama pass** | none (do with 3.1 or before) | pick the angle together in-game (Q10) |
| 3.3 | **Direct tank control mode** | 1.6 improves feel | **DESIGN NEEDED**: Q10 |
| 3.4 | Art D: order/selection markers, capture VFX | 3.1 style | follows art spec §13 |
| 3.5 | Art E: canvas sprite fallback renderer | 3.1 sprites | mechanical |
| 3.6 | Audio identity pass | asset sourcing (Q9) | spec 02 §17 is detailed |

## Wave 4+ — after the Rescue Update (V2.x, needs its own design rounds)

Route graph & congestion → bridges/water → Infiltrator; factions identity doc
→ Sentinel; NPC infantry design doc; fog ghosts; convoys; map variety;
campaign/offline; telemetry heatmaps; modding/workshop; mobile; i18n/a11y.
**Version 3**: lobbies (after play experience). Horizon: Luau twin, native
port, tournaments.

---

## Where more design work is needed (my proposals, ready to challenge)

- **Carrier-exclusive deadlock** (sim finding): if carrying is
  Carrier-exclusive and a team has no operable Carrier, a grounded enemy
  standard is untouchable. Proposal: any chassis may *return own* dropped
  standard (touch), but only Carriers *take* the enemy standard; standards
  auto-return home after N ticks grounded in enemy hands' territory — no
  permanent deadlock. → Q2.
- **Downed operators slim model**: keep them abstract-but-visible — a downed
  marker entity at the wreck (no combat, no pathing beyond a crawl-to-cover
  offset), rescued by Carrier drive-over, else timer. Full `operator_foot`
  movement later. → Q3.
- **Cargo slim model**: ONE resource ("materiel") carried as a single cargo
  slot on trucks; spend to repair damaged sites/depots; salvage wrecks you
  can't tow for partial materiel. Fuel/munitions transfer later. → Q5.
- **Public task auto-generation**: tasks spawn from events (wreck created →
  "Recover X", standard dropped → "Secure the standard", site damaged →
  "Repair Y"), expire when resolved; players/AI mark "responding". No
  player-authored tasks in v2.0.
- **Mines slim model**: tank carries 2 mines, deploy on own cell, arms after
  N ticks, triggers on enemy entry (heavy damage + suppression), visible to
  owning team always + to scouts within sensor range; scouts "mark" them
  (team-visible), trucks clear adjacent marked mines. → Q6.
- **Drone**: spawns from nearest enemy-owned relay when a unit idles > ~30 s
  outside its own supply umbrella; flies straight (ignores terrain), light
  repeated damage, any unit may fire at it, despawns after M ticks or when
  target moves. First flying entity: needs a `flying` flag exempting terrain
  speed/blocking and maybe its own LOS rule. → Q7.

## Questionnaire — ANSWERED 2026-07-26 (dev-prompts prompt 14)

All twelve ruled. Deviations from defaults: **Q3** full walking
`operator_foot` entities (not the slim marker — slice 1.2 grows); **Q9** (b)
upgraded procedural models PLUS a committed demo asset-strip PNG for human
assessment (`npm run strip` → `client/assets/preview/asset_strip.png`);
**Q10** chase cam for direct control (not tactical), gamepad later, and
mobile gets on-screen steering arrows (tank drives off in arrow direction,
tap the unit to stop). Everything else: defaults confirmed.

### Original questionnaire (for the record)

| # | Question | My default if you just say "go" |
|---|---|---|
| **Q1** | Command Carrier stats: hp/speed/armament? Spec says "defensive burst" — can it fight at all? Carrying capacity (how many downed operators/specialists at once)? | hp 120, speed 24, dmg 5/range 768/reload 25, capacity 2, canTow false |
| **Q2** | Carrier-exclusive carrying: accept my anti-deadlock proposal (any chassis returns OWN standard; auto-return after N grounded ticks)? N = ? | yes; N = 600 ticks (60 s) |
| **Q3** | Downed operators v2.0: abstract-but-visible marker (my proposal) or full walking `operator_foot` entity? | marker version first |
| **Q4** | Can enemies capture downed operators (POW mechanic, very Firepower)? v2.0 or later? | later (V2.x), design with NPC layer |
| **Q5** | Cargo slim cut: single "materiel" resource only in v2.0? Slow Manufacture cadence (asset every ~90 s when starved?) | yes; 900 ticks |
| **Q6** | Mines: 2 per tank, heavy damage (60?), owner-visible, scout-markable, truck-clearable — numbers OK? | as listed |
| **Q7** | Confirm DRONE over helicopter. Trigger: idle >30 s outside own supply umbrella? Can every chassis shoot it? | drone; 300 ticks; yes |
| **Q8** | Recognition score table: propose tow-complete 8, operator rescue 10, standard return 10, standard capture 25, relay 10, kill 5 — rescue > kill per spec. OK? | as listed |
| **Q9** | Painted GLBs: who produces them? (a) designer/artist delivers files, (b) I build better procedural/generated models in code, (c) commission externally. Determines the whole Wave-3 timeline. | (b) upgraded procedural until files arrive |
| **Q10** | Direct-control mode: keyboard WASD-drive + mouse-aim? Camera chase or stay tactical? Gamepad in scope? | WASD+mouse, tactical cam, no gamepad v2.0 |
| **Q11** | Turn-rate model in Wave 1 (better feel now, feeds direct control) or defer to Wave 3 with direct control? | Wave 1 (1.6) |
| **Q12** | Second map profile: before the Rescue Update (variety for playtests) or after? | after |

Answer any subset — numbered answers ("Q1: default, Q7: 20s...") are enough.
Everything unanswered proceeds on the stated default when its wave arrives.

---

## Round-2 rulings — ANSWERED 2026-07-26 (dev-prompts prompt 16)

All sixteen night-session questions ruled. Design theme set by the user:
**"We want the game world to be as alive as possible even with 1 or 2
humans playing."** Alive-world work (AI doctrine) therefore outranks new
human-facing systems in the order below.

### Phase 11 — the Living World round (slice order)

| # | Slice | Rulings | Notes |
|---|---|---|---|
| 11A | **Artillery turn retune** | Q4 | turnRate 5 → 2 (~6.4 s half turn). One-line + pins. |
| 11B | **BF2 capture countdown** | Q3 | Contested = frozen. One team alone on a relay drains it to neutral (~3 s), then captures it (~3 s). Per-site progress hashed; step lengths configurable constants. |
| 11C | **AI doctrine: hunt & guard** | Q1, Q2d, Q14 | Role-based garage crewing (any ROLE unfilled → crew a free asset, not just fixed pairings); fire doctrine prioritizes enemy standard-carriers; a unit stung by a drone shoots it down. |
| 11D | **AI doctrine: alive world** | Q11, Q16 | Tanks mine chokepoints near owned relays; recoverer truck clears marked mines on its route; regents ping (raider need_escort, recoverer recovery_in_progress, scout mines_detected). Vocabulary grows: carrier_under_attack, road_blocked, safe_route. |
| 11E | **AI rescue play** | Q5 | AI carriers pick up downed operators, AI trucks tow wrecks — LANDS ONLY IF the sim campaign shows it works and helps (compare seat health + war tempo across seeds vs 11D baseline). |
| 11F | **Damaged sites + materiel (9C revived)** | Q9 | Relays/depots get hp; artillery can shell them (damaged sites stop projecting supply/capturing); trucks haul ONE materiel slot from base to repair. Design detail below. |
| 11G | **Rescue autopilot option** | Q8 | Boarding/delivery stays automatic by default; gear/settings UI toggle; manual mode gets explicit board/unboard via hover icon (engine: per-operator autoRescue flag in hashed state + board/unboard commands). |
| 11H | **Replay viewer** | Q15 | Client scrubber over the /replays store, reusing the spectator view path (10A shipped the live half). |

Deferred by ruling: **Q2b** held-standard point bleed (arm it only if HUMAN
standoffs appear in playtests); **Q6** carrier special weapons (mortar /
sniper / spike-drop) — v2.x armament round; **Q8 hover-icon polish** beyond
the minimal toggle if playtests demand more.

### 11F design sketch (damaged sites, per Q9)

- Sites gain `hp` (relay 60?) in hashed state; artillery `fire_order` may
  target a site id (indirect siege role). At 0 the site is DAMAGED: stops
  projecting supply, cannot be captured or flip, keeps its owner.
- Trucks pick up 1 `materiel` at their home base (auto-load when idle in
  base, like resupply), drive to a damaged site, auto-repair over ~5 s —
  site returns at full hp. The truck role becomes tow + clear + repair.
- MPG stays as-is (independent guarantee). Salvage-for-materiel deferred.
- Open detail to confirm before building: can HOME BASES be shelled?
  (proposal: no — bases stay sacred, only relays/depots.)
