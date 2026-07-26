# 9D: Minimum Playability Guarantee — Slow Manufacture (spec 01 §9, Q5 cadence).
# When a team fields too few operable assets, the home base rebuilds its
# oldest wreck at the original spawn every 900 ticks. Fits the fixed roster.

p = "engine/state.js"
src = open(p).read()
src = src.replace("""    standards, // 8A: physical Command Standards
    downed: [], // 9B: operators on foot""",
"""    standards, // 8A: physical Command Standards
    downed: [], // 9B: operators on foot
    manufacture: [0, 0], // 9D: Slow Manufacture timers per team""")
# expose deterministic spawn lookup for rebuilds
src = src.replace("""function createFieldAssets() {""",
"""// Deterministic original spawn (cell + type) for any field asset id — used
// by the Slow Manufacture rebuild (9D).
export function fieldSpawnFor(id) {
  const team = id < 16 ? 0 : 1;
  const local = id % 16;
  if (local < 4) {
    const spawnX = team === 0 ? TEAM_A_SPAWN_X : TEAM_B_SPAWN_X;
    return { team, type: SPAWN_TYPES[local], cellX: spawnX, cellY: SPAWN_ROWS[local] };
  }
  const slot = local - 4;
  const cols = team === 0 ? TEAM_A_RESERVE_COLS : TEAM_B_RESERVE_COLS;
  const col = cols[(slot / RESERVE_ROWS.length) | 0];
  const row = RESERVE_ROWS[slot % RESERVE_ROWS.length];
  return { team, type: RESERVE_TYPES[slot % 12], cellX: col, cellY: row };
}

function createFieldAssets() {""")
open(p, "w").write(src)

# constants + reducer pass
p = "engine/reducer.js"
src = open(p).read()
src = src.replace('export { createInitialState } from "./state.js";',
'''export { createInitialState } from "./state.js";
import { fieldSpawnFor } from "./state.js";

// 9D Minimum Playability Guarantee (spec 01 §9, cadence per ruling Q5):
// below this many operable assets, the home base slow-manufactures.
export const MPG_MIN_OPERABLE = 6;
export const MPG_TICKS = 900;''')
src = src.replace("""  // Resupply pass: standing in your own base restores ammo and fuel.""",
"""  // Slow Manufacture pass (9D): a depleted team rebuilds its oldest wreck
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
    wreck.fuel = 2400;
    next.manufacture[team] = 0;
    next.events.push({ type: "asset_manufactured", assetId: wreck.id, team });
  }

  // Resupply pass: standing in your own base restores ammo and fuel.""")
open(p, "w").write(src)

# copyState: manufacture array
src = open(p).read()
src = src.replace("""    downed: state.downed.map((d) => ({ ...d })),
    events: [],""",
"""    downed: state.downed.map((d) => ({ ...d })),
    manufacture: [...state.manufacture],
    events: [],""")
open(p, "w").write(src)

# hash
for f in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    src = open(f).read()
    who = "state" if f.startswith("engine") else "s"
    src = src.replace("""  for (const d of (%s.downed ?? [])) { // added 9B""" % who,
"""  for (const m of (%s.manufacture ?? [0, 0])) w.writeI32LE(m); // added 9D
  for (const d of (%s.downed ?? [])) { // added 9B""" % (who, who))
    open(f, "w").write(src)

# feedback + metrics
p = "client/js/feedback_model.js"
src = open(p).read()
src = src.replace('    case "asset_restored": return `Asset ${e.assetId} restored to duty!`;',
'''    case "asset_restored": return `Asset ${e.assetId} restored to duty!`;
    case "asset_manufactured": return `Home base rebuilt asset ${e.assetId} — reinforcements!`;''')
open(p, "w").write(src)
p = "server/metrics.js"
src = open(p).read()
src = src.replace('    operatorsRescued: 0,', '    operatorsRescued: 0,\n    manufactured: 0,')
src = src.replace('          case "operator_rescued": counters.operatorsRescued++; break;',
'''          case "operator_rescued": counters.operatorsRescued++; break;
          case "asset_manufactured": counters.manufactured++; break;''')
open(p, "w").write(src)

# helpers: manufacture default (sandbox states via createInitialState get it) — ok.
print("9D wired")
