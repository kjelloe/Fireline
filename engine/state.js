// engine/state.js — authoritative state schema and initial state (1E contract).
// Reconstructed: the 1E state module was lost during the 1F merge. Field layout
// follows engine/snapshot.js hashState and test/fixtures/1A_reducer.json.
// 32 operator slots: 0..15 humans, 16..23 AI regency, 24..31 reserved.
// 8 field assets: 0..3 team A (west base), 4..7 team B (east base).

import { generateFrontierCorridor } from "./frontier_corridor.js";
import { cellToWorld } from "../shared/fixedmath.js";

export const OP_ABSENT = 0;
export const OP_ACTIVE = 1;
export const OP_DOWN = 2;

export const ASSET_IDLE = 0;
export const ASSET_MOVING = 1;
export const ASSET_DISABLED = 2;
export const ASSET_SALVAGED = 3;

export const OPERATOR_COUNT = 32;
export const TEAM_COUNT = 2;

const MAP_PROFILES = {
  frontier_corridor: generateFrontierCorridor,
};

// Spawn columns sit inside each base zone; rows are shared by both teams.
const SPAWN_ROWS = [56, 58, 60, 62];
const TEAM_A_SPAWN_X = 7;
const TEAM_B_SPAWN_X = 117;

function createOperators() {
  const operators = [];
  for (let id = 0; id < OPERATOR_COUNT; id++) {
    operators.push({ id, team: -1, state: OP_ABSENT, assetId: -1, score: 0, downTimer: 0 });
  }
  return operators;
}

function createFieldAssets() {
  const assets = [];
  let id = 0;
  for (let team = 0; team < TEAM_COUNT; team++) {
    const spawnX = team === 0 ? TEAM_A_SPAWN_X : TEAM_B_SPAWN_X;
    for (const row of SPAWN_ROWS) {
      const x = cellToWorld(spawnX);
      const y = cellToWorld(row);
      assets.push({
        id, type: 0, team, state: ASSET_IDLE,
        x, y, targetX: x, targetY: y,
        hp: 100, operatorId: -1, moveProgress: 0,
      });
      id++;
    }
  }
  return assets;
}

// mapArg: profile name string (standard scenario with field assets),
// a prebuilt map object (empty sandbox for tests), or undefined (default profile).
export function createInitialState(mapSeed, mapArg = "frontier_corridor") {
  let map;
  let assets;
  if (typeof mapArg === "string") {
    const profile = MAP_PROFILES[mapArg];
    if (!profile) throw new RangeError(`unknown map profile: ${mapArg}`);
    map = profile(mapSeed >>> 0);
    assets = createFieldAssets();
  } else if (mapArg && typeof mapArg === "object") {
    map = mapArg;
    assets = [];
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
    events: [],
  };
}
