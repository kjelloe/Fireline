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

test("v1: all 32 operator slots are active and every asset is crewed", () => {
  assert.equal(result.activeOperators, 32);
  assert.equal(result.operatedAssets, 32);
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
  // 10 ticks/sec is real time; require 50x headroom on this hardware.
  assert.ok(
    result.ticksPerSecond > 500,
    `only ${result.ticksPerSecond} ticks/sec`
  );
});
