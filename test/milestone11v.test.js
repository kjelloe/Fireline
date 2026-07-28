// test/milestone11v.test.js — Slice 11V: AI doctrine for bike / mortar /
// paths (prompt 24 approval). Courier recovery, replacement fire support,
// and light chassis patrolling the trails.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { AIRegency } from "../engine/ai_regency.js";
import { GameServer } from "../engine/server.js";
import { STD_DROPPED } from "../engine/standards.js";
import { UNIT_BIKE, UNIT_MORTAR } from "../engine/units.js";
import { sandbox, joinAndSelect, expectedStep } from "./helpers.js";
import { getUnitStats } from "../engine/units.js";

function regencyFor(...operatorIds) {
  const ai = new AIRegency({ fixedAgents: false });
  for (const id of operatorIds) ai.assume(id);
  return ai;
}

test("11V the recoverer role goes to the fastest controlled seat", () => {
  // Seat 0 drives a tank, seat 1 a bike; own standard lies dropped. The
  // BIKE gets the recovery move even though seat 0 is the lower operator.
  let s = sandbox(
    [{ team: 0, cellX: 10 }, { team: 0, cellX: 12, type: UNIT_BIKE }, { team: 1, cellX: 60 }],
    [],
    {
      bases: [{ team: 0, x: 0, y: 60, width: 4, height: 4 }],
      standards: [{ team: 0, cellX: 40, status: STD_DROPPED }, { team: 1, cellX: 60 }],
    }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = joinAndSelect(s, 1, 0, 1);
  const moves = regencyFor(0, 1).plan(s).filter((c) => c.type === "move_order");
  const bikeMove = moves.find((c) => c.operatorId === 1);
  assert.deepEqual(
    { x: bikeMove?.targetCellX, y: bikeMove?.targetCellY }, { x: 40, y: 0 },
    "the courier rides for the standard"
  );
});

test("11V a dropped standard pulls the garage bike into service", () => {
  // Empty-handed seat + dropped own standard + free bike -> crew the bike.
  let s = sandbox(
    [{ team: 0, cellX: 10 }, { team: 0, cellX: 12, type: UNIT_BIKE }, { team: 1, cellX: 60 }],
    [],
    {
      bases: [{ team: 0, x: 0, y: 60, width: 4, height: 4 }],
      standards: [{ team: 0, cellX: 40, status: STD_DROPPED }, { team: 1, cellX: 60 }],
    }
  );
  s = joinAndSelect(s, 1, 0, 0); // the tank is taken; the bike is free
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  const pick = regencyFor(0).plan(s).find((c) => c.type === "select_asset");
  assert.equal(pick?.assetId, 1, "the bike beats the default lowest-free pick");
});

test("11V a team with no crewed tube crews a mortar from the garage", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10 }, { team: 0, cellX: 12, type: UNIT_MORTAR }, { team: 1, cellX: 60 }],
    [], { bases: [{ team: 0, x: 0, y: 60, width: 4, height: 4 }] }
  );
  s = joinAndSelect(s, 1, 0, 0);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  const pick = regencyFor(0).plan(s).find((c) => c.type === "select_asset");
  assert.equal(pick?.assetId, 1, "replacement fire support reports for duty");

  // With a crewed tube already, the default pick returns.
  let manned = sandbox(
    [{ team: 0, cellX: 10, type: 2 }, { team: 0, cellX: 12, type: UNIT_MORTAR },
     { team: 0, cellX: 14 }, { team: 1, cellX: 60 }],
    [], { bases: [{ team: 0, x: 0, y: 60, width: 4, height: 4 }] }
  );
  manned = joinAndSelect(manned, 1, 0, 0); // artillery crewed
  manned = apply(manned, { type: "join_operator", operatorId: 0, team: 0 });
  const pick2 = regencyFor(0).plan(manned).find((c) => c.type === "select_asset");
  assert.equal(pick2?.assetId, 1, "lowest free asset (the mortar happens to be it)");
});

test("11V light chassis patrol the trails; heavy chassis keep the road", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true, aiDifficulty: 1 });
  for (let i = 0; i < 3; i++) server.step();
  const moves = server.commandLog.filter((e) => e.cmd.type === "move_order");
  const targetFor = (opId) => {
    const m = moves.filter((e) => e.cmd.operatorId === opId).at(-1);
    return m ? [m.cmd.targetCellX, m.cmd.targetCellY] : null;
  };
  const LIGHT_A = [[30, 40], [60, 40], [60, 86], [30, 86]];
  const HEAVY_A = [[48, 56], [60, 56], [58, 63], [56, 70]];
  const scoutTarget = targetFor(18); // op 18 drives asset 2 (scout)
  const tankTarget = targetFor(16);  // op 16 drives asset 0 (tank)
  // 13C: patrol legs route — accept a patrol point OR its routed first
  // step from the spawn cell.
  const acceptable = (finals, spawn, stats) => finals.flatMap((f) =>
    [f, expectedStep("frontier_corridor", spawn, f, stats)]);
  const scoutOk = acceptable(LIGHT_A, [7, 60], getUnitStats(1));
  assert.ok(scoutTarget && scoutOk.some(([x, y]) => x === scoutTarget[0] && y === scoutTarget[1]),
    `scout rides the trails (${scoutTarget})`);
  const tankOk = acceptable(HEAVY_A, [7, 56], getUnitStats(0));
  assert.ok(tankTarget && tankOk.some(([x, y]) => x === tankTarget[0] && y === tankTarget[1]),
    `tank keeps the road (${tankTarget})`);
});
