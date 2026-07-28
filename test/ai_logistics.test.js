// test/ai_logistics.test.js — 13C's tow-economy lifeline: the roleTruck
// crewing rung. Routed roads marched the truck into the centre fight and
// its death zeroed team tows for the whole war (sweep: 85 -> 0); with
// this rung a towless team re-crews a garage truck and the economy holds
// (11.5 tows/war in the acceptance sweep). A "rearguard stationing"
// doctrine was tried alongside and REMOVED: the A/B bisection showed it
// carried a west-side chirality worth ~25 points (norg vs notruck runs,
// dev-log 13C) — truck SURVIVAL was the fix, not station placement.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AIRegency } from "../engine/ai_regency.js";
import { UNIT_LOGISTICS } from "../engine/units.js";
import { apply } from "../engine/reducer.js";
import { sandbox } from "./helpers.js";

test("roleTruck rung: a towless team re-crews the garage truck over the default pick", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },                          // tank, id 0, free
    { team: 0, cellX: 12, cellY: 10, type: UNIT_LOGISTICS },    // truck, id 1, free
  ]);
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  const sel = ai.plan(s).find((c) => c.type === "select_asset" && c.operatorId === 16);
  assert.equal(sel?.assetId, 1, "the truck outranks the lowest-id tank");
});

test("roleTruck rung: with a tower already crewed, default pick resumes", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },                          // tank, id 0, free
    { team: 0, cellX: 12, cellY: 10, type: UNIT_LOGISTICS },    // truck, id 1
    { team: 0, cellX: 14, cellY: 10, type: UNIT_LOGISTICS },    // truck, id 2, free
  ]);
  s = apply(s, { type: "join_operator", operatorId: 17, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 17, assetId: 1, confirm: true });
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16); ai.assume(17);
  const sel = ai.plan(s).find((c) => c.type === "select_asset" && c.operatorId === 16);
  assert.equal(sel?.assetId, 0, "one tower is enough");
});
