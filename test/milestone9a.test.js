// test/milestone9a.test.js — Slice 9A: Command Carrier + Carrier-exclusive
// carrying (ruling Q1) + dropped-standard auto-return anti-deadlock (Q2).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { UNIT_CARRIER, getUnitStats } from "../engine/units.js";
import {
  STD_AT_BASE, STD_CARRIED, STD_DROPPED, AUTO_RETURN_TICKS,
} from "../engine/standards.js";
import { hashState } from "../engine/snapshot.js";
import { currentHint } from "../client/js/objective_model.js";
import { sandbox } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

test("9A carrier stats are pinned per ruling Q1", () => {
  assert.deepEqual(getUnitStats(UNIT_CARRIER), {
    id: 4, name: "carrier",
    speed: 24, range: 768, minRange: 0, hp: 120, damage: 5,
    indirect: false, reloadTicks: 25,
    canTow: false, canCarryStandard: true, capacity: 2, turnRate: 6,
    canMine: false, canClearMines: false,
    heavy: false, // 11N
  });
});

test("9A only the carrier chassis can take the enemy standard", () => {
  for (const [type, canTake] of [[0, false], [1, false], [2, false], [3, false], [4, true]]) {
    let s = sandbox(
      [{ team: 0, cellX: 10, type }],
      [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
    );
    s = apply(s, { type: "advance_tick" });
    assert.equal(
      s.standards[1].status === STD_CARRIED, canTake,
      `chassis ${type} takeable=${canTake}`
    );
  }
});

test("9A anti-deadlock: a dropped standard auto-returns after the timer", () => {
  let s = sandbox(
    [{ team: 0, cellX: 60 }], // bystander far away, cannot carry anyway
    [], { standards: [
      { team: 0, cellX: 1 },
      { team: 1, cellX: 40, status: STD_DROPPED, homeCellX: 50, homeCellY: 0 },
    ] }
  );
  for (let i = 0; i < AUTO_RETURN_TICKS - 1; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].status, STD_DROPPED, "still waiting");
  assert.equal(s.standards[1].droppedTimer, AUTO_RETURN_TICKS - 1);

  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].status, STD_AT_BASE);
  assert.equal(s.standards[1].x, cellToWorld(50), "back home");
  assert.equal(s.standards[1].droppedTimer, 0);
  assert.deepEqual(
    s.events.filter((e) => e.type === "standard_returned"),
    [{ type: "standard_returned", standardId: 1, team: 1, auto: true }]
  );
});

test("9A pickup before the deadline resets the dropped timer", () => {
  let s = sandbox(
    [{ team: 0, cellX: 40, type: UNIT_CARRIER }],
    [], { standards: [
      { team: 0, cellX: 1, status: STD_DROPPED }, // own displaced: no instant score
      { team: 1, cellX: 40, status: STD_DROPPED, droppedTimer: AUTO_RETURN_TICKS - 5 },
    ] }
  );
  s = apply(s, { type: "advance_tick" }); // carrier stands on it -> pickup
  assert.equal(s.standards[1].status, STD_CARRIED);
  assert.equal(s.standards[1].droppedTimer, 0, "timer cleared on pickup");
});

test("9A friendly touch-return also clears the timer", () => {
  let s = sandbox(
    [{ team: 1, cellX: 40 }], // any chassis may return its OWN standard
    [], { standards: [
      { team: 0, cellX: 1 },
      { team: 1, cellX: 40, status: STD_DROPPED, droppedTimer: 300, homeCellX: 50 },
    ] }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].status, STD_AT_BASE);
  assert.equal(s.standards[1].droppedTimer, 0);
});

test("9A droppedTimer is hashed state", () => {
  const a = sandbox([], [], { standards: [{ team: 0, cellX: 1 }, { team: 1, cellX: 40, status: STD_DROPPED }] });
  const b = sandbox([], [], { standards: [{ team: 0, cellX: 1 }, { team: 1, cellX: 40, status: STD_DROPPED, droppedTimer: 5 }] });
  assert.notEqual(hashState(a), hashState(b));
});

test("9A the hint teaches the carrier requirement", () => {
  const view = {
    standards: [{ team: 0, status: STD_AT_BASE }, { team: 1, status: STD_AT_BASE }],
    sites: [{ owner: 0 }],
  };
  assert.match(currentHint(view, 0, { canCarry: false }), /COMMAND CARRIER/);
  assert.match(currentHint(view, 0, { canCarry: true }), /Push for their Command Standard/);
  assert.match(currentHint(view, 0), /Push for their/, "no opts: legacy behavior");
});
