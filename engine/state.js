// engine/state.js — authoritative state schema and initial state (1E contract).
// Reconstructed: the 1E state module was lost during the 1F merge. Field layout
// follows engine/snapshot.js hashState and test/fixtures/1A_reducer.json.
// 32 operator slots: 0..15 humans, 16..23 AI regency, 24..31 reserved.
// 8 field assets: 0..3 team A (west base), 4..7 team B (east base).

import { generateFrontierCorridor, FRONTIER_CORRIDOR } from "./frontier_corridor.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { AMMO_MAX, FUEL_MAX } from "./supply.js";
import { getUnitStats } from "./units.js";
import { createStandards } from "./standards.js";

export const OP_ABSENT = 0;
export const OP_ACTIVE = 1;
export const OP_DOWN = 2;

export const ASSET_IDLE = 0;
export const ASSET_MOVING = 1;
export const ASSET_DISABLED = 2;
export const ASSET_SALVAGED = 3;

// Suppression is a timer, not an asset state: it coexists with IDLE/MOVING.
export function isSuppressed(asset) {
  return asset.suppressedTimer > 0;
}

export const OPERATOR_COUNT = 32;
export const TEAM_COUNT = 2;

const MAP_PROFILES = {
  frontier_corridor: generateFrontierCorridor,
};

// Spawn layout. Asset numbering is compatibility-layered: ids 0-7 keep the
// original 4v4 arrangement (0-3 team A col 7, 4-7 team B col 117 — positions
// and chassis pinned by 1A/1B/1D tests). Ids 8-19 are team A reserves and
// 20-31 team B reserves (32 field assets total — the v1 "32 players" scale).
// Original eight keep the pinned tank/tank/scout/artillery pattern; reserves
// cycle all four chassis so each team fields logistics trucks (tow role).
const SPAWN_ROWS = [56, 58, 60, 62];
const SPAWN_TYPES = [0, 0, 1, 2];
// 9A: explicit 12-slot reserve mix. The first four are AI-crewed (ops 24-27 /
// 28-31): carrier, truck, scout, tank — so AI regents can raid AND rescue.
// Per-team totals: 5 tanks, 3 scouts, 3 artillery, 3 trucks, 2 carriers.
const RESERVE_TYPES = [4, 3, 1, 0, 0, 1, 2, 3, 2, 3, 0, 4];
const TEAM_A_SPAWN_X = 7;
const TEAM_B_SPAWN_X = 117;
const RESERVE_ROWS = [55, 57, 59, 61, 63, 65];
const TEAM_A_RESERVE_COLS = [8, 9];
const TEAM_B_RESERVE_COLS = [116, 115];

function createOperators() {
  const operators = [];
  for (let id = 0; id < OPERATOR_COUNT; id++) {
    operators.push({ id, team: -1, state: OP_ABSENT, assetId: -1, score: 0, downTimer: 0 });
  }
  return operators;
}

function makeFieldAsset(id, type, team, cellX, cellY) {
  const x = cellToWorld(cellX);
  const y = cellToWorld(cellY);
  return {
    id, type, team, state: ASSET_IDLE,
    x, y, targetX: x, targetY: y,
    heading: team === 1 ? 128 : 0, // brads: A faces east, B faces west (9F)
    aboard1: -1, aboard2: -1, // 9B: carrier bunks (operator ids)
    hp: getUnitStats(type).hp, operatorId: -1, moveProgress: 0, suppressedTimer: 0,
    ammo: AMMO_MAX, fuel: FUEL_MAX,
    towedBy: -1, recoverTimer: 0, // 8D tow-back recovery
    reloadTimer: 0, // 8E fire cooldown
  };
}

// Deterministic original spawn (cell + type) for any field asset id — used
// by the Slow Manufacture rebuild (9D).
export function fieldSpawnFor(id) {
  // Layout: 0-3 team A originals, 4-7 team B originals, 8-19 team A
  // reserves, 20-31 team B reserves (see createFieldAssets).
  if (id < 8) {
    const team = id < 4 ? 0 : 1;
    const slot = id % 4;
    const spawnX = team === 0 ? TEAM_A_SPAWN_X : TEAM_B_SPAWN_X;
    return { team, type: SPAWN_TYPES[slot], cellX: spawnX, cellY: SPAWN_ROWS[slot] };
  }
  const team = id < 20 ? 0 : 1;
  const slot = team === 0 ? id - 8 : id - 20;
  const cols = team === 0 ? TEAM_A_RESERVE_COLS : TEAM_B_RESERVE_COLS;
  const col = cols[(slot / RESERVE_ROWS.length) | 0];
  const row = RESERVE_ROWS[slot % RESERVE_ROWS.length];
  return { team, type: RESERVE_TYPES[slot % 12], cellX: col, cellY: row };
}

function createFieldAssets() {
  const assets = [];
  let id = 0;
  for (let team = 0; team < TEAM_COUNT; team++) {
    const spawnX = team === 0 ? TEAM_A_SPAWN_X : TEAM_B_SPAWN_X;
    for (let slot = 0; slot < SPAWN_ROWS.length; slot++) {
      assets.push(makeFieldAsset(id, SPAWN_TYPES[slot], team, spawnX, SPAWN_ROWS[slot]));
      id++;
    }
  }
  for (let team = 0; team < TEAM_COUNT; team++) {
    const cols = team === 0 ? TEAM_A_RESERVE_COLS : TEAM_B_RESERVE_COLS;
    let slot = 0;
    for (const col of cols) {
      for (const row of RESERVE_ROWS) {
        assets.push(makeFieldAsset(id, RESERVE_TYPES[slot % 12], team, col, row));
        id++;
        slot++;
      }
    }
  }
  return assets;
}

// Relay sites along the corridor: west approach, objective centre, east approach.
const RELAY_CELLS = [
  { cellX: 32, cellY: 63 },
  { cellX: 63, cellY: 63 },
  { cellX: 95, cellY: 63 },
];

function createSites() {
  return RELAY_CELLS.map((pos, id) => ({
    id, type: 1 /* SITE_RELAY */, owner: -1 /* SITE_NEUTRAL */,
    cellX: pos.cellX, cellY: pos.cellY,
  }));
}

function createBases() {
  const a = FRONTIER_CORRIDOR.teamABase;
  const b = FRONTIER_CORRIDOR.teamBBase;
  return [
    { team: 0, x: a.x, y: a.y, width: a.width, height: a.height },
    { team: 1, x: b.x, y: b.y, width: b.width, height: b.height },
  ];
}

// mapArg: profile name string (standard scenario with field assets),
// a prebuilt map object (empty sandbox for tests), or undefined (default profile).
export function createInitialState(mapSeed, mapArg = "frontier_corridor") {
  let map;
  let assets;
  let sites;
  let bases;
  let standards;
  if (typeof mapArg === "string") {
    const profile = MAP_PROFILES[mapArg];
    if (!profile) throw new RangeError(`unknown map profile: ${mapArg}`);
    map = profile(mapSeed >>> 0);
    assets = createFieldAssets();
    sites = createSites();
    bases = createBases();
    standards = createStandards();
  } else if (mapArg && typeof mapArg === "object") {
    map = mapArg;
    assets = [];
    sites = [];
    bases = [];
    standards = [];
  } else {
    throw new RangeError("mapArg must be a profile name or map object");
  }

  return {
    tick: 0,
    mapSeed: mapSeed >>> 0,
    map,
    teamScores: [0, 0],
    operators: createOperators(),
    assets,
    sites,
    bases,
    standards, // 8A: physical Command Standards
    downed: [], // 9B: operators on foot
    manufacture: [0, 0], // 9D: Slow Manufacture timers per team
    // 3E: victory bookkeeping (all hashed).
    phase: 0, // PHASE_RUNNING
    winner: -1,
    winReason: 0, // WIN_NONE
    dominationTeam: -1,
    dominationTicks: 0,
    events: [],
  };
}
