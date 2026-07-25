// test/milestone4d.test.js — Milestone 4D: Server Health & Deployment
import { test } from 'node:test';
import assert from 'node:assert';
import { getHealthStatus, getLoadMetrics } from '../server/health.js';

test('4D server reports healthy when last tick was recent', () => {
  const now = 10000;
  const result = getHealthStatus(9500, now); // 500ms ago
  assert.strictEqual(result.status, 'healthy');
  assert.strictEqual(result.tickDelta, 500);
});

test('4D server reports unhealthy when tick is stale', () => {
  const now = 10000;
  const result = getHealthStatus(5000, now); // 5 seconds ago
  assert.strictEqual(result.status, 'unhealthy');
  assert.strictEqual(result.tickDelta, 5000);
});

test('4D load metrics flag overload when queue is deep', () => {
  const metrics = getLoadMetrics(150, 10);
  assert.strictEqual(metrics.overloaded, true);
  assert.strictEqual(metrics.queueDepth, 150);
});

test('4D load metrics flag normal when queue is shallow', () => {
  const metrics = getLoadMetrics(10, 4);
  assert.strictEqual(metrics.overloaded, false);
});
