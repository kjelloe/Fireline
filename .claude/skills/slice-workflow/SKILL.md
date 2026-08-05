---
name: slice-workflow
description: Deliver a new gameplay slice for More Firepower end to end (design → tests → engine → wiring → marker commit). Use when implementing any new mechanic, milestone (8x/9x...), or plan item from plan-version1.md or a designer spec.
---

# Delivering a slice

The repo is built slice-by-slice with tests as the contract (see `dev-log.md`
for 29 worked examples). Follow this shape:

## 1. Design against the layer map
- Outcomes/rules/state → `engine/` (pure, integer math, no I/O, no deps).
- Persistence/networking/lifecycle → `server/`.
- Anything the player sees → a **pure model module** in `client/js/`
  (node-testable) plus thin three.js/DOM wiring in `client/js/client.js`.
- Write the export list BEFORE code; tests may only import listed exports.

## 2. Tests first
- `test/milestone<slice>.test.js`: the spec's acceptance criteria plus
  self-tests (rejection paths, determinism, event shapes).
- Build states with `test/helpers.js` (`sandbox`, `makeAsset`,
  `joinAndSelect`, `joinSelectMove`). Sandbox defaults: whole-map bases
  (supply-neutral) and NO standards — pass `opts.standards`/`opts.bases`
  when the slice needs them, or instant-scoring/supply artifacts will bite.
- Command-driven only: reducer state changes flow through `apply`; direct
  state pokes are test setup shortcuts, never assertions of behavior.

## 3. Engine rules (non-negotiable)
- New commands: constant + validation in `engine/commands.js`, handler in
  the reducer, every failure a `rejected` event with a specific reason —
  then add human text for that reason in `client/js/feedback_model.js`
  (milestone8h's source-sweep test enforces this).
- New hashed fields → invoke the `fixture-repin` skill.
- New events → map them in `feedback_model.js`, `audio_cues.js`,
  `vfx_cues.js`, and `server/metrics.js` if balance-relevant.

## 3b. Layer-specific contracts (learned the hard way)
- **Player-facing text** → BOTH catalogs in `client/js/strings.js` (en +
  no). A parity test refuses a half-translated UI.
- **A new MAP profile** → three mirror-closed tables added together or
  not at all: `MAP_LAYOUTS` (state.js), `GRAPHS` (route_graph.js),
  `PATROLS` (ai_regency.js). And every objective must sit within
  `CAPTURE_SEEK_CELLS` (16, Manhattan) of somewhere units actually go,
  or it is never captured by anyone (18C).
- **New terrain behaviour** → ask what it does to towing, carrying,
  boarding, MPG rebuild spawns, and the route graph before trusting a
  sweep.

## 4. Verify and land
- `npm test` fully green (547+ tests, double-run); flaky ws tests get
  poll-waits, not longer sleeps.
- **Gate by layer** — the suite alone has never been enough:
  - gameplay/engine → the `sim-campaign` skill's 5-seed gate; balance
    claims need sweep scale (300+), never 5 seeds.
  - client → `node tools/client_smoke.mjs` AND
    `node tools/ui_acceptance.mjs`. These found the keydown TDZ that
    killed every keybind and the z-index that buried the whole HUD.
    Add an acceptance check for any new button or key.
  - Run `npm run sim2a` / `npm run simv1` if the slice touches combat,
    movement, supply, or standards.
- **When a playtest reports a VISUAL bug, reason about the rendered
  shape, not just the transform.** The move-marker "180° out" was
  cleared once by reading the rotation math (correct) while the geometry
  built an arrow whose dominant blades pointed backwards (18D).
- Commit locally: `marker-NNNN: <slice> (<pass-count>/<pass-count>)` (next
  NNNN from `git log`), add the `dev-log.md` entry, append any new product
  decision to `dev-prompts.md`. Never push.

## A new COMMAND needs four entries (learned W4-6, 2026-08-05)

`validate()` in `engine/commands.js` is an ALLOWLIST — an unknown
command type is refused there, before the reducer's switch ever runs,
and the refusal event is typed `"rejected"`. So a new command needs:

1. the constant in `engine/commands.js`
2. a **`validate()` case** — miss this and the command is a SILENT
   no-op: correctly dispatched, correctly handled, and never reached
3. the `case` in the reducer's switch
4. the handler itself

Symptom of a missing #2: the command "does nothing" with no rejection
you recognise, because you are grepping for the wrong event type.
