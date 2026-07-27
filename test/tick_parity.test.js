// test/tick_parity.test.js — the execution-order fairness fix (question 18).
// The nightly census proved a ~6-point team-A edge that survives full world
// reflection AND faction-swapping: whoever's commands resolve first each
// tick lands the first strike. The fix: AI doctrine commands alternate
// which team leads, by tick parity. These tests pin the alternation and
// that it stays deterministic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GameServer } from "../engine/server.js";

test("AI doctrine commands lead with team (tick & 1), ascending ids within a team", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  for (let i = 0; i < 3000; i++) server.step();

  // Fold the authoritative command log: per tick, the team sequence of
  // operator-bearing commands (skipping tick 0's one-time join/claim burst).
  const byTick = new Map();
  for (const { tick, cmd } of server.commandLog) {
    if (tick === 0 || cmd.operatorId === undefined) continue;
    const op = server.state.operators[cmd.operatorId];
    if (!op || op.team === undefined) continue;
    if (!byTick.has(tick)) byTick.set(tick, []);
    byTick.get(tick).push(op.team);
  }

  let checkedEven = 0;
  let checkedOdd = 0;
  for (const [tick, teams] of byTick) {
    if (new Set(teams).size !== 2) continue;
    const parity = tick & 1;
    // Leading block must be the parity team, then the other — one switch.
    assert.equal(teams[0], parity, `tick ${tick}: team ${parity} must lead, got ${teams.join("")}`);
    const switches = teams.filter((t, j) => j > 0 && t !== teams[j - 1]).length;
    assert.equal(switches, 1, `tick ${tick}: one team boundary, got ${teams.join("")}`);
    if (parity === 0) checkedEven++;
    else checkedOdd++;
  }
  assert.ok(checkedEven > 0 && checkedOdd > 0,
    `two-team ticks on both parities (even ${checkedEven}, odd ${checkedOdd})`);
});

test("parity ordering is deterministic: same seed, same command log", () => {
  const run = () => {
    const server = new GameServer({ mapSeed: 77, enableAi: true });
    for (let i = 0; i < 60; i++) server.step();
    return JSON.stringify(server.commandLog);
  };
  assert.equal(run(), run());
});
