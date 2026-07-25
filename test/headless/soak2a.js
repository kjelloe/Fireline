// test/headless/soak2a.js — shared 2A integration soak harness.
// Two scripted operators emulate browser clients: they read only their own
// fog-filtered views and respond with ordinary commands (join/select/move/
// fire). All outcomes are decided by the server's reducer.

import { GameServer } from "../../engine/server.js";
import { createInitialState } from "../../engine/reducer.js";
import { replayLog } from "../../engine/replay.js";
import { hashState } from "../../engine/snapshot.js";
import { DEFAULT_RULES } from "../../engine/combat.js";
import { ASSET_DISABLED, ASSET_SALVAGED } from "../../engine/state.js";

const OPS = [
  { operatorId: 0, team: 0, assetId: 0, goal: { cellX: 95, cellY: 63 } }, // east relay
  { operatorId: 1, team: 1, assetId: 4, goal: { cellX: 32, cellY: 63 } }, // west relay
];

function operable(state) {
  return state !== ASSET_DISABLED && state !== ASSET_SALVAGED;
}

function scriptCommands(view, op) {
  const own = view.friendlyAssets.find((a) => a.operatorId === op.operatorId);
  if (!own || !operable(own.state)) return [];

  const inRange = view.visibleEnemies
    .filter((e) => operable(e.state))
    .filter((e) => {
      const dx = e.x - own.x;
      const dy = e.y - own.y;
      return dx * dx + dy * dy <= DEFAULT_RULES.range * DEFAULT_RULES.range;
    })
    .sort((a, b) => a.id - b.id);

  if (inRange.length > 0 && own.ammo > 0) {
    return [{ type: "fire_order", operatorId: op.operatorId, targetAssetId: inRange[0].id }];
  }
  return [];
}

export function runSoak(seed, ticks) {
  const server = new GameServer({ mapSeed: seed });
  for (const op of OPS) {
    server.enqueue({ type: "join_operator", operatorId: op.operatorId, team: op.team });
    server.enqueue({ type: "select_asset", operatorId: op.operatorId, assetId: op.assetId });
    server.enqueue({
      type: "move_order", operatorId: op.operatorId,
      targetCellX: op.goal.cellX, targetCellY: op.goal.cellY,
    });
  }

  let snap = server.step();
  const log = [];
  let captures = 0;
  let disables = 0;
  let minAmmo = Infinity;
  let minFuel = Infinity;

  for (let i = 1; i < ticks; i++) {
    for (const op of OPS) {
      for (const cmd of scriptCommands(snap.views[op.team], op)) server.enqueue(cmd);
    }
    snap = server.step();
    for (const e of snap.views[0].events) {
      if (e.type === "site_captured") { captures++; log.push(`tick ${snap.tick}: site ${e.siteId} -> team ${e.team}`); }
      if (e.type === "asset_disabled") { disables++; log.push(`tick ${snap.tick}: asset ${e.assetId} disabled`); }
    }
    for (const a of server.state.assets) {
      if (a.ammo < minAmmo) minAmmo = a.ammo;
      if (a.fuel < minFuel) minFuel = a.fuel;
    }
  }

  const liveHash = server.getLatestSnapshot().stateHash;
  const replayHash = hashState(replayLog(createInitialState(seed, "frontier_corridor"), server.commandLog));
  return { server, log, captures, disables, minAmmo, minFuel, liveHash, replayHash };
}
