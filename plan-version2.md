# More Firepower — Version 2 Plan (the rest of the design)

*Written 2026-07-26 (marker-0038). HTML twin: `plan-version2.html`.
Companion to `plan-version1.md`. Sources: `specs/01–06`, `assets/asset-spec.md`,
`phases/phase5–7` plans, `specs/future/FUTURE_ROADMAP.md`, and user requests
logged in `dev-prompts.md`.*

V1 delivers the Command Standard war. V2 is everything else the design
documents describe, grouped into five tracks and ordered so each slice makes
the previous ones richer. Priorities: **V2.0** (the next coherent release),
**V2.x** (after it), **Horizon** (documented, not scheduled).

---

## Track A — Roster & roles completion (specs 01 §8, 02 §4/§9)

| Feature | Tier | What it is |
|---|---|---|
| **Command Carrier** | V2.0 | Rescue/protected transport chassis: extracts downed operators, moves specialists/POWs, **takes over the standard-carrying role** (carrier_heavy class, big footprint, needs suitable crossings). Takeover of a carrier mid-task requires confirmation (spec 02 §9). |
| **Downed operators** | V2.0 | RULED (Q3): FULL walking `operator_foot` entities — disabled asset may produce a downed operator that can move short distances to cover, call for help; fast redeploy (~10 s), Command Carrier rescue, or auto-return (~60 s). POW capture arrives with the NPC layer (Q4). |
| **Sentinel** (Warden unique) | V2.x | Deployable defensive platform: anchor/deploy-lock for area control and recovery-site protection. First faction-unique asset. |
| **Infiltrator** (Freehold unique) | V2.x | Amphibious EW raider: water lanes, sensor disruption/ECM, sabotage of exposed infrastructure. Needs Track B water + sensor systems first. |
| **Factions: Warden vs Freehold** | V2.x | Faction identity (unique assets, audio timbre, visual trim) replacing plain team A/B — spec 01 §5. |
| **NPC infantry layer** | V2.x | AI-only foot units (`npc_foot`): site guards, engineer crews, support squads, specialists/POWs, civilians. Cover-seeking, bounded; never player-micromanaged (spec 02 §4). |

## Track B — Battlefield systems depth (specs 01 §10–11, 04 §3–5)

| Feature | Tier | What it is |
|---|---|---|
| **Mines** | V2.0 | Assault Vehicle deploys, Scout detects, minefields as authoritative entities that block/damage and demand clearance work — dynamic risk on routes. |
| **Route graph & congestion** | V2.x | Seeded node/edge network (roads, forks, bridge ends, passes) with edge states: open / slowed / blocked / dangerous / mined / damaged / contested; `fast` vs `safer` route preferences; congestion costs. |
| **Bridges, crossings, water lanes** | V2.x | Crossing conditions per movement class; amphibious lanes for the Infiltrator; mud/slope constraints for wheeled classes. |
| **Cargo & materiel economy** | V2.0 | Logistics cargo transfer: fuel, materiel, munitions, operators, specialists, standard cargo; site repair/restoration; salvage and salvage-denial. Turns the truck from tower into a full logistics role. |
| **Sites beyond relays** | V2.0 | Depots and repair sites with damaged/restorable states; **Minimum Playability Guarantee**: home-base Slow Manufacture reserve so a starved team always gets basic assets (spec 01 §9). |
| **Fog ghosts** | V2.x | Last-known enemy contacts rendered as fading ghosts; terrain/structures stay known after discovery (spec 02 §7) — strictly presentation of legitimately known info. |
| **Convoy events** | V2.x | Escort/interdict convoys as public tasks — the "threatened convoy" moment from the concept brief. |

## Track C — Coordination & social (spec 02 §14–15)

| Feature | Tier | What it is |
|---|---|---|
| **Context ping system** | V2.0 | Tap a world target → compact context-sensitive ping strip (a standard carrier sees `Need escort`/`Carrier under attack`; a towing truck sees `Recovery in progress`). Anti-spam: merge, expire, rate-limit. |
| **Public tasks** | V2.0 | Mission markers with responder state: `Recover Assault Vehicle — 2 responding — escort requested`; AI regents may respond using only what they legitimately know. |
| **Join flow & balance** | V2.x | Entry options: join active operation (balance-aware battle picker), join friend, local/LAN; team-balance protection; operation turnover between wars. |
| **Takeover confirmations** | V2.0 | Confirm before assuming assets in consequential states (carrying the standard, towing high-value wrecks, transporting specialists). |

## Track D — Presentation & platforms (spec 02 §16–17, asset-spec, roadmap ph. 10)

| Feature | Tier | What it is |
|---|---|---|
| **Art Slices B–E** | V2.0 | Painted GLBs (standard, four-chassis kit, wrecks), order/selection markers, capture VFX, canvas sprite-fallback renderer. Pipeline is ready (`assets/PIPELINE.md`); models drop in with zero code changes. |
| **Camera/diorama pass** | V2.0 | Fix the "low-poly Syndicate" read (playtest 2): 35–55° angle, isometric bias, three zoom tiers per the art spec §3. |
| **Direct tank control mode** | V2.0 | Firepower homage (ruled Q10): WASD + mouse aim with CHASE CAM; gamepad later; mobile variant uses on-screen steering arrows (tank sets off in arrow direction, tap the unit to stop). Client input mode over the command stream; engine turn-rate model (Wave 1) feeds the feel. |
| **Audio identity system** | V2.x | Per-asset movement/tool/damage voices (spec 02 §17 table), the recovery sound arc, adaptive fog-safe music intensity. Replaces the synth placeholder cues. |
| **Mobile & touch** | V2.x | 6C touch overlay (virtual stick, tap orders, pinch-zoom) → roadmap 10B app wrapper later. |
| **Localization & accessibility** | V2.x | 7A string tables (en/no first); 7B colorblind matrices (team symbols already shipped in tokens), high contrast, screen-reader announcements, keybind validation. |
| **Roblox/Luau twin engine** | Horizon | The specs' founding constraint (Lua-portable engine subset) cashed in: a Luau port proven by the shared fixtures — 0A–0E vectors were built for exactly this parity test. |
| **Native core port (C++/Rust)** | Horizon | Roadmap 10A; only if scale demands it. |

## Track E — Meta, live ops & community (phases 5–7, roadmap ph. 8–9)

| Feature | Tier | What it is |
|---|---|---|
| **Full player profiles & leaderboard** | V2.0 | 5B beyond reconnect: per-player wins/recoveries/captures on disk, simple leaderboard; feeds Recognition (spec 01 §13 — recovery deeds score, not just kills). |
| **Achievements** | V2.x | 7C registry, cosmetic-only rewards, per-player progress files. |
| **Map variety & rotation** | V2.x | 5C: second map profile first (proves the registry), then biome palettes, rotation schedule, map voting. |
| **Campaign / offline skirmish** | V2.x | 5D mission chains with special win conditions + roadmap 10C offline mode vs AI. |
| **Telemetry & heatmaps** | V2.x | 6B: extends the shipped `/metrics` with per-match archives and combat heatmaps for balance work. |
| **Modding: schemas, editor, workshop** | V2.x | 6E + roadmap 8A/8B: JSON unit/rule schemas (data/units.json mirror is the seed), safe mod validation, replay-compatible manifests, browser map editor, share/workshop API. |
| **Custom game modes** | V2.x | Roadmap 8C: victory-condition plugins (KOTH, survival…) around the existing checkVictory seam. |
| **Spectator & replay viewer** | V2.0 | Roadmap 9A/9B: explicit spectator role with explicit view rules; a client mode that plays archived logs through the local reducer — the engine's best property, finally visible. Timeline/analysis later. |
| **Tournaments/ladders** | Horizon | Roadmap 9C, after spectating and profiles exist. |
| **Ops hardening** | V2.x | 7E remainder: rate limiting on ws upgrades, FNV-based feature flags, version manifest endpoint. |

## Suggested V2.0 cut (one coherent release)

> **"The Rescue Update"** — Command Carrier + downed operators + cargo/depot
> economy + mines + pings/public tasks + takeover confirmations, wrapped in
> the painted art pass (Slices B–E + camera), with spectator/replay viewer,
> profiles/leaderboard, and the direct-control homage mode.

That cut completes the spec's core promise ("the defining experience is
recovery") while staying inside systems the engine already hosts seams for.
Estimated 12–16 slices at the established cadence.

## Design rulings (2026-07-26, dev-prompts prompt 12)

1. **No-lobby stays THE entry point.** Lobbies/matchmaking move to
   **Version 3**, to be revisited only after real play experience (see below).
2. **Artillery is confirmed** as a permanent roster member.
3. **Standard carrying goes Command-Carrier-exclusive when the Carrier
   ships** — validated FIRST by AI-only backend simulations. The harness now
   exists: `npm run simwar` runs full AI-vs-AI standard wars (objective
   doctrine: designated raiders, carriers escorting home, per-team
   recoverers, lazy role reassignment). Early sim findings already logged:
   mutual-steal standoffs are possible, relay ownership can churn tick-to-
   tick when contested, and raider death without reassignment stalls the
   war — all inputs to the Carrier-exclusive evaluation.
4. **Anti-camping role: modern DRONE recommended** (pending veto) over a
   literal Firepower helicopter — fits the new-IP rule, the toy-diorama
   aesthetic (rotor toy on a stick), the Infiltrator/EW systems track, and a
   cheap unmistakable silhouette; the helicopter can return later as a skin
   or faction variant. Mechanic sketch: idle too long outside your supply
   umbrella → an autonomous harassment drone spawns from the nearest enemy
   relay, pesters (light damage, breaks suppression camping), expires or is
   shot down. Deterministic, seeded, engine-side.

## Also queued from playtests (engine feel)

- **Vehicle heading & turn-rate model (V2.x)** — playtest 3: axis-major
  movement makes units wiggle at near-diagonals. Client-side gradual-turn
  smoothing shipped as mitigation (marker-0039); the real fix is authoritative
  heading state with per-chassis turn rates (also unlocks the direct-control
  homage mode's feel).

## Version 3 (parking lot — needs play experience first)

- Lobbies/matchmaking (old 5E) as an OPTIONAL entry beside the no-lobby flow.
- Whatever the LAN/balance sessions prove the game still needs.
