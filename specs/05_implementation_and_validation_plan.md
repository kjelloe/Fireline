# Implementation and Validation Plan

## Purpose

This file converts the technical workthrough into a safe build order. It deliberately starts with a small deterministic playable loop, then proves recovery, fog, objective play, multiplayer, and JS/Luau parity in stages.

## Non-negotiable engineering rules

1. The reducer is pure: `apply(state, command) -> nextState`.
2. Authority uses 10 Hz fixed ticks, integer state, stable ordering, and explicit PRNG state.
3. Ruleset values live in data, not scattered constants.
4. Static map geometry reconstructs from versioned seed/template data.
5. Clients receive fog-filtered views built server-side before transport.
6. AI and humans produce equivalent conceptual intents and obey the same validation rules.
7. A feature is not complete until it has replay coverage, deterministic tests, and a defined fog/network behaviour.

## Vertical-slice milestones

| Milestone | Name | Goal | Required proof |
|---:|---|---|---|
| 0 | Determinism foundation | Reducer skeleton, canonical state representation, fixed tick, command envelope, seeded blank map | Same fixture replays to the same hash repeatedly |
| 1 | Humble Tank | One asset routes over seeded terrain in browser/local adapter | Tap destination, bounded path, stop, replay and hash verification |
| 2 | Tactical Duo | Two mobility profiles, visibility, area action, damage and wreck creation | Hidden enemy is not sent to the client; area action creates legal deterministic result |
| 3 | Rescuer | Tow/recovery, downed operator, depot capture/repair/service | Wreck is recovered or cleared through valid route; site restores through secure/repair/resupply |
| 4 | Operational Battle | Resources, convoys, public missions, AI director, Standard lifecycle | 1vAI/1v1 operation reaches score/Standard resolution without deadlock |
| 5 | No-Lobby Online | Node authoritative server, filtered snapshots/deltas, reconnect/regency | Mid-battle join, asset takeover, disconnect, reclaim and no hidden-state leakage |
| 6 | Mirror Stack | Luau parity harness and Roblox adapter | Shared fixtures match canonical hashes at checkpoints |
| 7 | Alpha Content | More templates/assets/art/audio, balance tuning, operational telemetry | Soak and playtest metrics meet agreed quality gates |

## Milestone acceptance criteria

### Milestone 0 — determinism foundation

- A ruleset and empty/static map can reconstruct from root seed and template ID.
- The same initial state and ordered commands produce the same canonical hash on repeated Node.js runs.
- Commands are validated, deduplicated by sequence, ordered by server-assigned execution tick, and rejected cleanly when malformed/stale.
- No authoritative code depends on wall clock, browser APIs, network packet order, floating-point spatial state, or implicit randomness.

### Milestone 1 — humble tank

- Seeded terrain creates passable and impassable cells.
- A controlled tank accepts a destination intent and routes with fixed-point movement.
- Path representation remains bounded; failed search yields partial route or an actionable blocked state.
- Client can display provisional marker but reconciles with authority.
- Replay can rebuild the movement sequence exactly.

### Milestone 2 — tactical duo

- At least two movement classes have data-driven terrain differences.
- Visibility uses deterministic grid traversal with blocking terrain.
- Client receives only legitimate contacts; a hidden enemy is absent from snapshot/delta data.
- Area-directed weapon validates range/facing/cooldown/information and produces condition transitions.
- Disabled asset becomes a valid wreck rather than disappearing.

### Milestone 3 — rescuer

- Tow link, constrained pair movement, detach/break and delivery states work.
- Site capture uses secure-then-interact physical geometry.
- Site service derives from ownership/security/condition/network/stock/disruption.
- Repair and resupply improve service through visible stages.
- Downed operator and rescue have bounded, recoverable lifecycle.

### Milestone 4 — operational battle

- Fuel, materiel and munitions are team operational resources with basic Home Base guarantee.
- Logistics delivery, convoy pressure and public mission publication work.
- AI asset doctrine and team director use legal knowledge only.
- Command Standard supports base/capture/carried/dropped/returned/score/reset transitions.
- A short AI-vs-AI soak does not show recurring route deadlocks, permanent access denial, or invalid Standard states.

### Milestone 5 — no-lobby online

- Server constructs filtered snapshots and deltas before serialisation.
- Browser/mobile client can join an operation, reconstruct map from seed, choose an in-world role/asset, and play without waiting.
- Brief disconnect holds a reserved controller state; expiry enables regency; reconnect uses fresh snapshot and lawful reclaim.
- Client prediction is limited to own presentation and pending input.
- Transport tests include duplicate, late, out-of-order and oversized command cases.

### Milestone 6 — mirror stack

- JS fixture exporter produces initial state, ordered commands and checkpoint hashes.
- Luau runner consumes equivalent fixtures and reports first tick/field divergence.
- Integer PRNG, canonical ordering, fixed-point utilities, path encoding, visibility and state serialisation all match.
- Roblox transport/view adapter maintains equivalent command and fog-view semantics.

## Test plan

### Reducer invariants

| Invariant | Example assertion |
|---|---|
| Bounds | No entity fixed-point position exits legal map bounds |
| Ownership | A player cannot command an asset they do not lawfully control |
| Path legality | Next movement step always meets terrain, footprint and reservation requirements |
| Resource safety | Resources/stock/ammunition never become negative |
| Lifecycle legality | No invalid state transition, such as towing a resolved wreck |
| Standard integrity | Standard has exactly one valid lifecycle location/holder state |
| Visibility safety | A team knowledge record cannot contain a hidden enemy’s current truth |
| Queue bounds | Commands, urgent AI reconsiderations, paths and missions remain within caps |
| Replay | Replaying accepted commands reproduces checkpoint hashes |

### Property and fuzz testing

Generate both valid and invalid compact commands. Include repeated movement replacement, start/cancel spam, out-of-bounds targets, self-tow attempts, stale sequence reuse, zero-resource actions, transitions during disablement, capacity conflicts, packet duplication, early/late delivery and reconnects. The goal is deterministic rejection or legal state transition—not merely avoiding crashes.

### Fixed-seed scenario suite

Maintain named, versioned deterministic scenarios:

| Scenario | Focus |
|---|---|
| `route_basic` | Road/rough/forest route preferences and partial paths |
| `bridge_failure` | Damaged crossing, alternate route, repair and return |
| `tow_recovery` | Tow pair constraints, congestion, delivery and break states |
| `mine_counterplay` | Placement, detection, mark, clear and fog-safe route effects |
| `site_restoration` | Capture, sabotage, repair, supply and service derivation |
| `standard_run` | Capture, escort, drop, recovery, own-Standard condition and reset |
| `regency_return` | Disconnect, safe AI behaviour, reconnect and reclaim |
| `fog_filter` | Snapshot/delta contact transitions and no-leak assertions |
| `map_validation` | Candidate acceptance/rejection and fallback determinism |

### Soak simulation

Run deterministic headless AI-vs-AI operations across templates, seeds and ruleset variants. Measure win distribution, first-score time, total operation time, congestion, path failures, wreck recovery, resource starvation, role use, mission completion, route resilience, Standard movement, join usefulness, and number of invalid/retry events. Diagnose by seed/template/ruleset version and retain minimised failing replay logs.

## Quality gates before broad playtesting

| Gate | Required evidence |
|---|---|
| Determinism | Replays and repeated runs match canonical hash checkpoints |
| Fog integrity | Automated view tests prove hidden entities/mines/intent are absent from payloads |
| Route resilience | Validation probes pass for basic, heavy, tow and Standard paths after defined disruptions |
| Join flow | Fresh join at multiple operation phases yields a lawful useful role/asset/task |
| Recovery loop | Wrecks do not accumulate into permanent impassable corridors in soak runs |
| AI legality | AI action logs show only lawful knowledge/commands; no privileged actions |
| Performance | Tick profiling meets measured target on representative hardware and entity count |
| Parity readiness | Shared integer/canonicalisation utilities have fixture coverage before Luau port expands |

## Immediate next implementation decision

Before code structure is finalised, choose and document:

1. The exact canonical state serialisation and hash algorithm available in both Node.js and Luau.
2. The small integer PRNG algorithm and seed/sub-seed mixing method.
3. The fixed-point integer utility contract, including rounding and clamping rules.
4. The first minimal ruleset: one template, two assets, limited terrain, one site and one weapon.
5. The first fixture format used for replay and parity tests.

These are implementation choices that affect every later system and should be validated in a small parity spike before the broader engine grows.

## Local/LAN prototype addition

### Network assumptions to validate early

The first networked vertical slice is not pass-the-device hotseat. It is one browser/mobile device per player connected to an authoritative host over a shared local network. The network may be an ordinary Wi-Fi access point or, where peer-to-host connectivity is permitted, a phone hotspot. Internet access is not required.

| Test | Expected result |
|---|---|
| Two devices on same Wi-Fi | Both connect to host and receive independent filtered views |
| Host laptop on same access point | Browser/mobile clients join by local endpoint/QR flow |
| Phone-hotspot test | Record whether connected clients can reach host; show clear connection failure if isolated |
| No Internet connectivity | Local operation continues normally once LAN connection exists |
| Join after operation start | Player receives snapshot, map identity and lawful in-world role/asset choice |
| Leave during prototype | Asset enters safe idle/deactivated state; later replaced by regency test |

### Initial online/LAN acceptance criterion

Before broad multiplayer features, demonstrate a complete two-device LAN operation: each player joins the active `frontier_corridor` world from their own device, controls one team asset, sees only their permitted information, moves and fires independently, contests/captures the Relay, and reaches a deterministic replay-compatible outcome.

### Pre-skeleton discussion gates

Before documenting the full repository skeleton, settle the following interfaces rather than burying them as code assumptions:

1. Local/LAN endpoint, join identifier, QR/manual connection and connection-test flow.
2. Exact first-operation start, join, leave, end and immediate-restart lifecycle.
3. Minimal browser/mobile UI boundaries: camera, renderer, fog layer, HUD, command preview and in-world entry overlay.
4. Versioned ruleset-data format for terrain, assets, weapons, templates and constants.
5. Shared replay/parity fixture format.
6. Canonical writer/hash/PRNG/fixed-point primitive vectors.
7. Initial server session lifecycle, including empty-operation and reset behaviour.
8. Milestone 0–2 AI scope.
9. Browser rendering approach.
10. Local development/test/replay workflow.

These gates are intentionally compact. They ensure the code skeleton represents the proven first end-to-end operation instead of being an abstract directory diagram.

## Milestone 0: frozen handshake gate

Milestone 0 is now explicitly a cross-language primitive and canonicalisation gate, not an early gameplay implementation. It must finish before movement, combat, fog, LAN transport, or three.js presentation work begins.

### Required implementation order

1. Canonical byte-writer primitives and exact expected byte fixtures.
2. FNV-1a 64-bit two-limb implementation and vectors.
3. `mix32` vectors.
4. `sfc32` vectors, including state-after-output checks.
5. Fixed-point/vector helper vectors at 256 units per cell.
6. Canonical empty-state writer and tick-zero hash.
7. Deterministic 8×8 map microscope and static signature.
8. First one-entity movement replay.
9. 128×128 `frontier_corridor` static signature.

### Milestone 0 exit criteria

| Criterion | Required outcome |
|---|---|
| JS vectors | All 0A–0I fixtures are exact and reproducible |
| Luau vectors | Luau twin matches all pinned values and hashes exactly |
| Primitive validation | Invalid widths, non-integers, missing optional markers and unordered authoritative collections fail in development/test mode |
| Map diagnosis | 8×8 failure output identifies the differing cell/static section, not only unequal final signature |
| Replay diagnosis | A divergent movement replay identifies first differing checkpoint and canonical section/field |
| Data identity | Fixture records ruleset/template/generator/schema/protocol versions and applicable data hash |

### Renderer plan boundary

Three.js work begins only after deterministic state/view work exists. The browser renderer will run independently from the 10Hz authoritative cadence: render frames interpolate between confirmed snapshots and never run speculative authoritative physics. Rendering tests should retain a conservative compatibility path, including the project-proven WebGL1/SwiftShader verification discipline.

