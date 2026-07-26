# Slice 9E: mines — engine edits (state, commands, reducer, view, snapshot,
# hash test, metrics). engine/mines.js is written separately.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: pattern x{src.count(old)} (want {count}): {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── units.js: explicit per-chassis mine contract ─────────────────────────────
patch("engine/units.js",
"""    speed: 32, range: 1280, minRange: 0, hp: 100, damage: 20, indirect: false, reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 8,""",
"""    speed: 32, range: 1280, minRange: 0, hp: 100, damage: 20, indirect: false, reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 8,
    canMine: true, canClearMines: false, // 9E: the Assault chassis lays mines""")
patch("engine/units.js",
"""    speed: 56, range: 1024, minRange: 0, hp: 60, damage: 10, indirect: false, reloadTicks: 8, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 14,""",
"""    speed: 56, range: 1024, minRange: 0, hp: 60, damage: 10, indirect: false, reloadTicks: 8, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 14,
    canMine: false, canClearMines: false, // 9E: scouts DETECT mines (los pass)""")
patch("engine/units.js",
"""    speed: 16, range: 3072, minRange: 768, hp: 80, damage: 30, indirect: true, reloadTicks: 40, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 5,""",
"""    speed: 16, range: 3072, minRange: 768, hp: 80, damage: 30, indirect: true, reloadTicks: 40, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 5,
    canMine: false, canClearMines: false,""")
patch("engine/units.js",
"""    speed: 40, range: 768, minRange: 0, hp: 80, damage: 5, indirect: false, reloadTicks: 20,
    canTow: true, canCarryStandard: false, capacity: 0, turnRate: 10,""",
"""    speed: 40, range: 768, minRange: 0, hp: 80, damage: 5, indirect: false, reloadTicks: 20,
    canTow: true, canCarryStandard: false, capacity: 0, turnRate: 10,
    canMine: false, canClearMines: true, // 9E: trucks clear marked mines""")
patch("engine/units.js",
"""    speed: 24, range: 768, minRange: 0, hp: 120, damage: 5, indirect: false, reloadTicks: 25,
    canTow: false, canCarryStandard: true, capacity: 2, turnRate: 6,""",
"""    speed: 24, range: 768, minRange: 0, hp: 120, damage: 5, indirect: false, reloadTicks: 25,
    canTow: false, canCarryStandard: true, capacity: 2, turnRate: 6,
    canMine: false, canClearMines: false,""")

# ── state.js: mines array + id counter + per-asset mine racks ────────────────
patch("engine/state.js",
"""    downed: [], // 9B: operators on foot
    manufacture: [0, 0], // 9D: Slow Manufacture timers per team""",
"""    downed: [], // 9B: operators on foot
    manufacture: [0, 0], // 9D: Slow Manufacture timers per team
    mines: [], // 9E: deployed mines
    nextMineId: 0,""")
patch("engine/state.js",
"""    towedBy: -1, recoverTimer: 0, // 8D tow-back recovery
    reloadTimer: 0, // 8E fire cooldown
  };""",
"""    towedBy: -1, recoverTimer: 0, // 8D tow-back recovery
    reloadTimer: 0, // 8E fire cooldown
    minesLeft: getUnitStats(type).canMine ? MINES_PER_TANK : 0, // 9E mine rack
  };""")
src = open("engine/state.js").read()
assert 'from "./units.js"' in src
patch("engine/state.js",
"""import { getUnitStats""",
"""import { MINES_PER_TANK } from "./mines.js";
import { getUnitStats""")

# ── commands.js: deploy_mine / clear_mine ────────────────────────────────────
patch("engine/commands.js",
"""export const CMD_CALL_MEDIC     = "call_medic";""",
"""export const CMD_DEPLOY_MINE    = "deploy_mine"; // 9E
export const CMD_CLEAR_MINE     = "clear_mine";  // 9E
export const CMD_CALL_MEDIC     = "call_medic";""")
patch("engine/commands.js",
"""    case CMD_CALL_MEDIC:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };""",
"""    case CMD_DEPLOY_MINE:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_CLEAR_MINE:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.mineId, 0xffff))  return { ok: false, reason: "invalid mineId" };
      return { ok: true };

    case CMD_CALL_MEDIC:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };""")

# ── reducer.js ───────────────────────────────────────────────────────────────
patch("engine/reducer.js",
"""import {
  CMD_ADVANCE_TICK, CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER,
  CMD_FIRE_ORDER, CMD_TOW_ORDER, CMD_CRAWL_ORDER, CMD_REDEPLOY,
  CMD_CALL_MEDIC, CMD_RESPAWN, validate,
} from "./commands.js";""",
"""import {
  CMD_ADVANCE_TICK, CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER,
  CMD_FIRE_ORDER, CMD_TOW_ORDER, CMD_CRAWL_ORDER, CMD_REDEPLOY,
  CMD_DEPLOY_MINE, CMD_CLEAR_MINE,
  CMD_CALL_MEDIC, CMD_RESPAWN, validate,
} from "./commands.js";
import {
  MINE_ARM_TICKS, MINE_DAMAGE, MINE_DETECT_RADIUS_CELLS,
  deployRejection, clearRejection, isArmed,
} from "./mines.js";""")

patch("engine/reducer.js",
"""    downed: state.downed.map((d) => ({ ...d })),
    manufacture: [...state.manufacture],""",
"""    downed: state.downed.map((d) => ({ ...d })),
    manufacture: [...state.manufacture],
    mines: state.mines.map((m) => ({ ...m })),""")

# Extract the shared disable path (fire + mine detonation are one physics).
patch("engine/reducer.js",
"""  if (target.hp === 0) {
    target.state = ASSET_DISABLED;
    next.teamScores[attacker.team] += SCORE_DISABLE;
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
  return next;
}""",
"""  if (target.hp === 0) disableAsset(next, target, attacker.team);
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
}""")

# Tick passes: arm → scout-mark → trigger, right after movement resolves.
patch("engine/reducer.js",
"""  // Anti-deadlock (9A): a standard left dropped long enough returns home.""",
"""  // 9E mines: arm, then scout detection, then detonation on enemy entry.
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

  // Anti-deadlock (9A): a standard left dropped long enough returns home.""")

patch("engine/reducer.js",
"""    case CMD_CRAWL_ORDER: return applyCrawlOrder(next, command);""",
"""    case CMD_CRAWL_ORDER: return applyCrawlOrder(next, command);
    case CMD_DEPLOY_MINE: return applyDeployMine(next, command);
    case CMD_CLEAR_MINE: return applyClearMine(next, command);""")

# ── view.js: team-legitimate mines only ──────────────────────────────────────
patch("engine/view.js",
"""  // 8A: Command Standards are a deliberate fog exception""",
"""  // 9E: a team sees its own mines always, enemy mines only once marked.
  const mines = state.mines
    .filter((m) => m.team === team || m.marked === 1)
    .map((m) => ({
      id: m.id, team: m.team, cellX: m.cellX, cellY: m.cellY,
      armed: m.armTimer === 0, marked: m.marked === 1,
    }));
  // 8A: Command Standards are a deliberate fog exception""")
patch("engine/view.js",
"""    standards,
    downedOperators,
  };""",
"""    standards,
    downedOperators,
    mines,
  };""")
patch("engine/view.js",
"""      towedBy: a.towedBy, recoverTimer: a.recoverTimer,
      reloadTimer: a.reloadTimer,
      heading: a.heading,""",
"""      towedBy: a.towedBy, recoverTimer: a.recoverTimer,
      reloadTimer: a.reloadTimer,
      heading: a.heading, minesLeft: a.minesLeft,""")

print("engine patched")
