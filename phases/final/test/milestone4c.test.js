// test/milestone4c.test.js — Milestone 4C: VFX Lifecycle
import { test } from 'node:test';
import assert from 'node:assert';
import { VFXManager } from '../client/vfx_manager.js';

test('4C muzzle flash spawned on UNIT_FIRE', () => {
  const mgr = new VFXManager();
  mgr.processTickEvents([{ type: 'UNIT_FIRE', x: 100, y: 100 }]);

  const active = mgr.getActiveEffects();
  assert.strictEqual(active.length, 1);
  assert.strictEqual(active[0].kind, 'muzzle');
  assert.strictEqual(active[0].life, 3);
});

test('4C explosion spawned on UNIT_DESTROYED', () => {
  const mgr = new VFXManager();
  mgr.processTickEvents([{ type: 'UNIT_DESTROYED', x: 200, y: 200 }]);

  const active = mgr.getActiveEffects();
  assert.strictEqual(active.length, 1);
  assert.strictEqual(active[0].kind, 'explosion');
  assert.strictEqual(active[0].life, 10);
});

test('4C dust spawned on movement through rough terrain', () => {
  const mgr = new VFXManager();
  mgr.processTickEvents([{ type: 'ASSET_MOVED', terrain: 3, x: 50, y: 50 }]);

  const active = mgr.getActiveEffects();
  assert.strictEqual(active.length, 1);
  assert.strictEqual(active[0].kind, 'dust');
});

test('4C effects expire after tick count reaches zero', () => {
  const mgr = new VFXManager();
  mgr.processTickEvents([{ type: 'UNIT_FIRE', x: 0, y: 0 }]);

  assert.strictEqual(mgr.getActiveEffects().length, 1);
  mgr.tick(); // life 2
  mgr.tick(); // life 1
  mgr.tick(); // life 0 -> purged

  assert.strictEqual(mgr.getActiveEffects().length, 0);
});
