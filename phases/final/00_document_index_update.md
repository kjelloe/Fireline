# Documentation Index — Update

## Existing design-document set

| File | Scope |
|---|---|
| `01_concept_brief.md` | Vision, player promise, high-level loop, session and world framing |
| `02_detailed_systems_document.md` | Detailed game systems, roles, missions, art/audio/UI and gameplay decisions |
| `03_decisions_and_open_questions.md` | Original confirmed decisions, version boundaries and unresolved design questions |

## New technical-document set

| File | Scope |
|---|---|
| `04_technical_workthrough.md` | Full technical contracts for deterministic simulation, movement, combat, sites, commands, AI, networking, seeded maps and testing |
| `05_implementation_and_validation_plan.md` | Vertical slices, acceptance criteria, test strategy, soak metrics and quality gates |
| `06_decisions_and_open_questions_update.md` | Technical decisions now locked, V1 boundaries, implementation questions still intentionally open and risks |

## Recommended reading order

1. `01_concept_brief.md`
2. `02_detailed_systems_document.md`
3. `04_technical_workthrough.md`
4. `05_implementation_and_validation_plan.md`
5. `03_decisions_and_open_questions.md`
6. `06_decisions_and_open_questions_update.md`

## How the documents relate

- The concept and systems documents establish **what the game is and why it should be fun**.
- The technical workthrough defines **how that game remains deterministic, fog-safe, mobile-legible and multiplayer-ready**.
- The implementation plan establishes **the smallest safe order to prove the design**.
- The two decision documents retain both original design choices and newly agreed technical constraints, while preventing unresolved choices from being silently treated as settled.

## Latest update: local/LAN play and pre-skeleton planning

The technical and planning documents now explicitly record that traditional hotseat is not a fit for this semi-real-time fog-of-war game. The preferred local mode is one browser/mobile device per player connected to an authoritative LAN host through a shared Wi-Fi access point or, where supported by the device/network, a phone hotspot. The first LAN vertical slice is a two-device, two-team Relay operation with independent filtered views.

Before repository skeleton work, the next discussion sequence is: local join and operation lifecycle; minimal browser/mobile UI boundaries; ruleset and parity-fixture formats; canonical primitive vectors; server lifecycle; minimal AI scope; rendering choice; and development workflow.

## Latest update: renderer and Milestone 0 contract

The document set now records the renderer decision—reuse the RetroMultiCiv-style three.js client with a lightly tilted, mostly orthographic 2.5D tactical camera—and the frozen canonicalisation contract: little-endian integer primitives, numeric-first state, FNV-1a 64-bit two-limb hashing, `mix32`/`sfc32`, 256-unit fixed point, explicit optional markers, and 0-based logical grid conventions.

Milestone 0 is indexed as a strict fixture ladder from byte primitives through an 8×8 map microscope, one-entity replay, and finally 128×128 `frontier_corridor` parity. Ruleset JSON belongs in `data/`; the skeleton must be staged around the primitive gate rather than pre-creating gameplay/adapters.

