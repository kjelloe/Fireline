# Slice 9A engine changes: Carrier chassis, carrier-exclusive carrying,
# dropped-standard auto-return, fielding, AI raider = carrier.

# 1. units.js
p = "engine/units.js"
src = open(p).read()
src = src.replace("export const UNIT_LOGISTICS = 3;",
                  "export const UNIT_LOGISTICS = 3;\nexport const UNIT_CARRIER = 4;")
src = src.replace("reloadTicks: 15, canTow: false,",
                  "reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0,")
src = src.replace("reloadTicks: 8, canTow: false,",
                  "reloadTicks: 8, canTow: false, canCarryStandard: false, capacity: 0,")
src = src.replace("reloadTicks: 40, canTow: false,",
                  "reloadTicks: 40, canTow: false, canCarryStandard: false, capacity: 0,")
src = src.replace("""    speed: 40, range: 768, minRange: 0, hp: 80, damage: 5, indirect: false, reloadTicks: 20,
    canTow: true,
  }),
});""",
"""    speed: 40, range: 768, minRange: 0, hp: 80, damage: 5, indirect: false, reloadTicks: 20,
    canTow: true, canCarryStandard: false, capacity: 0,
  }),
  // Rescue Update 9A (rulings Q1/Q2): the Command Carrier is the ONLY chassis
  // that can take the enemy standard, and it will carry downed operators (9B).
  [UNIT_CARRIER]: Object.freeze({
    id: UNIT_CARRIER, name: "carrier",
    speed: 24, range: 768, minRange: 0, hp: 120, damage: 5, indirect: false, reloadTicks: 25,
    canTow: false, canCarryStandard: true, capacity: 2,
  }),
});""")
open(p, "w").write(src)

# 2. standards.js: carrier gate + auto-return constant
p = "engine/standards.js"
src = open(p).read()
src = src.replace('import { ASSET_DISABLED, ASSET_SALVAGED } from "./state.js";',
'''import { ASSET_DISABLED, ASSET_SALVAGED } from "./state.js";
import { getUnitStats } from "./units.js";''')
src = src.replace("""// Carrying the prize slows you down: 192/256 = 0.75x speed.
export const CARRIER_SPEED_NUM = 192;
export const CARRIER_SPEED_DEN = 256;""",
"""// Carrying the prize slows you down: 192/256 = 0.75x speed.
export const CARRIER_SPEED_NUM = 192;
export const CARRIER_SPEED_DEN = 256;

// Anti-deadlock (ruling Q2): a standard left DROPPED this long walks home by
// itself. 600 ticks = 60 s.
export const AUTO_RETURN_TICKS = 600;""")
src = src.replace("""    carrierAssetId: -1,
    status: STD_AT_BASE,
  }));""",
"""    carrierAssetId: -1,
    status: STD_AT_BASE,
    droppedTimer: 0,
  }));""")
src = src.replace("""// The standard (if any) lying on the asset's cell that this asset may pick up:
// only the ENEMY standard, only when grounded (at base or dropped).
export function standardTakeableBy(state, asset) {
  if (isWreck(asset)) return null;""",
"""// The standard (if any) lying on the asset's cell that this asset may pick up:
// only the ENEMY standard, only when grounded, and ONLY by a Command Carrier
// (ruling: carrying is Carrier-exclusive as of 9A).
export function standardTakeableBy(state, asset) {
  if (isWreck(asset)) return null;
  if (!getUnitStats(asset.type).canCarryStandard) return null;""")
open(p, "w").write(src)

# 3. state.js fielding: explicit reserve list, AI slots get carrier+truck
p = "engine/state.js"
src = open(p).read()
src = src.replace("""const SPAWN_ROWS = [56, 58, 60, 62];
const SPAWN_TYPES = [0, 0, 1, 2];
const RESERVE_TYPES = [0, 1, 2, 3];""",
"""const SPAWN_ROWS = [56, 58, 60, 62];
const SPAWN_TYPES = [0, 0, 1, 2];
// 9A: explicit 12-slot reserve mix. The first four are AI-crewed (ops 24-27 /
// 28-31): carrier, truck, scout, tank — so AI regents can raid AND rescue.
// Per-team totals: 5 tanks, 3 scouts, 3 artillery, 3 trucks, 2 carriers.
const RESERVE_TYPES = [4, 3, 1, 0, 0, 1, 2, 3, 2, 3, 0, 4];""")
src = src.replace("        assets.push(makeFieldAsset(id, RESERVE_TYPES[slot % 4], team, col, row));",
                  "        assets.push(makeFieldAsset(id, RESERVE_TYPES[slot % 12], team, col, row));")
open(p, "w").write(src)

# 4. reducer: droppedTimer lifecycle + auto-return in advance_tick
p = "engine/reducer.js"
src = open(p).read()
src = src.replace("""import {
  assetCarries, standardTakeableBy, standardReturnableBy, canScore,
  STD_AT_BASE, STD_CARRIED, STD_DROPPED, STD_SCORED,
  CARRIER_SPEED_NUM, CARRIER_SPEED_DEN,
} from "./standards.js";""",
"""import {
  assetCarries, standardTakeableBy, standardReturnableBy, canScore,
  STD_AT_BASE, STD_CARRIED, STD_DROPPED, STD_SCORED,
  CARRIER_SPEED_NUM, CARRIER_SPEED_DEN, AUTO_RETURN_TICKS,
} from "./standards.js";""")
src = src.replace("""      takeable.status = STD_CARRIED;
      takeable.carrierAssetId = asset.id;""",
"""      takeable.status = STD_CARRIED;
      takeable.carrierAssetId = asset.id;
      takeable.droppedTimer = 0;""")
src = src.replace("""      returnable.status = STD_AT_BASE;
      returnable.carrierAssetId = -1;""",
"""      returnable.status = STD_AT_BASE;
      returnable.carrierAssetId = -1;
      returnable.droppedTimer = 0;""")
src = src.replace("""  // Carried standards ride with their carriers (8B); towed wrecks follow (8D).""",
"""  // Anti-deadlock (9A): a standard left dropped long enough returns home.
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
  // Carried standards ride with their carriers (8B); towed wrecks follow (8D).""")
src = src.replace("""      carried.status = STD_DROPPED;
      carried.carrierAssetId = -1;
      carried.x = target.x;
      carried.y = target.y;""",
"""      carried.status = STD_DROPPED;
      carried.carrierAssetId = -1;
      carried.droppedTimer = 0;
      carried.x = target.x;
      carried.y = target.y;""")
open(p, "w").write(src)

# 5. hash: droppedTimer (snapshot + 1a test hash fn)
for f in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    src = open(f).read()
    src = src.replace("w.writeI32LE(st.carrierAssetId); w.writeI32LE(st.status);",
                      "w.writeI32LE(st.carrierAssetId); w.writeI32LE(st.status);\n    w.writeI32LE(st.droppedTimer); // added 9A")
    open(f, "w").write(src)

# 6. ai_regency: raider = first operable canCarryStandard asset
p = "engine/ai_regency.js"
src = open(p).read()
src = src.replace("""// Objective doctrine (backend standard-war sims): each team's scout agent is
// the designated raider. Deterministic by construction.
const RAIDER_ASSET = Object.freeze({ 0: 2, 1: 6 });""",
"""// Objective doctrine: since 9A only Command Carriers can take the enemy
// standard, the raider role goes to the first controlled operable carrier.""")
src = src.replace("""      if (recovererFor[a.team] === -1) recovererFor[a.team] = operatorId;
      if (a.id === RAIDER_ASSET[a.team]) scoutAlive[a.team] = true;
      // Fallback raiders come only from fixed agents: a lone regented slot
      // (dropped human) plays relays, it does not solo-raid across the map.
      if (agent) raiderFor[a.team] = a.id;
    }
    for (const team of [0, 1]) {
      if (scoutAlive[team]) raiderFor[team] = RAIDER_ASSET[team];
    }""",
"""      if (recovererFor[a.team] === -1) recovererFor[a.team] = operatorId;
      if (raiderFor[a.team] === -1 && getUnitStats(a.type).canCarryStandard) {
        raiderFor[a.team] = a.id; // first operable controlled carrier raids
      }
    }""")
src = src.replace("""    const recovererFor = { 0: -1, 1: -1 };
    const raiderFor = { 0: -1, 1: -1 };
    const scoutAlive = { 0: false, 1: false };""",
"""    const recovererFor = { 0: -1, 1: -1 };
    const raiderFor = { 0: -1, 1: -1 };""")
open(p, "w").write(src)

# 7. resolver + feedback
p = "client/js/asset_resolver.js"
src = open(p).read()
src = src.replace('const CHASSIS_NAMES = { 0: "tank", 1: "scout", 2: "artillery", 3: "logistics" };',
                  'const CHASSIS_NAMES = { 0: "tank", 1: "scout", 2: "artillery", 3: "logistics", 4: "carrier" };')
open(p, "w").write(src)
print("9A engine edits done")
