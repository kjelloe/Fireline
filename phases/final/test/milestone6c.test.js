// test/milestone6c.test.js — Milestone 6C: Mobile Controls (unit tests)
// Tests the pure logic helpers without a DOM.
import { test } from 'node:test';
import assert from 'node:assert';

// Inline the pure helpers for headless testing
function pinchDist(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeJoystick(origin, touch) {
  const dx = touch.clientX - origin.x;
  const dy = touch.clientY - origin.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= 10) return null;
  return { dx: dx / len, dy: dy / len, magnitude: Math.min(len, 60) };
}

test('6C pinchDist computes correct distance', () => {
  const t1 = { clientX: 0, clientY: 0 };
  const t2 = { clientX: 3, clientY: 4 };
  assert.strictEqual(pinchDist(t1, t2), 5);
});

test('6C normalizeJoystick returns null for dead zone', () => {
  const origin = { x: 100, y: 100 };
  const touch = { clientX: 105, clientY: 100 }; // 5px — inside dead zone
  assert.strictEqual(normalizeJoystick(origin, touch), null);
});

test('6C normalizeJoystick returns unit vector outside dead zone', () => {
  const origin = { x: 0, y: 0 };
  const touch = { clientX: 60, clientY: 0 }; // 60px right
  const result = normalizeJoystick(origin, touch);
  assert.ok(result !== null);
  assert.strictEqual(result.dx, 1);
  assert.strictEqual(result.dy, 0);
  assert.strictEqual(result.magnitude, 60);
});
