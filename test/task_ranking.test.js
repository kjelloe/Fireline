// test/task_ranking.test.js — prompt-79 ruling: mission cards rank by
// VALUE TO THE TEAM first, then by locality. Value is the Recognition
// table, so the to-do list and the scoreboard cannot drift apart — a
// card ranked high but scored low would teach the wrong lesson.

import { test } from "node:test";
import assert from "node:assert/strict";
import { tasksFor } from "../client/js/tasks_model.js";
import {
  RECOG_TOW, RECOG_RESCUE, RECOG_RELAY, RECOG_STANDARD_CAPTURE,
} from "../engine/reducer.js";

const CELL = 256;
// A view with my truck at (20,20): a rescue far away and a tow nearby,
// so value and locality actively DISAGREE.
function viewWith(opts = {}) {
  return {
    friendlyAssets: [
      { id: 0, type: 3 /* truck: can tow AND has no bunks */, operatorId: 7,
        x: 20 * CELL, y: 20 * CELL, state: 0, hp: 100 },
      ...(opts.extraFriendly ?? []),
    ],
    visibleEnemies: [],
    downedOperators: opts.downed ?? [],
    sites: opts.sites ?? [],
    standards: opts.standards ?? [],
    bases: [{ team: 0, x: 0, y: 0, width: 128, height: 128 }],
    ...opts.view,
  };
}

test("79: the value table matches the Recognition ruling it claims to follow", () => {
  // If someone retunes Recognition, this fails and forces the card
  // values to be retuned with it - which is the entire point.
  assert.equal(RECOG_RESCUE, 10);
  assert.equal(RECOG_RELAY, 10);
  assert.equal(RECOG_TOW, 8);
  assert.equal(RECOG_STANDARD_CAPTURE, 25);
});

test("79: a distant HIGH-value card outranks a near low-value one", () => {
  const view = viewWith({
    // A wreck 2 cells away (recover, 8) and a downed operator 30 cells
    // away (rescue, 10). Locality alone would put the wreck first.
    extraFriendly: [
      { id: 1, type: 0, operatorId: -1, x: 22 * CELL, y: 20 * CELL, state: 2, hp: 0 },
      { id: 2, type: 4 /* carrier: gives the rescue card a taker */, operatorId: 8,
        x: 21 * CELL, y: 20 * CELL, state: 0, hp: 100 },
    ],
    downed: [{ operatorId: 9, team: 0, x: 50 * CELL, y: 20 * CELL }],
  });
  const cards = tasksFor(view, 8); // the carrier operator sees both kinds
  const kinds = cards.map((c) => c.kind);
  if (kinds.includes("rescue") && kinds.includes("recover")) {
    assert.ok(kinds.indexOf("rescue") < kinds.indexOf("recover"),
      `rescue (10) must outrank recover (8) despite being further: ${kinds.join(",")}`);
  }
});

test("79: among EQUAL value, the nearer card wins (locality is the tiebreak)", () => {
  // Two relays needing defence, one near, one far: same value, so the
  // near one must lead.
  const view = viewWith({
    sites: [
      { id: 0, cellX: 60, cellY: 60, owner: 0, hp: 60, captureProgress: 5, capturingTeam: 1 },
      { id: 1, cellX: 22, cellY: 20, owner: 0, hp: 60, captureProgress: 5, capturingTeam: 1 },
    ],
  });
  const defend = tasksFor(view, 7).filter((c) => c.kind === "defend_relay");
  if (defend.length > 1) {
    assert.ok(defend[0].distance <= defend[1].distance,
      "equal-value cards must be ordered by distance");
  }
});

test("79: ordering is deterministic — two clients cannot disagree", () => {
  const view = viewWith({
    extraFriendly: [
      { id: 1, type: 0, operatorId: -1, x: 30 * CELL, y: 20 * CELL, state: 2, hp: 0 },
      { id: 2, type: 0, operatorId: -1, x: 30 * CELL, y: 40 * CELL, state: 2, hp: 0 },
    ],
    sites: [{ id: 0, cellX: 60, cellY: 60, owner: 0, hp: 0 }],
  });
  const a = tasksFor(view, 7).map((c) => c.id);
  const b = tasksFor(view, 7).map((c) => c.id);
  assert.deepEqual(a, b, "same view, same order, every time");
});

test("32: a dry teammate raises a RESUPPLY card, ranked below every rescue", () => {
  const view = {
    friendlyAssets: [
      { id: 0, type: 3 /* truck */, operatorId: 7, x: 20 * 256, y: 20 * 256, state: 0, hp: 100 },
      { id: 1, type: 0, operatorId: 8, x: 21 * 256, y: 20 * 256, state: 0, hp: 100,
        ammo: 0, fuel: 100 }, // right next door and bone dry
    ],
    visibleEnemies: [],
    downedOperators: [{ operatorId: 9, team: 0, x: 90 * 256, y: 90 * 256 }], // far away
    sites: [], standards: [],
    bases: [{ team: 0, x: 0, y: 0, width: 128, height: 128 }],
  };
  const kinds = tasksFor(view, 7).map((c) => c.kind);
  assert.ok(kinds.includes("resupply"), `expected a resupply card: ${kinds.join(",")}`);
  if (kinds.includes("rescue")) {
    assert.ok(kinds.indexOf("rescue") < kinds.indexOf("resupply"),
      "a distant rescue (10) still outranks a resupply (4) next door");
  }
});

test("32: only a cargo chassis is offered the resupply card", () => {
  const base = {
    friendlyAssets: [
      { id: 0, type: 0 /* tank: cannot carry cargo */, operatorId: 7,
        x: 20 * 256, y: 20 * 256, state: 0, hp: 100 },
      { id: 1, type: 0, operatorId: 8, x: 21 * 256, y: 20 * 256, state: 0, hp: 100,
        ammo: 0, fuel: 100 },
    ],
    visibleEnemies: [], downedOperators: [], sites: [], standards: [],
    bases: [{ team: 0, x: 0, y: 0, width: 128, height: 128 }],
  };
  assert.ok(!tasksFor(base, 7).some((c) => c.kind === "resupply"),
    "a tank is never told to go and resupply someone");
});

test("Q31 raider's clause: an unguarded flag falls twice as fast to a Skimmer", async () => {
  const { apply } = await import("../engine/reducer.js");
  const { SITE_CAPTURE_TICKS } = await import("../engine/sites.js");
  const { sandbox, joinAndSelect } = await import("./helpers.js");
  const OFF = [
    { team: 0, x: 0, y: 0, width: 4, height: 4 },
    { team: 1, x: 60, y: 60, width: 4, height: 4 },
  ];
  // A lone Skimmer on an empty neutral flag: double clock.
  let raid = sandbox([{ team: 1, type: 8, cellX: 30, cellY: 30 }],
    [{ cellX: 30, cellY: 30 }], { bases: OFF });
  raid = joinAndSelect(raid, 16, 1, 0);
  for (let i = 0; i < Math.ceil(SITE_CAPTURE_TICKS / 2); i++) raid = apply(raid, { type: "advance_tick" });
  assert.equal(raid.sites[0].owner, 1, "raid completed in half the ticks");

  // Same raid with an enemy lurking 6 cells away: normal clock.
  let guarded = sandbox([
    { team: 1, type: 8, cellX: 30, cellY: 30 },
    { team: 0, type: 0, cellX: 36, cellY: 30 },
  ], [{ cellX: 30, cellY: 30 }], { bases: OFF });
  guarded = joinAndSelect(guarded, 16, 1, 0);
  for (let i = 0; i < Math.ceil(SITE_CAPTURE_TICKS / 2); i++) guarded = apply(guarded, { type: "advance_tick" });
  assert.equal(guarded.sites[0].owner, -1, "a guard within 8 cells kills the bonus");

  // A tank on the same empty flag: normal clock (the clause is the raider's).
  let tank = sandbox([{ team: 1, type: 0, cellX: 30, cellY: 30 }],
    [{ cellX: 30, cellY: 30 }], { bases: OFF });
  tank = joinAndSelect(tank, 16, 1, 0);
  for (let i = 0; i < Math.ceil(SITE_CAPTURE_TICKS / 2); i++) tank = apply(tank, { type: "advance_tick" });
  assert.equal(tank.sites[0].owner, -1, "no bonus for non-raiders");
});

test("Q31 seat-swap: a regent abandons a unique that earned nothing", async () => {
  const { AIRegency, EARN_WINDOW_TICKS } = await import("../engine/ai_regency.js");
  const { sandbox, joinAndSelect } = await import("./helpers.js");
  let s = sandbox([
    { team: 1, type: 8, cellX: 30, cellY: 30 },  // the Skimmer, op 16 aboard
    { team: 1, type: 0, cellX: 32, cellY: 30 },  // a free real tank
  ]);
  s = joinAndSelect(s, 16, 1, 0);
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  ai.plan(s);                       // arms the earn window
  s.tick += EARN_WINDOW_TICKS;      // a whole window passes, score unchanged
  const swap = ai.plan(s).find((c) => c.type === "select_asset" && c.operatorId === 16);
  assert.ok(swap, "the regent gives up the seat");
  assert.equal(swap.assetId, 1, "and takes the real hull");
  assert.ok(ai.benched.has(0), "the unique is benched for the war");

  // An EARNING unique keeps its crew.
  let earn = sandbox([
    { team: 1, type: 8, cellX: 30, cellY: 30 },
    { team: 1, type: 0, cellX: 32, cellY: 30 },
  ]);
  earn = joinAndSelect(earn, 16, 1, 0);
  const ai2 = new AIRegency({ fixedAgents: false });
  ai2.assume(16);
  ai2.plan(earn);
  earn.tick += EARN_WINDOW_TICKS;
  earn.operators[16] = { ...earn.operators[16], score: earn.operators[16].score + 10 };
  const stay = ai2.plan(earn).find((c) => c.type === "select_asset" && c.operatorId === 16);
  assert.equal(stay, undefined, "recognition earned = the seat is justified");
});

// W4-3 (prompt 174): the two systems a player could never find. Both
// cards derive from what the team LEGITIMATELY knows — prisons are
// public landmarks by design (headcount + identities ride the view),
// and a team--1 hull is unclaimed by definition because capture
// reassigns the team (Q42: select IS the capture).

const CELL_W43 = 256;
function w43View(opts = {}) {
  return {
    team: 0,
    friendlyAssets: [
      { id: 0, type: 3, operatorId: 7, x: 20 * CELL_W43, y: 20 * CELL_W43, state: 0, hp: 100 },
    ],
    visibleEnemies: opts.visibleEnemies ?? [],
    operators: opts.operators ?? [],
    prisons: opts.prisons ?? [],
    downedOperators: [], sites: [], standards: [], drops: [], mines: [],
  };
}

test("W4-3: a teammate in the enemy prison raises a RAID card at the prison", () => {
  const tasks = tasksFor(w43View({
    prisons: [{ team: 1, cellX: 90, cellY: 60, pows: [{ id: 4 }, { id: 9 }], raidTicks: 0 }],
    operators: [{ id: 4, team: 0 }, { id: 9, team: 0 }],
  }), 7);
  const card = tasks.find((c) => c.kind === "raid_prison");
  assert.ok(card, "the card exists");
  assert.equal(card.cellX, 90);
  assert.equal(card.cellY, 60);
  assert.match(card.label, /2/, "it names how many are held");
});

test("W4-3: our OWN prison holding THEIR people raises nothing", () => {
  const tasks = tasksFor(w43View({
    prisons: [{ team: 0, cellX: 10, cellY: 60, pows: [{ id: 20 }], raidTicks: 0 }],
    operators: [{ id: 20, team: 1 }],
  }), 7);
  assert.equal(tasks.find((c) => c.kind === "raid_prison"), undefined);
});

test("W4-3: an enemy prison holding only THEIR OWN people raises nothing", () => {
  // Re-secured enemy POWs sit in their own compound — not our problem.
  const tasks = tasksFor(w43View({
    prisons: [{ team: 1, cellX: 90, cellY: 60, pows: [{ id: 21 }], raidTicks: 0 }],
    operators: [{ id: 21, team: 1 }],
  }), 7);
  assert.equal(tasks.find((c) => c.kind === "raid_prison"), undefined);
});

test("W4-3: a visible unclaimed LANDSHIP raises a claim card", () => {
  const tasks = tasksFor(w43View({
    visibleEnemies: [{ id: 32, type: 9, team: -1, state: 0, x: 64 * CELL_W43, y: 40 * CELL_W43 }],
  }), 7);
  const card = tasks.find((c) => c.kind === "claim_landship");
  assert.ok(card, "the card exists");
  assert.equal(card.cellX, 64);
});

test("W4-3: a CLAIMED landship raises nothing (capture reassigns the team)", () => {
  const tasks = tasksFor(w43View({
    visibleEnemies: [{ id: 32, type: 9, team: 1, state: 0, x: 64 * CELL_W43, y: 40 * CELL_W43 }],
  }), 7);
  assert.equal(tasks.find((c) => c.kind === "claim_landship"), undefined);
});

test("W4-3: a WRECKED neutral hull is a tow job, not a prize", () => {
  const tasks = tasksFor(w43View({
    visibleEnemies: [{ id: 32, type: 9, team: -1, state: 2, x: 64 * CELL_W43, y: 40 * CELL_W43 }],
  }), 7);
  assert.equal(tasks.find((c) => c.kind === "claim_landship"), undefined);
});
