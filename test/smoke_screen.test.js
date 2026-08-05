// test/smoke_screen.test.js — W4-6 (prompt 174): SMOKE SCREENS, the
// measured counter to the artillery farming the mid-war ledger
// convicted. Smoke CONCEALS rather than blocking line of sight: this
// engine's LOS is a Chebyshev radius, not a raycast, and a ray march
// would put the whole equivariance ladder at risk for no extra
// gameplay. Concealment is a per-cell property, so it commutes with
// the mirror for free — which the last test here pins.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { computeVisible } from "../engine/los.js";
import {
  SMOKE_TICKS, SMOKE_TEAM_CAP, SMOKE_SEE_CELLS, smokeAt,
} from "../engine/smoke.js";
import { sandbox, joinAndSelect } from "./helpers.js";

// A truck (type 3, smoke: 2) and an enemy watcher well inside sensor
// range but well outside SMOKE_SEE_CELLS.
function screenState() {
  let s = sandbox([
    { team: 0, type: 3, cellX: 30, cellY: 30 },
    { team: 1, type: 0, cellX: 36, cellY: 30 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  return s;
}

test("W4-6: a truck lays smoke on its own cell and the rack drains", () => {
  let s = screenState();
  assert.equal(s.assets[0].smokeLeft, 2, "trucks ship with a rack");
  s = apply(s, { type: "deploy_smoke", operatorId: 0 });
  assert.equal(s.smokes.length, 1);
  assert.equal(s.assets[0].smokeLeft, 1);
  assert.equal(s.smokes[0].ticks, SMOKE_TICKS);
  assert.equal(s.smokes[0].team, 0);
  const ev = s.events.find((e) => e.type === "smoke_deployed");
  assert.ok(ev, "the deployment announces itself");
  assert.equal(ev.cellX, 30);
});

test("W4-6: smoke HIDES the hull standing in it", () => {
  let s = screenState();
  assert.ok(computeVisible(s, 1).has(0), "the truck is visible before");
  s = apply(s, { type: "deploy_smoke", operatorId: 0 });
  assert.ok(!computeVisible(s, 1).has(0), "and concealed after");
});

test("W4-6: smoke is BLIND to team — it hides the enemy from you too", () => {
  // The screen is a screen, not a buff: whoever stands in it is
  // concealed, and a sensor inside it sees only its own doorstep.
  let s = screenState();
  s = apply(s, { type: "deploy_smoke", operatorId: 0 }); // patch at cell 30
  // The layer drives clear of its own screen, and the enemy walks in.
  // (Standing IN your own smoke would see them at knife range — that is
  // the adjacency rule the next test pins, not a team exemption.)
  s.assets[0].x = 36 * 256 + 128;
  s.assets[1].x = 30 * 256 + 128;
  assert.ok(smokeAt(s, 30, 30), "the enemy is standing in it");
  assert.ok(!computeVisible(s, 0).has(1),
    "so team 0 cannot see them either, despite having laid it");
  // And the cut goes BOTH ways: the enemy standing in the cloud cannot
  // see the truck six cells away in the open either. A screen blinds
  // whoever is inside it, which is what makes laying one a decision.
  assert.ok(!computeVisible(s, 1).has(0),
    "the hull inside the smoke is blind to the open ground outside it");
});

test("W4-6: adjacency still sees through — smoke is cover, not invulnerability", () => {
  let s = screenState();
  s.assets[1].x = (30 + SMOKE_SEE_CELLS) * 256 + 128; // right on the edge
  s = apply(s, { type: "deploy_smoke", operatorId: 0 });
  assert.ok(computeVisible(s, 1).has(0), "a hull at knife range still sees you");
});

test("W4-6: smoke disperses on its own clock", () => {
  let s = screenState();
  s = apply(s, { type: "deploy_smoke", operatorId: 0 });
  for (let i = 0; i < SMOKE_TICKS - 1; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.smokes.length, 1, "still standing one tick short");
  assert.ok(!computeVisible(s, 1).has(0), "and still concealing");
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.smokes.length, 0, "dispersed");
  assert.ok(computeVisible(s, 1).has(0), "and the hull is exposed again");
});

test("W4-6: the rack, the team cap and stacking all refuse", () => {
  let s = screenState();
  s = apply(s, { type: "deploy_smoke", operatorId: 0 });
  s = apply(s, { type: "deploy_smoke", operatorId: 0 });
  assert.equal(s.events.filter((e) => e.type === "rejected").length, 1,
    "the second on the same cell is refused as a stack");
  // Drain and cap.
  let t = screenState();
  t.assets[0].smokeLeft = 99;
  for (let i = 0; i < SMOKE_TEAM_CAP; i++) {
    t.assets[0].x = (10 + i * 3) * 256 + 128; // fresh cell each time
    t = apply(t, { type: "deploy_smoke", operatorId: 0 });
  }
  assert.equal(t.smokes.length, SMOKE_TEAM_CAP);
  t.assets[0].x = 50 * 256 + 128;
  t = apply(t, { type: "deploy_smoke", operatorId: 0 });
  assert.equal(t.smokes.length, SMOKE_TEAM_CAP, "the cap holds");
  const rej = t.events.filter((e) => e.type === "rejected").pop();
  assert.equal(rej.reason, "team smoke limit reached");
});

test("W4-6: a chassis with no rack refuses", () => {
  let s = sandbox([{ team: 0, type: 0, cellX: 30, cellY: 30 }]); // tank
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "deploy_smoke", operatorId: 0 });
  assert.equal(s.smokes.length, 0);
  assert.equal(
    s.events.find((e) => e.type === "rejected").reason,
    "this chassis carries no smoke"
  );
});

test("W4-6: concealment commutes with the mirror", () => {
  // The invariant the whole era is built on. Two mirrored worlds must
  // conceal identically — trivially true for a per-cell property, and
  // pinned here so a future 'improvement' to a raycast cannot slip in
  // without confronting it.
  const W = 64;
  const build = (mirror) => {
    const col = (c) => (mirror ? W - 1 - c : c);
    let s = sandbox([
      { team: mirror ? 1 : 0, type: 3, cellX: col(30), cellY: 30 },
      { team: mirror ? 0 : 1, type: 0, cellX: col(36), cellY: 30 },
    ]);
    s = joinAndSelect(s, 0, mirror ? 1 : 0, 0);
    return apply(s, { type: "deploy_smoke", operatorId: 0 });
  };
  const plain = build(false);
  const flipped = build(true);
  assert.equal(computeVisible(plain, 1).has(0), computeVisible(flipped, 0).has(0),
    "the mirrored world conceals the same hull");
  assert.equal(plain.smokes[0].cellY, flipped.smokes[0].cellY, "same row");
  assert.equal(plain.smokes[0].cellX + flipped.smokes[0].cellX, W - 1,
    "and mirrored columns");
});

test("W4-6: the MORTAR fires a smoke round at range (alt-fire)", () => {
  // A screen you can place from safety is the whole point of a tube —
  // but it pays full tube discipline: reload, ammo, supply, min/max range.
  let s = sandbox([
    { team: 0, type: 6, cellX: 30, cellY: 30 }, // mortar carrier
    { team: 1, type: 0, cellX: 36, cellY: 30 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  assert.equal(s.assets[0].smokeLeft, 2, "the tube carries smoke rounds");
  s = apply(s, { type: "fire_order", operatorId: 0, smoke: true, targetCellX: 36, targetCellY: 30 });
  assert.equal(s.smokes.length, 1, "the round lands where it was aimed");
  assert.equal(s.smokes[0].cellX, 36);
  assert.equal(s.assets[0].smokeLeft, 1, "and costs a round");
  assert.ok(s.assets[0].reloadTimer > 0, "and the tube reloads like any shot");
  assert.ok(!computeVisible(s, 0).has(1), "the enemy it landed on is concealed");
});

test("W4-6: alt-fire respects the tube's minimum range", () => {
  let s = sandbox([{ team: 0, type: 6, cellX: 30, cellY: 30 }]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, smoke: true, targetCellX: 30, targetCellY: 30 });
  assert.equal(s.smokes.length, 0, "a tube cannot drop smoke on its own boots");
  assert.equal(s.events.find((e) => e.type === "rejected").reason, "target too close");
});

test("W4-6: a direct-fire chassis has no smoke round", () => {
  let s = sandbox([{ team: 0, type: 3, cellX: 30, cellY: 30 }]); // truck: lays, never fires
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, smoke: true, targetCellX: 36, targetCellY: 30 });
  assert.equal(s.smokes.length, 0);
  assert.equal(s.events.find((e) => e.type === "rejected").reason, "this chassis fires no smoke");
});

test("W4-6: SMOKE=0 disables both paths (the kill-switch)", () => {
  let s = sandbox([{ team: 0, type: 3, cellX: 30, cellY: 30 }], [], {});
  s.rules = { ...s.rules, smoke: false };
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "deploy_smoke", operatorId: 0 });
  assert.equal(s.smokes.length, 0, "the truck path is off");
  assert.equal(s.events.find((e) => e.type === "rejected").reason, "smoke disabled");
  let m = sandbox([{ team: 0, type: 6, cellX: 30, cellY: 30 }], [], {});
  m.rules = { ...m.rules, smoke: false };
  m = joinAndSelect(m, 0, 0, 0);
  m = apply(m, { type: "fire_order", operatorId: 0, smoke: true, targetCellX: 36, targetCellY: 30 });
  assert.equal(m.smokes.length, 0, "the tube path is off too");
});
