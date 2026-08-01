// test/v1_acceptance.test.js — v1 acceptance: the 32-participant war.
// 16 scripted human-like operators + 16 AI regents, full ruleset, replay
// verification, and a performance floor. Browser + LAN 2-human checks are
// manual (see RUNNING.md).

import { test } from "node:test";
import assert from "node:assert/strict";
import { runV1Soak } from "./headless/soak_v1.js";

const SEED = 2026;
const TICKS = 1500;
const result = runV1Soak(SEED, TICKS);

test("v1: all 32 operator seats participate (active, downed, or aboard)", () => {
  // Since 9B, crews bail out of disabled assets: a seat may legitimately be
  // OP_DOWN (walking or aboard a carrier) instead of driving. Nobody may be
  // ABSENT, and the driving seats must match the crewed assets.
  const s = result.server.state;
  const absent = s.operators.filter((o) => o.state === 0).length;
  assert.equal(absent, 0, "no seat abandoned the war");
  const driving = s.operators.filter((o) => o.state === 1 && o.assetId !== -1).length;
  assert.equal(driving, result.operatedAssets, "seat/asset links symmetric");
  // Floor recalibrated for 11B: the capture countdown slows relay flips, so
  // less supply is projected and more seats are legitimately mid-rescue
  // (walking or aboard a carrier) at any sampled tick. 2026@1500 measures
  // 22 active / 6 walking / 4 aboard — all 32 participating.
  // Floor recalibrated for the POW era (Q59): two seats start captive
  // and organic captures churn more mid-war — captive is a designed
  // state, not abandonment.
  assert.ok(result.activeOperators >= 16, `${result.activeOperators} active seats`);
});

test("v1: the war is fought — relays change hands and assets fall", () => {
  assert.ok(result.captures >= 1, `captures: ${result.captures}`);
  assert.ok(result.disables >= 3, `disables: ${result.disables}`);
});

test("v1: supply floors hold at zero", () => {
  assert.ok(result.minAmmo >= 0);
  assert.ok(result.minFuel >= 0);
});

test("v1: the full 32-participant war replays byte-exactly", () => {
  assert.equal(result.replayHash, result.liveHash);
});

test("v1: run-to-run hash determinism", () => {
  const again = runV1Soak(SEED, TICKS);
  assert.equal(again.liveHash, result.liveHash);
});

test("v1: simulation outruns real time by a wide margin", () => {
  // 10 ticks/sec is real time. The suite runs test files concurrently, so
  // wall-clock here is load-sensitive (standalone this measures thousands);
  // require a still-decisive 10x under full parallel load.
  assert.ok(
    result.ticksPerSecond > 100,
    `only ${result.ticksPerSecond} ticks/sec`
  );
});
