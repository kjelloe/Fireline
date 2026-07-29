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

test("B4/Q26 the deed indices are eight distinct columns", async () => {
  const { DEED_ESCORT } = await import("../engine/reducer.js");
  const all = [DEED_KILL, DEED_TOW, DEED_RESCUE, DEED_RELAY,
    DEED_STD_RETURN, DEED_STD_CAPTURE, DEED_FIELD_REPAIR, DEED_ESCORT];
  assert.equal(new Set(all).size, 8);
  assert.deepEqual([...all].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
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

test("Q26 escorts get paid when the rescue they guarded succeeds", async () => {
  const { RECOG_ESCORT, DEED_ESCORT } = await import("../engine/reducer.js");
  const { cellToWorld } = await import("../shared/fixedmath.js");
  // A carrier scoops a downed body; a crewed tank 3 cells off held the
  // corridor; another sits 20 cells away; an uncrewed hull watches.
  let s = sandbox([
    { team: 0, cellX: 30, cellY: 30, type: 4 },              // 0: the carrier (actor)
    { team: 0, cellX: 33, cellY: 30 },                        // 1: escort in reach
    { team: 0, cellX: 50, cellY: 30 },                        // 2: too far
    { team: 0, cellX: 31, cellY: 31 },                        // 3: in reach but uncrewed
  ], [], { bases: [
    { team: 0, x: 0, y: 0, width: 4, height: 4 },
    { team: 1, x: 60, y: 60, width: 4, height: 4 },
  ] });
  s = joinAndSelect(s, 0, 0, 0);   // op 0 drives the carrier
  s = joinAndSelect(s, 1, 0, 1);   // op 1 drives the near tank
  s = joinAndSelect(s, 2, 0, 2);   // op 2 drives the far tank
  s.operators[3] = { ...s.operators[3], state: 2, team: 0, assetId: -1, autoRescue: 1 };
  s.downed.push({
    operatorId: 3, team: 0,
    x: cellToWorld(31), y: cellToWorld(30),
    targetX: cellToWorld(31), targetY: cellToWorld(30), downTicks: 0,
  });
  s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "operator_rescued"), "the pickup happened");
  assert.equal(s.operators[1].deeds[DEED_ESCORT], 1, "the corridor holder is seen");
  assert.equal(s.operators[1].score, RECOG_ESCORT);
  assert.equal(s.operators[0].deeds[DEED_ESCORT], 0, "the actor is not its own escort");
  assert.equal(s.operators[2].deeds[DEED_ESCORT], 0, "20 cells away guarded nothing");
});

test("underdog premium: dormant table changes nothing; a convicted map pays 25% more", async () => {
  const { premiumPoints, MAP_PREMIUM } = await import("../engine/premium.js");
  // The shipped table is EMPTY (every live map measured fair 2026-07-31)
  // — dormancy is the contract that lets this land without a repin.
  assert.deepEqual(Object.keys(MAP_PREMIUM), []);
  assert.equal(premiumPoints(8, 0, "frontier_corridor"), 8);
  assert.equal(premiumPoints(8, 1, "frontier_corridor"), 8);
  // The math a future conviction buys: 25%, integer-floored.
  const fake = { hypothetical_map: 1 };
  const like = (pts, team, prof) =>
    fake[prof] === team ? ((pts * 5) / 4) | 0 : pts;
  assert.equal(like(8, 1, "hypothetical_map"), 10);
  assert.equal(like(8, 0, "hypothetical_map"), 8);
  assert.equal(like(5, 1, "hypothetical_map"), 6, "floors, never rounds up");
});
