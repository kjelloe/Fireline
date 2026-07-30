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
import { getUnitStats } from "../engine/units.js";

export function makeAsset(id, spec) {
  const x = spec.x ?? cellToWorld(spec.cellX ?? 0);
  const y = spec.y ?? cellToWorld(spec.cellY ?? 0);
  return {
    id, type: spec.type ?? 0, team: spec.team ?? 0, state: spec.state ?? ASSET_IDLE,
    x, y,
    heading: spec.heading ?? ((spec.team ?? 0) === 1 ? 128 : 0),
    targetX: spec.targetX ?? x, targetY: spec.targetY ?? y,
    hp: spec.hp ?? 100, operatorId: spec.operatorId ?? -1,
    moveProgress: 0, suppressedTimer: spec.suppressedTimer ?? 0,
    ammo: spec.ammo ?? AMMO_MAX, fuel: spec.fuel ?? FUEL_MAX,
    towedBy: spec.towedBy ?? -1, recoverTimer: spec.recoverTimer ?? 0,
    aboard1: spec.aboard1 ?? -1, aboard2: spec.aboard2 ?? -1,
    minesLeft: spec.minesLeft ?? ((spec.type ?? 0) === 0 ? 2 : 0), // 9E
    campTicks: spec.campTicks ?? 0, // 9G
    materiel: spec.materiel ?? 0, // 11F
    cargoFuel: spec.cargoFuel ?? 0, cargoAmmo: spec.cargoAmmo ?? 0, // 13A
    driveThrottle: spec.driveThrottle ?? 0, driveTurn: spec.driveTurn ?? 0, // 11L
    deployed: spec.deployed ?? 0, deployTimer: spec.deployTimer ?? 0, // 12B
    stationOp: spec.stationOp ?? -1, // prompt-100 stations
    stationAmmo: spec.stationAmmo ?? (getUnitStats(spec.type ?? 0).station?.shots ?? 0),
    stationReload: spec.stationReload ?? 0,
    ejectTimer: spec.ejectTimer ?? 0, // Q41
    prisoner: spec.prisoner ?? -1, captureTicks: spec.captureTicks ?? 0, // POW slice 2
    reloadTimer: spec.reloadTimer ?? 0,
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
    kind: spec.kind ?? 0, // B2
    cellX: spec.cellX, cellY: spec.cellY ?? 0,
    captureProgress: spec.captureProgress ?? 0, capturingTeam: spec.capturingTeam ?? -1, // 11B
    hp: spec.hp ?? 60, // 11F
  }));
  // Default: whole-map bases for both teams so supply rules (3B) stay neutral
  // in tests that aren't about supply. Pass opts.bases to exercise them.
  state.bases = opts.bases ?? [
    { team: 0, x: 0, y: 0, width: map.width, height: map.height },
    { team: 1, x: 0, y: 0, width: map.width, height: map.height },
  ];
  // 8A: standards only when a test asks for them.
  if (opts.standards) {
    state.standards = opts.standards.map((spec, id) => ({
      id, team: spec.team ?? id,
      x: cellToWorld(spec.cellX), y: cellToWorld(spec.cellY ?? 0),
      homeCellX: spec.homeCellX ?? spec.cellX, homeCellY: spec.homeCellY ?? spec.cellY ?? 0,
      carrierAssetId: spec.carrierAssetId ?? -1,
      status: spec.status ?? 0,
      droppedTimer: spec.droppedTimer ?? 0,
    }));
  }
  return state;
}

export function joinAndSelect(state, operatorId, team, assetId) {
  let s = apply(state, { type: "join_operator", operatorId, team });
  // Staging convenience: always confirm (10B) — takeover-gate tests issue
  // their own raw select_asset commands.
  s = apply(s, { type: "select_asset", operatorId, assetId, confirm: true });
  return s;
}

export function joinSelectMove(state, operatorId, team, assetId, cellX, cellY) {
  let s = joinAndSelect(state, operatorId, team, assetId);
  s = apply(s, { type: "move_order", operatorId, targetCellX: cellX, targetCellY: cellY });
  return s;
}

// 13C: what the AI actually emits for a long-haul objective — the routed
// first leg, or the objective itself when the graph sits it out.
import { routeWaypoints, nextWaypoint } from "../engine/route_graph.js";
export function expectedStep(profile, fromCell, toCell, stats) {
  const route = routeWaypoints(profile, fromCell[0], fromCell[1], toCell[0], toCell[1], stats);
  if (!route.length) return toCell;
  const wp = nextWaypoint(route, fromCell[0], fromCell[1]);
  return wp ?? toCell;
}
