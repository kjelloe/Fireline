# Slice 11D: alive-world doctrine (prompt 16 Q11 + Q16).
# Tanks mine ground near owned relays, trucks clear marked mines en route,
# regents ping, and the ping vocabulary grows.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── vocabulary (Q16) ─────────────────────────────────────────────────────────
patch("engine/pings.js",
"""  "mines_detected",       // scout marking danger ground
  "need_rescue",          // downed operator calling the carrier (OP_DOWN only)
]);""",
"""  "mines_detected",       // scout marking danger ground
  "carrier_under_attack", // the standard run is in trouble (Q16)
  "road_blocked",         // route intel (Q16)
  "safe_route",           // scout-marked clean path (Q16)
  "need_rescue",          // downed operator calling the carrier (OP_DOWN only)
]);""")

# ── AI doctrine (Q11 + Q16) ──────────────────────────────────────────────────
p = "engine/ai_regency.js"
patch(p,
"""import { CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER, CMD_FIRE_ORDER } from "./commands.js";""",
"""import {
  CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER, CMD_FIRE_ORDER,
  CMD_DEPLOY_MINE, CMD_CLEAR_MINE, CMD_PING,
} from "./commands.js";
import { mineAt, MINE_CLEAR_RADIUS_CELLS } from "./mines.js";
import { PING_COOLDOWN_TICKS } from "./pings.js";""")
patch(p,
"""// 11C: how far off-plan an agent will divert to flip a nearby relay.
export const CAPTURE_SEEK_CELLS = 16;""",
"""// 11C: how far off-plan an agent will divert to flip a nearby relay.
export const CAPTURE_SEEK_CELLS = 16;

// 11D (Q11): tanks fortify ground this close to an owned relay (never the
// site cell itself — that's protected); trucks clear marked mines they pass.
export const MINE_FORTIFY_CELLS = 3;
// 11D (Q16): regents signal sparingly — one ping per seat per 30 s.
export const AI_PING_INTERVAL_TICKS = 300;""")

# The doctrine block: insert after the fire doctrine, before movement.
patch(p,
"""      // Movement doctrine, in priority order:""",
"""      // 11D alive-world doctrine (Q11/Q16) — the world acts even with one
      // human present. All state-driven and deterministic.
      const cellX0 = worldToCellFloor(asset.x);
      const cellY0 = worldToCellFloor(asset.y);
      const stats = getUnitStats(asset.type);
      // Trucks defuse marked enemy mines they stand next to.
      if (stats.canClearMines) {
        const mine = state.mines.find((m) =>
          m.team !== asset.team && m.marked === 1 &&
          Math.max(Math.abs(m.cellX - cellX0), Math.abs(m.cellY - cellY0)) <= MINE_CLEAR_RADIUS_CELLS);
        if (mine) {
          commands.push({ type: CMD_CLEAR_MINE, operatorId, mineId: mine.id });
          continue;
        }
      }
      // Tanks fortify: idle near an owned relay (off the protected site
      // cell, outside bases), rack loaded, ground clean -> lay a mine.
      if (stats.canMine && asset.minesLeft > 0 && asset.state === ASSET_IDLE) {
        const nearOwned = state.sites.some((site) =>
          site.owner === asset.team &&
          !(site.cellX === cellX0 && site.cellY === cellY0) &&
          Math.max(Math.abs(site.cellX - cellX0), Math.abs(site.cellY - cellY0)) <= MINE_FORTIFY_CELLS);
        const inAnyBase = state.bases.some((b) =>
          cellX0 >= b.x && cellX0 < b.x + b.width && cellY0 >= b.y && cellY0 < b.y + b.height);
        if (nearOwned && !inAnyBase && !mineAt(state, cellX0, cellY0)) {
          commands.push({ type: CMD_DEPLOY_MINE, operatorId });
          continue;
        }
        // Standing ON the site it just captured: step one cell south to
        // legal ground so the fortify rule can fire next tick.
        const onOwnSite = state.sites.some((site) =>
          site.owner === asset.team && site.cellX === cellX0 && site.cellY === cellY0);
        if (onOwnSite) {
          commands.push({
            type: CMD_MOVE_ORDER, operatorId, targetCellX: cellX0, targetCellY: cellY0 + 1,
          });
          continue;
        }
      }
      // Regents ping, sparingly (Q16): the raider calls for escort while
      // carrying; the recoverer announces its run; scouts flag marked mines.
      if (state.tick - operator.lastPingTick >= AI_PING_INTERVAL_TICKS) {
        let ping = null;
        if (state.standards.length === 2) {
          const enemyStd = state.standards[asset.team === 0 ? 1 : 0];
          const ownStd = state.standards[asset.team];
          if (enemyStd.status === STD_CARRIED && enemyStd.carrierAssetId === asset.id) {
            ping = { kind: "need_escort" };
          } else if (ownStd.status === STD_DROPPED && operatorId === recovererFor[asset.team]) {
            ping = {
              kind: "recovery_in_progress",
              targetCellX: worldToCellFloor(ownStd.x), targetCellY: worldToCellFloor(ownStd.y),
            };
          }
        }
        if (!ping && asset.type === 1) {
          const marked = state.mines.find((m) =>
            m.team !== asset.team && m.marked === 1 &&
            Math.max(Math.abs(m.cellX - cellX0), Math.abs(m.cellY - cellY0)) <= 8);
          if (marked) {
            ping = { kind: "mines_detected", targetCellX: marked.cellX, targetCellY: marked.cellY };
          }
        }
        if (ping) {
          commands.push({ type: CMD_PING, operatorId, ...ping });
          // pinging is free: fall through to movement in the same tick
        }
      }

      // Movement doctrine, in priority order:""")

# ── client context options (Q16) ─────────────────────────────────────────────
patch("client/js/ping_model.js",
"""  const options = [];
  if ((view?.standards ?? []).some((st) => st.carrierAssetId === me.id)) {
    options.push({ kind: "need_escort", label: "ESCORT THE STANDARD" });
  }
  const towing = (view?.friendlyAssets ?? []).some((a) => a.towedBy === me.id);
  if (towing) {
    options.push(
      { kind: "recovery_in_progress", label: "RECOVERY IN PROGRESS" },
      { kind: "need_escort", label: "NEED ESCORT" }
    );
  }
  if (me.type === 1) {
    options.push({ kind: "mines_detected", label: "MINES DETECTED" });
  }""",
"""  const options = [];
  if ((view?.standards ?? []).some((st) => st.carrierAssetId === me.id)) {
    options.push(
      { kind: "need_escort", label: "ESCORT THE STANDARD" },
      { kind: "carrier_under_attack", label: "CARRIER UNDER ATTACK" }
    );
  } else if (me.type === 4) {
    options.push({ kind: "carrier_under_attack", label: "CARRIER UNDER ATTACK" });
  }
  const towing = (view?.friendlyAssets ?? []).some((a) => a.towedBy === me.id);
  if (towing) {
    options.push(
      { kind: "recovery_in_progress", label: "RECOVERY IN PROGRESS" },
      { kind: "need_escort", label: "NEED ESCORT" },
      { kind: "road_blocked", label: "ROAD BLOCKED" }
    );
  }
  if (me.type === 1) {
    options.push(
      { kind: "mines_detected", label: "MINES DETECTED" },
      { kind: "safe_route", label: "SAFE ROUTE MARKED" }
    );
  }
  if (me.type === 3 && !towing) {
    options.push({ kind: "road_blocked", label: "ROAD BLOCKED" });
  }""")
print("11D patched")
