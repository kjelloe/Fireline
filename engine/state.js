// engine/state.js
// Creates and clones the canonical numeric-first world state.
// No I/O, no clocks, no hidden state. All values are plain numbers or arrays.

export const MAX_OPERATORS = 32;
export const MAX_ASSETS    = 64;
export const CELL_SCALE    = 256; // fixed-point units per cell

// Asset types
export const ASSET_TANK    = 0;
export const ASSET_APC     = 1;
export const ASSET_INFANTRY= 2;

// Operator states
export const OP_ABSENT  = 0;
export const OP_ACTIVE  = 1;
export const OP_DOWN    = 2;

// Asset states
export const ASSET_IDLE     = 0;
export const ASSET_MOVING   = 1;
export const ASSET_DISABLED = 2;
export const ASSET_SALVAGED = 3;

// Team IDs
export const TEAM_A = 0;
export const TEAM_B = 1;

function makeOperator() {
  return {
    id: -1, team: -1, state: OP_ABSENT,
    assetId: -1, score: 0, downTimer: 0,
  };
}

function makeAsset() {
  return {
    id: -1, type: ASSET_TANK, team: -1, state: ASSET_IDLE,
    x: 0, y: 0,          // fixed-point world position (cell * CELL_SCALE)
    targetX: -1, targetY: -1,
    hp: 100, maxHp: 100,
    operatorId: -1,
    moveProgress: 0,      // 0-255 progress toward target cell
  };
}

export function createInitialState(mapSeed, mapProfile) {
  const operators = [];
  const assets    = [];
  for (let i = 0; i < MAX_OPERATORS; i++) { const o = makeOperator(); o.id = i; operators.push(o); }
  for (let i = 0; i < MAX_ASSETS;    i++) { const a = makeAsset();    a.id = i; assets.push(a); }

  // Spawn 4 AI-controlled assets per team at base positions (fixed-point)
  const spawnA = [{ x: 7, y: 56 }, { x: 8, y: 57 }, { x: 9, y: 58 }, { x: 10, y: 59 }];
  const spawnB = [{ x: 117, y: 56 }, { x: 116, y: 57 }, { x: 115, y: 58 }, { x: 114, y: 59 }];
  for (let i = 0; i < 4; i++) {
    assets[i].team = TEAM_A; assets[i].state = ASSET_IDLE;
    assets[i].x = spawnA[i].x * CELL_SCALE; assets[i].y = spawnA[i].y * CELL_SCALE;
    assets[i+4].team = TEAM_B; assets[i+4].state = ASSET_IDLE;
    assets[i+4].x = spawnB[i].x * CELL_SCALE; assets[i+4].y = spawnB[i].y * CELL_SCALE;
  }

  return {
    tick: 0,
    mapSeed: mapSeed >>> 0,
    mapProfile: mapProfile || "frontier_corridor",
    teamScores: [0, 0],
    operators,
    assets,
    events: [],       // cleared each tick; reducer appends events
    rngState: [0, 0, 0, 0], // reserved for AI regency; not yet consumed
  };
}

export function cloneState(s) {
  return {
    tick: s.tick,
    mapSeed: s.mapSeed,
    mapProfile: s.mapProfile,
    teamScores: [...s.teamScores],
    operators: s.operators.map(o => ({ ...o })),
    assets:    s.assets.map(a => ({ ...a })),
    events:    [],
    rngState:  [...s.rngState],
  };
}
