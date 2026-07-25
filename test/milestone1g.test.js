// test/milestone1g.test.js — Milestone 1G: combat, HP depletion, disablement.
// Ported from the phase-1 package to the authoritative engine: fire is an
// operator command (fire_order) resolved by the reducer, never a direct
// asset poke. Covers the seven acceptance criteria in phases/phase1/plan.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, createInitialState } from "../engine/reducer.js";
import { resolveShot, inFireRange, DEFAULT_RULES } from "../engine/combat.js";
import { ASSET_IDLE, ASSET_MOVING, ASSET_DISABLED } from "../engine/state.js";
import { buildView } from "../engine/view.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("1G resolveShot reduces HP by expected delta", () => {
  const result = resolveShot({}, {});
  assert.equal(result.hpDelta, 20);
  assert.equal(result.suppressed, true);
  assert.equal(DEFAULT_RULES.range, 1280);
});

test("1G repeated fire disables asset at HP=0", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 1, hp: 40 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);

  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.assets[1].hp, 20);
  assert.equal(s.assets[1].state, ASSET_IDLE);
  assert.deepEqual(s.events, [
    { type: "fire_resolved", attackerId: 0, targetId: 1, hpDelta: 20, targetHp: 20 },
  ]);

  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.assets[1].hp, 0);
  assert.equal(s.assets[1].state, ASSET_DISABLED);
  assert.deepEqual(s.events, [
    { type: "fire_resolved", attackerId: 0, targetId: 1, hpDelta: 20, targetHp: 0 },
    { type: "asset_disabled", assetId: 1 },
  ]);
});

test("1G disabled asset cannot move", () => {
  let s = sandbox([
    { team: 0, cellX: 0, state: ASSET_DISABLED, hp: 0 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 10, targetCellY: 0 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "move_order", reason: "asset not operable" },
  ]);
  const ticked = apply(s, { type: "advance_tick" });
  assert.equal(ticked.assets[0].x, 0, "disabled asset must not move");
});

test("1G disabled asset cannot fire", () => {
  let s = sandbox([
    { team: 0, cellX: 0, state: ASSET_DISABLED, hp: 0 },
    { team: 1, cellX: 1 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "fire_order", reason: "asset not operable" },
  ]);
  assert.equal(s.assets[1].hp, 100);
});

test("1G fire command rejected for out-of-range target", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 20 }, // 5120 units > 1280 range
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "fire_order", reason: "target out of range" },
  ]);
  assert.equal(s.assets[1].hp, 100);
  assert.equal(inFireRange(s.assets[0], s.assets[1]), false);
});

test("1G fire command rejected for friendly target", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 0, cellX: 1 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "fire_order", reason: "friendly target" },
  ]);
  assert.equal(s.assets[1].hp, 100);
});

test("1G view reports correct hp and status after combat", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 1, hp: 20 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });

  const enemyView = buildView(s, 1);
  const damaged = enemyView.friendlyAssets.find((a) => a.id === 1);
  assert.equal(damaged.hp, 0);
  assert.equal(damaged.state, ASSET_DISABLED);

  const attackerView = buildView(s, 0);
  const seen = attackerView.visibleEnemies.find((a) => a.id === 1);
  assert.equal(seen.state, ASSET_DISABLED, "enemy view shows disablement");
  assert.equal("hp" in seen, false, "enemy hp stays fogged");
});

// ── additional 1G self-tests ──────────────────────────────────────────────────

test("1G firing at a moving asset stops it via disablement", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 2, hp: 20, state: ASSET_MOVING },
  ]);
  s.assets[1].targetX = cellToWorld(30);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  const before = s.assets[1].x;
  const ticked = apply(s, { type: "advance_tick" });
  assert.equal(ticked.assets[1].x, before, "disabled mid-move asset stops");
});

test("1G firing at an already-disabled target is rejected", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 1, hp: 0, state: ASSET_DISABLED },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "fire_order", reason: "target not operable" },
  ]);
});

test("1G overkill damage floors at zero hp", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 1, hp: 5 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.assets[1].hp, 0);
  assert.equal(s.assets[1].state, ASSET_DISABLED);
});
