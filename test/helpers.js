// test/helpers.js — shared builders for sandbox states in milestone tests.
// Keeps test asset schema in one place so slice-driven schema growth
// (suppressedTimer 1H, ammo/fuel 1J, ...) only updates here.

import { createInitialState } from "../engine/state.js";
import { AMMO_MAX, FUEL_MAX } from "../engine/supply.js";
import { SITE_RELAY, SITE_NEUTRAL } from "../engine/sites.js";
import { ASSET_IDLE } from "../engine/state.js";
import { T_OPEN } from "../engine/mapgen.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { apply } from "../engine/reducer.js";

export function makeAsset(id, spec) {
  const x = spec.x ?? cellToWorld(spec.cellX ?? 0);
  const y = spec.y ?? cellToWorld(spec.cellY ?? 0);
  return {
    id, type: spec.type ?? 0, team: spec.team ?? 0, state: spec.state ?? ASSET_IDLE,
    x, y,
    targetX: spec.targetX ?? x, targetY: spec.targetY ?? y,
    hp: spec.hp ?? 100, operatorId: spec.operatorId ?? -1,
    moveProgress: 0, suppressedTimer: spec.suppressedTimer ?? 0,
    ammo: spec.ammo ?? AMMO_MAX, fuel: spec.fuel ?? FUEL_MAX,
  };
}

export function sandbox(assetSpecs, siteSpecs = [], opts = {}) {
  const size = opts.size ?? 64;
  const map = opts.map ?? {
    width: size, height: size,
    cells: new Uint8Array(size * size).fill(T_OPEN), seed: opts.seed ?? 1,
  };
  const state = createInitialState(opts.seed ?? 1, map);
  state.assets = assetSpecs.map((spec, id) => makeAsset(id, spec));
  state.sites = siteSpecs.map((spec, id) => ({
    id, type: spec.type ?? SITE_RELAY, owner: spec.owner ?? SITE_NEUTRAL,
    cellX: spec.cellX, cellY: spec.cellY ?? 0,
  }));
  if (opts.bases) state.bases = opts.bases;
  return state;
}

export function joinAndSelect(state, operatorId, team, assetId) {
  let s = apply(state, { type: "join_operator", operatorId, team });
  s = apply(s, { type: "select_asset", operatorId, assetId });
  return s;
}

export function joinSelectMove(state, operatorId, team, assetId, cellX, cellY) {
  let s = joinAndSelect(state, operatorId, team, assetId);
  s = apply(s, { type: "move_order", operatorId, targetCellX: cellX, targetCellY: cellY });
  return s;
}
