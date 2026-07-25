// test/milestone5d.test.js — Milestone 5D: Campaign Mode
import { test } from 'node:test';
import assert from 'node:assert';
import { getCampaignProgress, saveCampaignProgress, getMission, getAllMissions, MISSIONS } from '../server/campaign.js';
import fs from 'fs';
import path from 'path';

const CAMPAIGN_FILE = path.join(process.cwd(), 'data', 'campaign_progress.json');

// Reset before tests
if (fs.existsSync(CAMPAIGN_FILE)) fs.unlinkSync(CAMPAIGN_FILE);

test('5D new player starts with only mission m1 unlocked', () => {
  const progress = getCampaignProgress('soldier_1');
  assert.deepStrictEqual(progress.unlocked, ['m1']);
  assert.deepStrictEqual(progress.completed, []);
});

test('5D completing a mission unlocks the next one', () => {
  saveCampaignProgress('soldier_1', 'm1', true);
  const progress = getCampaignProgress('soldier_1');
  assert.deepStrictEqual(progress.completed, ['m1']);
  assert.ok(progress.unlocked.includes('m2'));
});

test('5D losing a mission does not unlock next', () => {
  saveCampaignProgress('soldier_2', 'm1', false);
  const progress = getCampaignProgress('soldier_2');
  assert.deepStrictEqual(progress.completed, []);
  assert.deepStrictEqual(progress.unlocked, ['m1']);
});

test('5D all 4 missions are defined', () => {
  const missions = getAllMissions();
  assert.strictEqual(missions.length, 4);
  assert.strictEqual(missions[0].name, 'The Valley');
  assert.strictEqual(missions[3].winCondition, 'captureHQ');
});

test('5D getMission returns correct biome data', () => {
  const m2 = getMission('m2');
  assert.strictEqual(m2.biome, 'arctic');
  assert.strictEqual(m2.winCondition, 'survival50');
});
