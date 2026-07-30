// test/prisons.test.js — POW arc slice 1 (specs/12 Q35/Q37/Q40):
// prison compounds, pre-placed captives, seat locks, and the raid
// that springs them into the standing rescue loop.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { createInitialState, OP_CAPTIVE, OP_DOWN, OP_ACTIVE } from "../engine/state.js";
import { RAID_HOLD_TICKS, RECOG_FREE_POW, PREPLACED_POWS } from "../engine/prisons.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("POW: pre-placed captives lock their seats, symmetrically", () => {
  // Pre-placement is a session rule (default 0 — the deviation note in
  // DEFAULT_RULES tells the story). POWS=2 is the designed experience.
  const s = createInitialState(42, "frontier_corridor", { powPreplaced: 2 });
  assert.equal(s.prisons.length, 2, "one prison per base");
  for (const [prisonTeam, powIds] of Object.entries(PREPLACED_POWS)) {
    for (const id of powIds) {
      assert.equal(s.operators[id].state, OP_CAPTIVE, `op ${id} starts captive`);
      assert.equal(s.operators[id].team, 1 - Number(prisonTeam), "held by the ENEMY");
    }
  }
  // The lock is real: neither a human nor the AI can join the seat.
  const joined = apply(s, { type: "join_operator", operatorId: 30, team: 1 });
  assert.equal(joined.events.at(-1).reason, "seat held prisoner");
  // Mirror fairness: both prisons hold the same headcount.
  assert.equal(s.prisons[0].pows.length, s.prisons[1].pows.length);
});

test("POW: a raid springs every prisoner into the rescue loop", () => {
  // Sandbox prison, team-0-owned, holding op 30 (team 1); a team-1
  // tank parks beside the wire.
  let s = sandbox([{ team: 1, type: 0, cellX: 11, cellY: 30 }], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 60, y: 60, width: 4, height: 4 },
    ],
  });
  s.operators[30] = { ...s.operators[30], state: OP_CAPTIVE, team: 1 };
  s.prisons = [{ team: 0, cellX: 10, cellY: 30, pows: [30], raidTicks: 0 }];
  s = joinAndSelect(s, 20, 1, 0);
  for (let i = 0; i < RAID_HOLD_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.prisons[0].pows.length, 0, "the compound is empty");
  assert.equal(s.operators[30].state, OP_DOWN, "the prisoner walks out DOWNED");
  const body = s.downed.find((d) => d.operatorId === 30);
  assert.ok(body, "a body at the wire");
  assert.equal(body.freedPow, 1, "marked as freed");
  assert.equal(s.operators[20].score, RECOG_FREE_POW, "the raider is paid per head");
  assert.ok(s.events.some((e) => e.type === "prison_raided"));

  // Freed prisoners cannot SELF-redeploy — the carrier ride IS the rescue.
  for (let i = 0; i < 110; i++) s = apply(s, { type: "advance_tick" });
  const rd = apply(s, { type: "redeploy", operatorId: 30 });
  assert.equal(rd.events.at(-1).reason, "too weak from captivity");
});

test("POW: the raid clock needs a live enemy at the wire and resets without one", () => {
  let s = sandbox([{ team: 1, type: 0, cellX: 40, cellY: 40 }], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 60, y: 60, width: 4, height: 4 },
    ],
  });
  s.operators[30] = { ...s.operators[30], state: OP_CAPTIVE, team: 1 };
  s.prisons = [{ team: 0, cellX: 10, cellY: 30, pows: [30], raidTicks: 50 }];
  s = joinAndSelect(s, 20, 1, 0); // crewed, but 30 cells away
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.prisons[0].raidTicks, 0, "no one at the wire, the clock resets");
  assert.equal(s.operators[30].state, OP_CAPTIVE, "still captive");
});

test("POW: delivery through the standing rescue loop unlocks the seat", () => {
  // Freed body next to a friendly carrier that is idle in its own base.
  let s = sandbox([{ team: 1, type: 4, cellX: 61, cellY: 61 }], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 60, y: 60, width: 4, height: 4 },
    ],
  });
  s.operators[30] = { ...s.operators[30], state: OP_DOWN, team: 1, autoRescue: 1 };
  s.downed.push({
    operatorId: 30, team: 1,
    x: cellToWorld(62), y: cellToWorld(61),
    targetX: cellToWorld(62), targetY: cellToWorld(61),
    downTicks: 0, freedPow: 1,
  });
  s = joinAndSelect(s, 20, 1, 0);
  s = apply(s, { type: "advance_tick" }); // scoop
  s = apply(s, { type: "advance_tick" }); // deliver (idle in own base)
  assert.equal(s.operators[30].state, OP_ACTIVE, "home — the seat is UNLOCKED");
});
