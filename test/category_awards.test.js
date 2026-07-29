// test/category_awards.test.js — B4: per-operator deed counters and the
// category honors read off them. The counters are HASHED (snapshot +
// the 1A local hash changed together; fixture repinned "B4 deed
// counters") — this file is the behavioural contract.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apply, DEED_KILL, DEED_TOW, DEED_RESCUE, DEED_RELAY,
  DEED_STD_RETURN, DEED_STD_CAPTURE, DEED_FIELD_REPAIR,
} from "../engine/reducer.js";
import { buildView } from "../engine/view.js";
import { categoryHonors } from "../client/js/feedback_model.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("B4 a gun kill counts one DEED_KILL beside its 5 points", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 5 },
    { team: 1, cellX: 12, cellY: 5, hp: 20 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.operators[0].deeds[DEED_KILL], 1);
  assert.equal(s.operators[0].deeds.reduce((a, b) => a + b, 0), 1, "and nothing else");
});

test("B4 the deed indices are seven distinct columns", () => {
  const all = [DEED_KILL, DEED_TOW, DEED_RESCUE, DEED_RELAY,
    DEED_STD_RETURN, DEED_STD_CAPTURE, DEED_FIELD_REPAIR];
  assert.equal(new Set(all).size, 7);
  assert.deepEqual([...all].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
});

test("B4 deeds ride the public view scoreboard", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 5 },
    { team: 1, cellX: 12, cellY: 5, hp: 20 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  const v = buildView(s, 1); // the ENEMY's view — the scoreboard is public
  const o = v.operators.find((x) => x.id === 0);
  assert.equal(o.deeds[DEED_KILL], 1);
});

test("B4/34 nested arrays never alias across ticks (the 11H scrub trap)", () => {
  // A shallow operator/asset clone shares the deeds/waypoints ARRAYS, so
  // an in-place award or a waypoint shift rewrites history — a backward
  // replay scrub then reads the future. Pin the deep copy.
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 5 },
    { team: 1, cellX: 12, cellY: 5, hp: 20 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  const before = s;
  const after = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(before.operators[0].deeds[DEED_KILL], 0, "history untouched");
  assert.equal(after.operators[0].deeds[DEED_KILL], 1);
  assert.notEqual(before.operators[0].deeds, after.operators[0].deeds, "distinct arrays");

  let w = sandbox([{ team: 0, cellX: 5, cellY: 5 }]);
  w = joinAndSelect(w, 0, 0, 0);
  w = apply(w, { type: "move_order", operatorId: 0, targetCellX: 8, targetCellY: 5 });
  const preQueue = w;
  const queued = apply(w, { type: "move_order", operatorId: 0, targetCellX: 12, targetCellY: 5, queue: true });
  assert.equal(preQueue.assets[0].waypoints.length, 0, "history untouched");
  assert.equal(queued.assets[0].waypoints.length, 1);
});

test("B4 honors go to the top count per category, ties to the lower id, empty to nobody", () => {
  const op = (id, team, deeds) => ({ id, team, score: 1, deeds });
  const view = { operators: [
    op(0, 0, [3, 0, 0, 0, 0, 0, 0]),   // 3 kills
    op(1, 1, [3, 0, 0, 0, 0, 0, 0]),   // 3 kills too — id 0 wins the tie
    op(2, 0, [0, 2, 1, 0, 0, 0, 0]),   // 3 recoveries (tow+rescue pool)
    op(16, 1, [0, 0, 0, 0, 1, 1, 0]),  // a regent runs the convoy
  ] };
  const lines = categoryHonors(view);
  assert.equal(lines.length, 3, "raider + recovery + convoy; no capturer, no mechanic");
  assert.match(lines[0], /Operator 0 \(A\)/, "tie broke to the lower id");
  assert.match(lines[1], /Operator 2 \(A\).*3/);
  assert.match(lines[2], /Regent 16 \(B\)/);
});
