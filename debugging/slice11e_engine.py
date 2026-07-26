# Slice 11E: full AI rescue play (prompt 16 Q5, sim-gated).
# AI trucks tow wrecks home; AI carriers pick up downed teammates and
# deliver them. Slots into the movement doctrine between standard
# objectives and capture-seek.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

p = "engine/ai_regency.js"
patch(p,
"""import { downedFor, REDEPLOY_TICKS } from "./downed.js";""",
"""import { downedFor, REDEPLOY_TICKS } from "./downed.js";
import { towRejection, towedWreck } from "./recovery.js";""")
patch(p,
"""// 11D (Q16): regents signal sparingly — one ping per seat per 30 s.
export const AI_PING_INTERVAL_TICKS = 300;""",
"""// 11D (Q16): regents signal sparingly — one ping per seat per 30 s.
export const AI_PING_INTERVAL_TICKS = 300;

// 11E (Q5): how far a truck/carrier will divert for a rescue errand.
export const RESCUE_SEEK_CELLS = 24;""")

# Helper: centre of the team's base, the drop-off for tows and passengers.
patch(p,
"""function isWreck(asset) {""",
"""function homeCellFor(state, team) {
  const base = state.bases.find((b) => b.team === team);
  if (!base) return null;
  return [base.x + ((base.width / 2) | 0), base.y + ((base.height / 2) | 0)];
}

function isWreck(asset) {""")

# Rescue doctrine, inserted between standard objectives and capture-seek.
patch(p,
"""      // 11C capture-seek (11B consequence): the countdown killed drive-by
      // captures. The designated capturer diverts to its relay and stands""",
"""      // 11E full AI rescue play (Q5). Trucks: hook the nearest claimable
      // wreck, haul it home (the repair bay takes it from there). Carriers:
      // ferry aboard passengers home; otherwise fetch a walking downed
      // teammate nearby — unless this carrier is the team's raider on duty.
      if (!target && stats.canTow) {
        const inTow = towedWreck(state, asset.id);
        if (inTow) {
          target = homeCellFor(state, asset.team);
        } else {
          let wreck = null;
          let bestDist = Infinity;
          for (const w of state.assets) {
            if (w.team !== asset.team || !isWreck(w)) continue;
            if (w.towedBy !== -1 || w.recoverTimer > 0) continue;
            const d = Math.max(Math.abs(worldToCellFloor(w.x) - cellX0),
                               Math.abs(worldToCellFloor(w.y) - cellY0));
            if (d < bestDist) { bestDist = d; wreck = w; }
          }
          if (wreck && bestDist <= RESCUE_SEEK_CELLS) {
            if (towRejection(state, asset, wreck) === null) {
              commands.push({ type: CMD_TOW_ORDER, operatorId, wreckAssetId: wreck.id });
              continue;
            }
            target = [worldToCellFloor(wreck.x), worldToCellFloor(wreck.y)];
          }
        }
      }
      if (!target && stats.capacity > 0) {
        if (asset.aboard1 !== -1 || asset.aboard2 !== -1) {
          target = homeCellFor(state, asset.team); // deliver at base idle
        } else if (asset.id !== raiderFor[asset.team]) {
          let body = null;
          let bestDist = Infinity;
          for (const d of state.downed) {
            if (d.team !== asset.team) continue;
            const dist = Math.max(Math.abs(worldToCellFloor(d.x) - cellX0),
                                  Math.abs(worldToCellFloor(d.y) - cellY0));
            if (dist < bestDist) { bestDist = dist; body = d; }
          }
          if (body && bestDist <= RESCUE_SEEK_CELLS) {
            target = [worldToCellFloor(body.x), worldToCellFloor(body.y)];
          }
        }
      }

      // 11C capture-seek (11B consequence): the countdown killed drive-by
      // captures. The designated capturer diverts to its relay and stands""")

# CMD_TOW_ORDER import.
patch(p,
"""import {
  CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER, CMD_FIRE_ORDER,
  CMD_DEPLOY_MINE, CMD_CLEAR_MINE, CMD_PING,
} from "./commands.js";""",
"""import {
  CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER, CMD_FIRE_ORDER,
  CMD_TOW_ORDER, CMD_DEPLOY_MINE, CMD_CLEAR_MINE, CMD_PING,
} from "./commands.js";""")
print("11E patched")
