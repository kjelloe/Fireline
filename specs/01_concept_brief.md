# Recovery Front — Concept Brief

**Working title:** Project Alpha: Recovery Front  
**Status:** V1 concept baseline  
**Platforms:** Fullscreen browser (desktop and mobile); Roblox considered after the browser/mobile loop is proven.

## 1. High concept

A drop-in, drop-out, top-down team warfare game set in a stylised retro-futurist fictional conflict. Players join an active 20–30 minute operation, take control of one vehicle or an AI-regent asset, and contribute immediately to a shared team battle.

Combat matters, but the defining experience is **recovery**: rescuing downed operators, towing disabled vehicles, restoring damaged sites, protecting convoys, reopening routes, denying salvage, and helping a losing team recover.

The game is a new IP and a spiritual successor in feel only. It does not reuse the world, art, names, or content of earlier games.

## 2. Design promise

> Join an active battle, understand what the team needs, take one useful asset, and help turn the situation around—whether you play for two minutes or the whole operation.

A player joining a losing side should see actionable opportunities: a damaged depot, a stranded assault vehicle, a threatened convoy, a broken route, a downed operator, or a command-standard carrier that needs escort or interception.

## 3. Core pillars

| Pillar | Meaning |
|---|---|
| Recovery is heroic | Disablement, towing, repair, rescue, retreat, and salvage denial are high-value play, not chores. |
| Live operations, no mandatory lobby | Players join active seeded battles and select work through an in-world tactical overlay. |
| One asset, many ways to matter | A player controls one active asset at a time and can switch at friendly operational sites. |
| Accessible tactical teamwork | Public missions, pings, status signals, and AI coordination make voice/text optional. |
| Readable tactical diorama | The battlefield is clear at mobile scale and rich in physical objectives, routes, terrain, and state changes. |
| Fair drop-in/drop-out warfare | AI regency preserves assets and missions; teams can be pressured but never locked out of play. |

## 4. Target experience

| Area | V1 target |
|---|---|
| Human players | 2–16 per operation |
| Active world entities | At least 32 meaningful human + AI entities |
| Operation duration | Approximately 20–30 minutes |
| Participation duration | 0–30 minutes; short useful participation is valid |
| Input | Mouse, touch/tap, pinch zoom, double-tap; controller support where practical |
| Multiplayer | Join active public operations, join friends, LAN/local, and single-player with AI |
| Battle tone | Light, accessible team competition; deeper competitive and arcade variants are future work |

## 5. Setting, factions, and visual direction

The world is a stylised retro-futurist tactical diorama: chunky vehicle silhouettes, compact industrial landmarks, strong terrain separation, and physical signs of damage, repair, supply, and recovery. The tone is adventurous and tense rather than grim or realistic.

Two mechanically near-symmetrical teams use distinct silhouettes, materials, architecture, audio, insignia, and one unique asset each.

| Aspect | Wardens — working label | Freeholds — working label |
|---|---|---|
| Identity | Organised territorial security force | Mobile frontier alliance / breakaway coalition |
| Shape language | Broad, stable, squared, fortified | Low, agile, angled, modular |
| Materials | Enamel armour, clean panels, concrete compounds | Patched alloy, fabric panels, adapted industrial sites |
| Audio identity | Dense machinery, disciplined radio tones | Rougher engines, modular tools, signal/static textures |
| Unique asset | Sentinel defensive platform | Infiltrator amphibious electronic-warfare raider |

Final faction names, lore, insignia, and visual samples remain open.

## 6. Battle structure and win condition

Every operation uses a fresh validated seed and progresses through opening, mid-operation, endgame, then brief debrief and turnover.

| Phase | Purpose |
|---|---|
| Opening | Secure routes and nearby sites; establish supply and map awareness. |
| Mid-operation | Raids, escorts, recoveries, repairs, sabotage, rescues, and site struggles create shifting fronts. |
| Endgame | Higher-value missions, command-standard events, and score pressure resolve the operation. |
| Debrief / turnover | Results and contributions are shown; remaining players enter a new operation promptly. |

The first team to the score threshold wins. Capturing and returning the enemy **Command Standard** is the highest-value event, while logistics, recovery, defence, reconnaissance, and site work remain meaningful score sources.

## 7. Join flow and first-minute experience

Players normally enter through a short tactical drone view showing score, time, team condition, recommended task, alternatives, and suitable assets. A **Spawn Now** button bypasses inspection and deploys the player immediately in an appropriate basic asset at an eligible friendly site.

Example briefing:

> Team Freeholds are trailing by 105 points. Delta Depot is damaged and an enemy convoy is approaching the central road. Recommended: Deploy Logistics Truck — Restore Delta Depot.

The intended first minute:

1. Read a concise live-operation summary.
2. Accept a suggested task, choose another public task, or take over an AI-regent asset.
3. Receive a route and immediate contextual control hint.
4. Perform a useful action: move, scout, fire, escort, repair, supply, recover, or rescue.
5. See visible contribution progress.

## 8. Asset roster

Each player controls one active asset. Switching is free at friendly operational sites, subject to asset availability.

| Asset | Role | Key actions |
|---|---|---|
| Assault Vehicle | Direct combat and route pressure | Area fire, suppression, mine deployment, site/cargo defence |
| Scout Buggy | Reconnaissance and rapid response | Reveal contacts, detect mines, mark safe routes, harass exposed targets |
| Command Carrier | Rescue and protected transport | Extract downed operators; move specialists/POWs; escort valuable cargo |
| Logistics Truck | Recovery, repair, salvage, and supply | Tow wrecks, repair assets/sites, transfer supplies, clear routes |
| Sentinel | Warden unique stabilisation asset | Deploy for defensive area control and recovery-site protection |
| Infiltrator | Freehold unique raider | Use limited amphibious routes, disrupt sensors, raid exposed infrastructure |

## 9. Minimum Playability Guarantee

A pressured or supply-starved team must always be able to participate. The Home Base maintains a **Slow Manufacture** reserve that periodically provides basic useful assets regardless of wider supply status.

Supply affects forward deployment, full repair/rearm, heavy rebuilds, unique-asset availability, and operational efficiency. It must never create a `no vehicles available` state for a joining player.

## 10. Combat, direct fire, disablement, and recovery

Combat rewards position, reconnaissance, terrain, escorting, and operational timing rather than precision twitch aiming.

### Area-directed direct fire

Players command fire at a ground location or target area rather than needing to select an individual unit. On browser, the player clicks a world point; on mobile, they tap a world point. A double-tap can indicate priority/urgent action. The asset aims or fires according to facing, range, terrain, line of sight, and weapon rules.

Area fire may suppress, damage, force repositioning, engage visible units, or threaten likely enemy cover. The UI always displays the intended target area with a clear reticle or ground marker.

### Wreck objects

Disabled vehicles remain as persistent **Wreck Objects** until repaired, towed, salvaged, or cleared aside where rules permit. This creates battlefield history and meaningful route problems without allowing permanent road griefing: maps include alternatives, recovery access, and limited heavy clearance.

### Downed operators

When appropriate, a disabled asset produces a downed operator. The player may fast redeploy after a short delay (target: about 10 seconds), wait for Command Carrier recovery, or automatically return after a longer timeout (target: about 60 seconds). Downed operators can call for help and move minimally to cover; they are not a separate action-game class.

## 11. Sites, supply, and objectives

Sites are functional physical locations, not abstract capture circles.

| State | Meaning |
|---|---|
| Operational | Friendly and basically functioning; supports rallying and asset switching. |
| Damaged | Friendly but service is reduced until repaired. |
| Supplied | Fully functioning; supports stronger repair, rearm, recovery, and deployment. |
| Cut off | Friendly but disconnected from supply; services are limited. |
| Sabotaged | Deliberately disrupted; requires logistics, repair, or clearance. |

Key site types include Home Base, Forward Depot, Garage, Relay, Radar Station, Fuel Facility, Bridge/Crossing, Specialist Camp, Village/Outpost, and Field Uplink.

## 12. Coordination, audio, and music

Coordination is possible without required voice or open text chat. V1 uses public missions, a small contextual ping set, `On my way` confirmations, asset/site status signals, tactical overlays, AI task labels, short radio alerts, and captions.

Audio is tactile and retro-industrial: route confirmation clicks, tow-cable clunks, repair-tool rhythms, rescue beacons, vehicle-specific engine/tool signatures, and site power-up sequences. Recovery and restoration receive the same dramatic attention as combat.

Music is restrained and adaptive: synth, mechanical percussion, warm textures, and distinct motifs for operations, recovery, command-standard events, comeback momentum, and results.

## 13. Recognition

End-of-operation results show a **Contribution Bar** that values verified team-positive work.

| Category | Examples |
|---|---|
| Combat | Defending allies, suppressing threats, disabling hostile assets |
| Logistics | Delivering supplies, supporting convoys, restoring services |
| Recovery | Towing, repair, rescue, salvage denial |
| Reconnaissance | Detecting mines, revealing threats/routes, reporting targets |
| Objective | Capturing, defending, escorting, extracting strategic objectives |

Non-mechanical **Battle Honors** celebrate memorable styles of play, such as Field Mechanic, Elite Escort, Last-Line Defender, Routefinder, Rescue Pilot, and Standard Guard.

## 14. V1 boundaries

V1 includes one core Operation Mode, browser/mobile usability, seeded validated maps, two teams, five core player assets, two unique assets, AI support/regency, recovery and supply systems, physical command-standard capture, and short debrief-to-next-operation turnover.

V1 deliberately defers persistent territory, ranked mode, deep progression/power, broad text/voice chat, player economy, large content rosters, player-controlled aircraft, elaborate campaign lore, and the Roblox implementation.

## 15. Success statement

The concept succeeds when a player can quickly understand what is happening, what their team needs, which asset can help, and why recovery is exciting. The desired memory is:

> I joined when our side was collapsing, got a truck to the depot under fire, recovered a disabled assault vehicle, and we turned the battle around.
