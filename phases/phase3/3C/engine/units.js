// engine/units.js — Unit library and stat lookup (3A)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UNITS_PATH = join(__dirname, '../data/units.json');

// Cache the unit data
const UNIT_DB = JSON.parse(readFileSync(UNITS_PATH, 'utf8'));

export function getUnitStats(type) {
  return UNIT_DB[type] || UNIT_DB["TANK"];
}

export function createAsset(id, type, team, x, y) {
  const stats = getUnitStats(type);
  return {
    id,
    type,
    team,
    x: x | 0,
    y: y | 0,
    hp: stats.hp,
    maxHp: stats.hp,
    status: 0, // ASSET_ACTIVE
    target: { x: x | 0, y: y | 0 },
    lastFired: -100 // Ready to fire
  };
}
