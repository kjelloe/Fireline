// test/milestone3a.test.js — Milestone 3A: unit roster & stats.
// Tank pins the historical 1G/1B constants; scout is fast and fragile;
// artillery is slow, long-armed, and has a minimum range.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  UNIT_TANK, UNIT_SCOUT, UNIT_ARTILLERY, UNIT_STATS, getUnitStats,
} from "../engine/units.js";
import { apply, createInitialState, BASE_SPEED } from "../engine/reducer.js";
import { resolveShot } from "../engine/combat.js";
import { ASSET_MOVING } from "../engine/state.js";
import { sandbox } from "./helpers.js";

test("3A stat table is pinned", () => {
  assert.deepEqual(getUnitStats(UNIT_TANK), {
    id: 0, name: "tank", speed: 32, range: 1280, minRange: 0, hp: 100, damage: 20, indirect: false, reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 8,
  });
  assert.equal(getUnitStats(UNIT_SCOUT).speed, 56);
  assert.equal(getUnitStats(UNIT_SCOUT).hp, 60);
  assert.equal(getUnitStats(UNIT_ARTILLERY).range, 3072);
  assert.equal(getUnitStats(UNIT_ARTILLERY).minRange, 768);
  assert.equal(getUnitStats(UNIT_ARTILLERY).indirect, true);
  assert.equal(getUnitStats(undefined).name, "tank", "unknown types fall back to tank");
  assert.equal(BASE_SPEED, getUnitStats(UNIT_TANK).speed);
});

test("3A frontier spawn mix cycles tank/tank/scout/artillery per team", () => {
  const s = createInitialState(42, "frontier_corridor");
  assert.equal(s.assets.length, 32, "v1 scale: 32 field assets");
  assert.deepEqual(s.assets.slice(0, 8).map((a) => a.type), [0, 0, 1, 2, 0, 0, 1, 2],
    "original eight unchanged");
  for (const team of [0, 1]) {
    const teamAssets = s.assets.filter((a) => a.team === team);
    assert.equal(teamAssets.length, 16);
    assert.equal(teamAssets.filter((a) => a.type === 0).length, 5, "5 tanks");
    assert.equal(teamAssets.filter((a) => a.type === 1).length, 3, "3 scouts");
    assert.equal(teamAssets.filter((a) => a.type === 2).length, 3, "3 artillery");
    assert.equal(teamAssets.filter((a) => a.type === 3).length, 3, "3 logistics trucks");
    assert.equal(teamAssets.filter((a) => a.type === 4).length, 2, "2 command carriers");
  }
  assert.equal(s.assets[2].hp, 60, "scout spawns with scout hp");
  assert.equal(s.assets[3].hp, 80, "artillery spawns with artillery hp");
});

test("3A scout outruns tank on the same terrain", () => {
  let s = sandbox([
    { team: 0, cellX: 0, cellY: 0, type: UNIT_TANK, state: ASSET_MOVING, targetX: 4096 },
    { team: 0, cellX: 0, cellY: 2, type: UNIT_SCOUT, state: ASSET_MOVING, targetX: 4096 },
    { team: 0, cellX: 0, cellY: 4, type: UNIT_ARTILLERY, state: ASSET_MOVING, targetX: 4096 },
  ]);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x, 32);
  assert.equal(s.assets[1].x, 56);
  assert.equal(s.assets[2].x, 16);
});

test("3A damage comes from the attacker's chassis", () => {
  assert.equal(resolveShot({ type: UNIT_TANK }, {}).hpDelta, 20);
  assert.equal(resolveShot({ type: UNIT_SCOUT }, {}).hpDelta, 10);
  assert.equal(resolveShot({ type: UNIT_ARTILLERY }, {}).hpDelta, 30);
});

test("3A data/units.json mirror matches engine stats", () => {
  const mirror = JSON.parse(readFileSync(new URL("../data/units.json", import.meta.url)));
  assert.deepEqual(mirror.units, JSON.parse(JSON.stringify(UNIT_STATS)));
});
