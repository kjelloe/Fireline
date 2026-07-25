// test/headless/soak_v1.js — v1 acceptance soak: 32 participants.
// 16 scripted human-like operators (view-driven, fog-respecting, ordinary
// commands only) + 16 fixed AI regents = 32 operators driving 32 assets.
// Humans crew the reserve assets; regents crew the line assets.

import { GameServer } from "../../engine/server.js";
import { createInitialState } from "../../engine/reducer.js";
import { replayLog } from "../../engine/replay.js";
import { hashState } from "../../engine/snapshot.js";
import { DEFAULT_RULES } from "../../engine/combat.js";

const RELAYS = [[32, 63], [63, 63], [95, 63]];
const A_RESERVES = [12, 13, 14, 15, 16, 17, 18, 19];
const B_RESERVES = [24, 25, 26, 27, 28, 29, 30, 31];

function scriptedOps() {
  const ops = [];
  for (let i = 0; i < 8; i++) {
    ops.push({ operatorId: i, team: 0, assetId: A_RESERVES[i], relay: i % 3 });
    ops.push({ operatorId: 8 + i, team: 1, assetId: B_RESERVES[i], relay: (i + 1) % 3 });
  }
  return ops;
}

function commandsFor(view, op) {
  const own = view.friendlyAssets.find((a) => a.operatorId === op.operatorId);
  if (!own || own.state === 2 || own.state === 3) return [];

  const inRange = view.visibleEnemies
    .filter((e) => e.state !== 2 && e.state !== 3)
    .filter((e) => {
      const dx = e.x - own.x;
      const dy = e.y - own.y;
      return dx * dx + dy * dy <= DEFAULT_RULES.range * DEFAULT_RULES.range;
    })
    .sort((a, b) => a.id - b.id);
  if (inRange.length > 0 && own.ammo > 0) {
    return [{ type: "fire_order", operatorId: op.operatorId, targetAssetId: inRange[0].id }];
  }

  if (own.state === 0) { // idle: push for the assigned relay, rotate on arrival
    const [cx, cy] = RELAYS[op.relay];
    const atRelay = Math.floor(own.x / 256) === cx && Math.floor(own.y / 256) === cy;
    if (atRelay) op.relay = (op.relay + 1) % RELAYS.length;
    const [tx, ty] = RELAYS[op.relay];
    return [{ type: "move_order", operatorId: op.operatorId, targetCellX: tx, targetCellY: ty }];
  }
  return [];
}

export function runV1Soak(seed, ticks) {
  const server = new GameServer({ mapSeed: seed, enableAi: true });
  const ops = scriptedOps();
  for (const op of ops) {
    server.enqueue({ type: "join_operator", operatorId: op.operatorId, team: op.team });
    server.enqueue({ type: "select_asset", operatorId: op.operatorId, assetId: op.assetId });
  }

  let snap = server.step();
  let captures = 0;
  let disables = 0;
  let minAmmo = Infinity;
  let minFuel = Infinity;
  const started = process.hrtime.bigint();

  for (let i = 1; i < ticks; i++) {
    for (const op of ops) {
      for (const cmd of commandsFor(snap.views[op.team], op)) server.enqueue(cmd);
    }
    snap = server.step();
    for (const e of snap.views[0].events) {
      if (e.type === "site_captured") captures++;
      if (e.type === "asset_disabled") disables++;
    }
    for (const a of server.state.assets) {
      if (a.ammo < minAmmo) minAmmo = a.ammo;
      if (a.fuel < minFuel) minFuel = a.fuel;
    }
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  const liveHash = server.getLatestSnapshot().stateHash;
  const replayHash = hashState(
    replayLog(createInitialState(seed, "frontier_corridor"), server.commandLog)
  );
  const activeOperators = server.state.operators.filter((o) => o.state === 1).length;
  const operatedAssets = server.state.assets.filter((a) => a.operatorId !== -1).length;

  return {
    server, captures, disables, minAmmo, minFuel, liveHash, replayHash,
    activeOperators, operatedAssets, elapsedMs,
    ticksPerSecond: Math.round((ticks / elapsedMs) * 1000),
  };
}
