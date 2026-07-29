// test/waypoints.test.js — playtest-9 item 34: queued move orders.
// Shift-click (long-press on touch) adds a leg; a plain click replaces
// the route. The AI never queues, which is deliberate: regent behaviour
// and therefore every balance measurement stay untouched.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, MAX_WAYPOINTS } from "../engine/reducer.js";
import { cellToWorld, worldToCellFloor } from "../shared/fixedmath.js";
import { validate } from "../engine/commands.js";
import { GameServer } from "../engine/server.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const ASSET_IDLE = 0, ASSET_MOVING = 1;

function scoutAt(cellX, cellY) {
  let s = sandbox([{ team: 0, type: 1 /* scout */, cellX, cellY }]);
  return joinAndSelect(s, 0, 0, 0);
}
const move = (operatorId, x, y, queue) =>
  ({ type: "move_order", operatorId, targetCellX: x, targetCellY: y, ...(queue ? { queue: true } : {}) });

test("34: a plain order REPLACES the route, a queued order APPENDS", () => {
  let s = scoutAt(10, 10);
  s = apply(s, move(0, 20, 10));
  s = apply(s, move(0, 20, 20, true));
  s = apply(s, move(0, 30, 20, true));
  assert.equal(s.assets[0].waypoints.length, 2, "two legs queued behind the current one");
  assert.ok(s.events.some((e) => e.type === "waypoint_queued"));

  s = apply(s, move(0, 5, 5)); // a plain click wipes the plan
  assert.equal(s.assets[0].waypoints.length, 0, "a normal order clears the queue");
  assert.equal(s.assets[0].targetX, cellToWorld(5));
});

test("34: the unit walks the whole route without further input", () => {
  let s = scoutAt(10, 10);
  s = apply(s, move(0, 16, 10));
  s = apply(s, move(0, 16, 16, true));
  s = apply(s, move(0, 10, 16, true));
  const seen = new Set();
  for (let i = 0; i < 4000 && !(s.assets[0].state === ASSET_IDLE && i > 10); i++) {
    s = apply(s, { type: "advance_tick" });
    seen.add(`${worldToCellFloor(s.assets[0].x)},${worldToCellFloor(s.assets[0].y)}`);
  }
  const a = s.assets[0];
  assert.equal(a.state, ASSET_IDLE, "the route finished");
  assert.equal(worldToCellFloor(a.x), 10, "ended at the last leg's column");
  assert.equal(worldToCellFloor(a.y), 16, "ended at the last leg's row");
  assert.ok(seen.has("16,10"), "and it actually went via the first corner");
  assert.equal(a.waypoints.length, 0, "queue drained");
});

test("34: queuing while STANDING STILL starts the unit moving", () => {
  let s = scoutAt(10, 10);
  s = apply(s, move(0, 14, 10, true));
  assert.equal(s.assets[0].state, ASSET_MOVING, "the first queued leg is the current one");
  assert.equal(s.assets[0].waypoints.length, 0);
});

test("34: the queue is bounded and refuses politely when full", () => {
  let s = scoutAt(10, 10);
  s = apply(s, move(0, 20, 10));
  for (let i = 0; i < MAX_WAYPOINTS; i++) s = apply(s, move(0, 20 + i, 12, true));
  assert.equal(s.assets[0].waypoints.length, MAX_WAYPOINTS);
  s = apply(s, move(0, 40, 40, true));
  assert.ok(s.events.some((e) => e.type === "rejected" && e.reason === "waypoint queue full"));
  assert.equal(s.assets[0].waypoints.length, MAX_WAYPOINTS, "and nothing was appended");
});

test("34: the queue flag is validated at the transport boundary", () => {
  const base = { type: "move_order", operatorId: 0, targetCellX: 5, targetCellY: 5 };
  assert.equal(validate({ ...base }).ok, true);
  assert.equal(validate({ ...base, queue: true }).ok, true);
  assert.equal(validate({ ...base, queue: "yes" }).ok, false, "a string must not pass for true");
});

test("34: waypoints are hashed, and the AI still never queues", () => {
  let a = scoutAt(10, 10);
  let b = scoutAt(10, 10);
  assert.equal(hashState(a), hashState(b));
  b = apply(b, move(0, 20, 10));
  b = apply(b, move(0, 20, 20, true));
  assert.notEqual(hashState(a), hashState(b), "a queued leg must change the hash");

  // The regents drive an entire war without ever queueing a leg — which
  // is what keeps AI-only balance measurements comparable across this
  // change.
  const war = new GameServer({ mapSeed: 2026, enableAi: true, aiDifficulty: 1 });
  for (let i = 0; i < 1200; i++) war.step();
  assert.ok(war.state.assets.every((x) => (x.waypoints ?? []).length === 0),
    "no regent queued a waypoint");
});
