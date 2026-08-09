// test/ai_standoff.test.js — the STANDOFF-BREAKER (prompt 221).
//
// THE PLAYTEST BUG: a pile of enemy hulls at a base gate, stacked, not
// moving, not shooting. Probe-confirmed root: hulls that meet OUT OF
// SUPPLY cannot fire (engine law) and cannot pass (enemy block radius),
// so opposed pushes interlock forever — seed 2026 held a 3-hull clot
// against an enemy carrier for 10,000+ ticks, everyone at full ammo and
// `supply false`. The law: an unsupplied, stationary regent hull
// pressed against an enemy — and not near a site — latches a retreat
// home until supply returns.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AIRegency } from "../engine/ai_regency.js";
import { apply } from "../engine/reducer.js";
import { sandbox } from "./helpers.js";

// A tiny west-corner base far from the clot: hulls at mid-map sit
// unsupplied (no owned relays in the sandbox).
const FAR_BASES = [
  { team: 0, x: 0, y: 0, width: 4, height: 4 },
  { team: 1, x: 124, y: 124, width: 4, height: 4 },
];

function clotState() {
  let s = sandbox(
    [
      { team: 0, type: 0, cellX: 63, cellY: 87 }, // the pressed tank
      { team: 1, type: 4, cellX: 64, cellY: 87 }, // the enemy carrier against it
    ],
    [],
    { bases: FAR_BASES, size: 128 }
  );
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 16, assetId: 0, confirm: true });
  return s;
}

function retreats(ai, s, plans = 120) {
  for (let i = 0; i < plans; i++) {
    const orders = ai.plan(s).filter(
      (c) => c.type === "move_order" && c.operatorId === 16);
    // The latch aims the hull at its own base centre.
    const home = orders.find((o) => o.targetCellX <= 3 && o.targetCellY <= 3);
    if (home) return { after: i, order: home };
  }
  return null;
}

test("an unsupplied hull pressed against an enemy retreats home after the hold", () => {
  const s = clotState();
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  const r = retreats(ai, s);
  assert.ok(r, "the standoff latch fired");
  assert.ok(r.after >= 99, `held ${r.after} plans before breaking (no twitch retreats)`);
});

test("a SUPPLIED hull in the same press never retreats — it can fight", () => {
  let s = clotState();
  s.bases = [
    { team: 0, x: 0, y: 0, width: 128, height: 128 }, // whole-map supply
    { team: 1, x: 124, y: 124, width: 4, height: 4 },
  ];
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  assert.equal(retreats(ai, s), null, "supply present: the fire doctrine owns this");
});

test("a press NEXT TO A SITE holds — capture standoffs keep their drama", () => {
  const s = clotState();
  s.sites.push({
    id: 90, type: 0, kind: 0, owner: -1, cellX: 64, cellY: 88,
    captureProgress: 0, capturingTeam: -1, hp: 40,
  });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  assert.equal(retreats(ai, s), null, "site within 2 cells: no retreat latch");
});

test("an unpressed unsupplied hull does not retreat — deep runs stay legal", () => {
  let s = sandbox(
    [{ team: 0, type: 0, cellX: 63, cellY: 87 }], // alone mid-map
    [],
    { bases: FAR_BASES, size: 128 }
  );
  s = apply(s, { type: "join_operator", operatorId: 16, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 16, assetId: 0, confirm: true });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  assert.equal(retreats(ai, s), null, "no enemy in the press radius: no latch");
});

test("STANDOFF=0 kill-switch actually disables the law (dead-switch law)", () => {
  const s = clotState();
  const ai = new AIRegency({ fixedAgents: false, standoffBreaker: false });
  ai.assume(16);
  assert.equal(retreats(ai, s), null, "switch off: the clot stands (A/B arm)");
});
