// test/milestone5a.test.js — Milestone 5A: Replay Store
import { test } from 'node:test';
import assert from 'node:assert';
import { saveReplay, getReplayIndex, loadReplay } from '../server/replay_store.js';
import fs from 'fs';
import path from 'path';

const TEST_REPLAY_DIR = path.join(process.cwd(), 'replays');
const TEST_INDEX = path.join(TEST_REPLAY_DIR, 'replay_index.json');

// Cleanup before test
if (fs.existsSync(TEST_INDEX)) fs.unlinkSync(TEST_INDEX);

test('5A saveReplay creates a file and updates index', () => {
  const mockState = { seed: 123, victory: { winner: 0 } };
  const mockLog = [{ type: 'MOVE', tick: 1 }];

  saveReplay('test_match_001', mockState, mockLog);

  const index = getReplayIndex();
  assert.ok(index.some(i => i.matchId === 'test_match_001'), 'Index should contain new match');

  const replay = loadReplay('test_match_001');
  // The store saves the winner as a string or number depending on the state
  assert.ok(replay.winner === 0 || replay.winner === '0', 'Winner should be 0');
  assert.strictEqual(replay.commandLog.length, 1);
});

test('5A loadReplay returns null for non-existent match', () => {
  const replay = loadReplay('ghost_match');
  assert.strictEqual(replay, null);
});
