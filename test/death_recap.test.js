// test/death_recap.test.js — B7: the disable event names the killer.
//
// "DISABLED — artillery from the north-west" needs three facts the
// client cannot reconstruct (the killer may be in fog): what kind of
// thing killed you, which chassis if it was a gun, and a coarse bearing.
// The reducer computes all three at the moment of death, integer-only.
// Events are not hashed and the 1A script contains no disables, so the
// enrichment is repin-free — this file is the contract instead.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, compassOctant } from "../engine/reducer.js";
import { MINE_ARM_TICKS } from "../engine/mines.js";
import { deathRecapLine } from "../client/js/feedback_model.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 0, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

const lastDisable = (s) => s.events.filter((e) => e.type === "asset_disabled").at(-1);

test("B7 a gun kill names the chassis and the bearing to the killer", () => {
  // Attacker WEST of the victim: the recap points back at the gun.
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 5 },
    { team: 1, cellX: 12, cellY: 5, hp: 20 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  const e = lastDisable(s);
  assert.equal(e.by, "asset");
  assert.equal(e.byType, 0, "an assault tank did it");
  assert.equal(e.dir, 6, "from the west");
});

test("B7 a diagonal kill reads as a diagonal", () => {
  let s = sandbox([
    { team: 0, cellX: 14, cellY: 3 },
    { team: 1, cellX: 12, cellY: 5, hp: 20 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(lastDisable(s).dir, 1, "from the north-east");
});

test("B7 a mine kill has no bearing — it was under your own tracks", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10, cellY: 10 }, { team: 1, cellX: 30, cellY: 10, type: 1, hp: 50 }],
    [], { bases: OFF_BASES }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "deploy_mine", operatorId: 0 });
  for (let i = 0; i < MINE_ARM_TICKS + 1; i++) s = apply(s, { type: "advance_tick" });
  s.assets[1].x = s.assets[0].x;
  s.assets[1].y = s.assets[0].y;
  s = apply(s, { type: "advance_tick" });
  const e = lastDisable(s);
  assert.ok(e, "the scout died on the mine");
  assert.equal(e.by, "mine");
  assert.equal(e.byType, -1);
  assert.equal(e.dir, -1, "no compass for a pressure plate");
});

test("B7 compass octants are the standard eight, +y south", () => {
  assert.equal(compassOctant(0, -100), 0, "N");
  assert.equal(compassOctant(100, -100), 1, "NE");
  assert.equal(compassOctant(100, 0), 2, "E");
  assert.equal(compassOctant(100, 100), 3, "SE");
  assert.equal(compassOctant(0, 100), 4, "S");
  assert.equal(compassOctant(-100, 100), 5, "SW");
  assert.equal(compassOctant(-100, 0), 6, "W");
  assert.equal(compassOctant(-100, -100), 7, "NW");
  assert.equal(compassOctant(0, 0), -1, "point blank has no bearing");
  // The 2:1 shoulders resolve to the cardinal, not the diagonal.
  assert.equal(compassOctant(300, -100), 2, "wide east stays east");
  assert.equal(compassOctant(-100, -300), 0, "tall north stays north");
});

test("B7 every cause renders a recap line, and none leak placeholders", () => {
  const cases = [
    { by: "asset", byType: 2, dir: 7 },   // artillery from the north-west
    { by: "asset", byType: 8, dir: -1 },  // a Skimmer, point blank
    { by: "mine", byType: -1, dir: -1 },
    { by: "drone", byType: -1, dir: 3 },
    { by: "satchel", byType: -1, dir: 4 },
    { by: "unknown", byType: -1, dir: -1 },
  ];
  for (const c of cases) {
    const line = deathRecapLine(c);
    assert.ok(line && typeof line === "string" && line.length > 5, JSON.stringify(c));
    assert.ok(!line.includes("{"), `no unfilled placeholder in: ${line}`);
  }
  assert.match(deathRecapLine(cases[0]), /artillery .*north-west/);
});
