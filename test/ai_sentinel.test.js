// test/ai_sentinel.test.js — 16B: AI doctrine for the Directorate
// Sentinel (12B unique), unblocked by the 12D fairness gate. The
// hardpoint ANCHORS relays: deploy when idle near an owned site, stow
// when the anchor is lost or the seat has a capture errand elsewhere,
// and never spam movement orders while deployed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AIRegency, HARDPOINT_STATION_CELLS } from "../engine/ai_regency.js";
import { UNIT_SENTINEL } from "../engine/units.js";
import { apply } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function crewedSentinel(siteSpec, assetExtra = {}, extraAssets = []) {
  let s = sandbox(
    [{ team: 0, cellX: 20, cellY: 20, type: UNIT_SENTINEL, ...assetExtra }, ...extraAssets],
    [siteSpec]
  );
  s = joinAndSelect(s, 16, 0, 0);
  const ai = new AIRegency({ fixedAgents: false, uniqueCrewing: true });
  ai.assume(16);
  return { s, ai };
}

// A visible enemy 6 cells out: beyond the mobile light gun (4 cells, so
// fire doctrine doesn't swallow the tick) but inside deployed reach (8).
const THREAT = { team: 1, cellX: 26, cellY: 20 };

test("16B: anchored + enemy in deployed reach — the Sentinel deploys", () => {
  const { s, ai } = crewedSentinel({ cellX: 22, cellY: 20, owner: 0 }, {}, [THREAT]);
  const cmds = ai.plan(s);
  assert.ok(cmds.some((c) => c.type === "deploy_hardpoint" && c.operatorId === 16),
    `expected deploy, got ${JSON.stringify(cmds)}`);
});

test("16B: anchored but NO visible threat — stays mobile (the 78/19 lesson)", () => {
  const { s, ai } = crewedSentinel({ cellX: 22, cellY: 20, owner: 0 });
  const cmds = ai.plan(s);
  assert.ok(!cmds.some((c) => c.type === "deploy_hardpoint"),
    `a standing fortress swept 78/19 — deploy must be reactive, got ${JSON.stringify(cmds)}`);
});

test("16B: no anchor in station range — the Sentinel does NOT deploy", () => {
  const far = 20 + HARDPOINT_STATION_CELLS + 2;
  const { s, ai } = crewedSentinel({ cellX: far, cellY: 20, owner: 0 }, {}, [THREAT]);
  const cmds = ai.plan(s);
  assert.ok(!cmds.some((c) => c.type === "deploy_hardpoint"),
    `no site in range, got ${JSON.stringify(cmds)}`);
});

test("16B: threat cleared — a deployed Sentinel stows", () => {
  const { s, ai } = crewedSentinel({ cellX: 22, cellY: 20, owner: 0 }, { deployed: 1 });
  const cmds = ai.plan(s);
  assert.ok(cmds.some((c) => c.type === "undeploy" && c.operatorId === 16),
    `expected undeploy with no threat, got ${JSON.stringify(cmds)}`);
});

test("16B: anchor lost — a deployed Sentinel stows to fight for it back", () => {
  const { s, ai } = crewedSentinel(
    { cellX: 22, cellY: 20, owner: 1 },
    { deployed: 1 }
  );
  const cmds = ai.plan(s);
  assert.ok(cmds.some((c) => c.type === "undeploy" && c.operatorId === 16),
    `expected undeploy, got ${JSON.stringify(cmds)}`);
});

test("16B crewing: a free seat prefers the faction unique over the default pick", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },                          // tank, id 0, free
    { team: 0, cellX: 12, cellY: 10, type: UNIT_SENTINEL },     // unique, id 1, free
  ]);
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  const ai = new AIRegency({ fixedAgents: false, uniqueCrewing: true });
  ai.assume(16);
  const sel = ai.plan(s).find((c) => c.type === "select_asset" && c.operatorId === 16);
  assert.equal(sel?.assetId, 1, "the garage Sentinel outranks the lowest-id default");
});

test("16B DORMANT by default: without the flag, the unique stays garaged", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },                          // tank, id 0, free
    { team: 0, cellX: 12, cellY: 10, type: UNIT_SENTINEL },     // unique, id 1, free
  ]);
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  const sel = ai.plan(s).find((c) => c.type === "select_asset" && c.operatorId === 16);
  assert.equal(sel?.assetId, 0,
    "flag off -> lowest-id default pick, byte-identical wars (the 59.7% lesson)");
});

test("16B crewing: unique already crewed — default pick resumes", () => {
  let s = sandbox([
    { team: 0, cellX: 10, cellY: 10 },                          // tank, id 0, free
    { team: 0, cellX: 12, cellY: 10, type: UNIT_SENTINEL },     // unique, id 1
    { team: 0, cellX: 14, cellY: 10 },                          // tank, id 2, free
  ]);
  s = apply(s, { type: "join_operator", operatorId: 17, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 17, assetId: 1, confirm: true });
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  const ai = new AIRegency({ fixedAgents: false, uniqueCrewing: true });
  ai.assume(16);
  ai.assume(17);
  const sel = ai.plan(s).find((c) => c.type === "select_asset" && c.operatorId === 16);
  assert.equal(sel?.assetId, 0, "one unique per team is enough");
});

test("16B: deployed, anchored, threat live — stays put, no move-order spam", () => {
  const { s, ai } = crewedSentinel(
    { cellX: 22, cellY: 20, owner: 0 },
    { deployed: 1 },
    [THREAT]
  );
  const cmds = ai.plan(s);
  assert.ok(!cmds.some((c) => c.operatorId === 16 &&
    (c.type === "undeploy" || c.type === "move_order")),
    `anchored hardpoint holds silent, got ${JSON.stringify(cmds)}`);
});
