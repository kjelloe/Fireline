// test/milestone7e.test.js — Milestone 7E: Launch Config & Operational Grace
import { test } from 'node:test';
import assert from 'node:assert';
import {
  getHealth,
  createShutdownSequence,
  createRateLimit,
  isFeatureEnabled,
  getVersion
} from '../server/launch_config.js';

// ── getHealth ────────────────────────────────────────────────────────────────────────
test('7E getHealth ok for healthy metrics', () => {
  const now = 100000;
  const h = getHealth(16, 128 * 1024 * 1024, now, now);
  assert.strictEqual(h.status, 'ok');
  assert.strictEqual(h.snapshotAge, 0);
});

test('7E getHealth degraded for high lag', () => {
  const h = getHealth(200, 128 * 1024 * 1024, 0, 0);
  assert.strictEqual(h.status, 'degraded');
});

test('7E getHealth degraded for high memory', () => {
  const h = getHealth(16, 600 * 1024 * 1024, 0, 0);
  assert.strictEqual(h.status, 'degraded');
});

test('7E getHealth degraded for old snapshot', () => {
  const h = getHealth(16, 128 * 1024 * 1024, 0, 40000);
  assert.strictEqual(h.status, 'degraded');
  assert.strictEqual(h.snapshotAge, 40000);
});

test('7E getHealth down for critical lag', () => {
  const h = getHealth(600, 128 * 1024 * 1024, 0, 0);
  assert.strictEqual(h.status, 'down');
});

test('7E getHealth down for critical memory', () => {
  const h = getHealth(16, 1200 * 1024 * 1024, 0, 0);
  assert.strictEqual(h.status, 'down');
});

test('7E getHealth down for very old snapshot', () => {
  const h = getHealth(16, 128 * 1024 * 1024, 0, 130000);
  assert.strictEqual(h.status, 'down');
});

// ── createShutdownSequence ───────────────────────────────────────────────────────────
test('7E createShutdownSequence executes stages in order', async () => {
  const seq = createShutdownSequence();
  const log = [];
  seq.addStage('save', async () => { log.push('save'); });
  seq.addStage('flush', async () => { log.push('flush'); });
  const results = await seq.execute({});
  assert.deepStrictEqual(log, ['save', 'flush']);
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].ok, true);
  assert.strictEqual(results[1].ok, true);
});

test('7E createShutdownSequence handles errors gracefully', async () => {
  const seq = createShutdownSequence();
  seq.addStage('fail', async () => { throw new Error('boom'); });
  seq.addStage('after', async () => 'ok');
  const results = await seq.execute({});
  assert.strictEqual(results[0].ok, false);
  assert.ok(results[0].error.includes('boom'));
  assert.strictEqual(results[1].ok, true);
  assert.strictEqual(results[1].result, 'ok');
});

test('7E createShutdownSequence rejects invalid stage inputs', () => {
  const seq = createShutdownSequence();
  assert.throws(() => seq.addStage(null, () => {}), /string/);
  assert.throws(() => seq.addStage('x', 'not-a-function'), /function/);
});

// ── createRateLimit ────────────────────────────────────────────────────────────────────
test('7E createRateLimit allows requests within limit', () => {
  const rl = createRateLimit(1000, 3);
  const t = 1000;
  assert.strictEqual(rl.record(t), true);
  assert.strictEqual(rl.record(t), true);
  assert.strictEqual(rl.record(t), true);
  assert.strictEqual(rl.record(t), false);
  assert.strictEqual(rl.count(t), 4); // includes expired? no, all same time
});

test('7E createRateLimit prunes old requests', () => {
  const rl = createRateLimit(1000, 2);
  rl.record(1000);
  rl.record(1500);
  assert.strictEqual(rl.record(2001), true); // 1000 expired
  assert.strictEqual(rl.count(2001), 2);
});

test('7E createRateLimit reset clears state', () => {
  const rl = createRateLimit(1000, 1);
  rl.record(1000);
  rl.reset();
  assert.strictEqual(rl.count(1000), 0);
  assert.strictEqual(rl.record(1000), true);
});

test('7E createRateLimit rejects invalid constructor args', () => {
  assert.throws(() => createRateLimit(0, 1), /must be > 0/);
  assert.throws(() => createRateLimit(1000, 0), /must be > 0/);
});

// ── isFeatureEnabled ────────────────────────────────────────────────────────────────────
test('7E isFeatureEnabled deterministic for same inputs', () => {
  const r1 = isFeatureEnabled('new_ui', 50, 'player_1');
  const r2 = isFeatureEnabled('new_ui', 50, 'player_1');
  assert.strictEqual(r1, r2);
});

test('7E isFeatureEnabled 0% always false', () => {
  assert.strictEqual(isFeatureEnabled('x', 0, 'any'), false);
});

test('7E isFeatureEnabled 100% always true', () => {
  assert.strictEqual(isFeatureEnabled('x', 100, 'any'), true);
});

test('7E isFeatureEnabled rejects invalid inputs', () => {
  assert.throws(() => isFeatureEnabled(null, 50, 'p'), /strings/);
  assert.throws(() => isFeatureEnabled('x', 101, 'p'), /0 and 100/);
  assert.throws(() => isFeatureEnabled('x', -1, 'p'), /0 and 100/);
});

// ── getVersion ───────────────────────────────────────────────────────────────────────────
test('7E getVersion returns manifest fields', () => {
  const v = getVersion({ version: '0.7.0', commit: 'abc123', buildDate: '2026-07-25' });
  assert.strictEqual(v.version, '0.7.0');
  assert.strictEqual(v.commit, 'abc123');
  assert.strictEqual(v.buildDate, '2026-07-25');
});

test('7E getVersion defaults missing fields', () => {
  const v = getVersion({});
  assert.strictEqual(v.version, '0.0.0');
  assert.strictEqual(v.commit, 'unknown');
  assert.strictEqual(v.buildDate, 'unknown');
});

test('7E getVersion rejects non-object', () => {
  assert.throws(() => getVersion(null), /manifest must be an object/);
  assert.throws(() => getVersion('0.7.0'), /manifest must be an object/);
});
