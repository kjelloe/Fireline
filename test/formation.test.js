// test/formation.test.js — the group-movement primitive (prompt 110
// queue), v1 consumer: the prison raid party. The laws under test:
// assemble at the rally before advancing, escorts lead, the soft
// leader holds cohesion, and solo dives happen only through an empty
// wire. The old chase-the-leader doctrine measured 2,478 dive ticks
// and zero completed raids — these tests pin its replacement.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AIRegency, FORM_UP_CELLS, RAID_COHESION_CELLS,
} from "../engine/ai_regency.js";
import { OP_CAPTIVE } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const PRISON = { cellX: 10, cellY: 30 };
// Rally near OWN lines: team-1 base centre (62,62) minus 12 toward the
// prison, on the SHARED approach lane (prison row +8, both teams —
// the team-keyed +10/+6 split was a measured 5-pt team bias).
const STAGE = { cellX: 50, cellY: 38 };
// The advance rides the lane until the final 12 cells, then turns in.
const LANE = { cellX: 10, cellY: 38 };

// Team 1 raids a team-0 prison holding op 30. Party: one scout (the
// specialist) + two tanks. A team-0 guard tank sits at the wire so the
// sneak window (guards === 0) stays closed unless a test opens it.
function partyWorld({ scoutAt, tank1At, tank2At, guard = true }) {
  const specs = [
    { team: 1, type: 1, cellX: scoutAt[0], cellY: scoutAt[1] },
    { team: 1, type: 0, cellX: tank1At[0], cellY: tank1At[1] },
    { team: 1, type: 0, cellX: tank2At[0], cellY: tank2At[1] },
  ];
  if (guard) specs.push({ team: 0, type: 0, cellX: PRISON.cellX + 1, cellY: PRISON.cellY });
  let s = sandbox(specs, [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 60, y: 60, width: 4, height: 4 },
    ],
  });
  s.operators[30] = { ...s.operators[30], state: OP_CAPTIVE, team: 1 };
  s.prisons = [{ team: 0, ...PRISON, pows: [{ id: 30, by: -1 }], raidTicks: 0 }];
  s = joinAndSelect(s, 20, 1, 0); // scout
  s = joinAndSelect(s, 21, 1, 1); // tank escort
  s = joinAndSelect(s, 22, 1, 2); // tank escort
  if (guard) s = joinAndSelect(s, 0, 0, 3); // human-crewed guard (not AI-planned)
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(20); ai.assume(21); ai.assume(22);
  return { s, ai };
}

const moveOf = (cmds, opId) => cmds.find((c) => c.type === "move_order" && c.operatorId === opId);
const near = (cmd, cell, tol = 2) =>
  cmd && Math.abs(cmd.targetCellX - cell.cellX) <= tol && Math.abs(cmd.targetCellY - cell.cellY) <= tol;

test("formation: a scattered party rides to the RALLY, nobody dives", () => {
  const { s, ai } = partyWorld({ scoutAt: [45, 45], tank1At: [50, 10], tank2At: [55, 50] });
  const cmds = ai.plan(s);
  for (const opId of [20, 21, 22]) {
    const mv = moveOf(cmds, opId);
    assert.ok(near(mv, STAGE), `op ${opId} rallies at the stage: ${JSON.stringify(mv)}`);
    assert.ok(!near(mv, PRISON, 4), `op ${opId} does not dive while scattered`);
  }
  assert.equal(ai.raidParty[1].phase, 0, "still assembling");
});

test("formation: formed up at the rally → ADVANCE, escorts lead at the wire", () => {
  const { s, ai } = partyWorld({
    scoutAt: [STAGE.cellX, STAGE.cellY],
    tank1At: [STAGE.cellX - 2, STAGE.cellY - 1],
    tank2At: [STAGE.cellX - 2, STAGE.cellY + 1],
  });
  const cmds = ai.plan(s);
  assert.equal(ai.raidParty[1].phase, 1, "the party is formed");
  for (const opId of [21, 22]) {
    assert.ok(near(moveOf(cmds, opId), LANE), `escort ${opId} leads the advance in-lane`);
  }
  // The scout sits within cohesion of both escorts — it presses too.
  assert.ok(near(moveOf(cmds, 20), LANE), "leader advances inside cohesion");
});


test("formation: the leader HOLDS cohesion — outrun escorts pull it back", () => {
  const { s, ai } = partyWorld({
    scoutAt: [20, 30],                       // way ahead, alone at the wire's edge
    tank1At: [20 + RAID_COHESION_CELLS + 8, 30],
    tank2At: [20 + RAID_COHESION_CELLS + 9, 30],
  });
  ai.raidParty = { 1: { raiderOp: 20, phase: 1 } }; // mid-advance
  const cmds = ai.plan(s);
  const mv = moveOf(cmds, 20);
  assert.ok(mv, "the leader gets an order");
  assert.ok(!near(mv, PRISON, 4), "not a solo dive");
  assert.ok(mv.targetCellX >= 20 + RAID_COHESION_CELLS + 6, "it closes on its armour instead");
});

test("formation: no escorts, guarded wire → the raider stages, never solo-dives", () => {
  // Only the scout is crewed: assemble can never complete (needs 2
  // escorts) and the guard keeps the sneak window shut.
  const specs = [
    { team: 1, type: 1, cellX: 55, cellY: 45 },
    { team: 0, type: 0, cellX: PRISON.cellX + 1, cellY: PRISON.cellY },
  ];
  let s = sandbox(specs, [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 60, y: 60, width: 4, height: 4 },
    ],
  });
  s.operators[30] = { ...s.operators[30], state: OP_CAPTIVE, team: 1 };
  s.prisons = [{ team: 0, ...PRISON, pows: [{ id: 30, by: -1 }], raidTicks: 0 }];
  s = joinAndSelect(s, 20, 1, 0);
  s = joinAndSelect(s, 0, 0, 1);
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(20);
  const cmds = ai.plan(s);
  assert.ok(near(moveOf(cmds, 20), STAGE), "the raider stages and waits for a party");
});

test("formation: an EMPTY wire is a sneak window only up CLOSE", () => {
  // Near: a target of opportunity — the raider slips in alone.
  const nearWorld = partyWorld({
    scoutAt: [20, 30], tank1At: [50, 10], tank2At: [50, 50], guard: false,
  });
  assert.ok(near(moveOf(nearWorld.ai.plan(nearWorld.s), 20), PRISON),
    "unguarded prison at 10 cells: no need for the party");
  // Far: the ROUTE is the danger, not the wire — party law applies.
  // (The trace that forced this: guards=0 at tick 2, both raiders
  // solo-diving the full map width from spawn.)
  const farWorld = partyWorld({
    scoutAt: [55, 45], tank1At: [50, 10], tank2At: [50, 50], guard: false,
  });
  assert.ok(near(moveOf(farWorld.ai.plan(farWorld.s), 20), STAGE),
    "unguarded but 40 cells out: rally first");
});

test("formation: freed AI POWs crawl for home instead of lying at the wire", () => {
  let s = sandbox([{ team: 1, type: 0, cellX: 40, cellY: 40 }], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 56, y: 56, width: 4, height: 4 },
    ],
  });
  s = joinAndSelect(s, 20, 1, 0);
  s.operators[26] = { ...s.operators[26], state: 2 /* OP_DOWN */, team: 1, assetId: -1 };
  s.downed = [{
    operatorId: 26, x: 10 * 256 + 128, y: 30 * 256 + 128,
    targetX: 10 * 256 + 128, targetY: 30 * 256 + 128,
    downTicks: 0, carriedBy: -1, freedPow: 1, resecureTicks: 0, satchels: 0,
  }];
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(20); ai.assume(26);
  const crawl = ai.plan(s).find((c) => c.type === "crawl_order" && c.operatorId === 26);
  assert.ok(crawl, "the freed prisoner gets a crawl order");
  // Crawl legs are capped at CRAWL_RADIUS_CELLS — one short leg toward
  // the own base (58,58), from (10,30): x first.
  assert.equal(crawl.targetCellX, 13, "a short leg toward the OWN base");
  assert.equal(crawl.targetCellY, 30);
});

test("formation: the phase latch resets when the mission ends", () => {
  const { s, ai } = partyWorld({
    scoutAt: [STAGE.cellX, STAGE.cellY],
    tank1At: [STAGE.cellX - 2, STAGE.cellY - 1],
    tank2At: [STAGE.cellX - 2, STAGE.cellY + 1],
  });
  ai.plan(s);
  assert.equal(ai.raidParty[1].phase, 1);
  const freed = { ...s, prisons: [{ ...s.prisons[0], pows: [] }] };
  ai.plan(freed);
  assert.equal(ai.raidParty[1], undefined, "no pows, no party memory");
});
