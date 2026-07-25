// test/milestone8b.test.js — Milestone 8B: pick up / carry / drop / return / score.
// The core flag-capture loop, driven entirely through commands and ticks.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import {
  STD_AT_BASE, STD_CARRIED, STD_DROPPED, STD_SCORED,
} from "../engine/standards.js";
import { ASSET_MOVING } from "../engine/state.js";
import { sandbox, joinAndSelect, joinSelectMove } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

const ZONE_A = { team: 0, x: 0, y: 0, width: 4, height: 4 };

test("8B driving onto the enemy standard picks it up and marks the carrier", () => {
  let s = sandbox(
    [{ team: 0, cellX: 8 }],
    [], { standards: [{ team: 0, cellX: 1, cellY: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );
  s = joinSelectMove(s, 0, 0, 0, 10, 0);
  for (let i = 0; i < 40 && s.standards[1].status !== STD_CARRIED; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  assert.equal(s.standards[1].status, STD_CARRIED);
  assert.equal(s.standards[1].carrierAssetId, 0);
});

test("8B pickup emits standard_taken exactly once", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10 }],
    [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );
  s = apply(s, { type: "advance_tick" });
  assert.deepEqual(s.events.filter((e) => e.type === "standard_taken"),
    [{ type: "standard_taken", standardId: 1, assetId: 0, byTeam: 0 }]);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.filter((e) => e.type === "standard_taken").length, 0);
});

test("8B the carried standard rides with the carrier at reduced speed", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10, state: ASSET_MOVING, targetX: cellToWorld(30) }],
    [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );
  s = apply(s, { type: "advance_tick" }); // pickup on the spot
  const x0 = s.assets[0].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x - x0, 12, "tank 16 * 0.75 carrier penalty");
  assert.equal(s.standards[1].x, s.assets[0].x, "standard rides along");
});

test("8B disabling the carrier drops the standard in place", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 10, hp: 20 },  // carrier, one shot from death
      { team: 1, cellX: 12 },           // gunner
    ],
    [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );
  s = apply(s, { type: "advance_tick" }); // pickup
  assert.equal(s.standards[1].status, STD_CARRIED);
  s = joinAndSelect(s, 1, 1, 1);
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 0 });
  assert.equal(s.standards[1].status, STD_DROPPED);
  assert.equal(s.standards[1].carrierAssetId, -1);
  assert.equal(s.standards[1].x, s.assets[0].x, "dropped where the carrier died");
  assert.ok(s.events.some((e) => e.type === "standard_dropped"));
});

test("8B a friendly touch returns a dropped standard home", () => {
  let s = sandbox(
    [{ team: 1, cellX: 20 }],
    [], { standards: [
      { team: 0, cellX: 1 },
      { team: 1, cellX: 20, status: STD_DROPPED, homeCellX: 40, homeCellY: 0 },
    ] }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].status, STD_AT_BASE);
  assert.equal(s.standards[1].x, cellToWorld(40), "back at home cell");
  assert.deepEqual(s.events.filter((e) => e.type === "standard_returned"),
    [{ type: "standard_returned", standardId: 1, team: 1 }]);
});

test("8B carrying the enemy standard into your zone scores — but only while your own is home", () => {
  let s = sandbox(
    [{ team: 0, cellX: 1, cellY: 1 }], // already inside zone A, standing on enemy standard
    [],
    {
      bases: [ZONE_A],
      standards: [
        { team: 0, cellX: 2, cellY: 2, status: STD_DROPPED }, // own standard NOT at base
        { team: 1, cellX: 1, cellY: 1 },
      ],
    }
  );
  s = apply(s, { type: "advance_tick" }); // picks up enemy standard, cannot score
  assert.equal(s.standards[1].status, STD_CARRIED);
  assert.equal(s.events.some((e) => e.type === "standard_scored"), false,
    "no scoring while own standard is missing");

  // A teammate would normally return it; here the same asset drives over it.
  // The return and the score land on the same tick: the return pass runs
  // before the scoring pass, so recovering your own opens the gate instantly.
  s = joinSelectMove(s, 0, 0, 0, 2, 2);
  const scoredEvents = [];
  for (let i = 0; i < 100 && s.standards[1].status !== STD_SCORED; i++) {
    s = apply(s, { type: "advance_tick" });
    scoredEvents.push(...s.events.filter((e) => e.type === "standard_scored"));
  }
  assert.equal(s.standards[0].status, STD_AT_BASE, "own standard recovered");
  assert.equal(s.standards[1].status, STD_SCORED);
  assert.deepEqual(scoredEvents, [{ type: "standard_scored", standardId: 1, byTeam: 0 }]);
});

test("8B full raid integration: steal from base, run home, score", () => {
  let s = sandbox(
    [{ team: 0, cellX: 3, cellY: 0 }],
    [],
    {
      bases: [ZONE_A, { team: 1, x: 20, y: 0, width: 4, height: 4 }],
      standards: [
        { team: 0, cellX: 1, cellY: 1 },
        { team: 1, cellX: 21, cellY: 1 },
      ],
    }
  );
  s = joinSelectMove(s, 0, 0, 0, 21, 1); // raid the enemy zone
  let taken = false;
  for (let i = 0; i < 400 && !taken; i++) {
    s = apply(s, { type: "advance_tick" });
    taken = s.standards[1].status === STD_CARRIED;
  }
  assert.equal(taken, true, "standard stolen from inside the enemy zone");

  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 1, targetCellY: 1 });
  let scored = false;
  for (let i = 0; i < 600 && !scored; i++) {
    s = apply(s, { type: "advance_tick" });
    scored = s.standards[1].status === STD_SCORED;
  }
  assert.equal(scored, true, "raider escorted it home and scored");
});
