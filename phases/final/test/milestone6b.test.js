// test/milestone6b.test.js — Milestone 6B: Telemetry & Analytics
import { test } from 'node:test';
import assert from 'node:assert';
import { TelemetryManager } from '../server/telemetry.js';
import fs from 'fs';
import path from 'path';

test('6B tracks events and saves match logs', () => {
  const tel = new TelemetryManager();
  tel.startMatch('test_match');
  tel.logEvent('SHOT_FIRED', { unitId: 'u1' });
  tel.logEvent('UNIT_KILLED', { unitId: 'u2', x: 50, y: 50 });

  const log = tel.endMatch({ winner: 'p1' });
  assert.strictEqual(log.matchId, 'test_match');
  assert.strictEqual(log.events.length, 3); // START, SHOT, KILL

  const logPath = path.join(process.cwd(), 'data', 'telemetry', 'match_test_match.json');
  assert.ok(fs.existsSync(logPath));
});

test('6B records heatmap data for kills', () => {
  const tel = new TelemetryManager();
  tel.startMatch('heatmap_match');
  tel.logEvent('UNIT_KILLED', { x: 10, y: 20 });

  const heatmapPath = path.join(process.cwd(), 'data', 'telemetry', 'heatmap.json');
  const data = JSON.parse(fs.readFileSync(heatmapPath, 'utf8'));
  const last = data[data.length - 1];
  assert.strictEqual(last.x, 10);
  assert.strictEqual(last.y, 20);
});

test('6B reports server health metrics', () => {
  const tel = new TelemetryManager();
  const health = tel.getServerHealth();
  assert.ok(health.memory > 0);
  assert.ok(health.uptime > 0);
});
