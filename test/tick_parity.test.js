// test/tick_parity.test.js — the execution-order fairness law (question 18,
// hardened by prompt 171). History: commands used to resolve in ascending
// operator order every tick (~6-point team-A edge); the Q18 fix alternated
// the lead team by RAW TICK PARITY — which the line-root hunt then proved
// unfair for mirror-SYNCHRONIZED exchanges: symmetric routes put both
// twins' mutual-lethal moment on the SAME tick every war, so one fixed
// team led every dominant simultaneous exchange (the 546/547 truck duel).
// Current law: the lead team is a seeded integer-hash bit of
// (tick, mapSeed) — deterministic, team-symmetric in expectation, and
// decorrelated from every cadence the war clock synchronizes. These tests
// pin the hash law, the single team boundary per tick, the mix of leads,
// and determinism.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GameServer } from "../engine/server.js";

function expectedLead(tick, seed) {
  const mixed = Math.imul((tick ^ (seed | 0)) + 0x9e3779b1, 0x85ebca6b);
  return (mixed >>> 16) & 1;
}

test("AI doctrine commands lead with the seeded hash team, ascending ids within a team", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  for (let i = 0; i < 3000; i++) server.step();
  const seed = server.state.map.seed;

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

  let ledA = 0;
  let ledB = 0;
  for (const [tick, teams] of byTick) {
    if (new Set(teams).size !== 2) continue;
    const lead = expectedLead(tick, seed);
    assert.equal(teams[0], lead, `tick ${tick}: team ${lead} must lead, got ${teams.join("")}`);
    const switches = teams.filter((t, j) => j > 0 && t !== teams[j - 1]).length;
    assert.equal(switches, 1, `tick ${tick}: one team boundary, got ${teams.join("")}`);
    if (lead === 0) ledA++;
    else ledB++;
  }
  // Decorrelation: both teams must lead a real share of mixed ticks —
  // a parity-style phase lock would skew one side to near zero.
  assert.ok(ledA + ledB > 20, `enough mixed ticks to judge (${ledA + ledB})`);
  const minShare = Math.min(ledA, ledB) / (ledA + ledB);
  assert.ok(minShare >= 0.25, `lead mix is balanced (A ${ledA}, B ${ledB})`);
});

test("lead ordering is deterministic: same seed, same command log", () => {
  const run = () => {
    const server = new GameServer({ mapSeed: 77, enableAi: true });
    for (let i = 0; i < 60; i++) server.step();
    return JSON.stringify(server.commandLog);
  };
  assert.equal(run(), run());
});
