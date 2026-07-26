---
name: new-chassis
description: Add a new vehicle chassis/unit type to More Firepower end to end (engine stats through art pipeline and tests). Use for Command Carrier, Sentinel, Infiltrator, drone, or any roster addition.
---

# Adding a chassis

Worked example: the Logistics Truck (marker-0037, `dev-log.md`). The test
suite enforces most of this checklist — run `npm test` early and let failures
point at what's missing.

## 1. Engine
- `engine/units.js`: `UNIT_<NAME> = <next id>` + a frozen stats entry.
  EVERY field explicit: speed/range/minRange/hp/damage/reloadTicks,
  `indirect`, `canTow` — `roster_gaps.test.js` rejects implicit booleans.
  New capability flags (e.g. `canCarryStandard` for the Carrier ruling)
  follow the same pattern: explicit on ALL chassis.
- Fielding: `engine/state.js` spawn tables. Asset ids 0-7 are pinned
  (tank/tank/scout/artillery per team) — new chassis go into the reserve
  cycle (`RESERVE_TYPES`) or new slots ≥32 (which changes OPERATOR pairing —
  check `engine/ai_regency.js` AGENTS).
- Role gating lives where the role lives: tow in `engine/recovery.js`
  `towRejection`, carrying checks in `engine/standards.js`, etc. Every new
  rejection reason needs text in `client/js/feedback_model.js`
  (milestone8h source-sweep enforces this).
- AI: decide the chassis' doctrine in `engine/ai_regency.js` (fire eligibility
  is automatic via stats; movement roles — raider/recoverer/patrol — are
  explicit and deterministic).

## 2. Data + fixtures
- Regenerate the mirror: the one-liner in dev-log (writes `data/units.json`
  from UNIT_STATS) — milestone3a pins equality.
- Update milestone3a stat pins / spawn-mix counts.
- `node tools/repin_1a.mjs "<chassis> fielded ..."` if spawn tables changed.

## 3. Art pipeline (tests enforce all of it)
- `client/js/asset_resolver.js` CHASSIS_NAMES entry.
- `client/assets/metadata/asset_manifest.json`: `unit_<name>` + `wreck_<name>`
  entries (webglModel path, procedural key, fallbackSprite, minimapIcon,
  triBudget).
- `client/assets/metadata/anchor_points.json`: towRear/towFront/banner.
- `client/js/asset_factory.js`: procedural builder (chunky silhouette,
  `team_panel` slot) + wreck variant + BUILDERS entries.
- `tools/build_assets.mjs`: icon glyph + sprite mapping; run it.

## 4. Tests
- Extend `roster_gaps.test.js` (fielding counts, role gating over ws).
- A behavior test for whatever the chassis uniquely does.
- Run soaks if movement/combat balance shifts: `npm run sim2a`,
  `npm run simv1`, `npm run simwar` (AI objective wars).

## 5. Land it
- `npm test` green twice, dev-log entry, `marker-NNNN` commit.
