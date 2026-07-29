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
  CMD_SET_OPTION, CMD_BOARD_CARRIER, CMD_UNBOARD, CMD_DRIVE,
  CMD_DEPLOY_HARDPOINT, CMD_UNDEPLOY, CMD_TRANSFER_CARGO,
  CMD_CALL_MEDIC, CMD_RESPAWN, CMD_SATCHEL, validate,
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
  BRIDGE_HP_MAX, bridgeSpans, bridgeIntact, adjacentToBridge, applyBridgeTerrain,
} from "./bridges.js";
import {
  DROP_HOLD_TICKS, DROP_RADIUS_CELLS, DROP_TICKET_PACKET, dropActive, dropWorld,
} from "./drops.js";
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
import {
  SUPPLY_FIRE_COST, SUPPLY_MOVE_COST, FUEL_MAX, AMMO_MAX,
  CARGO_FUEL_MAX, CARGO_AMMO_MAX, resupplyAt, inSupply,
} from "./supply.js";
import { getUnitStats } from "./units.js";
import { computeVisible, sensorRadius, chebyshevCells, weatherWindow } from "./los.js";
import {
  checkVictory, dominatingTeam, PHASE_RUNNING, PHASE_OVER,
} from "./victory.js";

// Scoring (3E): what a capture or a kill is worth on the war clock scoreboard.
export const SCORE_CAPTURE = 10;
export const SCORE_DISABLE = 5;

// 11K Recognition scoring (prompt 19): per-OPERATOR credit for verified
// reducer facts. Rescue work outranks kills by design (spec 04 §4).
// Item 34: a bounded queue keeps hashed state small and stops a script
// from stuffing the world with legs.
export const MAX_WAYPOINTS = 8;
export const RECOG_TOW = 8;
// A field patch is support work below a full recovery: it keeps someone
// fighting, it does not bring a wreck back.
export const RECOG_FIELD_REPAIR = 4;
export const RECOG_RESCUE = 10;
export const RECOG_STANDARD_RETURN = 10;
export const RECOG_STANDARD_CAPTURE = 25;
export const RECOG_RELAY = 10;
export const RECOG_KILL = 5;

// B4: deed categories — indices into operator.deeds. The counters are
// hashed state (they decide end-of-war honors), so the order is a
// contract: append only, never reorder.
export const DEED_KILL = 0;
export const DEED_TOW = 1;
export const DEED_RESCUE = 2;
export const DEED_RELAY = 3;
export const DEED_STD_RETURN = 4;
export const DEED_STD_CAPTURE = 5;
export const DEED_FIELD_REPAIR = 6;
export const DEED_ESCORT = 7; // Q26 ruling: escorts get seen too
// Escort pay sits at field-repair level: guarding a payoff is support
// work, and it can fan out to several hulls at once.
export const RECOG_ESCORT = 4;
export const ESCORT_RADIUS_CELLS = 6;
// B6: securing the neutral drop pays each crew on the spot. Points
// only, no deed column — it is a windfall, not a category of service.
export const RECOG_DROP = 5;

function awardOperator(next, operatorId, points, deed = -1) {
  if (operatorId === -1 || operatorId === undefined) return;
  const seat = next.operators[operatorId];
  if (!seat) return;
  seat.score += points;
  if (deed >= 0) seat.deeds[deed] += 1; // B4
}

// Q26: the guards get paid when the thing they guarded succeeds — every
// crewed, operable friendly within reach of the actor at the payoff
// moment (a field rescue, the standard coming home), never the actor
// itself. Event-driven and rare (~3-4/war), so it cannot be farmed by
// idling next to a carrier.
function awardEscorts(next, actor) {
  for (const a of next.assets) {
    if (a.id === actor.id || a.team !== actor.team || a.operatorId === -1) continue;
    if (a.state === ASSET_DISABLED || a.state === ASSET_SALVAGED) continue;
    if (chebyshevCells(a, actor) > ESCORT_RADIUS_CELLS) continue;
    awardOperator(next, a.operatorId, RECOG_ESCORT, DEED_ESCORT);
  }
}
import { speedMultiplier } from "./terrain.js";
import { cellToWorld, worldToCellFloor, absI32, floorDivI32, truncDivI32 } from "../shared/fixedmath.js";

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

// 15/15F respawn law (prompt-53 rulings): forced respawn frees the seat
// after a countdown; the abandoned hull SELF-RECALLS (auto-wrecks after
// 60 s uncrewed in the field — towable, no permanent litter); carrier
// field-respawn is gated by a per-operator cooldown.
export const RESPAWN_TICKS = 100;                 // 10 s countdown
export const ABANDON_RECALL_TICKS = 600;          // 60 s to self-recall
export const CARRIER_SPAWN_COOLDOWN_TICKS = 300;  // 30 s per operator

function copyState(state) {
  return {
    ...state,
    teamScores: [...state.teamScores],
    // deeds is nested MUTABLE state (awardOperator writes in place) —
    // without its own copy, every historical snapshot shares one array
    // and a backward replay scrub reads the future. 11H caught this.
    operators: state.operators.map((o) => ({ ...o, deeds: o.deeds ? [...o.deeds] : o.deeds })),
    // waypoints: same aliasing trap as deeds (push/shift write in place).
    assets: state.assets.map((a) => ({ ...a, waypoints: a.waypoints ? [...a.waypoints] : a.waypoints })),
    sites: state.sites.map((s) => ({ ...s })),
    standards: state.standards.map((st) => ({ ...st })),
    downed: state.downed.map((d) => ({ ...d })),
    tickets: state.tickets ? [...state.tickets] : state.tickets, // 13H
    drops: (state.drops ?? []).map((d) => ({ ...d })), // B6
    // bridges were the THIRD instance of the shared-nested-object trap
    // (bridge.hp writes in place) — found while adding drops, latent
    // since 13E because only riverline has spans.
    bridges: (state.bridges ?? []).map((b) => ({ ...b })),
    rules: { ...state.rules }, // 13F
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
  if ((operator.respawnTicks ?? 0) > 0) return reject(next, command, "respawning");
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
  asset.abandonTimer = 0; // re-crewed in time — the recall clock stops (15)
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
  if (asset.deployed === 1 || asset.deployTimer > 0) {
    return reject(next, command, "deployed — undeploy to move"); // 12B
  }
  // Item 34: shift-click / long-press QUEUES a leg instead of replacing
  // the route. A plain order always clears the queue, so the normal
  // click keeps meaning exactly what it always meant.
  const legX = cellToWorld(command.targetCellX);
  const legY = cellToWorld(command.targetCellY);
  if (command.queue === true) {
    asset.waypoints = asset.waypoints ?? [];
    if (asset.waypoints.length >= MAX_WAYPOINTS) {
      return reject(next, command, "waypoint queue full");
    }
    if (asset.state === ASSET_MOVING) {
      // Already under way: this becomes a later leg.
      asset.waypoints.push({ x: legX, y: legY });
      next.events.push({
        type: "waypoint_queued", assetId: asset.id,
        targetX: legX, targetY: legY, queued: asset.waypoints.length,
      });
      return next;
    }
    // Standing still: the first queued leg IS the current one.
  } else {
    asset.waypoints = [];
  }
  asset.targetX = legX;
  asset.targetY = legY;
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
  if (attacker.deployTimer > 0) return reject(next, command, "still transitioning"); // 12B
  // 11F (Q9): shelling infrastructure. Sites are public; only the indirect
  // siege tube can breach them; normal ammo/reload/supply/range discipline.
  if (command.targetSiteId !== undefined) {
    const site = next.sites.find((s) => s.id === command.targetSiteId);
    if (!site) return reject(next, command, "no such site");
    if (!getUnitStats(attacker.type).siege) { // 11R: explicit, artillery-only
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
  // 13E: dropping a bridge. Same discipline as shelling a relay — only
  // the siege tube can do it, and ammo/reload/supply/range all apply.
  // Bridges are public: no spotting gate, they do not move.
  if (command.targetBridgeId !== undefined) {
    const bridge = (next.bridges ?? []).find((b) => b.id === command.targetBridgeId);
    if (!bridge) return reject(next, command, "no such bridge");
    if (!getUnitStats(attacker.type).siege) {
      return reject(next, command, "cannot breach bridges");
    }
    if (!bridgeIntact(bridge)) return reject(next, command, "bridge already down");
    if (attacker.reloadTimer > 0) return reject(next, command, "reloading");
    if (attacker.ammo < SUPPLY_FIRE_COST) return reject(next, command, "out of ammo");
    if (!inSupply(next, attacker)) return reject(next, command, "out of supply");
    const span = bridgeSpans(next.mapProfile)[bridge.id];
    const spanPos = {
      x: cellToWorld((span.cols[0] + span.cols[1]) >> 1),
      y: cellToWorld((span.rows[0] + span.rows[1]) >> 1),
    };
    if (!inFireRange(attacker, spanPos)) return reject(next, command, "target out of range");
    attacker.ammo -= SUPPLY_FIRE_COST;
    attacker.reloadTimer = getUnitStats(attacker.type).reloadTicks;
    bridge.hp = Math.max(0, bridge.hp - getUnitStats(attacker.type).damage);
    next.events.push({
      type: "bridge_shelled", bridgeId: bridge.id, byAssetId: attacker.id, bridgeHp: bridge.hp,
    });
    if (bridge.hp === 0) {
      // The span becomes WATER: heavy hulls ford it in misery, the
      // amphibious Skimmer crosses at speed (specs/11).
      applyBridgeTerrain(next.map, next.mapProfile, bridge.id, false);
      next.events.push({ type: "bridge_breached", bridgeId: bridge.id, byAssetId: attacker.id });
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
  if (target.hp === 0) {
    disableAsset(next, target, attacker.team, {
      kind: "asset", byType: attacker.type,
      dir: compassOctant(attacker.x - target.x, attacker.y - target.y),
    });
    awardOperator(next, attacker.operatorId, RECOG_KILL, DEED_KILL); // 11K
  }
  return next;
}

// B1 (meaningful deaths, designer eval #35): a wreck costs the owning
// team ONE ticket, and recovering it gives that ticket back. Deaths were
// free before this, which left the rescue economy thematically central
// but mechanically optional; now every tow visibly saves the war and the
// two identities of this game finally pull on the same rope.
//
// The ledger is exactly balanced by construction - every transition INTO
// a wreck charges, every restore refunds - so no per-asset bookkeeping
// (and no fixture repin) is needed. Clamped at both ends: a pool cannot
// go negative, and a refund cannot mint tickets above the starting pool.
function chargeWreckTicket(next, team) {
  if (!next.tickets || team !== 0 && team !== 1) return;
  const cost = next.rules?.ticketPerDisable ?? 1;
  if (cost <= 0) return;
  next.tickets[team] = Math.max(0, next.tickets[team] - cost);
}

function refundWreckTicket(next, team) {
  if (!next.tickets || team !== 0 && team !== 1) return;
  const cost = next.rules?.ticketPerDisable ?? 1;
  if (cost <= 0) return;
  const ceiling = next.rules?.ticketPool ?? 300;
  next.tickets[team] = Math.min(ceiling, next.tickets[team] + cost);
}

// B7 death recap: coarse 8-way bearing from the victim to its killer.
// 0=N 1=NE 2=E 3=SE 4=S 5=SW 6=W 7=NW; -1 = no bearing (a mine is under
// your own tracks). +y is SOUTH (screen convention). Integer-only.
export function compassOctant(dx, dy) {
  if (dx === 0 && dy === 0) return -1;
  const ax = absI32(dx);
  const ay = absI32(dy);
  if (ax >= 2 * ay) return dx > 0 ? 2 : 6;
  if (ay >= 2 * ax) return dy > 0 ? 4 : 0;
  if (dx > 0) return dy > 0 ? 3 : 1;
  return dy > 0 ? 5 : 7;
}

// The one true disablement path — fire (1E) and mine detonations (9E) share
// it so bail-out, tow release, and standard drops can never diverge.
// B7: `by` names the killer for the death recap — {kind, byType?, dir?}.
// The event always carries the same shape (by/byType/dir) so consumers
// never branch on payload presence; events are not hashed and the 1A
// script contains no disables, so this enrichment needs no repin.
function disableAsset(next, target, scoringTeam, by = null) {
  target.state = ASSET_DISABLED;
  target.driveThrottle = 0;
  target.driveTurn = 0; // 11L: a wreck holds no wheel
  target.deployed = 0;
  target.deployTimer = 0; // 12B: wrecked legs fold
  next.teamScores[scoringTeam] += SCORE_DISABLE;
  chargeWreckTicket(next, target.team); // B1
  next.events.push({
    type: "asset_disabled", assetId: target.id,
    by: by?.kind ?? "unknown", byType: by?.byType ?? -1, dir: by?.dir ?? -1,
  });
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
  // Playtest-9 item 35: a disabled carrier RELEASES ITS PASSENGERS. They
  // bail out on foot exactly like the crew — which is both the rescue
  // fantasy (the van is gone, the people in it are not) and the fix for
  // a genuine stranding: passengers used to stay marked aboard a WRECK
  // forever, so "centre on me" pointed at the hulk and the player could
  // never take another asset. Nothing released them, ever.
  for (const seatField of ["aboard1", "aboard2"]) {
    const riderId = target[seatField];
    if (riderId === -1) continue;
    target[seatField] = -1;
    const rider = next.operators[riderId];
    if (!rider || rider.state !== OP_ACTIVE) continue;
    rider.assetId = -1;
    rider.state = OP_DOWN;
    next.downed.push(createDowned(rider, target));
    next.events.push({ type: "operator_downed", operatorId: rider.id });
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

// 13A: field resupply — a truck tops an adjacent friendly up from its
// cargo hold. Partial transfers are fine; an empty hold or a full target
// each have their own honest rejection.
function applyTransferCargo(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const truck = next.assets[operator.assetId];
  if (!truck || truck.operatorId !== operator.id) return reject(next, command, "no asset selected");
  if (truck.state === ASSET_DISABLED || truck.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  if (!getUnitStats(truck.type).canTow) return reject(next, command, "needs a logistics truck");
  const target = next.assets[command.targetAssetId];
  if (!target || target.id === truck.id) return reject(next, command, "no such target");
  if (target.team !== truck.team) return reject(next, command, "friendly target");
  if (target.state === ASSET_DISABLED || target.state === ASSET_SALVAGED) {
    return reject(next, command, "target not operable");
  }
  if (chebyshevCells(truck, target) > 1) return reject(next, command, "cargo out of reach");
  const fuel = Math.min(truck.cargoFuel, FUEL_MAX - target.fuel);
  const ammo = Math.min(truck.cargoAmmo, AMMO_MAX - target.ammo);
  if (fuel <= 0 && ammo <= 0) {
    return reject(next, command,
      truck.cargoFuel <= 0 && truck.cargoAmmo <= 0 ? "cargo hold empty" : "target is topped up");
  }
  truck.cargoFuel -= fuel;
  truck.cargoAmmo -= ammo;
  target.fuel += fuel;
  target.ammo += ammo;
  next.events.push({
    type: "cargo_transferred", byAssetId: truck.id, assetId: target.id, fuel, ammo,
  });
  return next;
}

// 12B: Deploy Hardpoint (3 s each way, immobile and guns cold while the
// legs work). Deployed flag flips IMMEDIATELY; "active" means the timer
// has finished — effectiveCombat() reads exactly that.
export const HARDPOINT_TRANSITION_TICKS = 30;

function hardpointSeat(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return { err: "operator not active" };
  if (operator.assetId === -1) return { err: "no asset selected" };
  const asset = next.assets[operator.assetId];
  if (!asset || asset.operatorId !== operator.id) return { err: "no asset selected" };
  if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) {
    return { err: "asset not operable" };
  }
  if (!getUnitStats(asset.type).deployable) return { err: "cannot deploy here" };
  if (asset.deployTimer > 0) return { err: "still transitioning" };
  return { asset };
}

function applyDeployHardpoint(next, command) {
  const { asset, err } = hardpointSeat(next, command);
  if (err) return reject(next, command, err);
  if (asset.deployed === 1) return reject(next, command, "already deployed");
  asset.deployed = 1;
  asset.deployTimer = HARDPOINT_TRANSITION_TICKS;
  asset.targetX = asset.x;
  asset.targetY = asset.y;
  asset.state = ASSET_IDLE;
  asset.driveThrottle = 0;
  asset.driveTurn = 0;
  next.events.push({ type: "hardpoint_deploying", assetId: asset.id });
  return next;
}

function applyUndeploy(next, command) {
  const { asset, err } = hardpointSeat(next, command);
  if (err) return reject(next, command, err);
  if (asset.deployed !== 1) return reject(next, command, "not deployed");
  asset.deployed = 0;
  asset.deployTimer = HARDPOINT_TRANSITION_TICKS;
  next.events.push({ type: "hardpoint_undeploying", assetId: asset.id });
  return next;
}

// 11L: direct control — store the seat's drive intent on its asset. Any
// intent cancels the click-move target; zeroing both returns the asset to
// ordinary click-to-move.
function applyDrive(next, command) {
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
  if ((asset.deployed === 1 || asset.deployTimer > 0) &&
      (command.throttle !== 0 || command.turn !== 0)) {
    return reject(next, command, "deployed — undeploy to move"); // 12B
  }
  asset.driveThrottle = command.throttle;
  asset.driveTurn = command.turn;
  if (command.throttle !== 0 || command.turn !== 0) {
    asset.targetX = asset.x;
    asset.targetY = asset.y;
    asset.state = ASSET_IDLE; // direct mode owns the wheel, not the target
  }
  return next;
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
  // 15F carrier field-respawn (ruled: crewed carriers only, 30 s/operator):
  // the seat spawns ABOARD like a rescue passenger and rides until
  // delivered or unboarded — the existing passenger machinery, verbatim.
  if (command.carrierAssetId !== undefined) {
    const operator = next.operators[command.operatorId];
    if (next.tick < (operator.carrierSpawnAt ?? 0)) {
      return reject(next, command, "carrier spawn cooling down");
    }
    const carrier = next.assets[command.carrierAssetId];
    if (!carrier || getUnitStats(carrier.type).capacity <= 0) {
      return reject(next, command, "not a carrier");
    }
    if (carrier.team !== operator.team) return reject(next, command, "asset belongs to other team");
    if (carrier.state === ASSET_DISABLED || carrier.state === ASSET_SALVAGED) {
      return reject(next, command, "asset not operable");
    }
    if (carrier.operatorId === -1) return reject(next, command, "carrier has no crew");
    if (carrier.aboard1 !== -1 && carrier.aboard2 !== -1) {
      return reject(next, command, "no bunk free");
    }
    if (carrier.aboard1 === -1) carrier.aboard1 = operator.id;
    else carrier.aboard2 = operator.id;
    next.downed = next.downed.filter((d) => d.operatorId !== operator.id);
    operator.carrierSpawnAt = next.tick + CARRIER_SPAWN_COOLDOWN_TICKS;
    next.events.push({
      type: "operator_carrier_spawned", operatorId: operator.id, carrierAssetId: carrier.id,
    });
    return next;
  }
  freeSeat(next, command.operatorId, "operator_redeployed");
  return next;
}

// Prompt-51 AT satchel: the downed crew's one heroic answer to armor —
// a single adjacent-cell demolition charge. LOUD by design: the event
// and an automatic team ping mark the blast for everyone.
export const SATCHEL_DAMAGE = 60;
function applySatchel(next, command) {
  const operator = next.operators[command.operatorId];
  const down = downedFor(next, command.operatorId);
  if (!operator || operator.state !== OP_DOWN || !down) {
    return reject(next, command, "not downed");
  }
  if ((down.satchel ?? 0) <= 0) return reject(next, command, "satchel spent");
  const target = next.assets[command.targetAssetId];
  if (!target || target.team === operator.team) return reject(next, command, "no enemy there");
  if (target.state === ASSET_DISABLED || target.state === ASSET_SALVAGED) {
    return reject(next, command, "already a wreck");
  }
  if (chebyshevCells(target, down) > 1) return reject(next, command, "out of arm's reach");
  down.satchel = 0;
  target.hp -= SATCHEL_DAMAGE;
  next.events.push({
    type: "satchel_detonated", operatorId: operator.id, assetId: target.id,
  });
  next.events.push({
    type: "ping", kind: "satchel_blast", team: operator.team, toTeam: operator.team,
    cellX: worldToCellFloor(target.x), cellY: worldToCellFloor(target.y),
  });
  if (target.hp <= 0) {
    target.hp = 0;
    disableAsset(next, target, operator.team, {
      kind: "satchel",
      dir: compassOctant(down.x - target.x, down.y - target.y),
    });
    awardOperator(next, operator.id, RECOG_KILL, DEED_KILL);
  }
  return next;
}

// 15: forced respawn — for the tactically stuck. Abandons the hull IN
// PLACE (it self-recalls in 60 s unless re-crewed or home) and frees the
// seat after a 10 s countdown; selection is gated until it elapses.
function applyRespawn(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if ((operator.respawnTicks ?? 0) > 0) return reject(next, command, "already respawning");
  if (operator.assetId === -1) return reject(next, command, "no asset to abandon");
  const asset = next.assets[operator.assetId];
  if (asset && asset.operatorId === operator.id) {
    asset.operatorId = -1;
    asset.abandonTimer = 1; // the self-recall clock starts
    asset.driveThrottle = 0;
    asset.driveTurn = 0;
    if (asset.state === ASSET_MOVING) asset.state = ASSET_IDLE;
    asset.targetX = asset.x;
    asset.targetY = asset.y;
  }
  operator.assetId = -1;
  operator.respawnTicks = RESPAWN_TICKS;
  next.events.push({ type: "respawn_called", operatorId: operator.id });
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

// 17 (playtest 7 ruling): body collision — HARD blocking against enemies,
// SOFT compression through friends. Only CLOSING moves are constrained
// (moving apart is always legal — the bridge-deadlock escape); wrecks and
// downed crews don't collide in v1 (tow trucks must reach wrecks).
export const ENEMY_BLOCK_RADIUS = 192; // world units (0.75 cell)
export const FRIEND_SOFT_RADIUS = 128; // closing inside this = half speed

// 0 = blocked, 1 = full step, 2 = half step (friendly compression).
function collisionVerdict(assets, self, nx, ny) {
  let half = false;
  for (const o of assets) {
    if (o.id === self.id) continue;
    if (o.state === ASSET_DISABLED || o.state === ASSET_SALVAGED) continue;
    const dOld = Math.max(absI32(o.x - self.x), absI32(o.y - self.y));
    const dNew = Math.max(absI32(o.x - nx), absI32(o.y - ny));
    if (dNew >= dOld) continue; // separating — never constrained
    if (o.team !== self.team) {
      if (dNew < ENEMY_BLOCK_RADIUS) return 0;
    } else if (dNew < FRIEND_SOFT_RADIUS) {
      half = true;
    }
  }
  return half ? 2 : 1;
}

// Heading -> 16-direction snap. A heading EXACTLY between two sectors
// (h ≡ 8 mod 16) used to round clockwise, which is not mirror-safe: 248
// snapped to pure east (cos 256) while its mirror 136 snapped to a
// diagonal (cos -237) — the divergence probe caught the asymmetry at
// tick 2 of a riverline war. Tie-break: the EVEN direction index, which
// commutes with both the E-W and N-S reflections.
function dirForHeading(heading) {
  const h = heading & 255;
  if ((h & 15) === 8) {
    const lo = (h >> 4) & 15;
    return (lo & 1) === 0 ? lo : (lo + 1) & 15;
  }
  return (floorDivI32(h + 8, 16)) & 15;
}

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

// The 180-degree tie is the LAST known mirror chirality (specs/08 §4
// sketched this fix; the sweep harness's own reflection bug was masking
// it). When the target lies exactly astern, clockwise and anticlockwise
// are equally short — and any FIXED choice fails to commute with the
// mirror, because mirroring negates the turn but not the rule.
//
// The tie-break therefore has to be keyed to something that itself flips
// under the mirror. The unit's side of the map is exactly that: west of
// the axis turns one way, east turns the other, so a mirrored world
// makes the mirrored choice. (2x is even and W-1 = 127 is odd, so a unit
// can never sit exactly ON the axis: there is no tie in the tie-break.)
function turnToward(heading, desiredBrads, turnRate, worldX = null, mapWidth = 128) {
  let diff = (desiredBrads - heading) & 255;
  if (diff > 128) diff -= 256; // shortest arc in [-128, 127]
  if (absI32(diff) === 128 && worldX !== null) {
    const westOfAxis = 2 * worldToCellFloor(worldX) < mapWidth - 1;
    diff = westOfAxis ? 128 : -128;
  }
  if (absI32(diff) <= turnRate) return desiredBrads;
  return (heading + (diff > 0 ? turnRate : -turnRate)) & 255;
}

// 18B: impassable terrain is a WALL, not a speed. Speed is sampled at
// the CURRENT cell, so a fast chassis could leap into a 0-speed cell
// and be trapped there forever (speed 0 = no step out). Refuse the
// move instead — units stall at the mesa face. Pure position check:
// commutes with the mirror because the terrain does.
function terrainWalled(map, worldX, worldY, stats) {
  const cx = worldToCellFloor(worldX);
  const cy = worldToCellFloor(worldY);
  if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) return true;
  return speedMultiplier(map.cells[cy * map.width + cx], stats) === 0;
}

// 18E: SLIDE along a wall instead of pressing into it. Refusing the step
// (18B) keeps units out of the rock, but a unit whose target lies across
// a mesa would grind its face against the same cell forever — measured
// at up to 4681 ticks (~8 minutes) on sawtooth, an asset silently
// removed from the war. The blocking-cell invariant test cannot see
// that, because the unit never enters the wall; dbg_wall_stall.mjs can.
//
// Returns the movement actually allowed, [dx, dy], possibly zeroed.
// MIRROR SAFETY: the fallbacks are ordered by AXIS (x-only, then
// y-only), never by sign or direction — the x-mirror maps an x-only
// slide onto an x-only slide, so mirrored worlds slide identically.
function slideAlongWall(map, asset, sdx, sdy, stats) {
  if (!terrainWalled(map, asset.x + sdx, asset.y + sdy, stats)) return [sdx, sdy];
  if (sdx !== 0 && !terrainWalled(map, asset.x + sdx, asset.y, stats)) return [sdx, 0];
  if (sdy !== 0 && !terrainWalled(map, asset.x, asset.y + sdy, stats)) return [0, sdy];
  return [0, 0];
}

// 11L: tank-style direct drive. A/D pivot at the chassis turnRate; W
// drives along the heading at chassis speed, S reverses at half; every
// speed multiplier stepAsset honors applies here too. Map edges clamp.
function driveStep(asset, map, supplied, carrying, towing, others) {
  const stats = getUnitStats(asset.type);
  if (asset.driveTurn !== 0) {
    asset.heading = (asset.heading + asset.driveTurn * stats.turnRate) & 255;
  }
  if (asset.driveThrottle === 0) return;

  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  if (cellX < 0 || cellX >= map.width || cellY < 0 || cellY >= map.height) return;
  const terrain = map.cells[cellY * map.width + cellX];
  let step = floorDivI32(stats.speed * speedMultiplier(terrain, stats), 256);
  if (!supplied) step = floorDivI32(step, 2);
  if (carrying) step = floorDivI32(step * CARRIER_SPEED_NUM, CARRIER_SPEED_DEN);
  if (towing) step = floorDivI32(step * TOW_SPEED_NUM, TOW_SPEED_DEN);
  if (asset.driveThrottle < 0) step = floorDivI32(step, 2); // reverse gear
  if (step <= 0) return;

  const dir = dirForHeading(asset.heading);
  const sign = asset.driveThrottle < 0 ? -1 : 1;
  const maxX = (map.width - 1) * 256 + 255;
  const maxY = (map.height - 1) * 256 + 255;
  // truncDiv: mirror-symmetric stepping (floor rounded -inf-ward and gave
  // west/north movers a free unit on diagonals — the riverline east edge).
  let sdx = sign * truncDivI32(step * DIR_COS[dir], 256);
  let sdy = sign * truncDivI32(step * DIR_SIN[dir], 256);
  const v = collisionVerdict(others, asset,
    Math.min(maxX, Math.max(0, asset.x + sdx)), Math.min(maxY, Math.max(0, asset.y + sdy)));
  if (v === 0) return; // 17: hard-blocked by an enemy hull
  if (v === 2) { sdx = truncDivI32(sdx, 2); sdy = truncDivI32(sdy, 2); } // friendly press
  // 18B/18E: refuse the rock, but slide along it — a driver holding W
  // into a mesa face should scrape past it, not weld to it.
  [sdx, sdy] = slideAlongWall(map, asset, sdx, sdy, stats);
  if (sdx === 0 && sdy === 0) return;
  asset.x = Math.min(maxX, Math.max(0, asset.x + sdx));
  asset.y = Math.min(maxY, Math.max(0, asset.y + sdy));
  asset.targetX = asset.x;
  asset.targetY = asset.y;
}

function stepAsset(asset, map, supplied, carrying, towing, others) {
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  if (cellX < 0 || cellX >= map.width || cellY < 0 || cellY >= map.height) return;

  const stats = getUnitStats(asset.type);
  const terrain = map.cells[cellY * map.width + cellX];
  let step = floorDivI32(stats.speed * speedMultiplier(terrain, stats), 256);
  if (!supplied) step = floorDivI32(step, 2); // out of supply: half speed (3B)
  if (carrying) step = floorDivI32(step * CARRIER_SPEED_NUM, CARRIER_SPEED_DEN); // 8B
  if (towing) step = floorDivI32(step * TOW_SPEED_NUM, TOW_SPEED_DEN); // 8D
  if (step <= 0) return;

  const dx = asset.targetX - asset.x;
  const dy = asset.targetY - asset.y;

  // Close enough: snap and stop (prevents orbiting a near target).
  if (absI32(dx) + absI32(dy) <= step) {
    if (collisionVerdict(others, asset, asset.targetX, asset.targetY) === 0) return; // 17
    if (terrainWalled(map, asset.targetX, asset.targetY, stats)) return; // 18B
    asset.x = asset.targetX;
    asset.y = asset.targetY;
    // Item 34: a queued leg means the journey continues without the
    // player touching anything.
    if (asset.waypoints && asset.waypoints.length > 0) {
      const leg = asset.waypoints.shift();
      asset.targetX = leg.x;
      asset.targetY = leg.y;
      return; // stays ASSET_MOVING
    }
    asset.state = ASSET_IDLE;
    return;
  }

  const desired = bearing16(dx, dy) * 16;
  asset.heading = turnToward(asset.heading, desired, stats.turnRate, asset.x, map.width);

  // Facing too far off the bearing: pivot in place this tick.
  let off = (desired - asset.heading) & 255;
  if (off > 128) off = 256 - off;
  if (off > 32) return;

  const dir = dirForHeading(asset.heading);
  let sdx = truncDivI32(step * DIR_COS[dir], 256);
  let sdy = truncDivI32(step * DIR_SIN[dir], 256);
  const v = collisionVerdict(others, asset, asset.x + sdx, asset.y + sdy);
  if (v === 0) return; // 17: hard-blocked by an enemy hull; keep trying
  if (v === 2) { sdx = truncDivI32(sdx, 2); sdy = truncDivI32(sdy, 2); } // friendly press
  [sdx, sdy] = slideAlongWall(map, asset, sdx, sdy, stats); // 18B/18E
  if (sdx === 0 && sdy === 0) {
    // Head-on into rock with nothing to slide along: the order is
    // unreachable this way. Go IDLE so the planner re-engages (the AI
    // re-plans idle assets, and the route graph routes around mesas)
    // instead of "moving" against the same cell for minutes. Choosing a
    // deflection direction here would be a coin-flip, and a coin-flip
    // keyed to sign is exactly the chirality specs/08 forbids.
    asset.state = ASSET_IDLE;
    return;
  }
  asset.x += sdx;
  asset.y += sdy;

  if (asset.x === asset.targetX && asset.y === asset.targetY) {
    asset.state = ASSET_IDLE;
  }
}

function applyAdvanceTick(next) {
  next.tick += 1;
  // A finished war only counts time; nothing moves, fights, or captures.
  if (next.phase === PHASE_OVER) return next;
  // 17: with body collision, whoever steps first claims contact-line
  // ground — alternate iteration direction by tick parity so neither
  // team owns the first move (the Q18 lesson, physics edition). Timer
  // decrements in this loop are per-asset and order-independent.
  const marchOrder = (next.tick & 1) === 0
    ? next.assets
    : [...next.assets].reverse();
  for (const asset of marchOrder) {
    if (asset.suppressedTimer > 0) asset.suppressedTimer -= 1;
    if (asset.reloadTimer > 0) asset.reloadTimer -= 1; // 8E
    // 12B: hardpoint legs working — immobile; announce completion.
    if (asset.deployTimer > 0) {
      asset.deployTimer -= 1;
      if (asset.deployTimer === 0) {
        next.events.push({
          type: asset.deployed === 1 ? "hardpoint_active" : "hardpoint_stowed",
          assetId: asset.id,
        });
      }
      continue;
    }
    if (asset.deployed === 1) continue; // 12B: hardpoints hold their ground
    // 11L direct control: intent-driven physics preempts target-seeking.
    if ((asset.driveThrottle !== 0 || asset.driveTurn !== 0) &&
        asset.state !== ASSET_DISABLED && asset.state !== ASSET_SALVAGED) {
      if (asset.fuel < SUPPLY_MOVE_COST) continue; // stranded until resupplied
      const beforeX = asset.x;
      const beforeY = asset.y;
      driveStep(
        asset, next.map, inSupply(next, asset),
        assetCarries(next, asset.id) !== null,
        towedWreck(next, asset.id) !== null,
        next.assets
      );
      if (asset.x !== beforeX || asset.y !== beforeY) asset.fuel -= SUPPLY_MOVE_COST;
      continue;
    }
    if (asset.state !== ASSET_MOVING) continue;
    if (asset.fuel < SUPPLY_MOVE_COST) continue; // stranded until resupplied
    const beforeX = asset.x;
    const beforeY = asset.y;
    stepAsset(
      asset, next.map, inSupply(next, asset),
      assetCarries(next, asset.id) !== null,
      towedWreck(next, asset.id) !== null,
      next.assets
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
        disableAsset(next, victim, mine.team, { kind: "mine" });
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
      if (target.hp === 0) {
        disableAsset(next, target, drone.team, {
          kind: "drone",
          dir: compassOctant(drone.x - target.x, drone.y - target.y),
        });
      }
    }
    if (gone.size > 0) next.drones = next.drones.filter((d) => !gone.has(d.id));
  }  // 9G anti-camping: idling outside your own supply umbrella draws a drone
  // from the enemy's nearest owned relay.
  for (const asset of next.assets) {
    const atTheWheel = asset.driveThrottle !== 0 || asset.driveTurn !== 0; // 11L
    if (asset.state === ASSET_IDLE && !atTheWheel && !inSupply(next, asset)) {
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
      if (!getUnitStats(asset.type).canCapture) continue; // 11R: bikes are ghosts here
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
        for (const a of next.assets) { // 11K: whoever stood the flag out
          if (a.team === team && a.operatorId !== -1 &&
              captureCheck(next, a.id)?.id === site.id) {
            awardOperator(next, a.operatorId, RECOG_RELAY, DEED_RELAY);
          }
        }
        next.events.push({ type: "site_captured", siteId: site.id, team });
      }
    }
  }
  // B6 supply-drop pass: once live, EXCLUSIVE presence in the ring
  // builds the hold; contested or empty RESETS it (a crate is either
  // yours or it is not — defending the ring is the counterplay);
  // HOLD_TICKS alone wins the packet, once.
  for (const drop of next.drops ?? []) {
    if (!dropActive(drop, next.tick)) continue;
    if (next.tick === drop.activateTick) {
      next.events.push({
        type: "supply_drop_incoming", dropId: drop.id,
        cellX: next.map.width >> 1, cellY: drop.cellY,
      });
    }
    const centre = dropWorld(drop, next.map.width);
    const present = [false, false];
    for (const a of next.assets) {
      if (a.operatorId === -1) continue;
      if (a.state === ASSET_DISABLED || a.state === ASSET_SALVAGED) continue;
      if (Math.max(absI32(a.x - centre.x), absI32(a.y - centre.y)) >
          DROP_RADIUS_CELLS * 256) continue;
      present[a.team] = true;
    }
    const holder = present[0] && !present[1] ? 0 : present[1] && !present[0] ? 1 : -1;
    if (holder === -1) {
      drop.heldBy = -1;
      drop.holdTicks = 0;
      continue;
    }
    if (drop.heldBy !== holder) {
      drop.heldBy = holder;
      drop.holdTicks = 0;
    }
    drop.holdTicks += 1;
    if (drop.holdTicks >= DROP_HOLD_TICKS) {
      drop.securedBy = holder;
      const ceiling = next.rules?.ticketPool ?? DEFAULT_RULES.ticketPool;
      next.tickets[holder] = Math.min(ceiling, next.tickets[holder] + DROP_TICKET_PACKET);
      for (const a of next.assets) { // the crews on the spot get seen
        if (a.team !== holder || a.operatorId === -1) continue;
        if (a.state === ASSET_DISABLED || a.state === ASSET_SALVAGED) continue;
        if (Math.max(absI32(a.x - centre.x), absI32(a.y - centre.y)) >
            DROP_RADIUS_CELLS * 256) continue;
        awardOperator(next, a.operatorId, RECOG_DROP);
      }
      next.events.push({ type: "supply_drop_secured", dropId: drop.id, byTeam: holder });
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
      awardOperator(next, asset.operatorId, RECOG_STANDARD_RETURN, DEED_STD_RETURN); // 11K
      next.events.push({ type: "standard_returned", standardId: returnable.id, team: asset.team });
    }
  }
  for (const st of next.standards) {
    if (st.status !== STD_CARRIED) continue;
    const carrier = next.assets[st.carrierAssetId];
    if (carrier && canScore(next, carrier)) {
      st.status = STD_SCORED;
      st.carrierAssetId = -1;
      awardOperator(next, carrier.operatorId, RECOG_STANDARD_CAPTURE, DEED_STD_CAPTURE); // 11K
      awardEscorts(next, carrier); // Q26: whoever held the final leg
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
      awardEscorts(next, carrier); // Q26: the corridor holders get seen
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
      awardOperator(next, carrier.operatorId, RECOG_RESCUE, DEED_RESCUE); // 11K
      next.events.push({ type: "operator_delivered", operatorId });
    }
  }

  // Recovery pass (8D): a towed wreck reaching its own base enters the
  // repair bay; timers count down; repaired assets return at half hull.
  for (const wreck of next.assets) {
    if (wreck.towedBy !== -1 && inOwnBase(next, wreck)) {
      awardOperator(next, next.assets[wreck.towedBy]?.operatorId, RECOG_TOW, DEED_TOW); // 11K
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
        refundWreckTicket(next, wreck.team); // B1: the tow paid for itself
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
    if (operable >= (next.rules?.mpgMinOperable ?? MPG_MIN_OPERABLE)) {
      next.manufacture[team] = 0;
      continue;
    }
    if (next.manufacture[team] < (next.rules?.mpgTicks ?? MPG_TICKS)) next.manufacture[team] += 1;
    if (next.manufacture[team] < (next.rules?.mpgTicks ?? MPG_TICKS)) continue;
    // BF2-study ruling (prompt 51): rebuilds arrive as a FULL WAVE — every
    // eligible wreck at once, so a gutted team counter-pushes as a
    // formation instead of feeding hulls in one at a time.
    const wrecks = next.assets.filter(
      (a) => a.team === team &&
        (a.state === ASSET_DISABLED || a.state === ASSET_SALVAGED) &&
        a.towedBy === -1 && a.recoverTimer === 0
    );
    if (!wrecks.length) continue; // hold at threshold until a hull is available
    for (const wreck of wrecks) {
      const spawn = fieldSpawnFor(wreck.id, next.bases); // base-derived: mirror-honest
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
      next.events.push({ type: "asset_manufactured", assetId: wreck.id, team });
    }
    next.manufacture[team] = 0;
  }

  // 11F materiel pass: an idle truck in its own base takes on one repair
  // load; a truck carrying materiel next to a damaged own/neutral site
  // spends it — the site comes back at full strength.
  for (const asset of next.assets) {
    if (!getUnitStats(asset.type).canTow) continue;
    if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) continue;
    if (asset.state === ASSET_IDLE && inOwnBase(next, asset)) {
      // 13A: the hold refills at home, as silently as the materiel crate.
      asset.cargoFuel = CARGO_FUEL_MAX;
      asset.cargoAmmo = CARGO_AMMO_MAX;
      if (asset.materiel === 0) {
        asset.materiel = 1; // silent, like breathing — the crate is just there
        continue;
      }
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
      continue;
    }
    // 13E: rebuilding a dropped crossing. EITHER TEAM may rebuild ANY
    // bridge (prompt-70 ruling) — no ownership concept, and the
    // tug-of-war over a contested span is the point.
    const cellX = cx;
    const cellY = cy;
    const bridge = (next.bridges ?? []).find((b) =>
      !bridgeIntact(b) && adjacentToBridge(next.mapProfile, b.id, cellX, cellY));
    if (bridge) {
      bridge.hp = BRIDGE_HP_MAX;
      asset.materiel = 0;
      applyBridgeTerrain(next.map, next.mapProfile, bridge.id, true);
      next.events.push({ type: "bridge_repaired", bridgeId: bridge.id, byAssetId: asset.id });
      continue;
    }
    // FIELD HULL REPAIR (playtest-9 item 32, ruled capped). A truck with
    // materiel patches an adjacent LIVING friendly up to half hull — the
    // same figure the repair bay gives a recovered wreck.
    //
    // The cap is what protects B1's recovery economy: a WRECK still can
    // only be fixed by towing it home, and a hull already above half
    // gets nothing, so this buys a mauled-but-alive unit one more push
    // rather than replacing the bay. You cannot work on your own vehicle
    // while driving it, so self-repair is excluded.
    const patient = next.assets.find((other) => {
      if (other.id === asset.id || other.team !== asset.team) return false;
      if (other.state === ASSET_DISABLED || other.state === ASSET_SALVAGED) return false;
      if (other.hp >= restoredHp(other.type)) return false;
      return Math.max(
        Math.abs(worldToCellFloor(other.x) - cx),
        Math.abs(worldToCellFloor(other.y) - cy)
      ) <= 1;
    });
    if (patient) {
      const before = patient.hp;
      patient.hp = restoredHp(patient.type);
      asset.materiel = 0;
      awardOperator(next, asset.operatorId, RECOG_FIELD_REPAIR, DEED_FIELD_REPAIR);
      next.events.push({
        type: "asset_field_repaired", assetId: patient.id, byAssetId: asset.id,
        hp: patient.hp, healed: patient.hp - before,
      });
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
  // 16G: the weather front announces itself at its edges (schedule is a
  // pure function of the seed; start >= 6000, far outside fixture ticks).
  {
    const w = weatherWindow(next.mapSeed);
    if (next.tick === w.start) next.events.push({ type: "weather_front", phase: "in" });
    if (next.tick === w.end) next.events.push({ type: "weather_front", phase: "out" });
  }
  // 15: respawn countdowns tick down; at zero the seat is free to select.
  for (const op of next.operators) {
    if ((op.respawnTicks ?? 0) > 0) {
      op.respawnTicks -= 1;
      if (op.respawnTicks === 0) {
        next.events.push({ type: "operator_respawned", operatorId: op.id });
      }
    }
  }
  // 15: abandoned hulls self-recall — 60 s uncrewed in the FIELD wrecks
  // them (towable, rebuildable); making it home (or being re-crewed,
  // which clears the timer at selection) spares them.
  for (const asset of next.assets) {
    if ((asset.abandonTimer ?? 0) <= 0) continue;
    if (asset.operatorId !== -1 ||
        asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) {
      asset.abandonTimer = 0;
      continue;
    }
    asset.abandonTimer += 1;
    if (asset.abandonTimer >= ABANDON_RECALL_TICKS) {
      asset.abandonTimer = 0;
      if (inOwnBase(next, asset)) continue; // safe at home
      asset.state = ASSET_DISABLED;
      asset.hp = 0;
      // B1: a hull left to rot in the field is materiel lost, so it costs
      // the same ticket a combat wreck does. Charging BOTH wreck paths is
      // what lets the refund work without a per-asset "was charged" flag
      // (which would need a fixture repin) - and it closes the exploit of
      // abandoning a hull for free, towing it home, and banking a refund
      // for a ticket nobody ever paid.
      chargeWreckTicket(next, asset.team);
      next.events.push({ type: "asset_recalled", assetId: asset.id });
    }
  }
  // 13H ticket bleed (hybrid, prompt-51): a relay MAJORITY drains the
  // enemy pool one ticket per cadence. Silent (no per-tick events — the
  // repin discipline); the pools are hashed and ride the view for UI.
  if (next.tickets) {
    const bleedTicks = next.rules?.ticketBleedTicks ?? 20;
    // The session law's majority is capped at this MAP's own majority —
    // 5-of-8 on frontier, 4-of-6 on riverline; a smaller map must not
    // need domination-grade holdings to bleed (13H, map-aware).
    const mapMajority = ((next.sites.length / 2) | 0) + 1;
    const majority = Math.min(next.rules?.ticketMajority ?? 5, mapMajority);
    if (bleedTicks > 0 && next.tick % bleedTicks === 0) {
      const owned = [0, 0];
      for (const site of next.sites) {
        if (site.owner === 0 || site.owner === 1) owned[site.owner] += 1;
      }
      // B3 MERCY BLEED. The designer's wording was "full cap held 3
      // minutes", which turns out to be UNREACHABLE in this engine:
      // holding every site already wins outright after 300 ticks
      // (DOMINATION_HOLD_TICKS), so a 3-minute full cap ends the war six
      // times over first. The drag it was aimed at is real, though — it
      // is the tail where the result is already decided and the clock
      // just grinds. So the trigger is that instead: the leader holds the
      // majority AND the loser's pool is nearly gone.
      //
      // It relents the moment the losing side starts a capture, so a team
      // fighting its way out is never punished for it. Pure function of
      // existing state — no new hashed field, no repin.
      const mercyRate = next.rules?.mercyMultiplier ?? 3;
      const mercyFloor = next.rules?.mercyPoolFraction ?? 4; // pool/4 = 25%
      const pool = next.rules?.ticketPool ?? 300;
      const nearlyOut = (team) => next.tickets[team] > 0 &&
        next.tickets[team] * mercyFloor <= pool;
      const fightingBack = (team) => next.sites.some((site) => site.capturingTeam === team);
      const rate = (team) => {
        const foe = team === 0 ? 1 : 0;
        return (nearlyOut(foe) && !fightingBack(foe)) ? mercyRate : 1;
      };
      if (owned[0] >= majority && next.tickets[1] > 0) {
        next.tickets[1] = Math.max(0, next.tickets[1] - rate(0));
      }
      if (owned[1] >= majority && next.tickets[0] > 0) {
        next.tickets[0] = Math.max(0, next.tickets[0] - rate(1));
      }
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
    case CMD_DRIVE: return applyDrive(next, command);
    case CMD_TRANSFER_CARGO: return applyTransferCargo(next, command);
    case CMD_DEPLOY_HARDPOINT: return applyDeployHardpoint(next, command);
    case CMD_UNDEPLOY: return applyUndeploy(next, command);
    case CMD_SET_OPTION: return applySetOption(next, command);
    case CMD_BOARD_CARRIER: return applyBoardCarrier(next, command);
    case CMD_UNBOARD: return applyUnboard(next, command);
    case CMD_DEPLOY_MINE: return applyDeployMine(next, command);
    case CMD_CLEAR_MINE: return applyClearMine(next, command);
    case CMD_REDEPLOY: return applyRedeploy(next, command);
    case CMD_RESPAWN: return applyRespawn(next, command); // 15: live since prompt-53
    case CMD_SATCHEL: return applySatchel(next, command); // prompt-51 AT charge
    case CMD_CALL_MEDIC: // recognized but inert until the medic milestone
      return next;
    default:
      return reject(next, command, `unknown command type: ${command.type}`);
  }
}
