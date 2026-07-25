# Technical Workthrough — Deterministic Operational Warfare Game

## Purpose and scope

This document records the technical contracts agreed after the initial three-part game-design-document set:

- `01_concept_brief.md`
- `02_detailed_systems_document.md`
- `03_decisions_and_open_questions.md`

It defines the V1 deterministic simulation, movement, combat, sites, command processing, AI, networking, map generation, and validation approach for a new-IP, top-down, mobile-friendly operational warfare game. It is a spiritual successor to the accessible, session-based energy of classic top-down tactical games, not a direct remake.

## Product constraints

| Topic | Agreed baseline |
|---|---|
| Session duration | Target 20–30 minutes; players can meaningfully join for shorter periods, including 10–15 minutes |
| Active operation | 2–16 active humans; at least 32 meaningful active entities through AI support |
| Play modes | Browser desktop/mobile first; LAN/local single player/hotseat; optional Roblox port later |
| Joining | No mandatory lobby; players join an active operation through an in-world overlay |
| Input | Destination, area-action, contextual interaction, ping, and role/asset selection; no continuous steering required in V1 |
| Player asset | One active asset at a time; free switching at friendly operational sites |
| Strategic style | Light accessible team competition in V1; tactical competitive war and chaotic arcade warfare are possible future modes |
| World/art | Stylised retro-futurist fictional conflict; alternate dieselpunk 1980s and abstract tactical-diorama directions remain viable |
| Primary win model | Team score threshold; returning the Command Standard is the largest score event |

## 1. Core simulation contract

### Reducer and fixed tick

The engine is a pure deterministic reducer:

```text
apply(state, command) -> nextState
```

The reducer has no I/O, wall-clock access, hidden global state, client camera state, or transport dependencies. All adapters—Node.js server, browser/local host, headless simulator, and later Luau/Roblox twin—drive the same conceptual rules.

| Property | V1 rule |
|---|---|
| Tick rate | 10 Hz fixed simulation tick |
| World grid | 128 × 128 logical cells |
| Coordinate precision | 256 fixed-point units per cell |
| Arithmetic | Integer-only for authoritative position, movement, timing, and state logic |
| State size | Dynamic state target under 1 MB per operation |
| Static map | Reconstructed from ruleset + template + seed |
| Ordering | Stable deterministic ordering with entity IDs and command sequence tie-breaks |
| Randomness | Explicit state-held integer PRNG only |

### State domains

| Domain | Examples |
|---|---|
| Meta | Ruleset, template, root seed, tick, phase, selected candidate map seed |
| Teams | Score, operational resources, broad pressure state, public mission budget |
| Entities | Assets, NPCs, operators, wrecks, cargo, mines, temporary authoritative effects |
| Sites | Ownership, security, condition, stock, disruption, network and derived service level |
| Missions | Public team tasks, responders, success/failure/expiry state |
| Visibility | Discovery, direct and sensor contacts, last-known records, team knowledge |
| Operations | Command Standard lifecycle, score threshold, operation result state |
| Queues | Pending actions, interactions, scheduled transitions, bounded AI urgent queue |
| Statistics | Verified contribution facts, Battle Honors and outcome summaries |

Static terrain, buildings, roads, route graph, site geometry, and presentation variants are not duplicated in the dynamic state.

## 2. Entity and lifecycle baseline

### Important lifecycle principle

The game favours disablement, recovery, repair, retreat, rescue, salvage, and restoration over immediate deletion. Destroyed or disabled vehicles generally become persistent wreck objects until towed, salvaged, cleared, or otherwise resolved.

| Object | Core lifecycle |
|---|---|
| Vehicle | Ready → damaged → impaired → critical → disabled → wreck/recoverable resolution |
| Controller | Human-controlled ↔ AI regency / ordinary AI, with lawful handoff |
| Wreck | Created → approached → repaired/towed/salvaged/cleared → resolved |
| Site | Neutral/friendly/enemy owner combined with security, damage, stock, network and service dimensions |
| Mission | Proposed → public → assigned/responding → completed/failed/superseded/expired |
| Command Standard | At base → capture progress → carried → dropped → recovered/returned → score/reset |

## 3. Movement, routing, congestion, and towing

### Movement model

Players issue a destination or route intent. The server resolves a bounded path and advances the asset on each fixed tick. Clients smooth presentation only.

$$
\text{distance per tick} = \text{base speed} \times \text{terrain modifier} \times \text{condition modifier} \times \text{load modifier}
$$

All values use integer values or integer ratios.

### Movement classes

| Class | Typical assets | Core behaviour |
|---|---|---|
| `tracked_heavy` | Assault Vehicle, Sentinel | Traverses roads/open/rough terrain; slower on rough ground |
| `wheeled_light` | Scout Buggy, Logistics Truck | Fast on roads; constrained by mud, slopes and crossing condition |
| `carrier_heavy` | Command Carrier | Large footprint, slower, requires suitable crossings |
| `amphibious_light` | Infiltrator | Uses designated shallow/deep-water lanes as well as land |
| `operator_foot` | Downed operator | Very short local movement only |
| `npc_foot` | Guards, crews, squads | Bounded AI-only movement through foot-passable terrain |

Terrain capability is ruleset data, not hard-coded per terrain name.

### Terrain effects

| Feature | Movement / tactical meaning |
|---|---|
| Roads | Fast reliable logistics, predictable and exposed travel |
| Open ground | Standard movement, clear fields of fire |
| Forest/scrub | Slower movement, concealment, shorter sight lines |
| Rough/rubble | Slow flanking terrain and harder recovery |
| Ridges/slopes | Restricted crossings, vision advantage and choke points |
| Water | Class-dependent crossing; deep lanes reserved for amphibious movement |
| Bridges | Strategic route dependencies with intact/damaged/repaired states |
| Minefields/wrecks | Dynamic risk, obstruction, recovery and clearance work |

### Strategic route graph

The seeded static map contains nodes (base exits, forks, bridge ends, passes, site approaches) and tagged edges (road, forest, narrow, exposed, concealed, heavy-capable, tow-capable, amphibious). Dynamic state changes edge availability or cost: open, slowed, blocked, dangerous, mined, damaged, or contested.

Route preference is an intent, never a client-supplied path:

| Preference | Behaviour |
|---|---|
| `fastest` | Favour travel time and direct roads |
| `safer` | Avoid known danger, mines, exposure and congestion |
| `concealed` | Favour cover and lower visibility corridors |
| `heavy_safe` | Avoid unsuitable narrow/damaged crossings |
| `return_safe` | Conservative route to a valid friendly operational site |

### Local path representation

Keep a bounded coarse plan plus compressed local path. Recommended local encoding: run-length direction segments using one of eight directions, cell count, and an optional fixed-point terminal waypoint. Store destination, route-node sequence, current segment, repath cooldown/retry budget, and local route revision.

New requests occur after a destination/preference change, invalidated segment, tow/displacement, precise interaction approach need, AI objective change, or bounded stuck threshold. Pathfinding has fixed work limits; a failed search gives a partial path or clear blocked result.

### Facing and collision

Authoritative facing uses eight directions in V1. Heavier units turn through deterministic steps. Client rendering may interpolate rotations.

Use soft occupancy, reservation and yielding—not rigid-body physics.

| Right-of-way order | Situation |
|---:|---|
| 1 | Command Standard carrier, active rescue, active tow |
| 2 | Emergency retreat / critically damaged friendly asset |
| 3 | Mission-assigned recovery or logistics |
| 4 | Human-controlled asset |
| 5 | AI-regency asset |
| 6 | Ordinary AI asset |
| 7 | Stable entity-ID tie-break |

Lower-priority assets briefly pause, move to an adjacent yield cell, locally repath, or stop cleanly. Narrow crossings reserve compatible entry/capacity. No valid route means no jitter: the asset reports `Route blocked` at the last legal point.

### Towing

Towing is an explicit linked-pair state, not cable physics. A tow record contains tow vehicle ID, towed wreck ID, discrete offset/orientation, current tow state, and destination/reference where relevant.

| Tow state | Meaning |
|---|---|
| `approach` | Recovery unit routes to an attachment point |
| `attach` | Bounded interaction validates the link |
| `tow_active` | Pair moves as a constrained footprint |
| `tow_paused` | Congestion/threat/invalid next segment causes a safe pause |
| `detach` | Wreck released in a valid position |
| `deliver` | Wreck reaches garage/depot/salvage point |
| `broken` | Damage or legal terrain/state event breaks link |

Tow pairs use the more restrictive mobility class, slower speed, wider turns, and tow-capable crossings. Important wreck areas must retain at least one recovery/clearance path under map validation.

## 4. Combat, visibility, suppression, and mines

### Combat contract

Combat is area-directed: players select a legal location, not a specific enemy entity as the primary interaction. Weapon profiles are ruleset data containing fire mode, range, area shape, damage and suppression, penetration/cover, cooldown, resource cost, visibility requirement, movement restriction, and side effects.

Area action sequence:

1. Validate controller, asset, weapon readiness, target bounds/range/arc/information and terrain.
2. Turn/deploy first where needed, creating a bounded pending action.
3. At resolution, derive the authoritative fixed-point effect area.
4. Resolve affected terrain/features/entities in stable order.
5. Apply cooldown/resource cost, valid events, verified contribution facts, and mission updates.

### Information tiers

| Tier | Legal use |
|---|---|
| `directly_observed` | Accurate normal area fire |
| `sensor_supported` | Approximate/limited fire under weapon restrictions |
| `last_known` | Suppression/denial, not perfect tracking |
| `suspected` | Limited speculative suppression where profile permits |
| `unobserved` | No target-specific attack; only non-targeted legal actions |

Visibility uses deterministic bounded grid traversal plus terrain blocking/height classes. Forest, structures, ridges, smoke, and site features can block or reduce sight. Checks occur at bounded intervals or significant terrain/cell changes.

**Fog safety:** hidden enemy coordinates, route intent, mines, resource detail, future events, audio direction, AI behaviour, and music intensity must never leak truth not legitimately known.

### Damage and suppression

| Condition | Effect |
|---|---|
| Ready | Normal operation |
| Damaged | Durability loss or minor penalty |
| Impaired | Meaningful mobility, weapon, sensor, cargo/service penalty |
| Critical | Strong disablement risk and restricted behaviour |
| Disabled | Wreck/downed-operator resolution begins |

Readable role-relevant impairment flags are mobility, weapon, sensor, and cargo/service. Suppression states (`clear`, `pressured`, `suppressed`, `pinned`, `recovering`) create pressure to seek cover, escort, retreat, or repair; they should not become opaque stun locks.

### Mine contract

Mines are bounded route denial with counterplay.

| Mine state | Meaning |
|---|---|
| `deploying` / `armed_hidden` | Legal placement and active undiscovered field |
| `suspected` / `detected` / `marked` | Increasing enemy knowledge and actionable warning |
| `clearing` / `cleared` | Counterplay action and restored route state |
| `detonated` | Resolved event with compact aftermath |

Mines have legal terrain restrictions, protected no-deployment zones, capped density/inventory/lifetime, discoverable clues and Scout/detection counterplay. They cannot be allowed to seal a team’s only viable route.

### Attribution

Contribution comes only from verified reducer facts: useful combat/suppression, reconnaissance used by a meaningful later action, recovery, logistics, and objective work. Apply bounded assistance windows and caps to prevent blind-fire, click, or repeated-damage farming.

## 5. Sites, supply, services, and Command Standard

### Site types

| Site | Operational role |
|---|---|
| Home Base | Guaranteed baseline operation, Standard home, basic repair/rearm, slow manufacture |
| Forward Depot | Forward switching, repair/rearm, supply and recovery anchor |
| Garage | Heavy repair, wreck processing and salvage |
| Relay | Legitimate shared team coordination/contact infrastructure |
| Radar Station | Approximate sensor contacts |
| Fuel Facility | Fuel distribution and delivery mission anchor |
| Crossing Control | Meaningful bridge/ford repair, defence and clearance focus |
| Specialist Camp | Rescue/extraction/escort objective |
| Village/Outpost | Tactical foothold, local security and small service |
| Field Uplink | Limited vulnerable temporary local utility |

### Site dimensions and capture

A site separately tracks owner, security, access, structural condition, network connection, stock, disruption, and derived service level. Capture is two-stage: secure the visible approach, then complete a bounded interaction at a physical terminal/gate/panel. It is not an abstract capture circle.

| Service | Capability |
|---|---|
| None | No normal service |
| Limited | Basic fallback/rally where safe; emergency partial repair |
| Standard | Normal switching, standard repair/rearm and ordinary wreck acceptance |
| Full | Best repair/rearm, high-capacity transfer, heavy recovery and eligible advanced access |

Newly secured sites begin damaged/limited where appropriate and progress through:

$$
\text{Secure} \rightarrow \text{Repair} \rightarrow \text{Resupply} \rightarrow \text{Full Service}
$$

Sabotage is temporary focused disruption that creates restoration work; it does not irreversibly delete a team’s play options.

### Team operational resources

| Resource | Used for | Restored through |
|---|---|---|
| Fuel | Readiness, long operations, some services | Facilities, logistics delivery, bounded Home Base reserve |
| Materiel | Site/asset repair, recovery, infrastructure | Depots, salvage, deliveries, bounded reserve |
| Munitions | Rearm, mines and weapon actions | Depots, deliveries, bounded reserve |

Resources are team-owned constraints, not personal currency. Shortage weakens forward efficiency before basic access. Home Base slow manufacture ensures basic fallback asset access.

Cargo uses small discrete tiers, contextual load/unload actions, and physical carriers—primarily Logistics Truck and Command Carrier—without detailed inventory micromanagement.

### Command Standard

Each team’s Standard begins physically at Home Base. An enemy must capture/load it through a bounded interaction, carry it on an eligible asset, and return it to the carrier team’s valid home return point. The score succeeds **only if the carrier team’s own Standard is secured at its own Home Base**.

| Lifecycle | Core data |
|---|---|
| At base | Owner team, base reference, security state |
| Capture/loading | Interacting entity and deterministic progress |
| Carried | Carrier ID, origin, current objective state |
| Dropped | Fixed-point position and valid recovery rules |
| Recovered/returned | Interacting carrier/return site/progress |
| Scoring/reset | Score event and deterministic reset tick |

The Command Carrier is the main carrier. A limited fallback carrier can be configured where needed. Carrying imposes speed/safety trade-offs and strongly encourages escort. Map rules prevent permanent invalid drops, spawn traps, one-route soft locks, and unanswerable Standard dominance.

## 6. Commands, ordering, and replay

### Command contents

A client sends compact intent only: protocol compatibility marker, client sequence, intended tick, category, subject reference where needed, and a restricted target descriptor. Server identity is transport-associated, not trusted from payload.

Allowed target forms are fixed-point world point, entity ID, site ID, route preference enum, action option enum, ping descriptor, or no target. Clients never submit paths, damage, score, visibility claims, arbitrary JSON, random values, or authoritative outcomes.

| Category | Intent examples |
|---|---|
| Movement | Destination and route preference |
| Area action | Fire, suppress, place mine, sensor/ECM action |
| Interaction | Capture, service, repair, sabotage, cancel |
| Recovery | Tow, repair, salvage, rescue |
| Cargo | Load/unload/transfer |
| Stance | Safety/autonomy/movement stance |
| Signal | Rate-limited team ping |
| Lifecycle | Deploy, takeover, reclaim, fast redeploy |

### Validation and ordering

Validation is deterministic: syntax/compatibility → sequence/deduplication → timing → authority → capability → target legality → conflict/capacity → accepted scheduling.

Within a tick: due system transitions; ordered accepted commands; command-start effects; movement; interactions; combat; sites/objectives/resources; scheduled AI decisions; visibility/events.

Intent precedence is lifecycle/handoff, cancel/retreat/safety, movement, interaction/recovery/cargo, area action, stance, then signals. Stable player and sequence IDs settle remaining order.

Late commands do not rewind state. Slightly late commands execute next legal tick if still legal; stale ones reject cleanly. Rejections use fog-safe reasons such as `Route blocked`, `Weapon reloading`, `No confirmed target information`, or `Asset is disabled`.

### Replay

A replay contains ruleset/version, root/map seed data, initial dynamic state, accepted ordered commands, any non-derivable deterministic system inputs, and periodic canonical state hashes. Optional checkpoints enable seeking. Rejected commands are diagnostics rather than simulation input.

## 7. AI, missions, and regency

AI has three layers:

| Layer | Responsibility |
|---|---|
| Reactive safety | Every tick/event: illegal-path stop, damage response, reservation compliance |
| Asset decision | Staggered objective/route/action/retreat decisions |
| Team operations director | Slower mission budget, convoy, role balance, comeback and endgame focus |

AI decision slots derive from stable entity IDs:

$$
\text{decisionSlot} = \text{entityId} \bmod \text{decisionInterval}
$$

AI receives only derived lawful knowledge: own observations, valid friendly sharing, legitimate radar/relay data, friendly operations state and published mission data. It never reads hidden enemies, mines, routes, future events, exact hidden resources, camera, or network state.

Role doctrines prioritise:

| Role | Priorities |
|---|---|
| Assault | Defend/escort/contest known threats, support capture/suppression |
| Scout | Discover threats/mines/routes, screen flanks, escort vulnerability |
| Command Carrier | Rescue operators, transport specialists, Standard escort/return |
| Logistics | Repair, tow, recover, supply, restore infrastructure |
| Sentinel | Stabilise key defence/recovery/Standard routes |
| Infiltrator | Lawful disruption, amphibious flank, recon/raid and safe exit |

Candidate tasks are capped and spatially bounded. Integer-style score considers priority, role fit, strategic value, urgency, route cost, team need, known risk, commitment, and duplicate responder penalty. Stable tie-breaks eliminate non-determinism.

The director publishes only capped, actionable, fog-safe tasks with success/failure/expiry conditions: recover wreck, rescue operator, restore depot/relay, escort convoy, clear known mines, escort/intercept a legitimately known Standard carrier.

**Regency** preserves an absent player’s asset first: avoid loss, safely finish nearly complete low-risk action, preserve viable rescue/tow/escort, retreat to useful safety, then continue ordinary work only if safe. It never makes reckless strategic spends or raids merely to stay busy. Returning players reclaim only at legal handoff boundaries.

## 8. Networking, views, and reconnection

The authoritative server owns full state. Clients receive fog-filtered derived views only.

| Layer | Owner | Hidden enemy truth allowed? |
|---|---|---:|
| Authoritative simulation | Server/reducer | Yes |
| Derived team knowledge | Server view builder | Only legitimately known data |
| Client presentation | Individual client | No additional truth |

Use filtered snapshots for initial join/reconnect/resync, revisioned filtered deltas for normal play, command acknowledgements, visible event batches, session/control messages, and optional development diagnostics.

A snapshot includes operation header, player context, permitted map discovery, friendly records, legitimate enemy contacts/last-known records, missions, team operations tiers, own action state, and bounded recent visible events. It never includes hidden history or full enemy truth.

Prediction is deliberately narrow:

| Client may predict | Client may not predict |
|---|---|
| Tap/selection feedback, destination marker, provisional route display, own short-horizon movement/turn animation, local camera/UI | Enemy motion, mine discovery, damage/score/objective result, hidden contact truth |

On authoritative update, client matches acknowledgement, replaces provisional intent, smooths minor movement correction, and immediately corrects meaningful state such as disablement, blocked route, rejected weapon, lost control or Standard drop.

Join-in-progress: connect → compatibility/team decision → filtered snapshot → seed-based map reconstruction → in-world overlay to take AI asset, reclaim regency asset, deploy basic asset, choose public task or briefly spectate → lifecycle command → play. There is no mandatory lobby.

Disconnect uses a deterministic grace period, then AI regency. Reconnect receives a fresh filtered snapshot and lawful reclaim/deploy choices. LAN, local single-player, hotseat, headless, online, and Roblox use equivalent authority/command/view concepts; local play must not quietly grant gameplay visibility of hidden enemy state.

## 9. Seeded maps and validation

### Generator

$$
\text{generate}(\text{rulesetVersion}, \text{templateId}, \text{rootSeed})
\rightarrow \text{staticMap} \;|\; \text{validationFailure}
$$

Named integer-derived sub-seeds control terrain, roads, structures, sites, objectives, route graph, ambient presentation, and static AI posture. No platform default RNG is allowed.

A template is a structural operational brief—not a fixed map—defining macro topology, base relationship, route structure, site budget, objective pattern, terrain proportions, asset accommodation, and validation thresholds.

Initial V1 templates:

| Template | Tactical character |
|---|---|
| `frontier_corridor` | Broad wilderness roads, woods and recovery/convoy pressure |
| `split_crossing` | River/canal crossings, bridge repair, clearance and amphibious flanks |
| `ridge_and_depot` | Vision ridges and protected lower depot routes |
| `broken_industry` | Roads, rubble and service disruption in compact industrial terrain |
| `coastal_inlet` | Land corridors and designated amphibious channels |

### Generation sequence

1. Select template and derive sub-seeds.
2. Generate macro terrain/elevation/water/ridge regions.
3. Place protected Home Base regions and exits.
4. Carve guaranteed backbone routes.
5. Add secondary roads, cover corridors, flank routes and crossings.
6. Build route graph with mobility/capacity tags.
7. Place sites against graph anchors and distance constraints.
8. Place Standard homes, service approaches, deployment zones and objectives.
9. Add static cover without invalidating routes.
10. Run mandatory validation and deterministic headless probes.
11. Select first passing deterministic candidate; otherwise use recorded fallback policy.

Validation includes structural geometry, movement-class/footprint access, operational access, recovery/tow/convoy/Standard routes, fairness and comeback resilience, and headless simulations. Each team must retain basic access and credible recovery/restoration options after bounded disruption; one bridge, wreck, minefield or site loss cannot permanently seal participation.

Asymmetry is acceptable only when measurable capability stays in template tolerance: travel cost, route redundancy, site service potential, sight access, defensive exposure, tow/recovery access, early pressure, and post-disruption fallback.

## 10. Testing and parity

### Test layers

| Layer | Purpose |
|---|---|
| Reducer unit tests | Each state machine and command transition |
| Property tests | Random valid/invalid command streams, invariants and illegal transition discovery |
| Fixed-seed scenarios | Known maps and tactical situations with expected result hashes |
| Replay tests | Rebuild exact state from initial state and command stream |
| JS/Luau parity fixtures | Same state/commands, canonical hash at checkpoints, first divergent field/tick diagnostics |
| Network/view tests | Fog-filtered snapshot/delta permissions and no-leak assertions |
| Headless soak tests | AI operations, map balance, congestion, recovery, logistics and Standard behaviour |
| Join/regency tests | Mid-operation snapshot join, takeover, disconnect, regency and reclaim |

### Soak metrics

| Metric | Intended signal |
|---|---|
| Win distribution | Identify template/asset systemic bias; target broadly balanced outcomes |
| First-score timing | Detect stalled or over-fast operations |
| Congestion index | Percentage of time yielding/waiting; identify choke/deadlock problems |
| Resource resilience | Detect operations where both sides cannot restore basic flow |
| Recovery efficiency | Identify wreck accumulation and inaccessible recovery loops |
| Role/action variance | Detect unused asset types or ignored mission categories |
| Route failure recovery | Verify single disruption retains viable alternate work/route |
| Join usefulness | Verify late joiners receive usable assets/tasks |

Performance target: benchmark `apply()` against a practical budget around 1 ms per tick on a representative standard CPU, while profiling pathfinding, vision, AI and validation separately. Treat this as a benchmark gate to refine after a first vertical slice, not as a substitute for measured evidence.

## 11. Local, LAN, and browser/mobile session model

### Hotseat decision

Traditional pass-the-device hotseat is **not** a supported primary mode. It conflicts with continuous simulation, fog of war, drop-in play, and the intended operational tempo. It would require pausing or masking state between players and would weaken the core per-player information model.

Supported local play modes are:

| Mode | Status | Notes |
|---|---:|---|
| Single player with AI | Core | One local browser client receives its normal fog-filtered view |
| One device per player on LAN | Core | Every player uses their own browser/mobile device and has an independently filtered view |
| Shared Wi-Fi/access point LAN | Core | No Internet is required when host and clients can communicate locally |
| Phone-hotspot LAN | Supported where local clients can communicate | Suitable for small groups; hotspot client limits and client-isolation behaviour vary by device |
| Online server | Core later transport mode | Same authority, commands, view model, and operation rules |
| Pass-the-device hotseat | Not planned | Poor fit for semi-real-time fog-of-war play |

### LAN topology

The host runs the authoritative Node.js operation server. All browser/mobile devices connect as ordinary clients over the local network.

```text
Host laptop or small server
          |
Shared Wi-Fi access point or phone hotspot
          |
One browser/mobile client per player
```

The access point does not need Internet connectivity. It must permit clients to reach the host. Because some consumer/phone hotspots isolate connected clients or restrict local discovery, the join flow needs an explicit connection test and a clear fallback: host from a laptop connected to the same ordinary Wi-Fi access point.

### No-lobby local join flow

1. Host starts an active operation with versioned ruleset, template, root seed and candidate selection.
2. The server publishes a local join endpoint and operation identifier.
3. A player opens the local address through QR code, short local join code, local discovery where available, or a manually entered address in development mode.
4. The player receives a fog-filtered snapshot and seed/map identity, reconstructs permitted static map presentation, and sees an in-world entry overlay.
5. The player selects a lawful available faction/asset or accepts the recommended role; this is an in-world deployment decision, not a conventional waiting lobby.
6. The continuous operation remains active while players join or leave.

### First-operation prototype lifecycle

For the earliest LAN proof, use two human-controlled assets—one per team—and no requirement for AI population. This isolates local connectivity, independent fog-filtered views, movement, combat and replay correctness. The target of 32 meaningful human-plus-AI entities remains an operational-game milestone after AI, recovery and mission systems exist.

| Stage | Prototype behaviour |
|---|---|
| Host starts | Choose versioned ruleset, `frontier_corridor`, and deterministic seed |
| World initialises | Two teams, one initial asset per team, neutral Relay |
| Player joins | In-world faction/asset selection or recommended available role |
| Operation | Continuous tick, independent fog views, movement/combat/Relay loop |
| Player leaves | Early prototype safely deactivates or idles the unclaimed asset; later milestone applies AI regency |
| End | Short prototype score condition and/or fixed test limit |
| Result | Brief outcome summary; host can begin a new seeded operation |

## 12. Renderer and canonical parity contract decisions

### Browser renderer

The browser/mobile client will reuse the established **three.js** approach proven in RetroMultiCiv rather than switching to HTML5 Canvas 2D. Three.js is a presentation adapter only: it consumes fog-filtered views and must never own authority, simulation, combat, visibility, path legality, or replay outcomes.

| Renderer decision | Agreed direction |
|---|---|
| Rendering technology | Pinned/vendored three.js, retaining a conservative WebGL1-compatible path |
| Visual approach | Mobile-first 2.5D tactical diorama |
| Camera | Lightly tilted, mostly orthographic camera |
| Zoom | Stable constrained zoom for readable touch targets |
| Camera rotation | No user rotation in the first slice |
| Re-centering | Clear `Centre on Asset` control |
| Effects | Conservative; avoid mandatory post-processing and universal real-time shadows |
| Compatibility | Low-quality graphics tier and existing-style SwiftShader/forced-WebGL1 renderer verification |
| Simulation/render timing | 10Hz authoritative snapshots; display loop interpolates known authoritative states at device frame rate |

### Canonical byte and primitive contract

The following Milestone 0 decisions are now fixed:

| Subject | Contract |
|---|---|
| Endianness | Little-endian for every canonical multi-byte primitive |
| Authoritative types | `u8`, `u16`, `u32`, `i32`; no floats in authoritative state |
| Boolean | `0` false, `1` true |
| Optional data | Presence byte (`0` absent / `1` followed by canonical value); no `null` |
| Arrays | Explicit count prefix followed by entries in prescribed stable order |
| Strings | Numeric-first authoritative state; UTF-8 strings only where unavoidable for version/template/ruleset IDs and fixture metadata; `u16` byte length then bytes |
| Coordinates | 0-based logical grid and named indexing helpers |
| Fixed point | Signed `i32`, 256 units per logical cell |
| Hash | FNV-1a 64-bit represented as `hashHi: u32`, `hashLo: u32`; printed as 16 fixed-width hexadecimal characters |
| PRNG | Explicit state-held `sfc32`, expanded from root seed through `mix32` |
| Overflow | Specify/implement `u32` wrap explicitly; never rely on accidental language coercion |

The canonical writer must validate ranges and reject invalid/non-integral authoritative values in development/test execution. It must not silently coerce data. Canonical serialisation remains separate from game-specific state writers.

### Milestone 0 validation ladder

| Fixture stage | Contract proved |
|---:|---|
| 0A | Byte writer primitive encodings |
| 0B | FNV-1a 64-bit vectors |
| 0C | `mix32` seed-expansion vectors |
| 0D | `sfc32` ordered-output and next-state vectors |
| 0E | Fixed-point helper vectors |
| 0F | Canonical empty state at tick 0 |
| 0G | Tiny 8×8 seeded static-map generation/signature |
| 0H | One-entity movement replay |
| 0I | 128×128 `frontier_corridor` generation/signature |

The 8×8 map is a generator microscope, not a playable map. It must exercise deterministic terrain choice, candidate selection/rejection, 0-based indexing, passability, vision blocking, spawn placement, a Relay footprint, and static-map signature generation. Human-readable terrain-grid diagnostics are required.

### Skeleton boundary correction

The illustrative repository structure is now constrained as follows: authoritative rulesets belong under `data/`, never `shared/`. The initial skeleton must not prematurely create combat or server/client modules before the 0A–0E primitive gate is demonstrated. Early module boundaries should therefore begin with `shared/` primitives, test fixtures/runners, versioned `data/` inputs, and later add engine/adapters in milestone order.

