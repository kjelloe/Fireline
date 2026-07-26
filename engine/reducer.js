// engine/reducer.js — the authoritative pure reducer: apply(state, command).
// Reconstructed 1E contract (see test/fixtures/1A_reducer.json) with the 1F
// terrain-speed rules merged in. Never mutates input state. Integer math only.
// Events describe what this command did; rejected in-game actions emit a
// "rejected" event and change nothing else.

import {
  OP_ABSENT, OP_ACTIVE, OP_DOWN,
  ASSET_IDLE, ASSET_MOVING, ASSET_DISABLED, ASSET_SALVAGED,
} from "./state.js";
import {
  CMD_ADVANCE_TICK, CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER,
  CMD_FIRE_ORDER, CMD_TOW_ORDER, CMD_CRAWL_ORDER, CMD_REDEPLOY,
  CMD_DEPLOY_MINE, CMD_CLEAR_MINE, CMD_PING,
  CMD_SET_OPTION, CMD_BOARD_CARRIER, CMD_UNBOARD,
  CMD_CALL_MEDIC, CMD_RESPAWN, validate,
} from "./commands.js";
import {
  MINE_ARM_TICKS, MINE_DAMAGE, MINE_DETECT_RADIUS_CELLS,
  deployRejection, clearRejection, isArmed,
} from "./mines.js";
import {
  CAMP_TICKS, DRONE_LIFETIME, DRONE_HIT_INTERVAL, DRONE_DAMAGE,
  DRONE_STATION_CELLS, launchSiteFor, stepDrone,
} from "./drone.js";
import { PING_KINDS, PING_COOLDOWN_TICKS, pingRejection } from "./pings.js";
import {
  createDowned, downedFor, crawlRejection, boardableBy,
  OPERATOR_SPEED, REDEPLOY_TICKS, OPERATOR_AUTO_RETURN_TICKS,
} from "./downed.js";
import {
  towRejection, towedWreck, restoredHp, TOW_SPEED_NUM, TOW_SPEED_DEN, REPAIR_TICKS,
} from "./recovery.js";
import { inOwnBase } from "./supply.js";
import { resolveShot, inFireRange, SUPPRESSION_TICKS } from "./combat.js";
import {
  captureCheck, SITE_NEUTRALIZE_TICKS, SITE_CAPTURE_TICKS,
  SITE_HP_MAX, siteOperational,
} from "./sites.js";
import {
  assetCarries, standardTakeableBy, standardReturnableBy, canScore,
  STD_AT_BASE, STD_CARRIED, STD_DROPPED, STD_SCORED,
  CARRIER_SPEED_NUM, CARRIER_SPEED_DEN, AUTO_RETURN_TICKS,
} from "./standards.js";
import { SUPPLY_FIRE_COST, SUPPLY_MOVE_COST, FUEL_MAX, resupplyAt, inSupply } from "./supply.js";
import { getUnitStats } from "./units.js";
import { computeVisible, sensorRadius, chebyshevCells } from "./los.js";
import {
  checkVictory, dominatingTeam, PHASE_RUNNING, PHASE_OVER,
} from "./victory.js";

// Scoring (3E): what a capture or a kill is worth on the war clock scoreboard.
export const SCORE_CAPTURE = 10;
export const SCORE_DISABLE = 5;
import { speedMultiplier } from "./terrain.js";
import { cellToWorld, worldToCellFloor, absI32, floorDivI32 } from "../shared/fixedmath.js";

export { createInitialState } from "./state.js";
import { fieldSpawnFor } from "./state.js";

// 9D Minimum Playability Guarantee (spec 01 §9, cadence per ruling Q5):
// below this many operable assets, the home base slow-manufactures.
export const MPG_MIN_OPERABLE = 6;
export const MPG_TICKS = 900;

// Tank movement speed in fixed world units per tick before terrain multiplier.
// Kept as the historical export name; per-unit speeds come from units.js (3A).
// Doubled 16->32 after the first LAN playtest ("tank felt slow") — designer's
// sanctioned x2 pace pass; reload times unchanged so combat pace in seconds holds.
export const BASE_SPEED = 32;

function copyState(state) {
  return {
    ...state,
    teamScores: [...state.teamScores],
    operators: state.operators.map((o) => ({ ...o })),
    assets: state.assets.map((a) => ({ ...a })),
    sites: state.sites.map((s) => ({ ...s })),
    standards: state.standards.map((st) => ({ ...st })),
    downed: state.downed.map((d) => ({ ...d })),
    manufacture: [...state.manufacture],
    mines: state.mines.map((m) => ({ ...m })),
    drones: state.drones.map((d) => ({ ...d })),
    events: [],
  };
}

function reject(next, command, reason) {
  next.events.push({ type: "rejected", cmd: command.type, reason });
  return next;
}

function applyJoinOperator(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ABSENT) return reject(next, command, "operator already active");
  operator.state = OP_ACTIVE;
  operator.team = command.team;
  next.events.push({ type: "operator_joined", operatorId: operator.id, team: operator.team });
  return next;
}

function applySelectAsset(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  const asset = next.assets[command.assetId];
  if (!asset) return reject(next, command, "no such asset");
  if (asset.team !== operator.team) return reject(next, command, "asset belongs to other team");
  if (asset.operatorId !== -1 && asset.operatorId !== operator.id) {
    return reject(next, command, "asset already operated");
  }
  // 10B (spec 02 §9): claiming an asset in a consequential state demands an
  // explicit confirmation — you are about to inherit the standard run, a
  // rescue tow, or living passengers.
  if (asset.operatorId === -1 && command.confirm !== true) {
    const consequential =
      assetCarries(next, asset.id) !== null ||
      towedWreck(next, asset.id) !== null ||
      asset.aboard1 !== -1 || asset.aboard2 !== -1;
    if (consequential) return reject(next, command, "takeover needs confirmation");
  }
  if (operator.assetId !== -1 && operator.assetId !== asset.id) {
    const previous = next.assets[operator.assetId];
    if (previous && previous.operatorId === operator.id) previous.operatorId = -1;
  }
  operator.assetId = asset.id;
  asset.operatorId = operator.id;
  next.events.push({ type: "asset_selected", operatorId: operator.id, assetId: asset.id });
  return next;
}

function applyMoveOrder(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const asset = next.assets[operator.assetId];
  if (!asset || asset.operatorId !== operator.id) return reject(next, command, "no asset selected");
  if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  asset.targetX = cellToWorld(command.targetCellX);
  asset.targetY = cellToWorld(command.targetCellY);
  asset.state = ASSET_MOVING;
  next.events.push({
    type: "move_ordered", assetId: asset.id, targetX: asset.targetX, targetY: asset.targetY,
  });
  return next;
}

function applyFireOrder(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const attacker = next.assets[operator.assetId];
  if (!attacker || attacker.operatorId !== operator.id) {
    return reject(next, command, "no asset selected");
  }
  if (attacker.state === ASSET_DISABLED || attacker.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  // 11F (Q9): shelling infrastructure. Sites are public; only the indirect
  // siege tube can breach them; normal ammo/reload/supply/range discipline.
  if (command.targetSiteId !== undefined) {
    const site = next.sites.find((s) => s.id === command.targetSiteId);
    if (!site) return reject(next, command, "no such site");
    if (!getUnitStats(attacker.type).indirect) {
      return reject(next, command, "cannot breach sites");
    }
    if (!siteOperational(site)) return reject(next, command, "site already damaged");
    if (attacker.reloadTimer > 0) return reject(next, command, "reloading");
    if (attacker.ammo < SUPPLY_FIRE_COST) return reject(next, command, "out of ammo");
    if (!inSupply(next, attacker)) return reject(next, command, "out of supply");
    const sitePos = { x: cellToWorld(site.cellX), y: cellToWorld(site.cellY) };
    if (!inFireRange(attacker, sitePos)) return reject(next, command, "target out of range");
    attacker.ammo -= SUPPLY_FIRE_COST;
    attacker.reloadTimer = getUnitStats(attacker.type).reloadTicks;
    site.hp = Math.max(0, site.hp - getUnitStats(attacker.type).damage);
    next.events.push({
      type: "site_shelled", siteId: site.id, byAssetId: attacker.id, siteHp: site.hp,
    });
    if (site.hp === 0) {
      site.captureProgress = 0;
      site.capturingTeam = -1;
      next.events.push({ type: "site_damaged", siteId: site.id });
    }
    return next;
  }
  // 9G: shooting at a drone. Drones are public and airborne: no spotting or
  // LOS gates, but indirect tubes cannot track aircraft, and normal ammo/
  // reload/supply/range discipline still applies. One hit downs it.
  if (command.targetDroneId !== undefined) {
    const drone = next.drones.find((d) => d.id === command.targetDroneId);
    if (!drone) return reject(next, command, "no such drone");
    if (getUnitStats(attacker.type).indirect) {
      return reject(next, command, "cannot track aircraft");
    }
    if (attacker.reloadTimer > 0) return reject(next, command, "reloading");
    if (attacker.ammo < SUPPLY_FIRE_COST) return reject(next, command, "out of ammo");
    if (!inSupply(next, attacker)) return reject(next, command, "out of supply");
    if (!inFireRange(attacker, drone)) return reject(next, command, "target out of range");
    attacker.ammo -= SUPPLY_FIRE_COST;
    attacker.reloadTimer = getUnitStats(attacker.type).reloadTicks;
    next.drones = next.drones.filter((d) => d.id !== drone.id);
    next.events.push({ type: "drone_downed", droneId: drone.id, byAssetId: attacker.id });
    return next;
  }
  const target = next.assets[command.targetAssetId];
  if (!target) return reject(next, command, "no such target");
  if (target.team === attacker.team) return reject(next, command, "friendly target");
  if (target.state === ASSET_DISABLED || target.state === ASSET_SALVAGED) {
    return reject(next, command, "target not operable");
  }
  if (attacker.reloadTimer > 0) return reject(next, command, "reloading");
  if (attacker.ammo < SUPPLY_FIRE_COST) return reject(next, command, "out of ammo");
  if (!inSupply(next, attacker)) return reject(next, command, "out of supply");
  if (!inFireRange(attacker, target)) return reject(next, command, "target out of range");
  // 3D: shots need the target spotted by the team; direct-fire chassis also
  // need it inside their own sensor radius. Indirect (artillery) fires on any
  // team-spotted target — the spotter doctrine.
  if (!computeVisible(next, attacker.team).has(target.id)) {
    return reject(next, command, "target not spotted");
  }
  if (!getUnitStats(attacker.type).indirect &&
      chebyshevCells(attacker, target) > sensorRadius(attacker)) {
    return reject(next, command, "no line of sight");
  }

  attacker.ammo -= SUPPLY_FIRE_COST;
  attacker.reloadTimer = getUnitStats(attacker.type).reloadTicks; // 8E
  const shot = resolveShot(attacker, target);
  target.hp = Math.max(0, target.hp - shot.hpDelta);
  if (shot.suppressed && target.hp > 0) target.suppressedTimer = SUPPRESSION_TICKS;
  next.events.push({
    type: "fire_resolved",
    attackerId: attacker.id,
    targetId: target.id,
    hpDelta: shot.hpDelta,
    targetHp: target.hp,
  });
  if (target.hp === 0) disableAsset(next, target, attacker.team);
  return next;
}

// The one true disablement path — fire (1E) and mine detonations (9E) share
// it so bail-out, tow release, and standard drops can never diverge.
function disableAsset(next, target, scoringTeam) {
  target.state = ASSET_DISABLED;
  next.teamScores[scoringTeam] += SCORE_DISABLE;
  next.events.push({ type: "asset_disabled", assetId: target.id });
  // 9B: the crew bails out as a downed operator (the wreck repairs to
  // uncrewed — the human/AI seat carries on on foot).
  if (target.operatorId !== -1) {
    const seat = next.operators[target.operatorId];
    seat.state = OP_DOWN;
    seat.assetId = -1;
    next.downed.push(createDowned(seat, target));
    next.events.push({ type: "operator_downed", operatorId: seat.id });
    target.operatorId = -1;
  }
  // 8D: a disabled tower releases anything it was towing.
  const inTow = towedWreck(next, target.id);
  if (inTow) inTow.towedBy = -1;
  // 8B: a disabled carrier drops the standard where it died.
  const carried = assetCarries(next, target.id);
  if (carried) {
    carried.status = STD_DROPPED;
    carried.carrierAssetId = -1;
    carried.droppedTimer = 0;
    carried.x = target.x;
    carried.y = target.y;
    next.events.push({ type: "standard_dropped", standardId: carried.id, x: carried.x, y: carried.y });
  }
}

// 11G: per-seat preference; the only option so far is the rescue autopilot.
function applySetOption(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state === OP_ABSENT) return reject(next, command, "operator not active");
  operator.autoRescue = command.value;
  next.events.push({
    type: "option_set", operatorId: operator.id,
    option: command.option, value: command.value,
  });
  return next;
}

// 11G: manual boarding — a downed seat climbs into an adjacent friendly
// carrier with a free bunk, on its own decision.
function applyBoardCarrier(next, command) {
  const operator = next.operators[command.operatorId];
  const down = downedFor(next, command.operatorId);
  if (operator.state !== OP_DOWN || !down) return reject(next, command, "not downed");
  const carrier = next.assets[command.carrierAssetId];
  if (!carrier || getUnitStats(carrier.type).capacity <= 0) {
    return reject(next, command, "not a carrier");
  }
  if (carrier.team !== operator.team) return reject(next, command, "asset belongs to other team");
  if (carrier.state === ASSET_DISABLED || carrier.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  if (carrier.aboard1 !== -1 && carrier.aboard2 !== -1) {
    return reject(next, command, "no bunk free");
  }
  const dist = chebyshevCells(carrier, down);
  if (dist > 1) return reject(next, command, "carrier out of reach");
  if (carrier.aboard1 === -1) carrier.aboard1 = operator.id;
  else carrier.aboard2 = operator.id;
  next.downed = next.downed.filter((d) => d.operatorId !== operator.id);
  next.events.push({
    type: "operator_rescued", operatorId: operator.id, byAssetId: carrier.id,
  });
  return next;
}

// 11G: hop out anywhere — back on foot beside the carrier.
function applyUnboard(next, command) {
  const operator = next.operators[command.operatorId];
  const carrier = next.assets.find(
    (a) => a.aboard1 === command.operatorId || a.aboard2 === command.operatorId
  );
  if (operator.state !== OP_DOWN || !carrier) return reject(next, command, "not aboard");
  if (carrier.aboard1 === operator.id) carrier.aboard1 = -1;
  else carrier.aboard2 = -1;
  next.downed.push(createDowned(operator, carrier));
  next.events.push({ type: "operator_unboarded", operatorId: operator.id, fromAssetId: carrier.id });
  return next;
}

// 10C: a bounded team signal — kind + place, own team only, cooled down.
function applyPing(next, command) {
  const operator = next.operators[command.operatorId];
  if (!PING_KINDS.includes(command.kind)) return reject(next, command, "unknown ping kind");
  const why = pingRejection(operator.state, OP_ACTIVE, OP_DOWN, command.kind);
  if (why) return reject(next, command, why);
  if (next.tick - operator.lastPingTick < PING_COOLDOWN_TICKS) {
    return reject(next, command, "ping cooling down");
  }
  // Where: a downed seat pings its own body; a driving seat pings the
  // target cell if given, else its asset's cell; a seatless active
  // operator (in the garage) must give a target cell.
  let cellX = command.targetCellX;
  let cellY = command.targetCellY;
  if (operator.state === OP_DOWN) {
    const body = downedFor(next, operator.id);
    cellX = worldToCellFloor(body.x);
    cellY = worldToCellFloor(body.y);
  } else if (cellX === undefined || cellY === undefined) {
    const asset = operator.assetId === -1 ? null : next.assets[operator.assetId];
    if (!asset) return reject(next, command, "ping needs a target cell");
    cellX = worldToCellFloor(asset.x);
    cellY = worldToCellFloor(asset.y);
  }
  operator.lastPingTick = next.tick;
  next.events.push({
    type: "ping", toTeam: operator.team, operatorId: operator.id,
    kind: command.kind, cellX, cellY, tick: next.tick,
  });
  return next;
}

// 9E: lay a mine on the asset's own cell (arms after MINE_ARM_TICKS).
function applyDeployMine(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const asset = next.assets[operator.assetId];
  if (!asset || asset.operatorId !== operator.id) {
    return reject(next, command, "no asset selected");
  }
  if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  const why = deployRejection(next, asset, getUnitStats(asset.type), cellX, cellY);
  if (why) return reject(next, command, why);
  asset.minesLeft -= 1;
  next.mines.push({
    id: next.nextMineId, team: asset.team, cellX, cellY,
    armTimer: MINE_ARM_TICKS, marked: 0,
  });
  next.nextMineId += 1;
  // Fog safety: the event names no coordinates — positions travel only in
  // the owning team's view.
  next.events.push({
    type: "mine_deployed", assetId: asset.id, team: asset.team,
    minesLeft: asset.minesLeft,
  });
  return next;
}

// 9E: a truck defuses an adjacent mine it legitimately knows about.
function applyClearMine(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const asset = next.assets[operator.assetId];
  if (!asset || asset.operatorId !== operator.id) {
    return reject(next, command, "no asset selected");
  }
  if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  const mine = next.mines.find((m) => m.id === command.mineId);
  if (!mine) return reject(next, command, "no such mine");
  const dist = chebyshevCells(asset, { x: cellToWorld(mine.cellX), y: cellToWorld(mine.cellY) });
  const why = clearRejection(asset, getUnitStats(asset.type), mine, dist);
  if (why) return reject(next, command, why);
  next.mines = next.mines.filter((m) => m.id !== mine.id);
  next.events.push({ type: "mine_cleared", mineId: mine.id, assetId: asset.id });
  return next;
}

function applyCrawlOrder(next, command) {
  const downed = downedFor(next, command.operatorId);
  const why = crawlRejection(downed, command.targetCellX, command.targetCellY);
  if (why) return reject(next, command, why);
  downed.targetX = cellToWorld(command.targetCellX);
  downed.targetY = cellToWorld(command.targetCellY);
  next.events.push({
    type: "crawl_ordered", operatorId: downed.operatorId,
    targetX: downed.targetX, targetY: downed.targetY,
  });
  return next;
}

function freeSeat(next, operatorId, eventType, extra = {}) {
  const seat = next.operators[operatorId];
  seat.state = OP_ACTIVE;
  seat.assetId = -1;
  next.downed = next.downed.filter((d) => d.operatorId !== operatorId);
  next.events.push({ type: eventType, operatorId, ...extra });
}

function applyRedeploy(next, command) {
  const downed = downedFor(next, command.operatorId);
  if (!downed) return reject(next, command, "not downed");
  if (downed.downTicks < REDEPLOY_TICKS) return reject(next, command, "still recovering nerve");
  freeSeat(next, command.operatorId, "operator_redeployed");
  return next;
}

function applyTowOrder(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const tower = next.assets[operator.assetId];
  if (!tower || tower.operatorId !== operator.id) return reject(next, command, "no asset selected");
  if (tower.state === ASSET_DISABLED || tower.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  const wreck = next.assets[command.wreckAssetId];
  const why = towRejection(next, tower, wreck);
  if (why) return reject(next, command, why);

  wreck.towedBy = tower.id;
  next.events.push({ type: "tow_started", assetId: wreck.id, by: tower.id });
  return next;
}

// 9F: heading-based movement. Headings are brads (0-255, 0 = +x east,
// 64 = +y south). Vehicles pivot in place toward the bearing (per-chassis
// turnRate brads/tick), then drive along one of 16 fixed directions with a
// fixed-point velocity table. Pure integer math.
const DIR_COS = [256, 237, 181, 98, 0, -98, -181, -237, -256, -237, -181, -98, 0, 98, 181, 237];
const DIR_SIN = [0, 98, 181, 237, 256, 237, 181, 98, 0, -98, -181, -237, -256, -237, -181, -98];

// Sector 0..15 of the vector (dx, dy) using rational tan boundaries.
function bearing16(dx, dy) {
  const ax = absI32(dx);
  const ay = absI32(dy);
  // Octant sectors via |dy|/|dx| against tan(11.25/33.75/56.25/78.75) deg.
  let sector;
  if (ay * 256 <= ax * 51) sector = 0;
  else if (ay * 256 <= ax * 171) sector = 1;
  else if (ax * 256 > ay * 171) sector = 2;
  else if (ax * 256 > ay * 51) sector = 3;
  else sector = 4;
  // Map octant sector to the full 16 directions by quadrant.
  let dir;
  if (dx >= 0 && dy >= 0) dir = sector;              // E..S
  else if (dx < 0 && dy >= 0) dir = 8 - sector;      // S..W
  else if (dx < 0 && dy < 0) dir = 8 + sector;       // W..N
  else dir = (16 - sector) % 16;                     // N..E
  return dir;
}

function turnToward(heading, desiredBrads, turnRate) {
  let diff = (desiredBrads - heading) & 255;
  if (diff > 128) diff -= 256; // shortest arc in [-128, 127]
  if (absI32(diff) <= turnRate) return desiredBrads;
  return (heading + (diff > 0 ? turnRate : -turnRate)) & 255;
}

function stepAsset(asset, map, supplied, carrying, towing) {
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  if (cellX < 0 || cellX >= map.width || cellY < 0 || cellY >= map.height) return;

  const stats = getUnitStats(asset.type);
  const terrain = map.cells[cellY * map.width + cellX];
  let step = floorDivI32(stats.speed * speedMultiplier(terrain), 256);
  if (!supplied) step = floorDivI32(step, 2); // out of supply: half speed (3B)
  if (carrying) step = floorDivI32(step * CARRIER_SPEED_NUM, CARRIER_SPEED_DEN); // 8B
  if (towing) step = floorDivI32(step * TOW_SPEED_NUM, TOW_SPEED_DEN); // 8D
  if (step <= 0) return;

  const dx = asset.targetX - asset.x;
  const dy = asset.targetY - asset.y;

  // Close enough: snap and stop (prevents orbiting a near target).
  if (absI32(dx) + absI32(dy) <= step) {
    asset.x = asset.targetX;
    asset.y = asset.targetY;
    asset.state = ASSET_IDLE;
    return;
  }

  const desired = bearing16(dx, dy) * 16;
  asset.heading = turnToward(asset.heading, desired, stats.turnRate);

  // Facing too far off the bearing: pivot in place this tick.
  let off = (desired - asset.heading) & 255;
  if (off > 128) off = 256 - off;
  if (off > 32) return;

  const dir = (floorDivI32(asset.heading + 8, 16)) & 15;
  asset.x += floorDivI32(step * DIR_COS[dir], 256);
  asset.y += floorDivI32(step * DIR_SIN[dir], 256);

  if (asset.x === asset.targetX && asset.y === asset.targetY) {
    asset.state = ASSET_IDLE;
  }
}

function applyAdvanceTick(next) {
  next.tick += 1;
  // A finished war only counts time; nothing moves, fights, or captures.
  if (next.phase === PHASE_OVER) return next;
  for (const asset of next.assets) {
    if (asset.suppressedTimer > 0) asset.suppressedTimer -= 1;
    if (asset.reloadTimer > 0) asset.reloadTimer -= 1; // 8E
    if (asset.state !== ASSET_MOVING) continue;
    if (asset.fuel < SUPPLY_MOVE_COST) continue; // stranded until resupplied
    const beforeX = asset.x;
    const beforeY = asset.y;
    stepAsset(
      asset, next.map, inSupply(next, asset),
      assetCarries(next, asset.id) !== null,
      towedWreck(next, asset.id) !== null
    );
    if (asset.x !== beforeX || asset.y !== beforeY) asset.fuel -= SUPPLY_MOVE_COST;
  }
  // 9E mines: arm, then scout detection, then detonation on enemy entry.
  for (const mine of next.mines) {
    if (mine.armTimer > 0) mine.armTimer -= 1;
    if (mine.marked === 1) continue;
    const spotted = next.assets.some(
      (a) => a.team !== mine.team &&
        getUnitStats(a.type).name === "scout" &&
        a.state !== ASSET_DISABLED && a.state !== ASSET_SALVAGED &&
        chebyshevCells(a, { x: cellToWorld(mine.cellX), y: cellToWorld(mine.cellY) }) <=
          MINE_DETECT_RADIUS_CELLS
    );
    if (spotted) {
      mine.marked = 1;
      next.events.push({ type: "mine_marked", mineId: mine.id });
    }
  }
  if (next.mines.length > 0) {
    const detonated = new Set();
    for (const mine of next.mines) {
      if (!isArmed(mine)) continue;
      const victim = next.assets.find(
        (a) => a.team !== mine.team &&
          a.state !== ASSET_DISABLED && a.state !== ASSET_SALVAGED &&
          worldToCellFloor(a.x) === mine.cellX && worldToCellFloor(a.y) === mine.cellY
      );
      if (!victim) continue;
      detonated.add(mine.id);
      victim.hp = Math.max(0, victim.hp - MINE_DAMAGE);
      next.events.push({
        type: "mine_detonated", mineId: mine.id, assetId: victim.id,
        cellX: mine.cellX, cellY: mine.cellY, targetHp: victim.hp,
      });
      if (victim.hp === 0) {
        disableAsset(next, victim, mine.team);
      } else {
        victim.suppressedTimer = SUPPRESSION_TICKS;
      }
    }
    if (detonated.size > 0) next.mines = next.mines.filter((m) => !detonated.has(m.id));
  }

  // 9G flight runs BEFORE launches: a fresh drone sits on its pad for
  // one tick (deterministic spawn position, no same-tick teleport).
  if (next.drones.length > 0) {
    const gone = new Set();
    for (const drone of next.drones) {
      drone.ageTicks += 1;
      const target = next.assets[drone.targetAssetId];
      // Recall: endurance spent, target gone/moving/back in supply — the
      // counterplay is simply to stop camping.
      if (
        drone.ageTicks >= DRONE_LIFETIME ||
        !target || target.state === ASSET_DISABLED || target.state === ASSET_SALVAGED ||
        target.state === ASSET_MOVING || inSupply(next, target)
      ) {
        gone.add(drone.id);
        next.events.push({ type: "drone_recalled", droneId: drone.id });
        continue;
      }
      stepDrone(drone, target.x, target.y);
      if (chebyshevCells(drone, target) > DRONE_STATION_CELLS) {
        drone.hitTimer = 0;
        continue;
      }
      drone.hitTimer += 1;
      if (drone.hitTimer < DRONE_HIT_INTERVAL) continue;
      drone.hitTimer = 0;
      target.hp = Math.max(0, target.hp - DRONE_DAMAGE);
      next.events.push({
        type: "drone_hit", droneId: drone.id, assetId: target.id, targetHp: target.hp,
      });
      if (target.hp === 0) disableAsset(next, target, drone.team);
    }
    if (gone.size > 0) next.drones = next.drones.filter((d) => !gone.has(d.id));
  }  // 9G anti-camping: idling outside your own supply umbrella draws a drone
  // from the enemy's nearest owned relay.
  for (const asset of next.assets) {
    if (asset.state === ASSET_IDLE && !inSupply(next, asset)) {
      asset.campTicks += 1;
    } else {
      asset.campTicks = 0;
    }
    if (asset.campTicks < CAMP_TICKS) continue;
    asset.campTicks = 0; // pay the toll, restart the clock
    if (next.drones.some((d) => d.targetAssetId === asset.id)) continue;
    const pad = launchSiteFor(next, asset, chebyshevCells);
    if (!pad) continue; // enemy owns no relay — nowhere to launch from
    next.drones.push({
      id: next.nextDroneId, team: asset.team === 0 ? 1 : 0,
      x: cellToWorld(pad.cellX), y: cellToWorld(pad.cellY),
      targetAssetId: asset.id, ageTicks: 0, hitTimer: 0,
    });
    next.nextDroneId += 1;
    next.events.push({
      type: "drone_launched", droneId: next.nextDroneId - 1,
      targetAssetId: asset.id, siteId: pad.id,
    });
  }

  // Anti-deadlock (9A): a standard left dropped long enough returns home.
  for (const st of next.standards) {
    if (st.status !== STD_DROPPED) continue;
    st.droppedTimer += 1;
    if (st.droppedTimer >= AUTO_RETURN_TICKS) {
      st.status = STD_AT_BASE;
      st.carrierAssetId = -1;
      st.droppedTimer = 0;
      st.x = cellToWorld(st.homeCellX);
      st.y = cellToWorld(st.homeCellY);
      next.events.push({ type: "standard_returned", standardId: st.id, team: st.team, auto: true });
    }
  }
  // Carried standards ride with their carriers (8B); towed wrecks follow (8D).
  for (const st of next.standards) {
    if (st.status !== STD_CARRIED) continue;
    const carrier = next.assets[st.carrierAssetId];
    if (carrier) { st.x = carrier.x; st.y = carrier.y; }
  }
  for (const wreck of next.assets) {
    if (wreck.towedBy === -1) continue;
    const tower = next.assets[wreck.towedBy];
    if (tower) { wreck.x = tower.x; wreck.y = tower.y; }
  }
  // Capture pass: stable asset order decides same-tick contests.
  // 11B capture pass: BF2-style countdown. Contested = frozen; empty =
  // progress drains; a lone team neutralizes the enemy flag, then raises
  // its own. Stable site order; team presence from operable assets only.
  {
    const present = new Map(); // siteId -> bitmask of teams standing on it
    for (const asset of next.assets) {
      const site = captureCheck(next, asset.id);
      if (site) present.set(site.id, (present.get(site.id) ?? 0) | (1 << asset.team));
    }
    for (const site of next.sites) {
      if (!siteOperational(site)) continue; // 11F: dead ground cannot flip
      const mask = present.get(site.id) ?? 0;
      if (mask === 0 || mask === 3) { // empty or contested: no flip, drain/freeze
        if (mask === 0 && site.captureProgress > 0) site.captureProgress -= 1;
        if (mask === 0 && site.captureProgress === 0) site.capturingTeam = -1;
        continue;
      }
      const team = mask === 1 ? 0 : 1;
      if (site.owner === team) { // securing your own ground heals the clock
        if (site.captureProgress > 0) site.captureProgress -= 1;
        if (site.captureProgress === 0) site.capturingTeam = -1;
        continue;
      }
      if (site.capturingTeam !== team) {
        site.capturingTeam = team;
        site.captureProgress = 0;
      }
      site.captureProgress += 1;
      if (site.owner !== -1 && site.captureProgress >= SITE_NEUTRALIZE_TICKS) {
        site.owner = -1;
        site.captureProgress = 0;
        next.events.push({ type: "site_neutralized", siteId: site.id, byTeam: team });
      } else if (site.owner === -1 && site.captureProgress >= SITE_CAPTURE_TICKS) {
        site.owner = team;
        site.captureProgress = 0;
        site.capturingTeam = -1;
        next.teamScores[team] += SCORE_CAPTURE;
        next.events.push({ type: "site_captured", siteId: site.id, team });
      }
    }
  }
  // Standard pass (8B): pickups, returns, then scoring — stable asset order.
  for (const asset of next.assets) {
    const takeable = standardTakeableBy(next, asset);
    if (takeable) {
      takeable.status = STD_CARRIED;
      takeable.carrierAssetId = asset.id;
      takeable.droppedTimer = 0;
      takeable.x = asset.x;
      takeable.y = asset.y;
      next.events.push({
        type: "standard_taken", standardId: takeable.id, assetId: asset.id, byTeam: asset.team,
      });
    }
    const returnable = standardReturnableBy(next, asset);
    if (returnable) {
      returnable.status = STD_AT_BASE;
      returnable.carrierAssetId = -1;
      returnable.droppedTimer = 0;
      returnable.x = cellToWorld(returnable.homeCellX);
      returnable.y = cellToWorld(returnable.homeCellY);
      next.events.push({ type: "standard_returned", standardId: returnable.id, team: asset.team });
    }
  }
  for (const st of next.standards) {
    if (st.status !== STD_CARRIED) continue;
    const carrier = next.assets[st.carrierAssetId];
    if (carrier && canScore(next, carrier)) {
      st.status = STD_SCORED;
      st.carrierAssetId = -1;
      next.events.push({ type: "standard_scored", standardId: st.id, byTeam: carrier.team });
    }
  }

  // Downed-operator pass (9B): crawl, count, board carriers, deliver.
  for (const d of [...next.downed]) {
    d.downTicks += 1;
    // Crawl toward target, axis-major at foot speed. No heading for feet.
    let ddx = d.targetX - d.x;
    let ddy = d.targetY - d.y;
    let remaining = OPERATOR_SPEED;
    if (absI32(ddx) >= absI32(ddy)) {
      const mx = Math.min(absI32(ddx), remaining);
      d.x += ddx < 0 ? -mx : mx; remaining -= mx;
      const my = Math.min(absI32(ddy), remaining);
      d.y += ddy < 0 ? -my : my;
    } else {
      const my = Math.min(absI32(ddy), remaining);
      d.y += ddy < 0 ? -my : my; remaining -= my;
      const mx = Math.min(absI32(ddx), remaining);
      d.x += ddx < 0 ? -mx : mx;
    }
    if (d.downTicks >= OPERATOR_AUTO_RETURN_TICKS) {
      freeSeat(next, d.operatorId, "operator_returned", { auto: true });
    }
  }
  // Carrier boarding: adjacent friendly downed operators climb aboard.
  for (const carrier of next.assets) {
    if (getUnitStats(carrier.type).capacity <= 0) continue;
    if (carrier.state === ASSET_DISABLED || carrier.state === ASSET_SALVAGED) continue;
    let bunkable = boardableBy(next, carrier);
    while (bunkable) {
      if (carrier.aboard1 === -1) carrier.aboard1 = bunkable.operatorId;
      else carrier.aboard2 = bunkable.operatorId;
      next.downed = next.downed.filter((d) => d.operatorId !== bunkable.operatorId);
      next.events.push({
        type: "operator_rescued", operatorId: bunkable.operatorId, byAssetId: carrier.id,
      });
      bunkable = boardableBy(next, carrier);
    }
  }
  // Delivery: an idle carrier in its own base unloads everyone aboard.
  for (const carrier of next.assets) {
    if (carrier.aboard1 === -1 && carrier.aboard2 === -1) continue;
    if (carrier.state !== ASSET_IDLE || !inOwnBase(next, carrier)) continue;
    for (const slot of ["aboard1", "aboard2"]) {
      const operatorId = carrier[slot];
      if (operatorId === -1) continue;
      carrier[slot] = -1;
      const seat = next.operators[operatorId];
      seat.state = OP_ACTIVE;
      seat.assetId = -1;
      next.events.push({ type: "operator_delivered", operatorId });
    }
  }

  // Recovery pass (8D): a towed wreck reaching its own base enters the
  // repair bay; timers count down; repaired assets return at half hull.
  for (const wreck of next.assets) {
    if (wreck.towedBy !== -1 && inOwnBase(next, wreck)) {
      wreck.towedBy = -1;
      wreck.recoverTimer = REPAIR_TICKS;
      next.events.push({ type: "recovery_started", assetId: wreck.id });
    }
    if (wreck.recoverTimer > 0) {
      wreck.recoverTimer -= 1;
      if (wreck.recoverTimer === 0) {
        wreck.state = ASSET_IDLE;
        wreck.hp = restoredHp(wreck.type);
        wreck.targetX = wreck.x;
        wreck.targetY = wreck.y;
        next.events.push({ type: "asset_restored", assetId: wreck.id });
      }
    }
  }

  // Slow Manufacture pass (9D): a depleted team rebuilds its oldest wreck
  // at the original spawn — a losing side can always field something.
  for (const team of [0, 1]) {
    const operable = next.assets.filter(
      (a) => a.team === team && a.state !== ASSET_DISABLED && a.state !== ASSET_SALVAGED
    ).length;
    if (operable >= MPG_MIN_OPERABLE) {
      next.manufacture[team] = 0;
      continue;
    }
    if (next.manufacture[team] < MPG_TICKS) next.manufacture[team] += 1;
    if (next.manufacture[team] < MPG_TICKS) continue;
    const wreck = next.assets.find(
      (a) => a.team === team &&
        (a.state === ASSET_DISABLED || a.state === ASSET_SALVAGED) &&
        a.towedBy === -1 && a.recoverTimer === 0
    );
    if (!wreck) continue; // hold at threshold until a hull is available
    const spawn = fieldSpawnFor(wreck.id);
    wreck.state = ASSET_IDLE;
    wreck.hp = floorDivI32(getUnitStats(wreck.type).hp, 2);
    wreck.x = cellToWorld(spawn.cellX);
    wreck.y = cellToWorld(spawn.cellY);
    wreck.targetX = wreck.x;
    wreck.targetY = wreck.y;
    wreck.heading = team === 1 ? 128 : 0;
    wreck.operatorId = -1;
    wreck.suppressedTimer = 0;
    wreck.reloadTimer = 0;
    wreck.ammo = 12;
    wreck.fuel = FUEL_MAX;
    next.manufacture[team] = 0;
    next.events.push({ type: "asset_manufactured", assetId: wreck.id, team });
  }

  // 11F materiel pass: an idle truck in its own base takes on one repair
  // load; a truck carrying materiel next to a damaged own/neutral site
  // spends it — the site comes back at full strength.
  for (const asset of next.assets) {
    if (!getUnitStats(asset.type).canTow) continue;
    if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) continue;
    if (asset.materiel === 0 && asset.state === ASSET_IDLE && inOwnBase(next, asset)) {
      asset.materiel = 1; // silent, like breathing — the crate is just there
      continue;
    }
    if (asset.materiel !== 1) continue;
    const cx = worldToCellFloor(asset.x);
    const cy = worldToCellFloor(asset.y);
    const site = next.sites.find((s) =>
      !siteOperational(s) && s.owner !== (asset.team === 0 ? 1 : 0) &&
      Math.max(Math.abs(s.cellX - cx), Math.abs(s.cellY - cy)) <= 1);
    if (site) {
      site.hp = SITE_HP_MAX;
      asset.materiel = 0;
      next.events.push({ type: "site_repaired", siteId: site.id, byAssetId: asset.id });
    }
  }

  // Resupply pass: standing in your own base restores ammo and fuel.
  for (const asset of next.assets) {
    const restored = resupplyAt(next, asset.id);
    if (restored) {
      asset.ammo = restored.ammo;
      asset.fuel = restored.fuel;
      next.events.push({ type: "resupplied", assetId: asset.id });
    }
  }
  // Victory pass (3E): track domination hold, then check every condition.
  const dominator = dominatingTeam(next);
  if (dominator === -1) {
    next.dominationTeam = -1;
    next.dominationTicks = 0;
  } else if (dominator === next.dominationTeam) {
    next.dominationTicks += 1;
  } else {
    next.dominationTeam = dominator;
    next.dominationTicks = 1;
  }
  const verdict = checkVictory(next);
  if (verdict) {
    next.phase = PHASE_OVER;
    next.winner = verdict.winner;
    next.winReason = verdict.reason;
    next.events.push({ type: "game_over", winner: verdict.winner, reason: verdict.reason });
  }
  return next;
}

export function apply(state, command) {
  const next = copyState(state);
  const verdict = validate(command);
  if (!verdict.ok) {
    next.events.push({ type: "rejected", cmd: command?.type ?? "?", reason: verdict.reason });
    return next;
  }

  if (next.phase === PHASE_OVER && command.type !== CMD_ADVANCE_TICK) {
    return reject(next, command, "war is over");
  }

  switch (command.type) {
    case CMD_ADVANCE_TICK: return applyAdvanceTick(next);
    case CMD_JOIN_OPERATOR: return applyJoinOperator(next, command);
    case CMD_SELECT_ASSET: return applySelectAsset(next, command);
    case CMD_MOVE_ORDER: return applyMoveOrder(next, command);
    case CMD_FIRE_ORDER: return applyFireOrder(next, command);
    case CMD_TOW_ORDER: return applyTowOrder(next, command);
    case CMD_CRAWL_ORDER: return applyCrawlOrder(next, command);
    case CMD_PING: return applyPing(next, command);
    case CMD_SET_OPTION: return applySetOption(next, command);
    case CMD_BOARD_CARRIER: return applyBoardCarrier(next, command);
    case CMD_UNBOARD: return applyUnboard(next, command);
    case CMD_DEPLOY_MINE: return applyDeployMine(next, command);
    case CMD_CLEAR_MINE: return applyClearMine(next, command);
    case CMD_REDEPLOY: return applyRedeploy(next, command);
    case CMD_CALL_MEDIC: // recognized but inert until the medic milestone
    case CMD_RESPAWN:
      return next;
    default:
      return reject(next, command, `unknown command type: ${command.type}`);
  }
}
