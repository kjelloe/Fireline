// test/milestone5b.test.js — Milestone 5B: Player Persistence
import { test } from 'node:test';
import assert from 'node:assert';
import { getProfile, updateStats, getLeaderboard } from '../server/player_store.js';
import fs from 'fs';
import path from 'path';

const PROFILES_FILE = path.join(process.cwd(), 'data', 'player_profiles.json');

// Reset before tests
if (fs.existsSync(PROFILES_FILE)) fs.unlinkSync(PROFILES_FILE);

test('5B getProfile returns blank for new players', () => {
  const profile = getProfile('player_1');
  assert.strictEqual(profile.playerId, 'player_1');
  assert.strictEqual(profile.wins, 0);
});

test('5B updateStats increments wins and matches', () => {
  updateStats('player_1', true);
  const profile = getProfile('player_1');
  assert.strictEqual(profile.wins, 1);
  assert.strictEqual(profile.matchesPlayed, 1);
});

test('5B updateStats increments losses', () => {
  updateStats('player_1', false);
  const profile = getProfile('player_1');
  assert.strictEqual(profile.losses, 1);
  assert.strictEqual(profile.matchesPlayed, 2);
});

test('5B leaderboard sorts by wins', () => {
  updateStats('noob', false); // 0 wins
  updateStats('pro', true);   // 1 win
  updateStats('pro', true);   // 2 wins

  const top = getLeaderboard(5);
  assert.strictEqual(top[0].playerId, 'pro');
  assert.strictEqual(top[0].wins, 2);
  assert.strictEqual(top[1].playerId, 'player_1'); // from previous tests
});
