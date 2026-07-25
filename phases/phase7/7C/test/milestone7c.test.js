// test/milestone7c.test.js — Milestone 7C: Achievement & Progression
import { test } from 'node:test';
import assert from 'node:assert';
import {
  evaluateAchievements,
  calculatePlayerTier,
  createPlayerProfile,
  updateProfileWithMatch,
  ACHIEVEMENT_REGISTRY
} from '../server/achievements.js';

test('7C evaluateAchievements detects first blood', () => {
  const matchState = {
    playerStats: { 'p1': { kills: 1, losses: 0 } }
  };
  const unlocked = evaluateAchievements(matchState, 'p1', []);
  assert.ok(unlocked.includes('first_blood'));
});

test('7C evaluateAchievements ignores already unlocked', () => {
  const matchState = {
    playerStats: { 'p1': { kills: 10 } }
  };
  const unlocked = evaluateAchievements(matchState, 'p1', ['first_blood']);
  assert.strictEqual(unlocked.length, 0);
});

test('7C evaluateAchievements flawless victory', () => {
  const matchState = {
    winner: 'p1',
    playerStats: { 'p1': { kills: 5, losses: 0 } }
  };
  const unlocked = evaluateAchievements(matchState, 'p1', []);
  assert.ok(unlocked.includes('flawless_victory'));
});

test('7C calculatePlayerTier logic', () => {
  assert.strictEqual(calculatePlayerTier(0), 'Recruit');
  assert.strictEqual(calculatePlayerTier(5), 'Bronze');
  assert.strictEqual(calculatePlayerTier(25), 'Silver');
  assert.strictEqual(calculatePlayerTier(100), 'Gold');
});

test('7C createPlayerProfile returns valid initial state', () => {
  const profile = createPlayerProfile('p1', 'Kjell');
  assert.strictEqual(profile.name, 'Kjell');
  assert.strictEqual(profile.tier, 'Recruit');
  assert.strictEqual(profile.wins, 0);
  assert.strictEqual(profile.achievements.length, 0);
});

test('7C updateProfileWithMatch updates wins and tier', () => {
  const profile = createPlayerProfile('p1', 'Kjell');
  const next = updateProfileWithMatch(profile, true, ['first_blood'], 12345);

  assert.strictEqual(next.wins, 1);
  assert.strictEqual(next.matches, 1);
  assert.strictEqual(next.achievements.length, 1);
  assert.strictEqual(next.achievements[0].id, 'first_blood');
  assert.strictEqual(next.achievements[0].unlockedAt, 12345);
});

test('7C tier promotion after 5 wins', () => {
  let profile = createPlayerProfile('p1', 'Kjell');
  profile.wins = 4;
  const next = updateProfileWithMatch(profile, true, []);
  assert.strictEqual(next.tier, 'Bronze');
});

test('7C evaluateAchievements pacifist victory', () => {
  const matchState = {
    winner: 'p1',
    playerStats: { 'p1': { kills: 0, losses: 2 } }
  };
  const unlocked = evaluateAchievements(matchState, 'p1', []);
  assert.ok(unlocked.includes('pacifist'));
});
