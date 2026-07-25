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

## 4. Verify and land
- `npm test` fully green (247+ tests); flaky ws tests get poll-waits, not
  longer sleeps. Run `npm run sim2a` / `npm run simv1` if the slice touches
  combat, movement, supply, or standards.
- Commit locally: `marker-NNNN: <slice> (<pass-count>/<pass-count>)` (next
  NNNN from `git log`), add the `dev-log.md` entry, append any new product
  decision to `dev-prompts.md`. Never push.
