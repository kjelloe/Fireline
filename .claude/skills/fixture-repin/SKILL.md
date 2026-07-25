---
name: fixture-repin
description: Re-pin the 1A reducer fixture after a deliberate state-schema change in More Firepower. Use whenever a field is added/removed from hashed state, or milestone1a fails with hash mismatches after an intentional engine change.
---

# Re-pinning the 1A fixture

`test/fixtures/1A_reducer.json` is the oldest surviving contract of the
reconstructed engine. Its 14-step command script and every event payload are
**verbatim from v1** and must never change — only the hashes evolve with the
state schema. It has been re-pinned 12+ times (v1→v12); this is the ritual.

## Steps

1. Make the schema change deliberate: new hashed fields must be written in
   **BOTH** `engine/snapshot.js` `hashState` **AND** the local hash function
   in `test/milestone1a.test.js` (same order, same widths, `// added <slice>`
   comment). If it isn't worth hashing, it isn't authoritative state.
2. Give every new field a default in `engine/state.js` asset/state builders
   **AND** in `test/helpers.js` `makeAsset`/`sandbox` (spec-overridable).
3. Run: `node tools/repin_1a.mjs "<one-line reason, e.g. 'fire cooldown reloadTimer (slice 8E)'>"`
   - It bumps `fixtureVersion`, rewrites hashes, and **aborts if any event
     drifts** — event drift means the reducer regressed; fix the reducer,
     never hand-edit the fixture's events.
4. `npm test` — the 1A tests plus `baseline.test.js` (which cross-pins the
   initial hash against the fixture) must go green together.
5. Mention the fixture version bump in the `dev-log.md` entry and commit.

## Never

- Never regenerate because a hash "looks wrong" with no intended schema
  change — that's a determinism bug to hunt, not a pin to refresh.
- Never edit steps/events/rejectionCases in the fixture by hand.
