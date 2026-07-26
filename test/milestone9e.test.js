// test/milestone9e.test.js — Slice 9E: mines (slim model, ruling Q6).
// Tank deploys on own cell, arms after a delay, detonates on enemy entry;
// scouts mark, trucks clear; bases/sites protected; fog never leaks positions.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import {
  MINES_PER_TANK, MINE_ARM_TICKS, MINE_DAMAGE, MINE_DETECT_RADIUS_CELLS,
} from "../engine/mines.js";
import { SUPPRESSION_TICKS } from "../engine/combat.js";
import { OP_DOWN, ASSET_DISABLED } from "../engine/state.js";
import { buildView } from "../engine/view.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

// A tank at (10,10) with a mine already laid and armed; bases pushed off-map
// so mining ground is legal.
const FIELD_BASES = [
  { team: 0, x: 0, y: 60, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

function minedField(extraAssets = [], opts = {}) {
  let s = sandbox(
    [{ team: 0, cellX: 10, cellY: 10 }, ...extraAssets],
    [],
    { bases: FIELD_BASES, ...opts }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "deploy_mine", operatorId: 0 });
  for (let i = 0; i < MINE_ARM_TICKS; i++) s = apply(s, { type: "advance_tick" });
  return s;
}

test("9E deploy contract: tank-only, own cell, capped rack, fog-safe event", () => {
  let s = sandbox([{ team: 0, cellX: 10, cellY: 10 }], [], { bases: FIELD_BASES });
  s = joinAndSelect(s, 0, 0, 0);
  assert.equal(s.assets[0].minesLeft, MINES_PER_TANK);

  s = apply(s, { type: "deploy_mine", operatorId: 0 });
  assert.equal(s.mines.length, 1);
  assert.deepEqual(
    s.events.find((e) => e.type === "mine_deployed"),
    { type: "mine_deployed", assetId: 0, team: 0, minesLeft: 1 },
    "the broadcast event names no coordinates"
  );
  assert.deepEqual(
    { cellX: s.mines[0].cellX, cellY: s.mines[0].cellY, armTimer: s.mines[0].armTimer },
    { cellX: 10, cellY: 10, armTimer: MINE_ARM_TICKS }
  );

  const dupe = apply(s, { type: "deploy_mine", operatorId: 0 });
  assert.equal(dupe.events[0].reason, "mine already here");

  // Empty the rack elsewhere, then hit the cap.
  s.assets[0].x = cellToWorld(12);
  s = apply(s, { type: "deploy_mine", operatorId: 0 });
  s.assets[0].x = cellToWorld(14);
  s = apply(s, { type: "deploy_mine", operatorId: 0 });
  assert.equal(s.events[0].reason, "no mines left");
  assert.equal(s.mines.length, 2);
});

test("9E only the assault tank deploys; bases and sites are protected ground", () => {
  for (const type of [1, 2, 3, 4]) {
    let s = sandbox([{ team: 0, cellX: 10, type }], [], { bases: FIELD_BASES });
    s = joinAndSelect(s, 0, 0, 0);
    s = apply(s, { type: "deploy_mine", operatorId: 0 });
    assert.equal(s.events[0].reason, "cannot deploy mines", `type ${type}`);
  }

  let inBase = sandbox([{ team: 0, cellX: 1, cellY: 61 }], [], { bases: FIELD_BASES });
  inBase = joinAndSelect(inBase, 0, 0, 0);
  inBase = apply(inBase, { type: "deploy_mine", operatorId: 0 });
  assert.equal(inBase.events[0].reason, "cannot mine a base zone");

  let onSite = sandbox(
    [{ team: 0, cellX: 20, cellY: 20 }],
    [{ cellX: 20, cellY: 20 }],
    { bases: FIELD_BASES }
  );
  onSite = joinAndSelect(onSite, 0, 0, 0);
  onSite = apply(onSite, { type: "deploy_mine", operatorId: 0 });
  assert.equal(onSite.events[0].reason, "cannot mine a site");
});

test("9E an arming mine is inert; an armed one detonates on enemy entry only", () => {
  // An enemy truck sits ON the cell while the mine arms: nothing happens
  // until the arm timer runs out (no drive-by kills), then it detonates.
  let s = sandbox(
    [{ team: 0, cellX: 10, cellY: 10 }, { team: 1, cellX: 10, cellY: 10, type: 3 }],
    [], { bases: FIELD_BASES }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "deploy_mine", operatorId: 0 });
  for (let i = 0; i < MINE_ARM_TICKS - 1; i++) {
    s = apply(s, { type: "advance_tick" });
    assert.equal(s.events.some((e) => e.type === "mine_detonated"), false, `tick ${i}`);
  }
  s = apply(s, { type: "advance_tick" });
  const boom = s.events.find((e) => e.type === "mine_detonated");
  assert.deepEqual(boom, {
    type: "mine_detonated", mineId: 0, assetId: 1,
    cellX: 10, cellY: 10, targetHp: 100 - MINE_DAMAGE,
  });
  assert.equal(s.mines.length, 0, "the mine is consumed");
  assert.equal(s.assets[1].suppressedTimer, SUPPRESSION_TICKS, "survivor staggered");
  assert.equal(s.assets[0].hp, 100, "the owner standing beside it is untouched");
});

test("9E a lethal detonation uses the shared disable path (crew bails out)", () => {
  // A crewed enemy scout (60 hp < 60 damage... exactly 60) walks in.
  let s = minedField([{ team: 1, cellX: 30, cellY: 10, type: 1, hp: 50 }]);
  s = joinAndSelect(s, 16, 1, 1);
  s.assets[1].x = cellToWorld(10);
  s.assets[1].y = cellToWorld(10);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[1].state, ASSET_DISABLED);
  assert.equal(s.operators[16].state, OP_DOWN, "crew bailed out on foot");
  assert.equal(s.downed.length, 1);
  assert.equal(s.teamScores[0], 5, "mine kills score like gun kills");
});

test("9E enemy scouts mark mines; marking gates enemy sight and clearing", () => {
  // Enemy truck adjacent to the unmarked mine: cannot clear what it can't see.
  let s = minedField([
    { team: 1, cellX: 11, cellY: 10, type: 3 },
    { team: 1, cellX: 40, cellY: 40, type: 1 },
  ]);
  s = joinAndSelect(s, 16, 1, 1);
  assert.equal(buildView(s, 1).mines.length, 0, "unmarked mine invisible to enemy");
  const blind = apply(s, { type: "clear_mine", operatorId: 16, mineId: 0 });
  assert.equal(blind.events[0].reason, "mine not marked");

  // The scout drives into detection range: auto-mark.
  s.assets[2].x = cellToWorld(10 + MINE_DETECT_RADIUS_CELLS);
  s.assets[2].y = cellToWorld(10);
  s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "mine_marked"));
  assert.equal(s.mines[0].marked, 1);
  const seen = buildView(s, 1).mines;
  assert.equal(seen.length, 1);
  assert.equal(seen[0].marked, true);

  // Now the adjacent truck clears it; the scout chassis may not.
  const wrongChassis = apply(
    joinAndSelect(s, 17, 1, 2), { type: "clear_mine", operatorId: 17, mineId: 0 }
  );
  s = apply(s, { type: "clear_mine", operatorId: 16, mineId: 0 });
  assert.ok(s.events.some((e) => e.type === "mine_cleared"));
  assert.equal(s.mines.length, 0);
  assert.equal(wrongChassis.events[0].reason, "cannot clear mines");
});

test("9E clearing needs adjacency; own mines are clearable unmarked", () => {
  let s = minedField([{ team: 0, cellX: 30, cellY: 30, type: 3 }]);
  s = joinAndSelect(s, 1, 0, 1);
  const far = apply(s, { type: "clear_mine", operatorId: 1, mineId: 0 });
  assert.equal(far.events[0].reason, "too far to clear");

  s.assets[1].x = cellToWorld(11);
  s.assets[1].y = cellToWorld(10);
  s = apply(s, { type: "clear_mine", operatorId: 1, mineId: 0 });
  assert.ok(s.events.some((e) => e.type === "mine_cleared"), "own team needs no mark");
});

test("9E fog: the owner always sees its mines, with arm state", () => {
  let s = sandbox([{ team: 0, cellX: 10, cellY: 10 }], [], { bases: FIELD_BASES });
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "deploy_mine", operatorId: 0 });
  let own = buildView(s, 0).mines;
  assert.equal(own.length, 1);
  assert.equal(own[0].armed, false);
  for (let i = 0; i < MINE_ARM_TICKS; i++) s = apply(s, { type: "advance_tick" });
  own = buildView(s, 0).mines;
  assert.equal(own[0].armed, true);
  assert.equal(buildView(s, 1).mines.length, 0);
});

test("9E mines and racks are hashed and deterministic", () => {
  const a = minedField();
  const b = minedField();
  assert.equal(hashState(a), hashState(b));
  b.mines[0].armTimer += 1;
  assert.notEqual(hashState(a), hashState(b));

  const c = minedField();
  c.assets[0].minesLeft -= 1;
  assert.notEqual(hashState(a), hashState(c));
});
