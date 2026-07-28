# Operational Warfare Game — Project Documentation

A new-IP, top-down, mobile-friendly operational warfare game built on a
reusable deterministic stack: one pure reducer that runs in the browser
(desktop + mobile), on a self-hostable Node.js server, and as a Roblox/Luau
port — with every variant provably running the same rules.

---

## Quick start — reading order

| Step | File | Purpose |
|---:|---|---|
| 1 | `01_concept_brief.md` | Vision, player promise, session framing and high-level loop |
| 2 | `02_detailed_systems_document.md` | Full game systems, roles, missions, art/audio/UI |
| 3 | `04_technical_workthrough.md` | Deterministic simulation contracts: movement, combat, fog, AI, networking, maps |
| 4 | `05_implementation_and_validation_plan.md` | Vertical-slice milestones, acceptance criteria, test strategy, quality gates |
| 5 | `03_decisions_and_open_questions.md` | Original confirmed design decisions and open design questions |
| 6 | `06_decisions_and_open_questions_update.md` | Technical decisions locked, V1 boundaries, open implementation choices, risks |

`00_document_index_update.md` gives a one-page map of all documents and how they relate.

### Living documents (updated as the build rules)

Documents 01–06 are the ORIGINAL design record. Documents 07+ are
maintained against the shipped implementation — when the two disagree,
07+ wins.

| File | Purpose |
|---|---|
| `07_rulings_register.md` | Every product ruling in force, by area — the first place to look before designing anything |
| `08_fairness_and_symmetry.md` | The mirror doctrine: invariants, instruments, campaign pattern, which world decides a verdict, accepted residues |
| `09_ai_regency_doctrine.md` | AI regent behaviour: crewing ladder, errand priority, movement, and the post-mortems behind each rule |
| `10_map_roster.md` | Map design of record: checklist audit, hard profile constraints, the shipped profiles, the future-map bank, promotion gate |

Reference material handed in by the designer (`gameplay-*.md`,
`faction-name-and-units.md`, `title-and-naming.md`, `game-discovery.md`)
is input, not record — its verdicts live in 07 and in `reports/`.

---

## What this game is

A session-based, drop-in/drop-out operational warfare game for 2–16 human
players (plus AI filling remaining slots up to 32 active entities). Target
session: 20–30 minutes, joinable at any point with no mandatory lobby.

Players control one asset at a time — tank, scout, logistics truck, infiltrator,
or command carrier — switching freely at friendly operational sites. The game
favours disablement, recovery, repair, rescue, and salvage over instant
deletion. The highest-value event is capturing and returning the enemy's
**Command Standard** while keeping your own secure at home base.

---

## The stack in one paragraph

One **pure, deterministic simulation core** written in a restricted,
Lua-portable subset of JavaScript, wrapped by thin adapters: a no-build
browser client, a Node.js WebSocket server, and a Roblox/Luau twin of the
engine. The engine is a reducer:

```
apply(state, command) → nextState
```

No I/O, no clocks, no hidden state. That single decision makes multiplayer,
replays, saves, cheat-proofing, the Roblox port, headless testing, and AI
soaks cheap instead of heroic.

---

## Key technical constraints

| Property | Value |
|---|---|
| Tick rate | 10 Hz fixed simulation tick |
| Grid | 128 × 128 logical cells, 256 fixed-point units per cell |
| Arithmetic | Integer-only for all authoritative state |
| State size | Target < 1 MB per active operation |
| Active entities | Up to 32 (human + AI combined) |
| Human players | 2–16 per operation |
| Session target | 20–30 minutes; meaningful 10–15 minute participation supported |
| Joining | No mandatory lobby; in-world overlay role/asset selection |

---

## Document set

### Game Design Documents

| File | Scope |
|---|---|
| `01_concept_brief.md` | Vision, player promise, high-level loop, session and world framing |
| `02_detailed_systems_document.md` | Detailed game systems, roles, missions, art/audio/UI and gameplay decisions |
| `03_decisions_and_open_questions.md` | Confirmed design decisions, version boundaries, unresolved design questions |

### Technical Documents

| File | Scope |
|---|---|
| `04_technical_workthrough.md` | Full technical contracts: reducer, movement, combat, fog, sites, commands, AI, networking, seeded maps, testing |
| `05_implementation_and_validation_plan.md` | Vertical slices, acceptance criteria, test suites, soak metrics, parity plan, quality gates |
| `06_decisions_and_open_questions_update.md` | Technical decisions locked, V1 boundaries, open implementation choices, risks |
| `00_document_index_update.md` | Full document index and reading guide |

---

## Milestone overview

| # | Name | Goal |
|---:|---|---|
| 0 | Determinism foundation | Reducer, canonical state, fixed tick, seeded blank map, replay hash |
| 1 | Humble Tank | One asset routes over seeded terrain in browser/local |
| 2 | Tactical Duo | Two mobility profiles, fog, area action, damage, wreck creation |
| 3 | Rescuer | Tow/recovery, downed operator, site capture/repair/service |
| 4 | Operational Battle | Resources, missions, AI director, Command Standard lifecycle |
| 5 | No-Lobby Online | Node server, filtered snapshots/deltas, reconnect, regency |
| 6 | Mirror Stack | Luau parity harness, Roblox adapter, cross-runtime hash fixtures |
| 7 | Alpha Content | Templates, assets, art, audio, balance, telemetry |

---

## Immediate next decisions (before code structure is finalised)

1. Canonical state serialisation format and hash algorithm (must work in Node.js and Luau).
2. Integer PRNG algorithm and sub-seed mixing method.
3. Fixed-point integer utility contract (rounding and clamping rules).
4. First minimal ruleset: one template, two assets, limited terrain, one site, one weapon.
5. First fixture format for replay and parity tests.

---

## Art direction candidates (decision pending)

- **Retro-futurist fictional conflict** — stylised near-future corporate war (Syndicate-adjacent).
- **Dieselpunk / alternate 1980s** — grounded alternate-history aesthetic.
- **Abstract tactical diorama** — coloured-faction generic fallback with maximum mobile readability.

Final choice requires art samples and mobile readability testing.

## Local multiplayer decision

Traditional pass-the-device hotseat is not a planned mode: continuous simulation and fog-of-war are better served by **one browser/mobile device per player**.

A local host runs the authoritative Node.js server. Players join from their own devices over the same Wi-Fi access point or, when the hotspot allows local client-to-host communication, a phone hotspot. Internet access is not required for LAN play. The initial LAN proof is two devices, one asset per team, independent fog-filtered views, and a neutral Relay objective.

Before the repository skeleton is finalised, the remaining focused decisions are the LAN join/operation lifecycle, minimal UI boundaries, versioned ruleset and fixture formats, parity primitive vectors, server lifecycle, early AI scope, browser renderer choice, and local development workflow.

## Renderer and parity-spike decisions

The browser/mobile presentation uses the established three.js approach from RetroMultiCiv: a lightly tilted, mostly orthographic 2.5D tactical camera, stable constrained zoom, no first-slice rotation, and a clear **Centre on Asset** action. The renderer is strictly non-authoritative and draws only fog-filtered views, interpolating confirmed 10Hz snapshots at display frame rate.

Milestone 0 begins with a byte-level parity handshake: little-endian `u8`/`u16`/`u32`/`i32` writing, FNV-1a 64-bit two-limb hashes, `mix32` + state-held `sfc32`, and 256-units-per-cell fixed point. A human-inspectable 8×8 map fixture precedes the 128×128 `frontier_corridor` map-parity fixture. Versioned ruleset JSON is stored under `data/`, not in engine code or `shared/`.

