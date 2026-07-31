// test/caltrops.test.js — Q45/Q50 chase-shapers (designer table,
// specs/12): light units strew slow-only patches; DISTINCT from mines
// — delay pursuit, never punish. No damage, no stacking, truck rakes,
// self-expiry.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { AIRegency } from "../engine/ai_regency.js";
import {
  CALTROP_TICKS, CALTROP_SLOW_NUM, CALTROP_SLOW_DEN,
} from "../engine/caltrops.js";
import { UNIT_BIKE, UNIT_SCOUT, getUnitStats } from "../engine/units.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const drop = (s, opId) => apply(s, { type: "deploy_caltrops", operatorId: opId });

test("caltrops: light chassis carry racks, heavies carry none", () => {
  assert.equal(getUnitStats(UNIT_BIKE).caltrops, 2);
  assert.equal(getUnitStats(UNIT_SCOUT).caltrops, 2);
  assert.equal(getUnitStats(0).caltrops, undefined, "tanks lay mines instead");
});

test("caltrops: drop, rack decrement, no stacking, tank rejected", () => {
  let s = sandbox([
    { team: 0, type: UNIT_BIKE, cellX: 20, cellY: 20 },
    { team: 0, type: 0, cellX: 30, cellY: 30 },
  ]);
  s = joinAndSelect(s, 20, 0, 0);
  s = joinAndSelect(s, 21, 0, 1);
  s = drop(s, 20);
  assert.equal(s.caltrops.length, 1);
  assert.equal(s.assets[0].caltropsLeft, 1);
  assert.equal(s.events.at(-1).type, "caltrops_deployed");
  s = drop(s, 20);
  assert.equal(s.events.at(-1).reason, "already strewn here", "no stacking");
  const tank = drop(s, 21);
  assert.equal(tank.events.at(-1).reason, "this chassis carries no caltrops");
});

test("caltrops: enemies crossing the patch run 30% slower; owners do not", () => {
  // Two identical team-0 bikes (spawn-facing EAST, so no pivot ticks)
  // racing east — one over a hostile patch, one over its own team's.
  let s = sandbox([
    { team: 0, type: UNIT_BIKE, cellX: 10, cellY: 10 }, // crosses ENEMY patch
    { team: 0, type: UNIT_BIKE, cellX: 10, cellY: 30 }, // crosses own patch
  ]);
  s.caltrops = [
    { id: 0, team: 1, cellX: 10, cellY: 10, ticksLeft: 400 },
    { id: 1, team: 0, cellX: 10, cellY: 30, ticksLeft: 400 },
  ];
  s.nextCaltropId = 2;
  s = joinAndSelect(s, 20, 0, 0);
  s = joinAndSelect(s, 21, 0, 1);
  s = apply(s, { type: "move_order", operatorId: 20, targetCellX: 40, targetCellY: 10 });
  s = apply(s, { type: "move_order", operatorId: 21, targetCellX: 40, targetCellY: 30 });
  s = apply(s, { type: "advance_tick" });
  const slowedStep = s.assets[0].x - (10 * 256 + 128);
  const freeStep = s.assets[1].x - (10 * 256 + 128);
  assert.ok(slowedStep < freeStep, `enemy patch slows: ${slowedStep} vs ${freeStep}`);
  const stats = getUnitStats(UNIT_BIKE);
  assert.equal(slowedStep,
    Math.floor(stats.speed * CALTROP_SLOW_NUM / CALTROP_SLOW_DEN),
    "exactly the ruled 30% cut on open ground");
});

test("caltrops: patches expire on their own — no damage ever dealt", () => {
  let s = sandbox([{ team: 1, type: 0, cellX: 10, cellY: 10 }]);
  s.caltrops = [{ id: 0, team: 0, cellX: 10, cellY: 10, ticksLeft: 3 }];
  s.nextCaltropId = 1;
  s = joinAndSelect(s, 20, 1, 0);
  const hp0 = s.assets[0].hp;
  for (let i = 0; i < 4; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.caltrops.length, 0, "expired silently");
  assert.equal(s.assets[0].hp, hp0, "slow-only: never punish");
});

test("caltrops: a truck's mine sweep rakes enemy patches too", () => {
  let s = sandbox([
    { team: 0, type: 3, cellX: 20, cellY: 20 }, // truck (canClearMines)
  ]);
  s.mines = [{ id: 0, team: 1, cellX: 21, cellY: 20, armTimer: 0, marked: 1 }];
  s.nextMineId = 1;
  s.caltrops = [
    { id: 0, team: 1, cellX: 20, cellY: 21, ticksLeft: 400 },
    { id: 1, team: 0, cellX: 21, cellY: 21, ticksLeft: 400 }, // OWN: untouched
  ];
  s.nextCaltropId = 2;
  s = joinAndSelect(s, 20, 0, 0);
  s = apply(s, { type: "clear_mine", operatorId: 20, mineId: 0 });
  assert.ok(s.events.some((e) => e.type === "caltrops_cleared"));
  assert.equal(s.caltrops.length, 1, "enemy patch raked");
  assert.equal(s.caltrops[0].team, 0, "own litter stays");
});

test("caltrops: ws-shape — validate accepts the command", async () => {
  const { validate } = await import("../engine/commands.js");
  assert.deepEqual(validate({ type: "deploy_caltrops", operatorId: 20 }), { ok: true });
  assert.equal(validate({ type: "deploy_caltrops", operatorId: -1 }).ok, false);
});

test("caltrops: AI — a mauled, pursued light runner strews the road", () => {
  let s = sandbox([
    { team: 0, type: UNIT_BIKE, cellX: 20, cellY: 20, hp: 12 }, // mauled (≤ half of 30)
    { team: 1, type: 0, cellX: 23, cellY: 20 },                 // the pursuer
  ]);
  s = joinAndSelect(s, 20, 0, 0);
  s = joinAndSelect(s, 21, 1, 1);
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(20);
  const cmd = ai.plan(s).find((c) => c.type === "deploy_caltrops" && c.operatorId === 20);
  assert.ok(cmd, "the escape kit comes out");
  // Healthy or unpursued: it does not litter the map.
  let s2 = sandbox([{ team: 0, type: UNIT_BIKE, cellX: 20, cellY: 20 }]);
  s2 = joinAndSelect(s2, 20, 0, 0);
  const ai2 = new AIRegency({ fixedAgents: false });
  ai2.assume(20);
  assert.equal(ai2.plan(s2).find((c) => c.type === "deploy_caltrops"), undefined);
});
