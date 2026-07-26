// test/milestone9b.test.js — Slice 9B: downed operators (full operator_foot,
// ruling Q3). Bail-out, crawl, redeploy, carrier rescue+delivery, auto-return.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import {
  OPERATOR_SPEED, CRAWL_RADIUS_CELLS, REDEPLOY_TICKS, OPERATOR_AUTO_RETURN_TICKS,
} from "../engine/downed.js";
import { OP_DOWN, OP_ACTIVE } from "../engine/state.js";
import { GameServer } from "../engine/server.js";
import { buildView } from "../engine/view.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld, worldToCellFloor } from "../shared/fixedmath.js";

function shootDown(extraAssets = []) {
  // Gunner (1) disables the crewed tank (0) held by operator 0. A bystander
  // (2) keeps team 0 fielded so elimination never ends these sandbox wars.
  let s = sandbox([
    { team: 0, cellX: 10, hp: 20 },
    { team: 1, cellX: 12 },
    { team: 0, cellX: 50 },
    ...extraAssets,
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = joinAndSelect(s, 1, 1, 1);
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 0 });
  return s;
}

test("9B a crewed disablement bails the crew out; uncrewed wrecks don't", () => {
  let s = shootDown();
  assert.equal(s.operators[0].state, OP_DOWN);
  assert.equal(s.operators[0].assetId, -1);
  assert.equal(s.assets[0].operatorId, -1, "wreck is crewless (repairs to uncrewed)");
  assert.equal(s.downed.length, 1);
  assert.equal(s.downed[0].operatorId, 0);
  assert.ok(s.events.some((e) => e.type === "operator_downed"));

  // Uncrewed target: no bail-out.
  let u = sandbox([
    { team: 0, cellX: 10, hp: 20 },
    { team: 1, cellX: 12 },
  ]);
  u = joinAndSelect(u, 1, 1, 1);
  u = apply(u, { type: "fire_order", operatorId: 1, targetAssetId: 0 });
  assert.equal(u.downed.length, 0);
});

test("9B a downed seat cannot select, move, or fire", () => {
  let s = shootDown();
  for (const cmd of [
    { type: "select_asset", operatorId: 0, assetId: 2 },
    { type: "move_order", operatorId: 0, targetCellX: 5, targetCellY: 0 },
    { type: "fire_order", operatorId: 0, targetAssetId: 1 },
  ]) {
    const next = apply(s, cmd);
    assert.equal(next.events[0].type, "rejected");
    assert.equal(next.events[0].reason, "operator not active", cmd.type);
  }
});

test("9B crawling: short moves at foot speed; long ones and non-downed rejected", () => {
  let s = shootDown();
  const startCell = worldToCellFloor(s.downed[0].x);
  s = apply(s, {
    type: "crawl_order", operatorId: 0,
    targetCellX: startCell + CRAWL_RADIUS_CELLS, targetCellY: 0,
  });
  assert.ok(s.events.some((e) => e.type === "crawl_ordered"));
  const x0 = s.downed[0].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.downed[0].x - x0, OPERATOR_SPEED, "crawls at 6/tick");

  const tooFar = apply(s, {
    type: "crawl_order", operatorId: 0,
    targetCellX: startCell + CRAWL_RADIUS_CELLS + 2, targetCellY: 0,
  });
  assert.equal(tooFar.events[0].reason, "too far to crawl");

  const notDowned = apply(s, { type: "crawl_order", operatorId: 1, targetCellX: 12, targetCellY: 0 });
  assert.equal(notDowned.events[0].reason, "not downed");
});

test("9B redeploy is gated, then frees the seat for a new asset", () => {
  let s = shootDown();
  const early = apply(s, { type: "redeploy", operatorId: 0 });
  assert.equal(early.events[0].reason, "still recovering nerve");

  for (let i = 0; i < REDEPLOY_TICKS; i++) s = apply(s, { type: "advance_tick" });
  s = apply(s, { type: "redeploy", operatorId: 0 });
  assert.equal(s.operators[0].state, OP_ACTIVE);
  assert.equal(s.downed.length, 0);
  assert.ok(s.events.some((e) => e.type === "operator_redeployed"));

  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 2 });
  assert.equal(s.assets[2].operatorId, 0, "back in the fight");
});

test("9B auto-return frees the seat after the long timer", () => {
  let s = shootDown();
  for (let i = 0; i < OPERATOR_AUTO_RETURN_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.downed.length, 0);
  assert.equal(s.operators[0].state, OP_ACTIVE);
});

test("9B carrier rescue: board adjacent (capacity 2), deliver at base", () => {
  // Three downed teammates around a carrier: two board, one must wait.
  let s = sandbox(
    [{ team: 0, cellX: 30, cellY: 30, type: 4 }],
    [],
    { bases: [{ team: 0, x: 0, y: 0, width: 4, height: 4 }] }
  );
  for (const [opId, cx] of [[3, 30], [4, 31], [5, 29]]) {
    s.operators[opId] = { ...s.operators[opId], state: OP_DOWN, team: 0, assetId: -1 };
    s.downed.push({
      operatorId: opId, team: 0,
      x: cellToWorld(cx), y: cellToWorld(30),
      targetX: cellToWorld(cx), targetY: cellToWorld(30), downTicks: 0,
    });
  }
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.downed.length, 1, "two aboard, one left walking");
  assert.equal(s.assets[0].aboard1, 3);
  assert.equal(s.assets[0].aboard2, 4);
  assert.equal(s.events.filter((e) => e.type === "operator_rescued").length, 2);

  // Drive home and unload.
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 1, targetCellY: 1 });
  let delivered = 0;
  for (let i = 0; i < 600 && delivered < 2; i++) {
    s = apply(s, { type: "advance_tick" });
    delivered += s.events.filter((e) => e.type === "operator_delivered").length;
  }
  assert.equal(delivered, 2, "both delivered at the depot");
  assert.equal(s.assets[0].aboard1, -1);
  assert.equal(s.operators[3].state, OP_ACTIVE, "seat freed to pick a new asset");
});

test("9B downed operators are invisible to the enemy team", () => {
  const s = shootDown();
  assert.equal(buildView(s, 0).downedOperators.length, 1, "own team sees them");
  assert.equal(buildView(s, 1).downedOperators.length, 0, "enemy never does");
});

test("9B AI seats redeploy and re-crew their paired asset", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.step();
  const S = () => server.state;
  // Send a lone enemy tank into team A's base guns: A's supplied units shred
  // it, its crew (op 20, paired with asset 4) bails out — a real combat-path
  // down for an AI seat.
  S().assets[4].x = S().assets[0].x + 512;
  S().assets[4].y = S().assets[0].y;
  let downedSeen = false;
  for (let i = 0; i < 60 && !downedSeen; i++) {
    server.step();
    downedSeen = S().operators[20].state === OP_DOWN;
  }
  assert.equal(downedSeen, true, "AI crew went down via real combat");

  // Repair the wreck in place and give it safe passage home; the seat should
  // redeploy after the timer and retake its paired asset.
  S().assets[4].state = 0;
  S().assets[4].hp = 50;
  S().assets[4].x = 120 * 256;
  S().assets[4].y = 60 * 256;
  let recrewed = false;
  for (let i = 0; i < REDEPLOY_TICKS + 60 && !recrewed; i++) {
    server.step();
    recrewed = S().assets[4].operatorId === 20;
  }
  assert.equal(recrewed, true, "AI redeployed and retook its paired asset");
});

test("9B downed entities are hashed and deterministic", () => {
  const a = shootDown();
  const b = shootDown();
  assert.equal(hashState(a), hashState(b));
  b.downed[0].x += 6;
  assert.notEqual(hashState(a), hashState(b));
});
