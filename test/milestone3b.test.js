// test/milestone3b.test.js — Milestone 3B: supply projection.
// Bases and owned relays project supply in a radius; out-of-supply units
// move at half speed and cannot fire.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import {
  inSupply, SUPPLY_RADIUS_CELLS, RELAY_SUPPLY_CELLS,
} from "../engine/supply.js";
import { ASSET_MOVING } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

const CORNER_BASE = [{ team: 0, x: 0, y: 0, width: 4, height: 4 }];

test("3B supply radius from base edge, inclusive boundary", () => {
  const inside = sandbox(
    [{ team: 0, cellX: 3 + SUPPLY_RADIUS_CELLS, cellY: 0 }],
    [], { bases: CORNER_BASE }
  );
  assert.equal(inSupply(inside, inside.assets[0]), true, "at radius: supplied");

  const outside = sandbox(
    [{ team: 0, cellX: 4 + SUPPLY_RADIUS_CELLS, cellY: 0 }],
    [], { bases: CORNER_BASE }
  );
  assert.equal(inSupply(outside, outside.assets[0]), false, "beyond radius: cut off");
});

test("3B owned relay projects supply; neutral or enemy relay does not", () => {
  const spot = { cellX: 50, cellY: 50 };
  const near = { team: 0, cellX: 50 + RELAY_SUPPLY_CELLS, cellY: 50 };

  const owned = sandbox([near], [{ ...spot, owner: 0 }], { bases: [] });
  assert.equal(inSupply(owned, owned.assets[0]), true);

  const neutral = sandbox([near], [spot], { bases: [] });
  assert.equal(inSupply(neutral, neutral.assets[0]), false);

  const enemy = sandbox([near], [{ ...spot, owner: 1 }], { bases: [] });
  assert.equal(inSupply(enemy, enemy.assets[0]), false);
});

test("3B out-of-supply units move at half speed", () => {
  let s = sandbox(
    [{ team: 0, cellX: 40, cellY: 40, state: ASSET_MOVING, targetX: cellToWorld(60) }],
    [], { bases: CORNER_BASE }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x - cellToWorld(40), 8, "tank crawls at 8 instead of 16");
});

test("3B out-of-supply units cannot fire", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 40, cellY: 40 },
      { team: 1, cellX: 42, cellY: 40 },
    ],
    [], { bases: CORNER_BASE }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "fire_order", reason: "out of supply" },
  ]);
});

test("3B capturing a relay restores fighting power on the spot", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 50, cellY: 50 },
      { team: 1, cellX: 52, cellY: 50 },
    ],
    [{ cellX: 50, cellY: 50 }],
    { bases: [] }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.events[0].reason, "out of supply");

  s = apply(s, { type: "advance_tick" }); // standing on relay -> capture
  assert.equal(s.sites[0].owner, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.events[0].type, "fire_resolved", "owned relay supplies the gun");
});
