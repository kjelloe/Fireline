// test/milestone11h.test.js — Slice 11H: replay viewer engine (prompt 16
// Q15). The scrubber re-simulates the command log locally: seeking must be
// exact, backward scrubbing must not lie, and checkpoints must never
// change outcomes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GameServer } from "../engine/server.js";
import { hashState } from "../engine/snapshot.js";
import { createReplayPlayer } from "../client/js/replay_engine.js";

// A real (short) AI war provides the record.
function makeRecord(ticks = 600) {
  const server = new GameServer({ mapSeed: 4242, enableAi: true, aiDifficulty: 1 });
  const hashes = new Map();
  for (let i = 0; i < ticks && server.state.phase === 0; i++) {
    server.step();
    if (server.state.tick % 100 === 0) hashes.set(server.state.tick, hashState(server.state));
  }
  return {
    record: {
      meta: { mapSeed: 4242, ticks: server.state.tick },
      commandLog: server.commandLog,
    },
    finalHash: hashState(server.state),
    finalTick: server.state.tick,
    hashes,
  };
}

const fixture = makeRecord();

test("11H seeking to the end reproduces the live war byte-exactly", () => {
  const player = createReplayPlayer(fixture.record);
  const state = player.seek(fixture.finalTick);
  assert.equal(state.tick, fixture.finalTick);
  assert.equal(hashState(state), fixture.finalHash);
});

test("11H forward play, backward scrub, and re-seek all agree", () => {
  const player = createReplayPlayer(fixture.record, { checkpointEvery: 150 });
  for (const [tick, want] of fixture.hashes) {
    assert.equal(hashState(player.seek(tick)), want, `forward seek to ${tick}`);
  }
  // Backward: jump to an early tick AFTER visiting the end.
  player.seek(fixture.finalTick);
  for (const [tick, want] of [...fixture.hashes].reverse()) {
    assert.equal(hashState(player.seek(tick)), want, `backward seek to ${tick}`);
  }
  // Random-order scrubbing stays exact.
  const ticks = [...fixture.hashes.keys()];
  for (const tick of [ticks.at(-1), ticks[0], ticks[Math.floor(ticks.length / 2)]]) {
    assert.equal(hashState(player.seek(tick)), fixture.hashes.get(tick));
  }
});

test("11H checkpoint density never changes outcomes", () => {
  const sparse = createReplayPlayer(fixture.record, { checkpointEvery: 5000 });
  const dense = createReplayPlayer(fixture.record, { checkpointEvery: 50 });
  const mid = Math.floor(fixture.finalTick / 2);
  assert.equal(hashState(sparse.seek(mid)), hashState(dense.seek(mid)));
  assert.equal(hashState(sparse.seek(fixture.finalTick)), fixture.finalHash);
  assert.equal(hashState(dense.seek(fixture.finalTick)), fixture.finalHash);
});

test("11H seeks clamp to the war's bounds", () => {
  const player = createReplayPlayer(fixture.record);
  assert.equal(player.seek(-50).tick, 0);
  assert.equal(player.seek(999999).tick, fixture.finalTick);
});
