# Recovery Front — Detailed Systems Document

**Status:** Design baseline for technical workthrough. Exact values and data schemas remain to be specified.

## 1. Simulation and architecture constraints

The game is built around a pure deterministic reducer:

$$apply(state, command) 
ightarrow state$$

The authoritative simulation has no I/O, wall-clock reads, hidden state, or non-deterministic randomness. Timed systems use simulation ticks. Any randomness uses a state-held deterministic PRNG. The browser client, Node.js server, headless simulator, and later Luau twin use the same ruleset intent.

| Constraint | Design consequence |
|---|---|
| State target under 1 MB | Compact entity/site state; generated terrain reconstructed from seed and ruleset. |
| 32 meaningful active entities | AI doctrine must be lightweight and bounded. |
| Browser/mobile networking | Small commands, fog-filtered deltas, interpolation/prediction outside authoritative rules. |
| Roblox parity later | Core logic remains Lua-portable and avoids platform-specific simulation behaviour. |

## 2. Core battle state

The exact schema is a technical-workthrough item. Conceptually, state contains:

- Ruleset/version and deterministic seed/sub-seeds.
- Tick and phase information.
- Team score, supply network state, and command-standard state.
- Compact entity records: owner/team, asset type, position, orientation, health/state, task, cargo, and short path/action state.
- Site records: owner, operational state, health/service bits, inventory/network status, and relevant progress.
- Active mission records: type, target, priority, progress, responder references, and expiry.
- Visibility/discovery state required to produce team-filtered views.
- Deterministic PRNG state and bounded event/notification queues where needed.

The terrain is regenerated from seed rather than stored as a full map payload. The server remains authoritative and sends fog-filtered views/deltas.

## 3. Command model

The command vocabulary must remain small, validated, and target-area friendly. Candidate high-level verbs:

| Command family | Purpose |
|---|---|
| Move / route | Set destination, route preference, retreat/return behaviour. |
| Area fire | Aim or fire at a world area; simulation resolves valid weapon use. |
| Interact | Capture, repair, supply, dock, load, unload, activate, sabotage. |
| Recovery | Attach tow, detach, repair, salvage, clear wreck. |
| Cargo | Transfer fuel, materiel, munitions, operator, specialist, or standard cargo. |
| Stance | Change permitted asset behaviour such as cautious, defend, or priority action. |
| Ping / respond | Create a bounded contextual team signal or acknowledge a mission. |
| Deploy / takeover | Claim an eligible asset or deploy at an eligible operational site. |
| Redeploy | Select fast redeploy from the downed state. |

The technical workthrough must define exact identifiers, payloads, validation rules, command sequencing, and replay encoding. Names above are conceptual, not final API names.

## 4. Entity and combat rules

### Assets and ownership

One player controls one active asset. Assets can be human-operated, AI-operated, AI-regent after player departure, available, reserved, disabled, recovering, or unavailable/rebuilding.

### Direct fire

Weapons act on target areas/locations, within weapon-specific range, facing, line-of-sight, terrain, and cooldown constraints. The simulation must clearly distinguish valid visible contact, speculative suppression, and invalid blind fire according to final rules.

### Disablement and wrecks

A disabled vehicle becomes a Wreck Object. Wrecks persist until repaired, towed, salvaged, or cleared. They are both mission targets and route modifiers. Their collision/blocking representation must remain simple and deterministic.

### Infantry/NPC boundary

Infantry is a compact AI tactical layer: site guards, support/assault squads, engineer crews, specialists/POWs, and civilians/outpost groups. They seek cover, engage known threats, and retreat. Players do not micro-manage squads in V1. Vehicle operators may become downed operators but do not gain a full infantry combat kit.

## 5. Recovery, supply, and economy

Three team-owned operational resources are visible in V1:

| Resource | Uses | Typical source/transport |
|---|---|---|
| Fuel | Vehicle readiness, depot service, distance operations | Fuel network and logistics cargo |
| Materiel | Repairs, restoration, heavy rebuilding, infrastructure | Logistics cargo and salvage |
| Munitions | Rearming assault assets and defensive systems | Depot network and logistics cargo |

No personal player currency exists in V1. Home Base slow manufacture guarantees baseline playable vehicles. Heavy and unique assets are scarce, recoverable, and slower to replace.

A desired state chain for friendly sites is capture/secure → repair → supply → full service. Supply scarcity limits efficiency and forward capability but not basic participation.

## 6. Map generation

Each battle uses a validated seed. Generation selects a map personality, places fair home zones, builds terrain barriers, constructs a route graph, places sites/objectives, then validates the theatre.

| Requirement | Intent |
|---|---|
| Fair home zones | Comparable early reachability and at least two independent exits. |
| Multiple routes | Fast/exposed and slower/concealed options; central lanes, flanks, cross-links. |
| No spawn trap | No single mandatory crossing or trivially locked home route. |
| Supply and recovery access | Important sites and wreck-prone areas remain recoverable. |
| Comeback space | Fallback positions and raid/flank opportunities remain after central loss. |
| Standard-route balance | No trivially short, hidden, or unavoidable command-standard path. |

V1 starts with one fixed logical map size and a small set of topology templates. Biome dressing adds identity without undermining route guarantees.

## 7. Fog of war and team information

The authoritative server computes valid visibility and provides fog-filtered views. Terrain/buildings may remain known after discovery; enemy entity updates stop outside legitimate vision. Last-known contacts may be represented as fading ghosts according to final rules.

Team-wide information is intentionally selective:

- Command Standard movement is always team-visible.
- Major friendly recovery/rescue/supply needs may become public tasks.
- Radar/relay infrastructure can share legitimate contacts.
- Mine detection is local/nearby first and may become temporarily shared.
- AI task/status is team-readable.

No sound, UI, AI, or music system may leak information that the team has not legitimately detected.

## 8. AI and regency

AI uses bounded deterministic doctrine, not hidden stat advantages.

| Doctrine | Purpose |
|---|---|
| Defend | Hold sites/routes, use cover, retreat before irreversible loss. |
| Patrol | Scout routes and report valid contacts. |
| Escort | Protect cargo, carriers, recovery units, or key routes. |
| Supply | Run valid logistics routes and request protection when threatened. |
| Recover | Prioritise disabled assets and safe extraction. |
| Raid | Target exposed relays, fuel, convoys, or weak sites. |
| Regency | Preserve an absent human's task when safe; otherwise return or defend conservatively. |
| Reserve response | Support base threats and viable comeback missions. |

AI obeys fog, terrain, supply, disablement, recovery, and combat rules. Difficulty scales through decision quality, route choice, timing, target priority, and coordination—not arbitrary health/damage/vision bonuses.

## 9. Join, leave, takeover, and lifecycle

Joining players receive a concise tactical briefing, optional drone view, recommended task, and asset choices. `Spawn Now` permits immediate deployment.

Eligible AI-regent assets may be taken over. Confirmation is required for especially consequential states such as carrying the Command Standard, towing a high-value wreck, or transporting specialists.

When a player leaves, AI regency continues safely: complete a safe interaction, preserve escort/recovery where viable, retreat when heavily threatened, and prioritise secure return of strategic cargo. Reconnecting players may reclaim an eligible asset if not already claimed by another human.

## 10. Coordination and audio implementation intent

V1 coordination consists of a small ping vocabulary, public tasks, responder indicators, AI labels, radio alerts, captions, and map markers. Repeated nearby pings merge and expire; mission markers outrank ordinary pings.

Audio must be state-derived and fairness-safe. It provides command confirmation, asset identity, damage/recovery cues, site ambience, and critical operation alerts. Essential information always has a visual equivalent.

## 11. Scoring and recognition

Team score comes from verifiable outcomes: objective work, recovery, logistics, reconnaissance, defence, and combat. Command Standard capture/return is the largest individual score event.

Personal contribution is categorised rather than reduced to eliminations. Battle Honors are non-mechanical labels derived from meaningful contribution patterns.

## 12. Testing and telemetry

The reducer/replay layer should record data sufficient to evaluate:

- Join-to-first-command and join-to-first-contribution time.
- Mission acceptance, completion, and abandonment.
- Asset selection and support-role uptake.
- Disabled-asset outcomes: repair, tow, salvage, abandonment.
- Downed-operator redeploy versus rescue outcomes.
- Comeback attempts and success rate.
- Score-source distribution and command-standard impact.
- AI/human contribution and regency outcomes.
- Battle/endgame duration, seed win rate, and route usage.
- Mobile command rejection/mis-tap indicators.

## 13. Explicit V1 non-goals

No physics engine, large persistent path histories, full RTS ally control, ranked queues, persistent territorial campaign, deep power progression, broad open chat/voice chat, player economy, or advanced Roblox-specific implementation is required for V1.

## 14. Detailed coordination and public-task system

### Design objective

Strangers must coordinate effectively without mandatory voice or open text chat. The simulation communicates urgent operational needs; players reinforce that information with concise pings and visible commitments.

### Information-sharing matrix

| Information | Individual | Nearby allies | Whole team |
|---|---:|---:|---:|
| Exact route/current target | Yes | Yes | Only when attached to a public mission |
| Enemy directly observed by an asset | Yes | Yes | Fading contact if validly relay/radar linked |
| Radar-derived approximate contact | No | No | Yes, while supporting radar is operational |
| Mine detection | Yes | Yes | Temporarily shared when marked |
| Disabled friendly asset | Yes | Yes | Public recovery task when valuable or threatened |
| Downed-operator beacon | Yes | Yes | Public rescue task when appropriate |
| Friendly site state / supply need | No | No | Yes |
| Command Standard status/movement | No | No | Always |
| Major convoy or specialist extraction | No | No | When confirmed or threatened |
| AI-regent task/status | No | Nearby allies | Through team task/unit information |

Enemy information loses precision or expires when valid observation is no longer maintained. The exact contact ageing values are a balance item.

### Public-task priority

| Priority | Examples | Presentation |
|---|---|---|
| Critical | Home base threatened; Command Standard stolen; friendly standard carrier endangered | Strong map pulse, concise alert, radio/caption callout |
| Urgent | Valuable wreck at salvage risk; carrier/convoy under attack; depot under raid | Prominent mission card and map marker |
| Important | Restore depot; escort fuel; repair bridge; extract specialists | Standard task marker and suggested mission |
| Opportunity | Scout flank; investigate route; sabotage relay | Small marker, shown when seeking work |
| Background | Routine patrol or minor transfer | Usually AI-managed; not pushed broadly |

### Core ping set

Keep the default player-visible set to eight or fewer universal pings.

| Ping | Typical target | Purpose |
|---|---|---|
| Attack / engage | Enemy, convoy, site | Focus attention on a known threat |
| Defend | Site, route, carrier, base | Ask allies to protect an area or asset |
| Need escort | Self, convoy, tow, standard carrier | Request protection during exposed work |
| Need recovery | Wreck or downed operator | Request repair, towing, or extraction |
| Need supplies | Vehicle or site | Request fuel, materiel, or munitions |
| Enemy spotted | Enemy, route, site | Mark meaningful contact |
| Route / move here | Terrain location or crossing | Suggest rally, route, or flank |
| On my way | Existing task or ping | Commit to respond visibly |

Context replaces irrelevant options. For example, a Command Standard carrier sees `Need escort`, `Carrier under attack`, and `Returning standard`; a Logistics Truck towing a wreck sees `Recovery in progress`, `Need escort`, and `Road blocked`; a Scout at mines sees `Mines detected` and `Safe route marked`.

### Interaction and anti-spam rules

- Tap/click a world target, then choose a compact context-sensitive ping strip.
- A future long-press shortcut may expose the full ping set but is not required for V1.
- Ordinary pings expire quickly unless attached to an active public task.
- Similar pings near the same target merge instead of stacking.
- Repeated individual pings are rate-limited by a short cooldown.
- A task can show responder state, for example: `Recover Assault Vehicle — 2 responding — escort requested`.
- AI may respond to eligible high-priority public tasks, but only using information it legitimately knows.
- Public mission markers always visually outrank ordinary pings.

## 15. Detailed join flow, team balance, and operation turnover

### Entry choices

| Entry option | Intended use |
|---|---|
| Join active operation | Default online route; choose a battle with room, live objectives, and reasonable effective balance |
| Join friend | Join the friend’s current battle and normally their team, subject to balance protection |
| Local / LAN operation | Self-hosted lightweight-server play |
| Single-player operation | Full seeded operation with one human and AI operators |

### Team-assignment rules

1. Prefer the team with fewer humans where this does not create an implausible effective-force imbalance.
2. Consider useful active assets and current operational pressure, not human count alone.
3. Avoid automatically placing players on a substantially winning side.
4. Honour friend joining when it does not severely worsen balance.
5. When a friend team is strongly advantaged, present a transparent choice between joining them and joining the recovery side.

### Asset availability states

| State | Meaning |
|---|---|
| Available | Unassigned and ready for a human or AI operator |
| AI operating | Active under AI; eligible for takeover where permitted |
| Reserved | Being deployed/reclaimed by a player |
| Disabled | Immobilised and needs repair, towing, or salvage resolution |
| Recovering | Being repaired, towed, or returned to a service site |
| Unavailable | Lost, rebuilding, or restricted by site/supply state |

### AI takeover safeguards

Instant takeover is normally allowed for idle, patrol, return, defence, or ordinary public-mission AI assets. Confirmation is required when an asset is carrying the Command Standard, transporting specialists/POWs, towing a valuable wreck, or in a critical capture/combat interaction. Confirmation must show the operational consequence clearly.

### Leaving and reconnection

| Departure state | Conservative AI-regency behaviour |
|---|---|
| Idle or travelling | Continue a safe route or return to the nearest operational friendly site |
| Defending | Hold defensively; call for support; retreat before avoidable loss |
| Escorting | Continue conservatively while the protected objective remains viable |
| Repairing / supplying | Finish a safe current interaction, then return or continue the public task |
| Carrying Command Standard | Prioritise secure return, avoid unnecessary fights, alert the team |
| Carrying specialists | Seek a safe extraction route and request escort |
| Towing | Continue only on a safe route; otherwise hold and request escort |
| Disabled / downed | Remain a recovery objective until resolved or expired |

A reconnecting player sees the prior asset’s current status and may reclaim it if it remains AI-regent, eligible, and unclaimed by another human. The world continues rather than pausing for the absent player.

### Endgame and late joining

Late joiners should be offered immediately relevant work: escort/intercept a Command Standard carrier, defend or restore a threatened site, recover a high-value wreck, open a route, repair a bridge, sabotage sensors, or deliver emergency supplies. The operation remains joinable until its result is formally locked.

### Result and turnover

At score threshold or decisive resolution: resolve legitimately in-progress objective interactions within a short bounded window; stop new combat commitments; show result, decisive event, operation highlights, contribution categories, Battle Honors, and a concise chronicle; then offer stay, join friend, new operation, or leave. Remaining players enter the next seeded theatre without a long waiting room.

## 16. Detailed art direction and asset-production requirements

### Readability rules

| Rule | Requirement |
|---|---|
| Silhouette before texture | Asset role is identifiable before fine detail is visible. |
| Function has visible language | Relays are tall, garages have large doors, fuel sites have tanks/pipes, depots show cargo/service activity. |
| State changes are physical | Damage smokes/sparks; supplied sites show activity; cut-off sites quieten; sabotage is visibly signalled. |
| Team ID is redundant | Colour is combined with icon shape, markings, lights, banners, and silhouette. |
| Objectives are dramatic | The Command Standard is a substantial physical object with a clear signal, never a tiny pickup. |
| Combat remains legible | Effects cannot obscure tap targets, status, or route choices. |
| Mobile first | Assets and state markers are tested at minimum intended screen size before detail is added. |

### Art production sequence

1. **Prototype diorama:** abstract team colours, primitive vehicle silhouettes, simple terrain, large temporary objective/status markers.
2. **Loop validation:** confirm recovery, supply, scouting, standard pursuits, and touch control before costly art.
3. **V1 art layer:** establish palette, faction shape language, one coherent biome, readable illustrated assets, and concise mission framing.
4. **Future theatre packs:** corporate, dieselpunk, abstract-competitive, or arcade variants only after the core ruleset is proven.

### Minimum V1 art categories

| Category | Required content |
|---|---|
| Terrain | Open ground, road, forest/scrub, rough ground, ridges, shallow/deep water, industrial/settlement ground |
| Route features | Bridges, fords, passes/tunnels, roadblocks, minefields, wreckage |
| Sites | Home base, depot, garage, relay, fuel facility, crossing control, camp, outpost, field uplink |
| Assets | Five core asset types for both factions and one unique asset per faction |
| NPCs | Downed operator, rescue representation, guards, convoy crew, specialists/POWs, outpost figures |
| State variants | Operational, damaged, disabled, repaired, supplied, cut off, sabotaged, destroyed where applicable |
| Objectives | Command Standard at base, carried, dropped, and returned states |
| Effects | Movement, fire, impact, smoke, repairs, tow cable, supply transfer, capture, sensor signal |
| UI icons | Mission, asset role, ping, cargo, stance, score, and site-state markers |

Deferred visual scope includes detailed character customisation, deep lore cinematics, realistic weapon proliferation, many biome families, silhouette-altering skins, and building interiors.

## 17. Detailed audio, SFX, and music system

### Command sound vocabulary

| Event | Sound intention |
|---|---|
| Move order accepted | Soft mechanical click plus short electronic confirmation |
| Priority/double-tap action | Firmer double clunk with upward signal chirp |
| Area-fire order | Target-lock tick and asset-specific weapon-ready cue |
| Site/object interaction | Function-specific utility cue: relay ping, garage clunk, supply latch |
| Mission accepted | Brief rising UI/radio phrase |
| Invalid command | Muted low click, never a harsh failure sting |
| Cancel / safe return | Gentle descending tone with turn/brake cue |
| Ping placed | Distinct beacon chirp by ping category |
| Ally response | Friendly two-note acknowledgement |

### Asset sound identities

| Asset | Movement | Tool/combat | Damage/recovery identity |
|---|---|---|---|
| Assault Vehicle | Heavy tracks, gear changes, ground crunch | Cannon thump, turret servo, mine-drop clunk | Track grind, engine cough, warning klaxon |
| Scout Buggy | High agile engine, suspension rattle, skid | Light fire, sensor sweep, detection ping | Over-rev distress and filtered low-profile mode |
| Command Carrier | Broad diesel-electric hum, ramp/door mechanisms | Defensive burst, rescue beacon | Cargo alarm and operator-secured confirmation |
| Logistics Truck | Industrial engine, cargo rattle, tyre/track squeak | Repair arc, winch ratchet, transfer sounds | Strained towing engine and cable-tension creak |
| Sentinel | Slow mechanical pressure/stomp | Deploy-lock, charge, heavy report | Anchor alarm, heat vent, heavy shutdown |
| Infiltrator | Quiet motor with water-ready texture | ECM sweep, interference, sabotage tool | Detection flutter, water-entry and sealed-hull cues |

Faction timbre adds personality but must not create competitive advantages through volume or audibility.

### Recovery sound arc

| Moment | Audio purpose |
|---|---|
| Critical damage | Engine strain, armour stress, restrained urgent cue |
| Recovery task created | Brief distress beacon and concise alert |
| Tow attached | Heavy clamp / winch-lock confirmation |
| Tow under way | Cable tension and loaded-engine sound |
| Field repair | Reassuring repetitive tool rhythm |
| Repair threshold reached | Strong engine restart and confirmation |
| Operator beacon | Soft repeating rescue pulse attenuated by distance |
| Carrier extraction | Ramp/door, harness latch, medical/secure tone |
| Enemy salvage | Hostile cutting/drilling identity and valid team warning |
| Wreck secured / depot restored | Strong secure impact or generator startup sequence |

### Site ambience

Operational sites have distinctive low-intensity ambience: command-base comms/machinery, depot generators/forklifts, garage doors/lifts, relay transmission pulses, radar sweeps, fuel pumping/valves, and field-uplink antenna chirps. Damaged/cut-off states replace these with sputter, silence, intermittent static, leaks, or warning patterns. Ambience attenuates naturally with camera distance.

### Combat and hazard mix rules

- Prioritise local player activity and critical team events over distant AI fighting.
- Use concise directional impacts, weapon signatures, cover-hit cues, and escalating personal-damage warning.
- Do not use constant loud automatic-fire beds, gore, repetitive elimination stingers, or sound that leaks fog-hidden enemy information.
- Mines use a detection chirp, approach warning ticks for known fields, compact deployment cue, sharp detonation, and clear-safe-route confirmation.
- Every essential audio signal has a visual equivalent; offer captions, separate music/effects/UI/radio controls, reduced flash/shake, and repeated-alert reduction.

### Adaptive music states

| State | Music behaviour |
|---|---|
| Briefing / opening | Curious low-energy mechanical pulse |
| Exploration | Sparse rhythm and melodic fragments |
| Local fight | Controlled percussion/tension layer near the player |
| Escort / convoy | Forward-moving rhythmic pattern |
| Recovery / repair | Low tension that rises with risk and resolves hopefully |
| Site restoration | Hopeful progression with mechanical startup elements |
| Standard stolen / return | Distinct high-stakes motif and pursuit escalation |
| Comeback | Resilient rising variation as recovery succeeds |
| Near victory | Controlled urgency without oppressive panic |
| Result / debrief | Short neutral conclusion and reflective motif |

Music may react to the player team’s legitimate state and known events, never hidden enemy proximity or undiscovered operations.

## 18. Expanded AI doctrine and NPC boundaries

### AI difficulty behaviour

| Lower-pressure behaviour | Higher-pressure behaviour |
|---|---|
| Simple route choice | Better visible-risk route selection |
| Slower high-priority response | Faster legitimate public-task response |
| Obvious targets | Better target and retreat prioritisation |
| More solo travel | Sensible escort/recovery pairings |
| Rigid holding | Fallback-site and flank use |

Humans can take eligible AI assets and issue public signals AI may answer. Humans do not directly command every allied AI unit; V1 is not an RTS.

### NPC categories

| Category | Control | Function | Direct player control |
|---|---|---|---|
| Vehicle operator | Human or AI | Operates asset; may become downed | Contextual survival only when downed |
| Site guard squad | AI | Site/crossing defence and cover use | No |
| Assault/support squad | AI | Contest/escort support | No |
| Engineer crew | AI/site-linked | Infrastructure restoration support | No; enabled by relevant logistics/site action |
| Specialists/POWs | AI/mission object | Extraction cargo/objective | No |
| Civilian/outpost group | AI | Evacuation, aid, intelligence incidents | No |

Infantry uses cover, engages known threats, and retreats at low strength. It can threaten vehicles only through explicit readable anti-vehicle interactions at close range, never through constant unreadable small-arms attrition. Keep squad counts small and bounded.

## 19. Expanded map-generation procedure and validation

### Generation order

1. Select map personality from the deterministic seed.
2. Place fair home-zone templates with at least two independent exits.
3. Generate major terrain barriers: water, ridges, forest, rough ground.
4. Build primary lanes, flanks, cross-links, supply routes, and fallback routes.
5. Place strategic sites using reachability and dependency rules.
6. Create convoy paths, recovery zones, camp locations, and valid field-uplink locations.
7. Run deterministic validation.
8. Re-roll deterministic sub-seeds or reject the seed if validation fails.

### Validation checklist

A valid V1 seed guarantees:

- Comparable travel time from both home zones to early neutral objectives.
- At least two viable base-to-base paths.
- At least one fast/exposed route and one slower/concealed route.
- No single-crossing spawn trap.
- Valid supply routes for both teams.
- Recovery-accessible terrain around important objectives.
- At least one flank/raid opportunity after central loss.
- Defensible fallback areas near both home zones.
- No trivial, hidden, or unavoidable Command Standard route.
- Useful but non-mandatory opportunities for both unique assets.

## 20. Expanded testing, milestones, accessibility, and roadmap

### Playtest success questions

| Question | Evidence of success |
|---|---|
| Can a new player become useful? | Most players start meaningful work within roughly one minute. |
| Does one-human play feel alive? | AI maintains credible fronts, tasks, convoys, threats, and support. |
| Do players understand mission value? | They can explain why depots, relays, fuel, and recovery matter. |
| Is recovery fun? | Players voluntarily take recovery/rescue/repair work and remember it. |
| Can losing teams recover? | Score/site deficits still permit credible reversals. |
| Is mobile combat readable? | Threats, asset state, objectives, routes, and area targeting are understood at small scale. |
| Are support assets chosen? | Logistics, carrier, and scout use is not dramatically below assault use. |
| Does DIDO work? | Departures do not collapse tasks; reconnection feels continuous. |
| Is the Standard event balanced? | It creates drama without making other objectives irrelevant. |
| Are maps fair? | No durable seed, side, or route advantage emerges in repeated tests. |

### Prototype milestones

| Milestone | Demonstrates |
|---|---|
| Simulation sandbox | Deterministic movement, terrain, area fire, disablement, replay |
| Recovery vertical slice | Wreck → escort → tow/repair → restored asset |
| Live-operation slice | Sites, supply, AI doctrines, public missions, DIDO join/leave |
| Full V1 alpha | Score race, Command Standard, endgame, debrief, seed validation |
| Content/balance beta | More seeds, mission tuning, touch readability, art/audio replacement, browser/mobile hardening |

### Accessibility requirements

| Area | V1 requirement |
|---|---|
| Team identification | Colour plus symbols, banners, markings, lights, and UI shapes |
| Colour vision | Alternative team-identification modes and palette support |
| Readability | Scalable UI and high-contrast site/mission states |
| Audio | Captions, separate volume controls, visual equivalents for essential cues |
| Motion | Reduced screen shake, flashes, camera motion, and effect intensity |
| Controls | Large touch targets, configurable UI scale, simple one-handed basic commands |
| Cognitive load | Small command vocabulary, limited clutter, clear task hierarchy |
| Connectivity | Clear reconnection feedback; AI regency protects in-world continuity |
| Language | Short icon-supported mission text; localisation breadth later |

### Roadmap boundary

V2 may deepen operations, tactical competition, social return reasons, content breadth, and platform expansion. Future candidates include more structured tactical war, chaotic arcade warfare, persistent theatre, co-op defence/recovery, and curated weekly seed scenarios. They are explicitly not required to validate V1.

