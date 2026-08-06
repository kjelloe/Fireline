// test/ai_human_reserve.test.js — the HUMAN-RESERVE LAW (prompt 195).
//
// THE PLAYTEST BUG: each team fields 17 hulls for 16 seats. When the
// human's hull was wrecked, the regency crewing ladder claimed the
// spare AND won the race to every factory-wave hull (the AI plans every
// tick; a human clicks). The human respawned bodiless at base with
// nothing selectable — Next-asset disabled, hull clicks silently
// no-op'd — and stayed a spectator in their own war. The law: a regent
// may claim a free hull only while enough stock remains for every
// waiting human (active, bodiless, not on foot, not under regency —
// respawn countdowns included). Inert in AI-only sims: no human slot
// (0-15) ever joins there, so wars stay tick-identical.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AIRegency } from "../engine/ai_regency.js";
import { apply } from "../engine/reducer.js";
import { sandbox } from "./helpers.js";

const claims = (ai, s) =>
  ai.plan(s).filter((c) => c.type === "select_asset");

test("a bodiless human reserves the last free hull — the regent waits", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 }, // the one free hull
  ]);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });  // human, bodiless
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 }); // regent, bodiless
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  assert.deepEqual(claims(ai, s), [],
    "one free hull + one waiting human = zero regent claims");
});

test("with stock beyond the reserve, the regent claims the surplus", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },
    { team: 0, cellX: 12, cellY: 10 },
  ]);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  const sel = claims(ai, s);
  assert.equal(sel.length, 1, "two free hulls, one reserved: one claim");
  assert.equal(sel[0].operatorId, 16);
});

test("two bodiless regents in one plan tick cannot double-spend the surplus", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },
    { team: 0, cellX: 12, cellY: 10 },
  ]);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });  // human waits
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  s = apply(s, { type: "join_operator", operatorId: 17, team: 0 });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16); ai.assume(17);
  assert.equal(claims(ai, s).length, 1,
    "the within-tick claims counter must hold the reserve");
});

test("no waiting human: the ladder claims freely (the sim world)", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },
  ]);
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  assert.equal(claims(ai, s).length, 1, "AI-only wars are untouched");
});

test("a human who HAS a hull reserves nothing", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },
    { team: 0, cellX: 12, cellY: 10 },
  ]);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  assert.equal(claims(ai, s).length, 1, "the seated human frees the garage");
});

test("a human slot under regency takeover reserves nothing (it IS the AI)", () => {
  // The cross-system edge: a disconnected human's seat is assumed by the
  // regency (3C). That seat must not ALSO count as a waiting human, or a
  // dropped player would freeze their team's garage from the lobby.
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },
  ]);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 }); // human joins...
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(0); // ...then drops; the regency takes the slot
  const sel = claims(ai, s);
  assert.equal(sel.length, 1, "the regented seat claims like any regent");
  assert.equal(sel[0].operatorId, 0);
});

test("a waiting human on team A does not freeze team B's garage", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },
    { team: 1, cellX: 100, cellY: 10 },
  ]);
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });   // human A waits
  s = apply(s, { type: "join_operator", operatorId: 24, team: 1 });  // regent B
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(24);
  const sel = claims(ai, s);
  assert.equal(sel.length, 1, "the reserve is per-team");
  assert.equal(sel[0].operatorId, 24);
});
