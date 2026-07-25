// test/milestone2a.test.js — Milestone 2A: first playable, full-stack soak.
// Integration slice: no new engine logic. Two scripted view-driven operators
// converge, duel, and capture; the recorded log must replay to the live hash.
// Covers the six acceptance criteria in phases/phase1/plan.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runSoak } from "./headless/soak2a.js";

const SEED = 2026;
const TICKS = 1700;

// One soak, shared across subtests (pure function of seed+ticks).
const result = runSoak(SEED, TICKS);

test("2A soak completes without error", () => {
  assert.equal(result.server.state.tick, TICKS);
  assert.match(result.liveHash, /^[0-9a-f]{16}$/);
});

test("2A final state hash is stable across two runs", () => {
  const again = runSoak(SEED, TICKS);
  assert.equal(again.liveHash, result.liveHash);
});

test("2A replay of soak log matches final state hash", () => {
  assert.equal(result.replayHash, result.liveHash);
});

test("2A at least one relay captured during soak", () => {
  assert.ok(result.captures >= 1, `captures: ${result.captures}`);
});

test("2A at least one asset disabled during soak", () => {
  assert.ok(result.disables >= 1, `disables: ${result.disables}`);
});

test("2A no asset supply goes below zero", () => {
  assert.ok(result.minAmmo >= 0, `min ammo: ${result.minAmmo}`);
  assert.ok(result.minFuel >= 0, `min fuel: ${result.minFuel}`);
});
