// test/milestone5c.test.js — Milestone 5C: Map Rotation & Biomes
import { test } from 'node:test';
import assert from 'node:assert';
import { MapRotator, BIOMES } from '../server/map_rotator.js';

test('5C MapRotator starts with temperate biome', () => {
  const rotator = new MapRotator();
  const options = rotator.getCurrentMapOptions(0);
  assert.strictEqual(options.id, 'temperate');
  assert.strictEqual(options.roughFraction, 0.15);
});

test('5C MapRotator rotates biome after 30 minutes', () => {
  const rotator = new MapRotator();
  const t0 = 0;
  const t30 = 30 * 60 * 1000 + 1;

  const first = rotator.getCurrentMapOptions(t0);
  const second = rotator.getCurrentMapOptions(t30);

  assert.notStrictEqual(first.id, second.id);
  assert.strictEqual(second.id, 'arctic');
});

test('5C forceBiome overrides current selection', () => {
  const rotator = new MapRotator();
  rotator.forceBiome('desert');
  const options = rotator.getCurrentMapOptions(Date.now());
  assert.strictEqual(options.id, 'desert');
  assert.strictEqual(options.roughFraction, 0.25);
});

test('5C biome list contains exactly 3 biomes', () => {
  assert.strictEqual(BIOMES.length, 3);
  assert.ok(BIOMES.some(b => b.id === 'arctic'));
  assert.ok(BIOMES.some(b => b.id === 'desert'));
});
