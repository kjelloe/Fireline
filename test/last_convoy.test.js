// test/last_convoy.test.js — THE LAST CONVOY (ruled 2026-07-31).
// The moment mercy WOULD engage, the losing team's endgame flips: get
// N hulls home before the pool empties. The call SUSPENDS the mercy
// bleed (ruled); N = ceil(fielded/3) clamped 3..5; under 3 in the
// field there is no convoy and mercy carries on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, RECOG_CONVOY_EVAC } from "../engine/reducer.js";
import { ASSET_DISABLED } from "../engine/state.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { sandbox, joinAndSelect } from "./helpers.js";

// Team 0 holds the majority (2 of 3); team 1 is nearly out with hulls
// in the FIELD (bases are small, so "outside the base" is real).
function rout(opts = {}) {
  const BASES = [
    { team: 0, x: 0, y: 0, width: 6, height: 6 },
    { team: 1, x: 58, y: 58, width: 6, height: 6 },
  ];
  const fielded = opts.fielded ?? 4;
  const units = [{ team: 0, type: 0, cellX: 10, cellY: 10 }];
  for (let i = 0; i < fielded; i++) {
    units.push({ team: 1, type: 0, cellX: 30 + i, cellY: 30 });
  }
  let s = sandbox(units,
    [{ cellX: 10, cellY: 10, owner: 0 }, { cellX: 20, cellY: 20, owner: 0 },
     { cellX: 40, cellY: 40, owner: -1 }],
    { bases: BASES });
  s = joinAndSelect(s, 0, 0, 0);
  for (let i = 0; i < fielded; i++) s = joinAndSelect(s, 16 + i, 1, 1 + i);
  s.tickets = [300, opts.loserPool ?? 60]; // 60 <= 315/4: nearly out
  return s;
}

function bleedUntil(s, pred, cap = 60) {
  for (let i = 0; i < cap; i++) {
    s = apply(s, { type: "advance_tick" });
    if (pred(s)) break;
  }
  return s;
}

test("convoy: the call replaces mercy — bleed drops back to 1 per cadence", () => {
  let s = rout({ fielded: 4 });
  s = bleedUntil(s, (x) => x.convoy[1].active === 1);
  assert.equal(s.convoy[1].active, 1, "the convoy was called");
  assert.equal(s.convoy[1].need, 3, "ceil(4/3)=2, clamped up to 3");
  assert.ok(s.events.length >= 0);
  const before = s.tickets[1];
  s = bleedUntil(s, (x) => x.tickets[1] !== before);
  assert.equal(before - s.tickets[1], 1,
    "no mercy acceleration while the convoy runs");
});

test("convoy: quota reached pays every escaped crew, once, and mercy resumes", () => {
  let s = rout({ fielded: 4 });
  s = bleedUntil(s, (x) => x.convoy[1].active === 1);
  // Teleport three convoy hulls home (the test is about counting, not
  // driving). ids are the fielded team-1 hulls.
  const home = { x: cellToWorld(60), y: cellToWorld(60) };
  for (const id of s.convoy[1].ids.slice(0, 3)) {
    s.assets[id].x = home.x; s.assets[id].y = home.y;
    s.assets[id].targetX = home.x; s.assets[id].targetY = home.y;
  }
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.convoy[1].done, 3);
  assert.ok(s.events.some((e) => e.type === "last_convoy_complete"),
    "the escape is announced");
  const escaped = s.convoy[1].ids.slice(0, 3).map((id) => s.assets[id].operatorId);
  for (const op of escaped) {
    assert.equal(s.operators[op].score, RECOG_CONVOY_EVAC, "the driver got seen");
  }
  const again = apply(s, { type: "advance_tick" });
  assert.ok(!again.events.some((e) => e.type === "last_convoy_complete"),
    "completion announces once");
  for (const op of escaped) {
    assert.equal(again.operators[op].score, RECOG_CONVOY_EVAC, "and pays once");
  }
});

test("convoy: a gutted team (under 3 fielded) gets mercy, not a quota", () => {
  let s = rout({ fielded: 2 });
  s = bleedUntil(s, () => false, 30);
  assert.equal(s.convoy[1].active, 0, "no convoy for two hulls");
  // Mercy still does its work instead.
  const before = s.tickets[1];
  s = bleedUntil(s, (x) => x.tickets[1] !== before);
  assert.equal(before - s.tickets[1], 3, "the mercy rate applies");
});

test("convoy: a hull that dies on the road stops counting", () => {
  let s = rout({ fielded: 4 });
  s = bleedUntil(s, (x) => x.convoy[1].active === 1);
  const home = { x: cellToWorld(60), y: cellToWorld(60) };
  const [a, b] = s.convoy[1].ids;
  s.assets[a].x = home.x; s.assets[a].y = home.y;
  s.assets[b].x = home.x; s.assets[b].y = home.y;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.convoy[1].done, 2);
  s.assets[a].state = ASSET_DISABLED; // hunted down IN the base? — no: it died, it stops counting
  s.assets[a].hp = 0;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.convoy[1].done, 1, "the count is live, not banked");
});
