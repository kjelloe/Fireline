// test/milestone12b.test.js — Slice 12B: the Directorate Sentinel
// (designer ruling, prompt 29). Deploy Hardpoint: 3 s each way, immobile
// and guns cold during transition; ACTIVE = artillery-class direct reach.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, HARDPOINT_TRANSITION_TICKS } from "../engine/reducer.js";
import { getUnitStats, effectiveCombat, UNIT_SENTINEL, UNIT_STATS } from "../engine/units.js";
import { createInitialState } from "../engine/state.js";
import { hashState } from "../engine/snapshot.js";
import { buildView } from "../engine/view.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

function sentinel(extra = []) {
  let s = sandbox([{ team: 0, cellX: 20, cellY: 20, type: UNIT_SENTINEL }, ...extra]);
  return joinAndSelect(s, 0, 0, 0);
}

test("12B contract: only the Sentinel deploys; Directorate-only fielding", () => {
  for (const [type, stats] of Object.entries(UNIT_STATS)) {
    assert.equal(typeof stats.deployable, "boolean", `chassis ${type} explicit`);
    assert.equal(stats.deployable, Number(type) === UNIT_SENTINEL);
  }
  const s0 = createInitialState(42, "frontier_corridor");
  const sentinels = s0.assets.filter((a) => a.type === UNIT_SENTINEL);
  assert.equal(sentinels.length, 1, "one Sentinel in the whole war");
  assert.deepEqual([sentinels[0].team, sentinels[0].id], [0, 18],
    "Directorate garage slot idx 10 (no 17th asset)");
});

test("12B the hardpoint cycle: deploy, fight heavy, undeploy, move again", () => {
  let s = sentinel();
  assert.deepEqual(effectiveCombat(s.assets[0]),
    { range: 1024, minRange: 0, damage: 8, reloadTicks: 20 }, "mobile: a light gun");

  s = apply(s, { type: "deploy_hardpoint", operatorId: 0 });
  assert.ok(s.events.some((e) => e.type === "hardpoint_deploying"));
  // Transitioning: immobile, guns cold, no double-deploy.
  const move = apply(s, { type: "move_order", operatorId: 0, targetCellX: 30, targetCellY: 20 });
  assert.equal(move.events[0].reason, "deployed — undeploy to move");
  const again = apply(s, { type: "deploy_hardpoint", operatorId: 0 });
  assert.equal(again.events[0].reason, "still transitioning");
  assert.deepEqual(effectiveCombat(s.assets[0]).damage, 8, "no bonus until ACTIVE");

  for (let i = 0; i < HARDPOINT_TRANSITION_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "hardpoint_active"));
  assert.deepEqual(effectiveCombat(s.assets[0]),
    { range: 2048, minRange: 0, damage: 25, reloadTicks: 20 },
    "ACTIVE: artillery-class direct reach");

  const drive = apply(s, { type: "drive", operatorId: 0, throttle: 1, turn: 0 });
  assert.equal(drive.events[0].reason, "deployed — undeploy to move");

  s = apply(s, { type: "undeploy", operatorId: 0 });
  for (let i = 0; i < HARDPOINT_TRANSITION_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "hardpoint_stowed"));
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 22, targetCellY: 20 });
  for (let i = 0; i < 60; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x, cellToWorld(22), "mobile again");
});

test("12B an ACTIVE hardpoint outranges a tank and hits harder", () => {
  // Enemy tank at 7 cells: outside mobile range (4), inside deployed (8).
  let s = sentinel([{ team: 1, cellX: 27, cellY: 20, hp: 30 }, { team: 1, cellX: 60 }]);
  const cold = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(cold.events[0].reason, "target out of range", "mobile gun can't reach");

  s = apply(s, { type: "deploy_hardpoint", operatorId: 0 });
  const mid = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(mid.events[0].reason, "still transitioning", "guns cold while legs work");
  for (let i = 0; i < HARDPOINT_TRANSITION_TICKS; i++) s = apply(s, { type: "advance_tick" });
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  const hit = s.events.find((e) => e.type === "fire_resolved");
  assert.equal(hit?.hpDelta, 25, "deployed shells hit at the deployed weight");
});

test("12B ordinary chassis cannot deploy; wrecking folds the legs", () => {
  let tank = sandbox([{ team: 0, cellX: 5 }]);
  tank = joinAndSelect(tank, 0, 0, 0);
  const no = apply(tank, { type: "deploy_hardpoint", operatorId: 0 });
  assert.equal(no.events[0].reason, "cannot deploy here");

  let s = sentinel([{ team: 1, cellX: 22, cellY: 20 }, { team: 0, cellX: 60 }]);
  s = apply(s, { type: "deploy_hardpoint", operatorId: 0 });
  for (let i = 0; i < HARDPOINT_TRANSITION_TICKS; i++) s = apply(s, { type: "advance_tick" });
  s.assets[0].hp = 10;
  s = joinAndSelect(s, 16, 1, 1);
  s = apply(s, { type: "fire_order", operatorId: 16, targetAssetId: 0 });
  assert.equal(s.assets[0].deployed, 0, "a wreck holds no hardpoint");
  assert.equal(s.assets[0].deployTimer, 0);
});

test("12B deployment is public to the enemy; state is hashed", () => {
  let s = sentinel([{ team: 1, cellX: 22, cellY: 20 }]);
  s = apply(s, { type: "deploy_hardpoint", operatorId: 0 });
  for (let i = 0; i < HARDPOINT_TRANSITION_TICKS; i++) s = apply(s, { type: "advance_tick" });
  const enemyView = buildView(s, 1);
  const seen = enemyView.visibleEnemies.find((e) => e.id === 0);
  assert.equal(seen?.deployed, 1, "a raised hardpoint is externally obvious");

  const a = sentinel();
  const b = sentinel();
  b.assets[0].deployed = 1;
  assert.notEqual(hashState(a), hashState(b));
  const c = sentinel();
  c.assets[0].deployTimer = 5;
  assert.notEqual(hashState(a), hashState(c));
});
