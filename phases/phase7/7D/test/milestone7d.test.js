// test/milestone7d.test.js — Milestone 7D: Tutorial & Onboarding Engine
import { test } from 'node:test';
import assert from 'node:assert';
import {
  createTutorial,
  evaluateTrigger,
  isTutorialComplete,
  markTutorialComplete,
  resetTutorial
} from '../client/tutorial.js';

// ── Mock storage ──────────────────────────────────────────────────────────────
function mockStorage() {
  const store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); }
  };
}

// ── evaluateTrigger ───────────────────────────────────────────────────────────
test('7D evaluateTrigger returns true when condition met', () => {
  const step = { trigger: (s) => s.tick >= 5 };
  assert.strictEqual(evaluateTrigger(step, { tick: 5 }), true);
  assert.strictEqual(evaluateTrigger(step, { tick: 4 }), false);
});

test('7D evaluateTrigger returns false for non-function trigger', () => {
  assert.strictEqual(evaluateTrigger({ trigger: null }, {}), false);
  assert.strictEqual(evaluateTrigger({}, {}), false);
});

// ── createTutorial ────────────────────────────────────────────────────────────
test('7D createTutorial rejects empty steps', () => {
  assert.throws(() => createTutorial([]), /non-empty array/);
  assert.throws(() => createTutorial('bad'), /non-empty array/);
});

test('7D tutorial starts at step 0', () => {
  const steps = [
    { id: 'a', message: 'A', trigger: () => true, actionRequired: null },
    { id: 'b', message: 'B', trigger: () => true, actionRequired: null }
  ];
  const tut = createTutorial(steps);
  assert.strictEqual(tut.currentStep().id, 'a');
  assert.strictEqual(tut.isComplete(), false);
});

test('7D advance moves to next step when trigger met', () => {
  const steps = [
    { id: 'a', message: 'A', trigger: () => true, actionRequired: null },
    { id: 'b', message: 'B', trigger: () => true, actionRequired: null }
  ];
  const tut = createTutorial(steps);
  const result = tut.advance({});
  assert.strictEqual(result.advanced, true);
  assert.strictEqual(tut.currentStep().id, 'b');
});

test('7D advance does not move when trigger not met', () => {
  const steps = [
    { id: 'a', message: 'A', trigger: (s) => s.ready === true, actionRequired: null }
  ];
  const tut = createTutorial(steps);
  const result = tut.advance({ ready: false });
  assert.strictEqual(result.advanced, false);
  assert.strictEqual(tut.currentStep().id, 'a');
});

test('7D tutorial completes after last step', () => {
  const steps = [
    { id: 'only', message: 'Only', trigger: () => true, actionRequired: null }
  ];
  const tut = createTutorial(steps);
  tut.advance({});
  assert.strictEqual(tut.isComplete(), true);
  assert.strictEqual(tut.currentStep(), null);
});

test('7D advance on completed tutorial is a no-op', () => {
  const steps = [
    { id: 'only', message: 'Only', trigger: () => true, actionRequired: null }
  ];
  const tut = createTutorial(steps);
  tut.advance({});
  const result = tut.advance({});
  assert.strictEqual(result.advanced, false);
});

test('7D reset returns tutorial to step 0', () => {
  const steps = [
    { id: 'a', message: 'A', trigger: () => true, actionRequired: null },
    { id: 'b', message: 'B', trigger: () => true, actionRequired: null }
  ];
  const tut = createTutorial(steps);
  tut.advance({});
  tut.reset();
  assert.strictEqual(tut.currentStep().id, 'a');
  assert.strictEqual(tut.isComplete(), false);
});

test('7D idleHint returns null below threshold', () => {
  const steps = [
    { id: 'a', message: 'Do something', trigger: () => false, actionRequired: null }
  ];
  const tut = createTutorial(steps);
  assert.strictEqual(tut.idleHint(10), null);
});

test('7D idleHint returns hint at or above threshold', () => {
  const steps = [
    { id: 'a', message: 'Do something', trigger: () => false, actionRequired: null }
  ];
  const tut = createTutorial(steps);
  const hint = tut.idleHint(20);
  assert.ok(typeof hint === 'string');
  assert.ok(hint.includes('Do something'));
});

test('7D idleHint returns null when complete', () => {
  const steps = [
    { id: 'a', message: 'A', trigger: () => true, actionRequired: null }
  ];
  const tut = createTutorial(steps);
  tut.advance({});
  assert.strictEqual(tut.idleHint(999), null);
});

// ── Storage helpers ───────────────────────────────────────────────────────────
test('7D isTutorialComplete returns false initially', () => {
  const s = mockStorage();
  assert.strictEqual(isTutorialComplete(s), false);
});

test('7D markTutorialComplete sets flag', () => {
  const s = mockStorage();
  markTutorialComplete(s);
  assert.strictEqual(isTutorialComplete(s), true);
});

test('7D resetTutorial clears flag', () => {
  const s = mockStorage();
  markTutorialComplete(s);
  resetTutorial(s);
  assert.strictEqual(isTutorialComplete(s), false);
});
