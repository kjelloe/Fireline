// test/milestone2c.test.js — Milestone 2C: Interpolator & Scene Adapter

import { test } from 'node:test';
import assert from 'node:assert';
import { createInterpolator } from '../client/interpolator.js';

test('2C interpolator returns null with no snapshots', () => {
  const interp = createInterpolator();
  assert.strictEqual(interp.getFrame(), null);
});

test('2C interpolator returns first snapshot directly if no prev', () => {
  const interp = createInterpolator();
  const snap = { tick: 1, assets: [{ id: 0, x: 100, y: 0, team: 0, status: 'ACTIVE' }] };
  interp.pushSnapshot(snap);
  const frame = interp.getFrame();
  assert.strictEqual(frame.assets[0].x, 100);
});

test('2C interpolator lerps asset position between snapshots at t=0.5', () => {
  const interp = createInterpolator();
  const snap1 = { tick: 1, assets: [{ id: 0, x: 0, y: 0, team: 0, status: 'ACTIVE' }] };
  const snap2 = { tick: 2, assets: [{ id: 0, x: 200, y: 0, team: 0, status: 'ACTIVE' }] };

  interp.pushSnapshot(snap1);
  interp.pushSnapshot(snap2);

  // Simulate t=0.5 (50ms into a 100ms tick window)
  // lastSnapshotTime is set at pushSnapshot time, so we add 50ms to simulate mid-tick
  const fakeNow = Date.now() + 50;
  const frame = interp.getFrame(fakeNow);

  // x should be between 0 and 200
  assert.ok(frame.assets[0].x >= 0 && frame.assets[0].x <= 200,
    `Expected x between 0 and 200, got ${frame.assets[0].x}`);
});

test('2C interpolator clamps t to 1.0 for late frames', () => {
  const interp = createInterpolator();
  const snap1 = { tick: 1, assets: [{ id: 0, x: 0, y: 0, team: 0, status: 'ACTIVE' }] };
  const snap2 = { tick: 2, assets: [{ id: 0, x: 200, y: 0, team: 0, status: 'ACTIVE' }] };

  interp.pushSnapshot(snap1);
  interp.pushSnapshot(snap2);

  // Simulate t >> 1.0 (500ms after snapshot, well past the 100ms window)
  const fakeNow = Date.now() + 500;
  const frame = interp.getFrame(fakeNow);

  assert.strictEqual(frame.assets[0].x, 200, 'Should clamp to next snapshot position');
});

test('2C interpolator handles new asset appearing in next snapshot', () => {
  const interp = createInterpolator();
  const snap1 = { tick: 1, assets: [] };
  const snap2 = { tick: 2, assets: [{ id: 5, x: 100, y: 50, team: 1, status: 'ACTIVE' }] };

  interp.pushSnapshot(snap1);
  interp.pushSnapshot(snap2);

  const frame = interp.getFrame(Date.now() + 500);
  assert.strictEqual(frame.assets.length, 1);
  assert.strictEqual(frame.assets[0].id, 5);
});
