// test/milestone11c.test.js — Slice 11C: AI hunt & guard doctrine
// (prompt 16 Q1/Q2d/Q14): standard-carriers are priority targets, drones
// stinging you get swatted, and an unfilled raider role pulls a spare
// carrier out of the garage.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { AIRegency } from "../engine/ai_regency.js";
import { STD_CARRIED } from "../engine/standards.js";
import { ASSET_DISABLED } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

function regencyFor(...operatorIds) {
  const ai = new AIRegency({ fixedAgents: false });
  for (const id of operatorIds) ai.assume(id);
  return ai;
}

test("11C fire doctrine: the enemy carrying a standard outranks a nearer target", () => {
  // Gunner (asset 0) sees a plain enemy 2 cells away and a standard-carrier
  // 4 cells away — both in range. The carrier eats the shell.
  let s = sandbox(
    [
      { team: 0, cellX: 10 },
      { team: 1, cellX: 12 },
      { team: 1, cellX: 14, type: 4 },
    ],
    [],
    {
      standards: [
        { team: 0, cellX: 14, status: STD_CARRIED, carrierAssetId: 2 },
        { team: 1, cellX: 60 },
      ],
    }
  );
  s = joinAndSelect(s, 0, 0, 0);
  const commands = regencyFor(0).plan(s);
  const fire = commands.find((c) => c.type === "fire_order");
  assert.equal(fire?.targetAssetId, 2, "the standard thief is the priority");

  // Control: with no standard aboard, proximity rules as before.
  let plain = sandbox([
    { team: 0, cellX: 10 },
    { team: 1, cellX: 12 },
    { team: 1, cellX: 14, type: 4 },
  ]);
  plain = joinAndSelect(plain, 0, 0, 0);
  const nearest = regencyFor(0).plan(plain).find((c) => c.type === "fire_order");
  assert.equal(nearest?.targetAssetId, 1);
});

test("11C a drone stinging the asset gets swatted before anything else", () => {
  let s = sandbox([
    { team: 0, cellX: 10 },
    { team: 1, cellX: 12 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s.drones.push({
    id: 3, team: 1, x: cellToWorld(10), y: cellToWorld(0),
    targetAssetId: 0, ageTicks: 0, hitTimer: 0,
  });
  const fire = regencyFor(0).plan(s).find((c) => c.type === "fire_order");
  assert.deepEqual(
    { droneId: fire?.targetDroneId, asset: fire?.targetAssetId },
    { droneId: 3, asset: undefined },
    "swat the pest, ignore the tank for one shot"
  );

  // Artillery cannot track aircraft — it keeps shelling ground targets.
  let arty = sandbox([
    { team: 0, cellX: 10, type: 2 },
    { team: 1, cellX: 14 },
  ]);
  arty = joinAndSelect(arty, 0, 0, 0);
  arty.drones.push({
    id: 3, team: 1, x: cellToWorld(10), y: cellToWorld(0),
    targetAssetId: 0, ageTicks: 0, hitTimer: 0,
  });
  const shell = regencyFor(0).plan(arty).find((c) => c.type === "fire_order");
  assert.equal(shell?.targetAssetId, 1);
  assert.equal(shell?.targetDroneId, undefined);
});

test("11C an unfilled raider role pulls the spare carrier from the garage", () => {
  // Team 0: a wrecked carrier (1), a spare uncrewed carrier (2), a free
  // tank (3, lower id would normally win). Seat 0 is empty-handed.
  let s = sandbox([
    { team: 1, cellX: 60 },
    { team: 0, cellX: 10, type: 4, state: ASSET_DISABLED, hp: 0 },
    { team: 0, cellX: 12, type: 4 },
    { team: 0, cellX: 8 },
  ]);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  const pick = regencyFor(0).plan(s).find((c) => c.type === "select_asset");
  assert.equal(pick?.assetId, 2, "the spare carrier fills the empty raider role");

  // Once ANY seat (here a human) crews a carrier, the role is filled and
  // the default lowest-free pick returns.
  let filled = sandbox([
    { team: 1, cellX: 60 },
    { team: 0, cellX: 10, type: 4 },
    { team: 0, cellX: 8 },
    { team: 0, cellX: 12, type: 4 },
  ]);
  filled = joinAndSelect(filled, 1, 0, 1); // human seat 1 drives carrier 1
  filled = apply(filled, { type: "join_operator", operatorId: 0, team: 0 });
  const pick2 = regencyFor(0).plan(filled).find((c) => c.type === "select_asset");
  assert.equal(pick2?.assetId, 2, "role filled by the human — take the tank");
});
