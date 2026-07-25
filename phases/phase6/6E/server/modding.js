
// server/modding.js — Modding Support & Custom Maps (6E)
// Loads, validates, and applies JSON mods. No arbitrary code execution.

import fs from 'fs';
import path from 'path';

const MODS_DIR = path.join(process.cwd(), 'data', 'mods');
if (!fs.existsSync(MODS_DIR)) fs.mkdirSync(MODS_DIR, { recursive: true });

const ALLOWED_OVERRIDE_KEYS = new Set([
  'terrainSpeeds', 'unitStats', 'weaponStats', 'mapGenParams', 'victoryConditions'
]);

const ALLOWED_TERRAIN_IDS = new Set([0, 1, 2, 3, 4]);
const MAX_MAP_SIZE = 512;

export function listMods() {
  if (!fs.existsSync(MODS_DIR)) return [];
  return fs.readdirSync(MODS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const raw = fs.readFileSync(path.join(MODS_DIR, f), 'utf8');
        const manifest = JSON.parse(raw);
        return { id: f.replace('.json', ''), name: manifest.name || f, author: manifest.author || 'unknown', version: manifest.version || '0.0.1' };
      } catch { return null; }
    })
    .filter(Boolean);
}

export function loadMod(modId) {
  const filePath = path.join(MODS_DIR, `${modId}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Mod not found: ${modId}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const manifest = JSON.parse(raw);
  validateMod(manifest);
  return manifest;
}

export function validateMod(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('Manifest must be an object');
  if (!manifest.id || typeof manifest.id !== 'string') throw new Error('Missing mod id');
  if (!manifest.name || typeof manifest.name !== 'string') throw new Error('Missing mod name');

  // Only allow specific override keys
  if (manifest.overrides) {
    for (const key of Object.keys(manifest.overrides)) {
      if (!ALLOWED_OVERRIDE_KEYS.has(key)) {
        throw new Error(`Disallowed override key: ${key}`);
      }
    }
  }

  // Validate custom map if present
  if (manifest.customMap) {
    validateTerrainMap(manifest.customMap.cells, manifest.customMap.width, manifest.customMap.height);
  }

  return true;
}

export function validateTerrainMap(cells, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error('Dimensions must be integers');
  if (width < 4 || height < 4) throw new Error('Map too small (min 4x4)');
  if (width > MAX_MAP_SIZE || height > MAX_MAP_SIZE) throw new Error('Map too large (max 512x512)');
  if (!Array.isArray(cells)) throw new Error('Cells must be an array');
  if (cells.length !== width * height) throw new Error('Cells length must match width * height');
  for (const c of cells) {
    if (!ALLOWED_TERRAIN_IDS.has(c)) throw new Error(`Invalid terrain id: ${c}`);
  }
  return true;
}

export function applyModToState(modManifest, baseState) {
  if (!modManifest.overrides) return baseState;
  const state = { ...baseState };
  const ov = modManifest.overrides;

  if (ov.terrainSpeeds) {
    state.terrainSpeeds = { ...state.terrainSpeeds, ...ov.terrainSpeeds };
  }
  if (ov.unitStats) {
    state.unitStats = { ...state.unitStats, ...ov.unitStats };
  }
  if (ov.weaponStats) {
    state.weaponStats = { ...state.weaponStats, ...ov.weaponStats };
  }
  if (ov.victoryConditions) {
    state.victoryConditions = { ...state.victoryConditions, ...ov.victoryConditions };
  }

  return state;
}
