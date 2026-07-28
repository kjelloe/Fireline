// test/milestone11k.test.js — Slice 11K: Recognition scoring (prompt 19
// table). Rescue > kill: tow 8, delivery 10, standard return 10, standard
// capture 25, relay 10, kill 5. Auto-returns and unmanned kills award
// nobody; the scoreboard rides the views, minimal.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apply, RECOG_TOW, RECOG_RESCUE, RECOG_STANDARD_RETURN,
  RECOG_STANDARD_CAPTURE, RECOG_RELAY, RECOG_KILL,
} from "../engine/reducer.js";
import { SITE_CAPTURE_TICKS } from "../engine/sites.js";
import { STD_DROPPED, STD_CARRIED } from "../engine/standards.js";
import { ASSET_DISABLED, OP_DOWN } from "../engine/state.js";
import { AUTO_RETURN_TICKS } from "../engine/standards.js";
import { buildView } from "../engine/view.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 0, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

test("11K a kill pays 5 — to the trigger seat only", () => {
  let s = sandbox([
    { team: 0, cellX: 10 },
    { team: 1, cellX: 12, hp: 20 },
    { team: 1, cellX: 50 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.operators[0].score, RECOG_KILL);
});

test("11K standard capture pays 25, manual return 10, auto-return nothing", () => {
  // Capture: carrier holding the enemy standard idles home.
  let cap = sandbox(
    [{ team: 0, cellX: 1, cellY: 1, type: 4 }],
    [],
    {
      bases: [{ team: 0, x: 0, y: 0, width: 4, height: 4 }, { team: 1, x: 60, y: 60, width: 4, height: 4 }],
      standards: [
        { team: 0, cellX: 2, cellY: 1 },
        { team: 1, cellX: 1, cellY: 1, status: STD_CARRIED, carrierAssetId: 0 },
      ],
    }
  );
  cap = joinAndSelect(cap, 0, 0, 0);
  cap = apply(cap, { type: "advance_tick" });
  assert.ok(cap.events.some((e) => e.type === "standard_scored"));
  assert.equal(cap.operators[0].score, RECOG_STANDARD_CAPTURE);

  // Manual return: any chassis touching its own dropped standard.
  let ret = sandbox(
    [{ team: 0, cellX: 10 }],
    [],
    { bases: OFF_BASES, standards: [{ team: 0, cellX: 10, status: STD_DROPPED }, { team: 1, cellX: 60 }] }
  );
  ret = joinAndSelect(ret, 0, 0, 0);
  ret = apply(ret, { type: "advance_tick" });
  assert.ok(ret.events.some((e) => e.type === "standard_returned" && !e.auto));
  assert.equal(ret.operators[0].score, RECOG_STANDARD_RETURN);

  // Auto-return after the timer: the war thanks no one.
  let auto = sandbox(
    [{ team: 0, cellX: 40 }],
    [],
    { bases: OFF_BASES, standards: [{ team: 0, cellX: 20, status: STD_DROPPED }, { team: 1, cellX: 60 }] }
  );
  for (let i = 0; i < AUTO_RETURN_TICKS; i++) auto = apply(auto, { type: "advance_tick" });
  assert.ok(auto.events.some?.((e) => e.type === "standard_returned") ||
    auto.standards[0].status === 0, "returned");
  assert.equal(auto.operators.every((o) => o.score === 0), true);
});

test("11K tow completion pays 8; rescue delivery pays 10 to the carrier seat", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 1, cellY: 1, type: 3 },
      { team: 0, cellX: 2, cellY: 1, state: ASSET_DISABLED, hp: 0, towedBy: 0 },
    ],
    [],
    { bases: [{ team: 0, x: 0, y: 0, width: 4, height: 4 }, { team: 1, x: 60, y: 60, width: 4, height: 4 }] }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "advance_tick" }); // wreck is in base: bay takes it
  assert.ok(s.events.some((e) => e.type === "recovery_started"));
  assert.equal(s.operators[0].score, RECOG_TOW);

  // Delivery: carrier idles home with a passenger aboard.
  let del = sandbox(
    [{ team: 0, cellX: 1, cellY: 1, type: 4, aboard1: 5 }],
    [],
    { bases: [{ team: 0, x: 0, y: 0, width: 4, height: 4 }, { team: 1, x: 60, y: 60, width: 4, height: 4 }] }
  );
  del.operators[5] = { ...del.operators[5], state: OP_DOWN, team: 0, assetId: -1 };
  del = joinAndSelect(del, 0, 0, 0);
  del = apply(del, { type: "advance_tick" });
  assert.ok(del.events.some((e) => e.type === "operator_delivered"));
  assert.equal(del.operators[0].score, RECOG_RESCUE);
});

test("11K standing a relay capture out pays 10; the scoreboard is public", () => {
  let s = sandbox(
    [{ team: 0, cellX: 5 }],
    [{ cellX: 5 }, { cellX: 60, owner: 1 }],
    { bases: OFF_BASES }
  );
  s = joinAndSelect(s, 0, 0, 0);
  for (let i = 0; i <= SITE_CAPTURE_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some?.((e) => e.type === "site_captured") || s.sites[0].owner === 0);
  assert.equal(s.operators[0].score, RECOG_RELAY);

  const board = buildView(s, 1).operators;
  assert.deepEqual(board, [{ id: 0, team: 0, score: RECOG_RELAY, respawnTicks: 0 }],
    "both teams read the same scoreboard");
});

test("11K mine kills award nobody (no seat behind a mine)", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10 }, { team: 1, cellX: 20, cellY: 20, hp: 10 }, { team: 1, cellX: 50 }],
    [], { bases: OFF_BASES }
  );
  s.mines.push({ id: 0, team: 0, cellX: 20, cellY: 20, armTimer: 0, marked: 0 });
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[1].state, ASSET_DISABLED, "the mine killed");
  assert.equal(s.operators.every((o) => o.score === 0), true, "nobody claims it");
});

test("11K topOperators ranks honors for the end screen", async () => {
  const { topOperators } = await import("../client/js/feedback_model.js");
  const view = { operators: [
    { id: 3, team: 0, score: 10 }, { id: 20, team: 1, score: 25 },
    { id: 1, team: 0, score: 0 }, { id: 7, team: 1, score: 10 },
  ] };
  assert.deepEqual(topOperators(view), [
    "Regent 20 (B) — 25 pts",
    "Operator 3 (A) — 10 pts",
    "Operator 7 (B) — 10 pts",
  ]);
  assert.deepEqual(topOperators({}), []);
});
