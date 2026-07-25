// test/milestone8e.test.js — Milestone 8E: fire cooldown.
// The reducer enforces per-chassis reload; clicking faster changes nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { getUnitStats, UNIT_TANK, UNIT_SCOUT, UNIT_ARTILLERY } from "../engine/units.js";
import { hashState } from "../engine/snapshot.js";
import { buildView } from "../engine/view.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function duelState(attackerType) {
  let s = sandbox([
    { team: 0, cellX: 0, type: attackerType },
    { team: 0, cellX: 4, type: UNIT_SCOUT },  // spotter so artillery works too
    { team: 1, cellX: 4, cellY: 1, hp: 10000 },
  ]);
  return joinAndSelect(s, 0, 0, 0);
}

test("8E per-chassis reload values are pinned", () => {
  assert.equal(getUnitStats(UNIT_TANK).reloadTicks, 15);
  assert.equal(getUnitStats(UNIT_SCOUT).reloadTicks, 8);
  assert.equal(getUnitStats(UNIT_ARTILLERY).reloadTicks, 40);
});

test("8E fire at T works, T+1 is rejected, T+reload works again", () => {
  let s = duelState(UNIT_TANK);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.equal(s.events[0].type, "fire_resolved");
  assert.equal(s.assets[0].reloadTimer, 15);

  const spam = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.deepEqual(spam.events, [
    { type: "rejected", cmd: "fire_order", reason: "reloading" },
  ]);

  s = apply(s, { type: "advance_tick" });
  const early = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.equal(early.events[0].reason, "reloading", "one tick is not enough");

  for (let i = 0; i < 14; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].reloadTimer, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.equal(s.events[0].type, "fire_resolved", "loaded again at T+reload");
});

test("8E rejected spam mutates nothing", () => {
  let s = duelState(UNIT_TANK);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  const h = hashState(s);
  let spam = s;
  for (let i = 0; i < 5; i++) {
    spam = apply(spam, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  }
  assert.equal(hashState(spam), h, "click racing achieves nothing");
});

test("8E artillery pays the longest reload", () => {
  let s = duelState(UNIT_ARTILLERY);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.equal(s.events[0].type, "fire_resolved");
  assert.equal(s.assets[0].reloadTimer, 40);
});

test("8E reload ticks down while moving and is visible to the owner only", () => {
  let s = duelState(UNIT_TANK);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 10, targetCellY: 0 });
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].reloadTimer, 14, "reload progresses on the move");

  const own = buildView(s, 0).friendlyAssets.find((a) => a.id === 0);
  assert.equal(own.reloadTimer, 14);
  const enemyView = buildView(s, 1);
  const seen = enemyView.visibleEnemies.find((a) => a.id === 0);
  assert.equal(seen && "reloadTimer" in seen, false, "enemy reload state stays hidden");
});

test("8E cooldown behavior is deterministic across runs", () => {
  const run = () => {
    let s = duelState(UNIT_SCOUT);
    for (let i = 0; i < 30; i++) {
      s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
      s = apply(s, { type: "advance_tick" });
    }
    return hashState(s);
  };
  assert.equal(run(), run());
});
