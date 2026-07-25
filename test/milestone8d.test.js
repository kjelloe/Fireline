// test/milestone8d.test.js — Milestone 8D: wreck tow-back recovery.
// Disabled assets stay on the field until a friendly tows them home; repair
// takes deterministic ticks and returns the asset at half hull.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { REPAIR_TICKS, restoredHp, towRejection } from "../engine/recovery.js";
import { ASSET_IDLE, ASSET_MOVING, ASSET_DISABLED } from "../engine/state.js";
import { sandbox, joinAndSelect, joinSelectMove } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

const DEPOT = [{ team: 0, x: 0, y: 0, width: 4, height: 4 }];

function wreckSpec(cellX, extra = {}) {
  return { team: 0, cellX, state: ASSET_DISABLED, hp: 0, ...extra };
}

test("8D tow_order validation covers every rejection reason", () => {
  let s = sandbox([
    { team: 0, cellX: 10 },              // 0 tower
    wreckSpec(11),                        // 1 adjacent friendly wreck
    wreckSpec(30),                        // 2 far wreck
    { team: 1, cellX: 11, state: ASSET_DISABLED, hp: 0 }, // 3 enemy wreck
    { team: 0, cellX: 11 },               // 4 healthy friendly
  ]);
  s = joinAndSelect(s, 0, 0, 0);

  assert.equal(towRejection(s, s.assets[0], s.assets[2]), "wreck out of reach");
  assert.equal(towRejection(s, s.assets[0], s.assets[3]), "enemy wreck");
  assert.equal(towRejection(s, s.assets[0], s.assets[4]), "not a wreck");
  assert.equal(towRejection(s, s.assets[0], s.assets[1]), null);

  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  assert.deepEqual(s.events, [{ type: "tow_started", assetId: 1, by: 0 }]);
  assert.equal(s.assets[1].towedBy, 0);

  // Second tow while already towing is refused.
  const again = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 2 });
  assert.equal(again.events[0].reason, "already towing");
});

test("8D towing halves speed and drags the wreck along", () => {
  let s = sandbox([
    { team: 0, cellX: 10, state: ASSET_MOVING, targetX: cellToWorld(30) },
    wreckSpec(11),
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  const x0 = s.assets[0].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x - x0, 8, "tank 16 * 0.5 tow penalty");
  assert.equal(s.assets[1].x, s.assets[0].x, "wreck follows the tower");
});

test("8D full rescue: tow home, repair, return at half hull with crew intact", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 6, cellY: 1 },
      wreckSpec(7, { cellY: 1, operatorId: 3 }),
    ],
    [], { bases: DEPOT }
  );
  s.operators[3] = { ...s.operators[3], state: 1, team: 0, assetId: 1 };
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 1, targetCellY: 1 });

  let started = false;
  for (let i = 0; i < 400 && !started; i++) {
    s = apply(s, { type: "advance_tick" });
    started = s.events.some((e) => e.type === "recovery_started");
  }
  assert.equal(started, true, "repair bay engaged at the depot");
  assert.equal(s.assets[1].towedBy, -1, "tow released on arrival");

  let restored = false;
  for (let i = 0; i < REPAIR_TICKS + 2 && !restored; i++) {
    s = apply(s, { type: "advance_tick" });
    restored = s.events.some((e) => e.type === "asset_restored");
  }
  assert.equal(restored, true);
  assert.equal(s.assets[1].state, ASSET_IDLE);
  assert.equal(s.assets[1].hp, restoredHp(s.assets[1].type), "half hull");
  assert.equal(s.assets[1].operatorId, 3, "original crew resumes control");
});

test("8D disabling the tower releases the wreck where it stands", () => {
  let s = sandbox([
    { team: 0, cellX: 10, hp: 20 }, // tower, one shot from death
    wreckSpec(11),
    { team: 1, cellX: 12 },          // gunner
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  s = joinAndSelect(s, 1, 1, 2);
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 0 });
  assert.equal(s.assets[0].state, ASSET_DISABLED);
  assert.equal(s.assets[1].towedBy, -1, "tow line cut");
});

test("8D a recovering wreck cannot be towed again", () => {
  let s = sandbox(
    [{ team: 0, cellX: 2, cellY: 1 }, wreckSpec(1, { cellY: 1, recoverTimer: 50 })],
    [], { bases: DEPOT }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  assert.equal(s.events[0].reason, "already recovering");
});

test("8D restored asset fights again", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 1, cellY: 1, state: ASSET_DISABLED, hp: 0, recoverTimer: 1 },
      { team: 1, cellX: 3, cellY: 1 },
    ],
    [], { bases: [{ team: 0, x: 0, y: 0, width: 64, height: 64 }] }
  );
  s = apply(s, { type: "advance_tick" }); // repair completes
  assert.equal(s.assets[0].state, ASSET_IDLE);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.events[0].type, "fire_resolved", "back in the war");
});
