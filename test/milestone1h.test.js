// test/milestone1h.test.js — Milestone 1H: fog of war LOS + suppression visibility.
// Ported to the authoritative engine. Suppression is a timer (coexists with
// IDLE/MOVING) rather than an asset state; wrecks are visible battlefield
// features. Covers the six acceptance criteria in phases/phase1/plan.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, createInitialState } from "../engine/reducer.js";
import {
  computeVisible, sensorRadius, FOG_RADIUS_CELLS, SUPPRESSED_RADIUS_CELLS,
} from "../engine/los.js";
import { SUPPRESSION_TICKS } from "../engine/combat.js";
import { ASSET_IDLE, ASSET_DISABLED, isSuppressed } from "../engine/state.js";
import { buildView } from "../engine/view.js";
import { T_OPEN } from "../engine/mapgen.js";
import { cellToWorld } from "../shared/fixedmath.js";

function sandbox(assetSpecs) {
  const size = 64;
  const map = { width: size, height: size, cells: new Uint8Array(size * size).fill(T_OPEN), seed: 1 };
  const state = createInitialState(1, map);
  state.assets = assetSpecs.map((spec, id) => ({
    id, type: 0, team: spec.team, state: spec.state ?? ASSET_IDLE,
    x: cellToWorld(spec.cellX), y: cellToWorld(spec.cellY ?? 0),
    targetX: cellToWorld(spec.cellX), targetY: cellToWorld(spec.cellY ?? 0),
    hp: spec.hp ?? 100, operatorId: -1, moveProgress: 0,
    suppressedTimer: spec.suppressedTimer ?? 0,
  }));
  return state;
}

test("1H enemy asset outside fog radius is hidden in view", () => {
  const s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: FOG_RADIUS_CELLS + 1 },
  ]);
  assert.equal(buildView(s, 0).visibleEnemies.length, 0);
});

test("1H enemy asset inside fog radius is visible in view", () => {
  const s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: FOG_RADIUS_CELLS },
  ]);
  assert.equal(buildView(s, 0).visibleEnemies.length, 1);
});

test("1H suppressed asset has reduced visibility radius", () => {
  const suppressed = sandbox([
    { team: 0, cellX: 0, suppressedTimer: 10 },
    { team: 1, cellX: SUPPRESSED_RADIUS_CELLS + 1 },
  ]);
  assert.equal(sensorRadius(suppressed.assets[0]), SUPPRESSED_RADIUS_CELLS);
  assert.equal(
    buildView(suppressed, 0).visibleEnemies.length, 0,
    "beyond suppressed radius must be hidden"
  );

  const stillClose = sandbox([
    { team: 0, cellX: 0, suppressedTimer: 10 },
    { team: 1, cellX: SUPPRESSED_RADIUS_CELLS },
  ]);
  assert.equal(buildView(stillClose, 0).visibleEnemies.length, 1);
});

test("1H disabled wreck remains visible regardless of fog", () => {
  const s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 50, state: ASSET_DISABLED, hp: 0 },
  ]);
  const view = buildView(s, 0);
  assert.equal(view.visibleEnemies.length, 1);
  assert.equal(view.visibleEnemies[0].state, ASSET_DISABLED);
});

test("1H computeVisible returns correct set for team 0", () => {
  const s = sandbox([
    { team: 0, cellX: 0 },                          // 0: own sensor
    { team: 1, cellX: 5 },                          // 1: in range
    { team: 1, cellX: 40 },                         // 2: fogged
    { team: 1, cellX: 60, state: ASSET_DISABLED },  // 3: wreck, always seen
  ]);
  assert.deepEqual([...computeVisible(s, 0)].sort(), [1, 3]);
});

test("1H computeVisible returns correct set for team 1", () => {
  const s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 5 },
    { team: 1, cellX: 40 },
    { team: 1, cellX: 60, state: ASSET_DISABLED },
  ]);
  assert.deepEqual([...computeVisible(s, 1)].sort(), [0]);
});

// ── additional 1H self-tests ──────────────────────────────────────────────────

test("1H taking fire suppresses the target and it recovers after the timer", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 2 },
  ]);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0 });
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.assets[1].suppressedTimer, SUPPRESSION_TICKS);
  assert.equal(isSuppressed(s.assets[1]), true);

  for (let i = 0; i < SUPPRESSION_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[1].suppressedTimer, 0);
  assert.equal(isSuppressed(s.assets[1]), false);
});

test("1H disabling shot does not leave a suppression timer on the wreck", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 2, hp: 20 },
  ]);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0 });
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.assets[1].state, ASSET_DISABLED);
  assert.equal(s.assets[1].suppressedTimer, 0);
});

test("1H wrecked sensors cannot see for their team", () => {
  const s = sandbox([
    { team: 0, cellX: 0, state: ASSET_DISABLED, hp: 0 },
    { team: 1, cellX: 2 },
  ]);
  assert.equal(computeVisible(s, 0).size, 0, "a wreck is not a sensor");
});
