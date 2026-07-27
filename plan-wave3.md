# More Firepower — Wave 3 Plan (the living-world completion)

*Written 2026-07-26 (prompt 26), while playtest 5 runs. Companion to
`plan-version2.md` (status board) and `plan-implementation-order.md`
(history). This is the DESIGN-AHEAD document for everything commissioned
in prompt 26; nothing here is built yet. Slices numbered phase 12–15 by
track, but the ORDER OF EXECUTION is the dependency ladder at the end.*

---

## Track F — Factions + special units + NPC/POW (phase 12)

The centerpiece, and the one gated on the designer conversation.

### 12A–12D: Factions & the unique pair

| Slice | Scope |
|---|---|
| **12A Faction plumbing** | `FACTIONS` config (id, name, color scheme, roster diffs); team → faction binding in state (hashed); views expose faction identity; client briefing/labels/end-screen speak faction names; faction palette round 2 rides this (Track H). No gameplay change yet — pure identity. |
| **12B Sentinel** (Warden unique) | New chassis, `deployable: true` contract flag: `deploy`/`undeploy` commands with a transition timer; DEPLOYED = immobile, range/damage/armor bonus, counts for capture/contest; mobile = weak. The area-denial anchor. Fielding: replaces one Warden garage slot. |
| **12C Infiltrator** (Freehold unique) | New chassis, `amphibious: true` contract flag — water/river cells traverse at path speed (the 11N per-chassis terrain pattern, third use). Likely the real riverline fix: the river becomes Freehold's highway. v1 = mobility only; sensor disruption (ECM) is a later slice once there is a sensor system to disrupt. |
| **12D Faction balance campaign** | Asymmetry is BY DESIGN, so fairness needs a new instrument: the **faction-swap sweep** (same seeds, factions trade sides) on the batch PC, alongside the mirror sweep. Acceptance: win rates within an agreed band across BOTH transforms. |

**Questions the designer conversation should answer (12-Q):**
1. Names confirmed? (Warden vs Freehold / "Freeholder"?) Which team
   color becomes which faction, or do factions get NEW colors?
2. Sentinel numbers: deploy time (~3 s?), deployed range (artillery-
   class 3072 or its own tier?), damage/hp mobile vs deployed.
3. Infiltrator v1: amphibious-only acceptable, or must sensor
   disruption ship with it? (My strong lean: mobility first, ECM later.)
4. Do the uniques replace a garage slot (like bike/mortar) or ADD an
   asset (roster 17 per team — breaks several pinned counts)?
5. Any faction flavor beyond units — different standard art, base
   dressing, audio timbre? (Cheap once 12A exists; needs the call.)

### 12E–12G: NPC layer, POWs, convoys

| Slice | Scope |
|---|---|
| **12E NPC foot layer** | `state.npcs`: AI-only foot entities (site guards first) — spawn at owned relays, short patrol, shoot at close enemies (light), die into nothing (no seats). Reuses the downed-entity movement machinery. Hashed, fog-filtered like assets. |
| **12F POWs** (ruled Q4: with NPC layer) | An ENEMY carrier may board an enemy downed operator → POW aboard; deliver to own base → Recognition award + the victim seat's redeploy gate LENGTHENS (capture stings but never removes a player). Rescue-vs-abduction races over every bail-out. **12F-Q: exchange mechanic (POWs swap on war end? held at a site raidable for release?) — designer input wanted.** |
| **12G Convoys** | Periodic NPC supply convoy (2 NPC trucks + escort guards) runs a route between a team's base and a relay; arrival = supplies/points, interdiction = denial. Spawns public task cards on BOTH sides (escort/intercept). Depends on 12E + Track G's route graph for pathing. The spec's "threatened convoy" moment. |

## Track G — Logistics depth & world model (phase 13)

| Slice | Scope |
|---|---|
| **13A Full cargo** | Truck manifest beyond materiel: `{fuel, ammo, materiel}` slots (hashed); auto-load at base; `transfer_cargo` command to an ADJACENT friendly asset (field rearm/refuel). Numbers to tune: truck tankage ~2400 fuel + 12 ammo — enough to keep one artillery position alive, not a whole push. Balance risk: field resupply weakens the base-return rhythm — sim-gate war tempo. |
| **13B AI resupply runner** | New truck errand between tow/repair jobs: top off the thirstiest supplied-area teammate (artillery/mortar first). Makes 13A matter with 1–2 humans. |
| **13C Route graph** | Per-profile seeded node/edge graph (base exits, bridge ends, relay approaches; edges tagged road/trail/open/rough with integer costs). Pure module + deterministic Dijkstra. **Consumers in order:** AI movement (waypoint chains replace straight lines — finally closes "AI ignores paths"), then convoy routing, then `fast` vs `safer` preferences. The biggest AI behavior change since capture-seek — lands behind its own 5-seed + sweep gate. |
| **13D Dynamic edge states** | Mined/damaged/contested edges re-cost the graph (the spec's open/slowed/blocked/dangerous ladder). AI starts ROUTING AROUND marked minefields — mine play becomes area denial for real. |
| **13E Fog ghosts** | Client-only: last-seen enemy contacts fade over ~10 s at their last position (pure ghost-store model + tests; renders as translucent hulls). Strictly legitimate knowledge — nothing new crosses the wire. Cheap, ships any time. |

## Track H — Presentation completion (phase 14)

| Slice | Scope |
|---|---|
| **14A Props round 2 (2c cont.)** | Site dressing: relay antenna clutter + supply-radius ground ring, base pads (garage/repair-bay markers where rebuilds/repairs happen), riverline water shading + bridge rails, standard plinths. Same deterministic props_model pattern. |
| **14B Faction palette round 2 (2a cont.)** | Rides 12A: faction-owned base hulls (not just blend-tint): per-faction paint definitions in style tokens, insignia DECALS on team panels (canvas-generated textures from the faction symbol), faction-colored standards/beacons. |
| **14C Motion pass (2b, noted→planned)** | All client-side, event-driven: track/wheel scroll illusion (material map offset), turret recoil kick on fire_resolved, shell-arc tracers for indirect fire (the mortar/artillery READ), drone rotor blur disc, dust puffs while driving. One slice per batch of three effects. |
| **14D Baked sprites (2d, noted→planned)** | Extend the strip renderer to bake per-chassis rotation sheets (16 headings); a 2D sprite renderer fallback that auto-engages when WebGL is absent or the perf harness's fps floor (batch-PC data) says so. Also the seed of the minimap unit icons. |
| **14E Camera pass** | The 35–55° diorama read (playtest-2 note "low-poly Syndicate"): perspective camera option with three zoom tiers, subtle tilt; **chase cam (ruled b-later, now planned)**: in direct-drive mode the camera sits behind the tank and rotates with smoothed heading. Needs the motion pass first or driving feels static. |
| **14F Audio identity** | Replace placeholder synth: audio manifest (chassis × event → patch) mirroring the asset manifest; per-chassis engine loops pitch-bent by speed, weapon voices, the recovery arc stinger set (spec §17); adaptive intensity layer driven by nearby-event density from the OWN view only (fog-safe). **Open call: stay synthesized (WebAudio patches, zero assets, always ships) vs source sample packs (better, needs licensing) — recommend synth first, samples as drop-in later, same manifest.** |

## Track I — Platforms & reach (phase 15)

| Slice | Scope |
|---|---|
| **15A Mobile touch** | Ruled in Q10: on-screen steering arrows (tank sets off in arrow direction, tap the unit to stop) = a touch skin over the 11L drive-intent command; tap-orders via the existing click mapper; pinch zoom; layout scale for small screens. Pure input-mapper extensions, testable headless. |
| **15B i18n** | Extract every user-facing string (feedback_model, labels, cards, banners, briefing) through a `t()` table; `en` + `no` first. The string TABLE ships before any second language — extraction is the work. |
| **15C a11y** | High-contrast mode, UI font scaling, screen-reader live region for the event feed, keybind remapping in the ⚙ panel (colorblind-safe team symbols already shipped in tokens). |

## Execution ladder (dependencies, not calendar)

```
DONE 2026-07-27:          13E fog ghosts ✅ · 14A props r2 ✅ · 15B strings part 1 ✅ (part 2: describeEvent lines + static pages)
DESIGNER RULING LANDED:   12A factions ✅ (Directorate/Outliers) · 12B Sentinel ✅ (Deploy Hardpoint) · 12C Skimmer ✅ (Riverline Drive, T_WATER)
NEXT GATE:                12D faction-swap sweep campaign on the BATCH PC (the pair is UNTUNED); 14B faction palette r2 now unblocked
ALSO DONE 2026-07-27:     15B part 2 ✅ (events/end/briefing en+no) · 13A cargo + 13B resupply runner ✅ (sim gate PASS) · 15C a11y ✅ (contrast/scale/keybinds)
DAY SESSION 2026-07-27:   16A tick-parity fairness ✅ (Q18 CLOSED, A 49.8%) · 13G difficulty presets ✅ (RULES= env) · riverline census ✅ (standard-viable 19%; east edge traced NOT to terrain — generator was already symmetric — but to floor-div movement arithmetic, fixed next day) · 16B unique crewing+Sentinel doctrine built but DORMANT (chassis gate passes 53.1%; unexplained ~12pt TEAM-linked A-edge → UNIQUES=1 sweeps to chase)
PROMOTED SAME DAY:        14C motion batch 1 ✅ (recoil·tracers·dust·rotor) · 14D baked sprites ✅ (sheets+2D fallback+minimap seed; fps auto-engage awaits PC perf data) — batch 2 (track scroll) open
AFTER DESIGNER TALK:      12A factions → 12B Sentinel → 12C Infiltrator → 12D balance campaign
                          └→ 14B faction palette r2
INDEPENDENT ENGINE LANE:  13A cargo → 13B resupply AI
BIG ONE (own campaign):   13C route graph → 13D dynamic edges → 12E NPCs → 12G convoys
                                                              └→ 12F POWs (needs 12E only)
PRESENTATION LANE:        14C motion → 14E camera/chase → 14F audio → 14D baked sprites
PLATFORM LANE:            15A mobile → 15C a11y (15B feeds both)
```

Rule of thumb held throughout: engine slices carry the sim gate; AI
behavior changes carry the 5-seed campaign AND a batch-PC sweep; faction
work carries the faction-swap sweep. Everything lands one tagged slice at
a time with the 1A fixture guard deciding what is a schema change.
