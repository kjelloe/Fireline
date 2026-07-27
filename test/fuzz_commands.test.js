// test/fuzz_commands.test.js — the command fuzzer (review round, prompt
// 40). Thousands of adversarial-random commands against the reducer:
// nothing may THROW (bad input is rejected, never fatal), and the same
// seeded barrage twice must land on the same hash (determinism under
// abuse). Uses the engine's own PRNG — no Math.random.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { createInitialState } from "../engine/state.js";
import { hashState } from "../engine/snapshot.js";
import { seedSfc32, sfc32Next } from "../shared/prng.js";

const TYPES = [
  "advance_tick", "join_operator", "select_asset", "move_order", "fire_order",
  "tow_order", "crawl_order", "redeploy", "deploy_mine", "clear_mine", "ping",
  "set_option", "board_carrier", "unboard", "drive", "deploy_hardpoint",
  "undeploy", "transfer_cargo", "call_medic", "respawn", "nonsense", "",
];
const PING_KINDS = ["attack", "defend", "rally", "need_rescue", "bogus"];

function fuzzRun(seed, steps) {
  let rng = seedSfc32(seed);
  const roll = (max) => {
    const step = sfc32Next(rng);
    rng = step.nextState;
    return (step.value >>> 0) % max;
  };
  let s = createInitialState(42, "frontier_corridor");
  for (let i = 0; i < steps; i++) {
    const cmd = {
      type: TYPES[roll(TYPES.length)],
      operatorId: roll(40) - 4,           // includes invalid ids
      assetId: roll(40) - 4,
      targetAssetId: roll(40) - 4,
      wreckAssetId: roll(40) - 4,
      carrierAssetId: roll(40) - 4,
      targetCellX: roll(140) - 6,          // includes off-map
      targetCellY: roll(140) - 6,
      mineId: roll(6),
      targetDroneId: roll(6),
      targetSiteId: roll(8),
      kind: PING_KINDS[roll(PING_KINDS.length)],
      option: roll(2) ? "auto_rescue" : "wallhack",
      value: roll(3) - 1,
      throttle: roll(5) - 2,               // includes invalid magnitudes
      turn: roll(5) - 2,
      confirm: roll(2) === 1,
    };
    s = apply(s, cmd);                     // must never throw
    if (i % 7 === 0) s = apply(s, { type: "advance_tick" });
  }
  return hashState(s);
}

test("fuzz: 3000 adversarial commands never throw and stay deterministic", () => {
  for (const seed of [1, 999, 31337]) {
    const a = fuzzRun(seed, 1000);
    const b = fuzzRun(seed, 1000);
    assert.equal(a, b, `seed ${seed}: same barrage, same world`);
  }
});
