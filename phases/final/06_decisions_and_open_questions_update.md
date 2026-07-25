# Decisions and Open Questions — Technical Update

## Status

This document supplements `03_decisions_and_open_questions.md`. It records decisions made during the technical workthrough and preserves intentionally unresolved implementation choices.

## Confirmed technical decisions

| Area | Confirmed decision |
|---|---|
| Simulation | Pure deterministic reducer, 10 Hz fixed tick, no I/O/clocks/hidden state |
| Coordinates | 128 × 128 logical grid, 256 fixed-point units per cell, integer authority |
| Static versus dynamic | Static world reconstructs from ruleset/template/seed; dynamic battle truth is stored |
| Input | Intent-based move, area action and contextual interactions; no continuous steering in V1 |
| Movement | Data-driven mobility classes, strategic graph + bounded local compressed path, eight-direction facing |
| Collision | Soft footprint occupancy/reservations/yield; no rigid physics |
| Recovery | Towing is linked-pair state, not cable physics; wrecks create gameplay work |
| Combat | Data-driven area effects, legitimate information tiers, no entity-targeting as main interaction |
| Fog | Server derives and serialises filtered views before transport; no presentation, AI or audio fog leaks |
| Damage | Readable condition bands and limited role-relevant impairment flags; disablement precedes recovery loop |
| Mines | Bounded, counterable, detectable route denial; cannot create unavoidable locks |
| Sites | Physical secure-then-interact capture; separate owner/security/condition/network/stock/disruption/service dimensions |
| Resources | Team fuel/materiel/munitions; physical low-micromanagement cargo; Home Base basic-access guarantee |
| Standard | Physical carrier cargo; return scores only while own Standard is secure at home base |
| Commands | Compact typed intent; server sets final execution tick/order; late commands never rewind |
| Replay | Ruleset + seed + initial state + accepted commands + canonical hashes/checkpoints |
| AI | Staggered deterministic scheduler, lawful knowledge view, bounded mission/director system |
| Regency | Preserve absent player asset/cargo and safe continuity; player can lawfully reclaim |
| Networking | Filtered snapshots/deltas, narrow own-client prediction, no-lobby join/reconnect flow |
| Maps | Seeded templates plus mandatory mobility/operational/fairness/headless-probe validation |
| Testing | Reducer/property/fixed-seed/replay/fog/parity/soak/join testing required |

## Explicit V1 boundaries

| Deferred / constrained item | V1 position |
|---|---|
| Continuous steering and twitch aiming | Not required; revisit only if area/intention controls prove inadequate |
| High-fidelity vehicle physics | Excluded; use deterministic path/footprint/reservation model |
| Rigid-body tow cable | Excluded |
| Large granular personal inventories/economy | Excluded; use small team resource tiers and discrete cargo |
| Full tactical esports mode | Future mode, not V1 baseline |
| Chaotic arcade warfare mode/map | Potential future mode |
| Persistent progression / levels | Later; V1 uses contribution and Battle Honors rather than power progression |
| Full Roblox port | Optional after browser/mobile authoritative loop and parity foundation |
| Unlimited procedural templates | Excluded; begin with small validated template set |
| Full arbitrary-angle authoritative facing | Deferred; eight-direction model first |

## Open implementation decisions

| Decision | Why it remains open | Required validation |
|---|---|---|
| Canonical hash algorithm | Must be identical and practical in Node.js and Luau | Small cross-runtime fixture spike |
| Canonical state serialisation | Must define field order, collection order, integer encoding and omission rules | Parity fixture comparison |
| Integer PRNG and seed mixer | Must be deterministic in both runtimes and convenient for named sub-seeds | Cross-runtime sequence fixtures |
| Pathfinding algorithm/details | Must meet fixed work limits and shared implementation feasibility | Route/cost/partial-path benchmarks |
| Exact tick windows for late/early commands | Depends on mobile/browser/LAN latency experience | Network simulation and playtests |
| Exact AI intervals/budgets | Depends on performance and tactical responsiveness | Headless profiles and soak metrics |
| Exact map-template tolerances | Depends on measured travel/score/route outcomes | Seed corpus and balance soak tests |
| Exact asset roster/numbers | Requires first playable combat/recovery loop | Vertical-slice playtests |
| Weapon damage/suppression values | Balance data, not architecture | Scenario and human-play balance pass |
| Standard carrier fallback rule | Needs playtest evidence on accessibility versus cooperation | Standard-run scenarios |
| Join team-assignment formula | Must avoid unfair forcing while maintaining operation balance | Mid-game join simulations and playtests |
| Snapshot/delta serialisation/compression | Requires actual payload/performance profiling | Network benchmark with fog-filtered views |
| Art direction choice | Three viable directions remain: retro-futurist fictional conflict, dieselpunk alternate 1980s, abstract tactical diorama | Art samples and mobile readability tests |

## Risks to watch

| Risk | Mitigation already selected |
|---|---|
| Route deadlocks / bridge congestion | Reservations, deterministic yield, path retry budgets, map probes and congestion soak metric |
| Fog leaks | Derived server-side views; automated payload assertions; AI/audio/music constraints |
| Snowball lockout | Home Base basic access, restoration missions, route redundancy and comeback validation |
| Recovery loop becomes tedious | Discrete interactions, clear mission prompts, tow-capable validation and service value |
| Mobile ambiguity | Strong ground markers, contextual target previews, confirmed/rejected command feedback |
| JS/Luau drift | Integer-only rules, canonical fixtures, periodic hash checkpoints, small parity spike early |
| AI CPU cost | Staggering, caps, spatial candidate lists, route cooldowns and bounded queues |
| Procedural unfairness | Template constraints, deterministic validation/retry and fallback candidate |
| Objective dominance | Standard safeguards, limited frequency/reset, viable non-Standard score paths |

## Recommended next decision sequence

1. Perform the canonicalisation/PRNG/fixed-point parity spike.
2. Lock the minimal vertical-slice ruleset and fixture format.
3. Decide exact first template and first two asset archetypes.
4. Build Milestone 0 and verify deterministic replay before rendering polish.
5. Expand only after movement, fog, area action and wreck lifecycle prove readable in browser/mobile play.

## Local multiplayer update

| Area | Decision |
|---|---|
| Traditional hotseat | Excluded as a primary/support target; it is a poor fit for continuous fog-of-war play |
| Local multiplayer | One browser/mobile device per player on a LAN is the preferred local social mode |
| LAN host | Authoritative Node.js host runs on a laptop/small server or other reachable host device |
| Internet requirement | None for LAN play; local client-to-host communication is sufficient |
| Shared access point | Supported when devices can reach the host on the same local network |
| Phone hotspot | Potentially supported for small groups, but must be tested for client isolation and device limits |
| Local joining | QR code, local join identifier, discovery where available, or manual development address; all lead to an active in-world operation, not a waiting lobby |
| Early departure behaviour | Safe idle/deactivation is acceptable in first LAN prototype; AI regency remains the later intended solution |
| First LAN scope | Two human devices, one asset/team, independent fog-filtered views, neutral Relay; no AI population requirement |

## Newly prioritised pre-skeleton questions

| Question | Why it must be addressed before repository skeleton finalisation |
|---|---|
| Local join endpoint/QR/manual fallback | Defines browser/mobile connection boundary and host UX |
| First-operation lifecycle | Defines session, reset and no-lobby flow |
| Minimal mobile/browser UI boundaries | Defines client module boundaries before folder layout |
| Ruleset and fixture formats | Defines shared data ownership and test tooling boundaries |
| Parity primitive vectors | Defines what belongs in engine/shared/test from day one |
| Initial server lifecycle | Defines operation creation, empty world and restart behaviour |
| Renderer choice | Defines client presentation boundary without affecting reducer authority |
| Milestone 0–2 AI scope | Prevents accidental premature AI architecture |

## Confirmed renderer and Milestone 0 decisions

| Area | Decision |
|---|---|
| Browser renderer | Reuse the established three.js approach from RetroMultiCiv |
| Visual style | 2.5D tactical diorama, mobile-first and conservatively rendered |
| Camera | Lightly tilted, mostly orthographic; stable zoom; no rotation in first slice; Centre on Asset control |
| Rendering authority | Renderer consumes fog-filtered views only and is never a simulation authority |
| Render cadence | Interpolate between confirmed 10Hz snapshots at display frame rate |
| Canonical endianness | Little-endian |
| State data policy | Numeric-first, integer-only authority; strings limited to necessary IDs/fixture metadata |
| Map parity progression | Inspectable 8×8 generator microscope before the 128×128 `frontier_corridor` parity fixture |
| Primary grid convention | 0-based, retained logically in both JS and Luau through explicit helpers |
| Ruleset ownership | Versioned standard JSON in `data/`; drafted from design and iterated after simulation/soak findings |
| Fixture scope | Pin primitive, data/map, initial state and selected replay checkpoints; include detailed map diagnostics |

## Clarification still required before writing Milestone 0 code

The remaining design choice is deliberately narrow: define the exact 8×8 microscope terrain layout/generator constraints and select the first active asset for the first movement fixture. The recommended default remains a valid miniature corridor/island rather than a purely arbitrary palette, and `scout_buggy` as the first moving entity. This choice does not change the primitive 0A–0E work.

