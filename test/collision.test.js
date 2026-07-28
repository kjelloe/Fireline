// test/collision.test.js — playtest 7 item 17 (user ruling: soft-blocking
// for friends, hard blocking for enemies). Rules under test:
//   - an enemy inside BLOCK radius stops your CLOSING move (hard);
//   - a friend inside SOFT radius halves your closing step (compression);
//   - moving APART is never blocked (the bridge-deadlock escape);
//   - wrecks and downed operators do not collide (v1);
//   - resolution order alternates by tick parity (no first-mover team).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, ENEMY_BLOCK_RADIUS, FRIEND_SOFT_RADIUS } from "../engine/reducer.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function drive(s, operatorId, targetCellX, targetCellY, ticks) {
  s = apply(s, { type: "move_order", operatorId, targetCellX, targetCellY });
  for (let i = 0; i < ticks; i++) s = apply(s, { type: "advance_tick" });
  return s;
}

test("17: an enemy wall stops the advance at the block radius", () => {
  let s = sandbox([
    { team: 0, cellX: 20, cellY: 20, heading: 0 },
    { team: 1, cellX: 30, cellY: 20, heading: 128 }, // parked enemy
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = drive(s, 0, 30, 20, 200); // drive straight at it
  const gap = Math.abs(s.assets[1].x - s.assets[0].x);
  assert.ok(gap >= ENEMY_BLOCK_RADIUS, `stopped ${gap} apart (radius ${ENEMY_BLOCK_RADIUS})`);
  assert.ok(gap < cellToWorld(3), `but it pressed close (${gap})`);
});

test("17: friends compress through each other at half speed, never stop", () => {
  let s = sandbox([
    { team: 0, cellX: 20, cellY: 20, heading: 0 },
    { team: 0, cellX: 24, cellY: 20 }, // friendly parked on the road
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = drive(s, 0, 40, 20, 400);
  assert.equal(s.assets[0].x, cellToWorld(40), "reached the far side through the friend");
});

test("17: moving APART from a blocking enemy is always legal", () => {
  let s = sandbox([
    { team: 0, cellX: 20, cellY: 20, heading: 128 },
    { team: 1, cellX: 21, cellY: 20 }, // enemy already inside the radius
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = drive(s, 0, 5, 20, 300);
  assert.equal(s.assets[0].x, cellToWorld(5), "retreat is never body-blocked");
});

test("17: wrecks do not block (tow trucks must reach them)", () => {
  let s = sandbox([
    { team: 0, cellX: 20, cellY: 20, heading: 0 },
    { team: 1, cellX: 24, cellY: 20, state: 2 }, // enemy WRECK in the way
    { team: 1, cellX: 60, cellY: 60 }, // live enemy far away — war continues
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = drive(s, 0, 30, 20, 300);
  assert.equal(s.assets[0].x, cellToWorld(30), "drove past the wreck");
});

test("17: head-on contact resolves without a team first-mover edge", () => {
  // Two mirror-symmetric hostile pairs converge; after the dust settles the
  // standoff gap must be symmetric — parity alternation removes the id-order
  // ground-claiming advantage (the Q18 lesson, physics edition).
  let s = sandbox([
    { team: 0, cellX: 20, cellY: 20, heading: 0 },
    { team: 1, cellX: 40, cellY: 20, heading: 128 },
    { team: 1, cellX: 20, cellY: 40, heading: 0 },
    { team: 0, cellX: 40, cellY: 40, heading: 128 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = joinAndSelect(s, 1, 1, 1);
  s = joinAndSelect(s, 2, 1, 2);
  s = joinAndSelect(s, 3, 0, 3);
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 40, targetCellY: 20 });
  s = apply(s, { type: "move_order", operatorId: 1, targetCellX: 20, targetCellY: 20 });
  s = apply(s, { type: "move_order", operatorId: 2, targetCellX: 40, targetCellY: 40 });
  s = apply(s, { type: "move_order", operatorId: 3, targetCellX: 20, targetCellY: 40 });
  for (let i = 0; i < 300; i++) s = apply(s, { type: "advance_tick" });
  // Row 20: A drove east, B west. Row 40: teams swapped. If resolution
  // favored a team, the two rows would come to rest at different midpoints.
  const mid20 = (s.assets[0].x + s.assets[1].x) / 2;
  const mid40 = (s.assets[2].x + s.assets[3].x) / 2;
  assert.equal(mid20, mid40, `standoff midpoints match (${mid20} vs ${mid40})`);
});
