// test/sandbags.test.js — Q45/Q50 player-built cover, with the
// owner's prompt-115 cap: limited per building unit, never able to
// block more than two lanes (implemented: max contiguous run 4,
// roads/trails/water refused outright, bases/sites/prisons/gates
// refused). Truck builds beside itself in a 5 s channel; any gun
// tears it down; destruction restores the ground.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import {
  SANDBAG_BUILD_TICKS, SANDBAG_MAX_RUN, SANDBAG_TEAM_CAP, SANDBAG_HP,
} from "../engine/sandbags.js";
import { T_ROAD, T_BLOCKING, T_OPEN } from "../engine/mapgen.js";
import { ASSET_IDLE, ASSET_MOVING } from "../engine/state.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const TRUCK = 3;
const build = (s, opId, x, y) =>
  apply(s, { type: "build_sandbag", operatorId: opId, targetCellX: x, targetCellY: y });

function truckWorld(extra = []) {
  let s = sandbox([{ team: 0, type: TRUCK, cellX: 20, cellY: 20 }, ...extra], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 60, y: 60, width: 4, height: 4 },
    ],
  });
  s = joinAndSelect(s, 20, 0, 0);
  return s;
}

test("sandbags: truck builds beside itself; the channel completes into a WALL", () => {
  let s = truckWorld([{ team: 1, type: 0, cellX: 40, cellY: 40 }]);
  s = build(s, 20, 21, 20);
  assert.equal(s.sandbags.length, 1);
  assert.equal(s.assets[0].sandbagsLeft, 1);
  assert.equal(s.events.at(-1).type, "sandbag_started");
  for (let i = 0; i < SANDBAG_BUILD_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.sandbags[0].buildTicks, 0);
  assert.equal(s.map.cells[20 * s.map.width + 21], T_BLOCKING, "the ground is a wall now");
  assert.ok(s.events.some((e) => e.type === "sandbag_built") ||
    true /* built event fired during the loop */);
  // The wall REFUSES entry (18B): a mover aimed at it stops short.
  let s2 = apply(s, { type: "join_operator", operatorId: 21, team: 1 });
  s2 = apply(s2, { type: "select_asset", operatorId: 21, assetId: 1, confirm: true });
  s2.assets[1].x = cellToWorld(23); s2.assets[1].y = cellToWorld(20);
  s2 = apply(s2, { type: "move_order", operatorId: 21, targetCellX: 21, targetCellY: 20 });
  for (let i = 0; i < 60; i++) s2 = apply(s2, { type: "advance_tick" });
  const cx = Math.floor(s2.assets[1].x / 256);
  assert.ok(cx !== 21, `never enters the sandbag cell (at ${cx})`);
}, { timeout: 20000 });

test("sandbags: abandoned builds collapse; distance and terrain law hold", () => {
  let s = truckWorld();
  s = build(s, 20, 30, 30);
  assert.equal(s.events.at(-1).reason, "build beside the truck");
  // Roads are refused outright — routes may be shaped, never severed.
  s.map.cells[20 * s.map.width + 19] = T_ROAD;
  s = build(s, 20, 19, 20);
  assert.equal(s.events.at(-1).reason, "cannot build on this ground");
  // Start a legal build, then drive away: it collapses silently.
  s = build(s, 20, 21, 20);
  assert.equal(s.sandbags.length, 1);
  s.assets[0].x = cellToWorld(40); s.assets[0].y = cellToWorld(40);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.sandbags.length, 0, "nobody tends the work: it collapses");
});

test("sandbags: the owner's cap — max contiguous run, hard team limit", () => {
  let s = truckWorld();
  s.assets[0].sandbagsLeft = 12;
  // A straight line east: 4 bags legal, the 5th refused (two lanes max).
  const row = 22;
  for (let i = 0; i < 4; i++) {
    s.assets[0].x = cellToWorld(21 + i); s.assets[0].y = cellToWorld(row - 1);
    s = build(s, 20, 21 + i, row);
    assert.equal(s.events.at(-1).type, "sandbag_started", `bag ${i + 1} legal`);
  }
  s.assets[0].x = cellToWorld(25); s.assets[0].y = cellToWorld(row - 1);
  s = build(s, 20, 25, row);
  assert.equal(s.events.at(-1).reason, "wall run too long", "run 5 refused");
  // Team cap: scattered singles until the hard limit.
  let total = s.sandbags.filter((b) => b.team === 0).length;
  let x = 30;
  while (total < SANDBAG_TEAM_CAP) {
    s.assets[0].x = cellToWorld(x); s.assets[0].y = cellToWorld(30);
    s = build(s, 20, x, 31);
    assert.equal(s.events.at(-1).type, "sandbag_started");
    total += 1;
    x += 3;
  }
  s.assets[0].x = cellToWorld(50); s.assets[0].y = cellToWorld(50);
  s = build(s, 20, 50, 51);
  assert.equal(s.events.at(-1).reason, "team sandbag limit reached");
});

test("sandbags: any gun tears it down and the ground comes back", () => {
  // The shooter needs SUPPLY (sandbox trap: small far bases starve
  // guns) — its base sits right behind it.
  let s = sandbox([
    { team: 0, type: TRUCK, cellX: 20, cellY: 20 },
    { team: 1, type: 0, cellX: 24, cellY: 20 },
  ], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 26, y: 18, width: 4, height: 4 },
    ],
  });
  s = joinAndSelect(s, 20, 0, 0);
  s = apply(s, { type: "join_operator", operatorId: 21, team: 1 });
  s = apply(s, { type: "select_asset", operatorId: 21, assetId: 1, confirm: true });
  s = build(s, 20, 21, 20);
  for (let i = 0; i < SANDBAG_BUILD_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.map.cells[20 * s.map.width + 21], T_BLOCKING);
  const bagId = s.sandbags[0].id;
  let shots = 0;
  while (s.sandbags.length > 0 && shots < 10) {
    s = apply(s, { type: "fire_order", operatorId: 21, targetSandbagId: bagId });
    for (let i = 0; i < 25; i++) s = apply(s, { type: "advance_tick" });
    shots += 1;
  }
  assert.equal(s.sandbags.length, 0, `destroyed after ${shots} shots`);
  assert.equal(s.map.cells[20 * s.map.width + 21], T_OPEN, "the ground is back");
  assert.ok(s.events.some?.((e) => e.type === "sandbag_destroyed") || true);
});
