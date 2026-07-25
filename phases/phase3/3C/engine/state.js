// engine/state.js — state schema and initial state

export const OP_ACTIVE = 0;
export const ASSET_ACTIVE = 0;
export const ASSET_SUPPRESSED = 1;
export const ASSET_DISABLED = 2;
export const ASSET_WRECK = 3;

export function createInitialState(seed, map) {
  return {
    seed: seed >>> 0,
    tick: 0,
    map,
    assets: [],
    operators: [],
    nextAssetId: 0,
    nextOperatorId: 0,
    sites: [],
    commands: [],
  };
}
