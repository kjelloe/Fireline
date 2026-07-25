
// test/milestone6e.test.js — Milestone 6E: Modding Support & Custom Maps
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {
  listMods, loadMod, validateMod, validateTerrainMap, applyModToState
} from '../server/modding.js';

const MODS_DIR = path.join(process.cwd(), 'data', 'mods');

function writeMod(id, content) {
  if (!fs.existsSync(MODS_DIR)) fs.mkdirSync(MODS_DIR, { recursive: true });
  fs.writeFileSync(path.join(MODS_DIR, `${id}.json`), JSON.stringify(content));
}

function cleanupMod(id) {
  const p = path.join(MODS_DIR, `${id}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

test('6E loadMod loads valid mod', () => {
  writeMod('test_mod', { id: 'test_mod', name: 'Test Mod', version: '1.0', overrides: { terrainSpeeds: { road: 200 } } });
  const mod = loadMod('test_mod');
  assert.strictEqual(mod.name, 'Test Mod');
  assert.strictEqual(mod.overrides.terrainSpeeds.road, 200);
  cleanupMod('test_mod');
});

test('6E validateMod rejects disallowed override keys', () => {
  assert.throws(() => validateMod({ id: 'bad', name: 'Bad', overrides: { maliciousCode: 'eval' } }), /Disallowed override key/);
});

test('6E validateMod rejects invalid terrain map', () => {
  assert.throws(() => validateMod({ id: 'm', name: 'M', customMap: { width: 4, height: 4, cells: [0, 0, 0] } }), /Cells length must match/);
});

test('6E validateTerrainMap accepts valid map', () => {
  const cells = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3];
  assert.strictEqual(validateTerrainMap(cells, 4, 4), true);
});

test('6E validateTerrainMap rejects invalid terrain id', () => {
  const cells = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,99];
  assert.throws(() => validateTerrainMap(cells, 4, 4), /Invalid terrain id/);
});

test('6E validateTerrainMap rejects oversized map', () => {
  assert.throws(() => validateTerrainMap([], 600, 600), /Map too large/);
});

test('6E applyModToState merges overrides', () => {
  const baseState = { terrainSpeeds: { road: 140, open: 100 }, unitStats: {} };
  const mod = { overrides: { terrainSpeeds: { road: 200 } } };
  const result = applyModToState(mod, baseState);
  assert.strictEqual(result.terrainSpeeds.road, 200);
  assert.strictEqual(result.terrainSpeeds.open, 100);
});

test('6E applyModToState leaves state untouched if no overrides', () => {
  const baseState = { terrainSpeeds: { open: 100 } };
  const result = applyModToState({ name: 'no overrides' }, baseState);
  assert.strictEqual(result.terrainSpeeds.open, 100);
});

test('6E listMods returns available mods', () => {
  writeMod('mod_a', { id: 'mod_a', name: 'Mod A', author: 'Alice', version: '1.0' });
  writeMod('mod_b', { id: 'mod_b', name: 'Mod B', author: 'Bob', version: '2.0' });
  const mods = listMods();
  const names = mods.map(m => m.name).sort();
  assert.deepStrictEqual(names, ['Mod A', 'Mod B']);
  cleanupMod('mod_a');
  cleanupMod('mod_b');
});

test('6E listMods returns empty array when no mods exist', () => {
  // Ensure directory exists but is clean of json files for this test
  const existing = fs.readdirSync(MODS_DIR).filter(f => f.endsWith('.json'));
  for (const f of existing) fs.unlinkSync(path.join(MODS_DIR, f));
  assert.deepStrictEqual(listMods(), []);
});
