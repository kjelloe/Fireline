// test/milestone6d.test.js — Milestone 6D: AI Difficulty & Behavior Trees
import { test } from 'node:test';
import assert from 'node:assert';
import {
  createDifficultyConfig,
  calculateAggression,
  shouldCheatWithFog,
  getAccuracyRoll,
  shouldMakeMicroError,
  DIFFICULTY_PRESETS,
  Selector,
  Sequence,
  Action,
  Condition
} from '../server/ai_difficulty.js';

test('6D easy preset has low aggression and no fog cheat', () => {
  const config = createDifficultyConfig('easy');
  assert.strictEqual(config.preset, 'easy');
  assert.strictEqual(config.aggression, 0.3);
  assert.strictEqual(config.fogCheat, false);
  assert.strictEqual(config.reactionDelay, 3);
});

test('6D hard preset enables fog cheating and high accuracy', () => {
  const config = createDifficultyConfig('hard');
  assert.strictEqual(config.fogCheat, true);
  assert.strictEqual(config.accuracy, 0.95);
  assert.strictEqual(config.reactionDelay, 1);
});

test('6D brutal preset has perfect accuracy and zero delay', () => {
  const config = createDifficultyConfig('brutal');
  assert.strictEqual(config.accuracy, 1.0);
  assert.strictEqual(config.reactionDelay, 0);
  assert.strictEqual(config.microErrors, 0.0);
});

test('6D calculateAggression scales with player advantage', () => {
  const config = createDifficultyConfig('medium');
  const base = calculateAggression(0.5, config, {});
  const behind = calculateAggression(0.5, config, { playerAdvantage: 6, tickCount: 0 });
  assert.ok(behind > base, 'AI should be more aggressive when behind');
  assert.ok(behind <= 1.0, 'Aggression should be clamped to 1.0');
});

test('6D shouldCheatWithFog returns true only for hard/brutal', () => {
  assert.strictEqual(shouldCheatWithFog(createDifficultyConfig('easy')), false);
  assert.strictEqual(shouldCheatWithFog(createDifficultyConfig('medium')), false);
  assert.strictEqual(shouldCheatWithFog(createDifficultyConfig('hard')), true);
  assert.strictEqual(shouldCheatWithFog(createDifficultyConfig('brutal')), true);
});

test('6D getAccuracyRoll is deterministic for perfect accuracy', () => {
  const brutal = createDifficultyConfig('brutal');
  assert.strictEqual(getAccuracyRoll(brutal), true);

  const easy = createDifficultyConfig('easy');
  // With accuracy 0.5, we can't guarantee, but we can test the distribution
  let hits = 0;
  for (let i = 0; i < 100; i++) if (getAccuracyRoll(easy)) hits++;
  assert.ok(hits >= 30 && hits <= 70, 'Should be roughly 50/50');
});

test('6D shouldMakeMicroError respects microErrors config', () => {
  const brutal = createDifficultyConfig('brutal');
  assert.strictEqual(shouldMakeMicroError(brutal), false); // 0.0 means never
});

test('6D Selector returns SUCCESS on first child success', () => {
  let called = [0, 0, 0];
  const selector = new Selector([
    new Action(() => { called[0]++; return false; }),
    new Action(() => { called[1]++; return true; }),
    new Action(() => { called[2]++; return true; })
  ]);
  const result = selector.tick({});
  assert.strictEqual(result, 'SUCCESS');
  assert.strictEqual(called[0], 1);
  assert.strictEqual(called[1], 1);
  assert.strictEqual(called[2], 0); // Third never called
});

test('6D Sequence returns FAILURE on first child failure', () => {
  let called = [0, 0, 0];
  const sequence = new Sequence([
    new Action(() => { called[0]++; return true; }),
    new Action(() => { called[1]++; return false; }),
    new Action(() => { called[2]++; return true; })
  ]);
  const result = sequence.tick({});
  assert.strictEqual(result, 'FAILURE');
  assert.strictEqual(called[0], 1);
  assert.strictEqual(called[1], 1);
  assert.strictEqual(called[2], 0); // Third never called
});

test('6D Condition node evaluates predicate', () => {
  const cond = new Condition(ctx => ctx.health > 50);
  assert.strictEqual(cond.tick({ health: 75 }), 'SUCCESS');
  assert.strictEqual(cond.tick({ health: 30 }), 'FAILURE');
});

test('6D unknown preset defaults to medium', () => {
  const config = createDifficultyConfig('nonexistent');
  assert.strictEqual(config.preset, 'medium');
  assert.strictEqual(config.aggression, 0.6);
});
