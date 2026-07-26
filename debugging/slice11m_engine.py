# Slice 11M: second map prep (prompt 19). Profile-parameterized layout:
# relays, standard homes, and AI patrols become per-profile; riverline
# joins the registry; the server/replay stack carries the profile through
# resets and archives. Frontier values unchanged -> no fixture repin.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── state.js: registry + per-profile layout ──────────────────────────────────
patch("engine/state.js",
"""import { generateFrontierCorridor, FRONTIER_CORRIDOR } from "./frontier_corridor.js";""",
"""import { generateFrontierCorridor, FRONTIER_CORRIDOR } from "./frontier_corridor.js";
import { generateRiverline } from "./riverline.js";""")
patch("engine/state.js",
"""  frontier_corridor: generateFrontierCorridor,""",
"""  frontier_corridor: generateFrontierCorridor,
  riverline: generateRiverline, // 11M""")

src = open("engine/state.js").read()
assert "const RELAY_CELLS = [" in src
patch("engine/state.js",
"""const RELAY_CELLS = [
  { cellX: 32, cellY: 63 },
  { cellX: 58, cellY: 63 },
  { cellX: 69, cellY: 63 },
  { cellX: 95, cellY: 63 },
];""",
"""const RELAY_CELLS = [
  { cellX: 32, cellY: 63 },
  { cellX: 58, cellY: 63 },
  { cellX: 69, cellY: 63 },
  { cellX: 95, cellY: 63 },
];

// 11M: per-profile layout — what differs between maps. Spawns and bases
// are shared (both maps use the same corridor-flank arrangement). Every
// entry MUST keep the mirror invariant: pairs at x and 127-x.
export const MAP_LAYOUTS = Object.freeze({
  frontier_corridor: Object.freeze({
    relayCells: RELAY_CELLS,
    standardHomes: [{ cellX: 14, cellY: 59 }, { cellX: 113, cellY: 59 }],
  }),
  riverline: Object.freeze({
    // Mirrored pairs north and south of the road: 44<->83.
    relayCells: [
      { cellX: 44, cellY: 32 }, { cellX: 83, cellY: 32 },
      { cellX: 44, cellY: 95 }, { cellX: 83, cellY: 95 },
    ],
    standardHomes: [{ cellX: 14, cellY: 59 }, { cellX: 113, cellY: 59 }],
  }),
});""")

patch("engine/state.js",
"""function createSites() {
  return RELAY_CELLS.map((pos, id) => ({""",
"""function createSites(profileName = "frontier_corridor") {
  const cellsFor = MAP_LAYOUTS[profileName]?.relayCells ?? RELAY_CELLS;
  return cellsFor.map((pos, id) => ({""")

# createInitialState: remember the profile, build per-profile sites/standards.
patch("engine/state.js",
"""    sites = createSites();
    bases = createBases();""",
"""    sites = createSites(typeof mapArg === "string" ? mapArg : "frontier_corridor");
    bases = createBases();""")
patch("engine/state.js",
"""    standards = createStandards();""",
"""    standards = createStandards(
      MAP_LAYOUTS[typeof mapArg === "string" ? mapArg : "frontier_corridor"]?.standardHomes
    );""")

src = open("engine/state.js").read()
assert "mapProfile" not in src
patch("engine/state.js",
"""    downed: [], // 9B: operators on foot""",
"""    mapProfile: typeof mapArg === "string" ? mapArg : "frontier_corridor", // 11M
    downed: [], // 9B: operators on foot""")

# ── standards.js: homes parameterized (frontier default) ─────────────────────
patch("engine/standards.js",
"""export function createStandards() {
  return STANDARD_HOMES.map((home, team) => ({""",
"""export function createStandards(homes = STANDARD_HOMES) {
  return (homes ?? STANDARD_HOMES).map((home, team) => ({""")

# ── ai_regency: per-profile patrols ──────────────────────────────────────────
patch("engine/ai_regency.js",
"""// 11C: exact mirrors (x' = 127-x), each crossing its team's mid relay.
const TEAM_A_PATROL = Object.freeze([[48, 56], [60, 56], [58, 63], [56, 70]]);
const TEAM_B_PATROL = Object.freeze([[79, 56], [67, 56], [69, 63], [71, 70]]);

function patrolTarget(agent, tick) {
  const patrol = agent.team === 0 ? TEAM_A_PATROL : TEAM_B_PATROL;
  const phase = ((tick / 80) | 0) + (agent.assetId & 3);
  return patrol[phase % patrol.length];
}""",
"""// 11C: exact mirrors (x' = 127-x), each crossing its team's mid relay.
// 11M: patrols are per-map — riverline routes swing north and south
// through the bridge lines and past both relay pairs.
const PATROLS = Object.freeze({
  frontier_corridor: Object.freeze({
    0: [[48, 56], [60, 56], [58, 63], [56, 70]],
    1: [[79, 56], [67, 56], [69, 63], [71, 70]],
  }),
  riverline: Object.freeze({
    0: [[44, 33], [52, 63], [44, 94], [36, 63]],
    1: [[83, 33], [75, 63], [83, 94], [91, 63]],
  }),
});

function patrolTarget(agent, tick, profileName = "frontier_corridor") {
  const set = PATROLS[profileName] ?? PATROLS.frontier_corridor;
  const patrol = set[agent.team === 0 ? 0 : 1];
  const phase = ((tick / 80) | 0) + (agent.assetId & 3);
  return patrol[phase % patrol.length];
}""")
patch("engine/ai_regency.js",
"""      if (!target && agent && this.difficulty !== AI_HARD) {
        target = patrolTarget(agent, state.tick);
      } else if (!target) {
        const relay = nearestUnownedRelay(state, asset);
        if (relay) target = [relay.cellX, relay.cellY];
        else if (agent) target = patrolTarget(agent, state.tick);
      }""",
"""      if (!target && agent && this.difficulty !== AI_HARD) {
        target = patrolTarget(agent, state.tick, state.mapProfile);
      } else if (!target) {
        const relay = nearestUnownedRelay(state, asset);
        if (relay) target = [relay.cellX, relay.cellY];
        else if (agent) target = patrolTarget(agent, state.tick, state.mapProfile);
      }""")

# ── server: the profile survives resets; replay meta carries it ──────────────
patch("engine/server.js",
"""    this.state = createInitialState(options.mapSeed ?? 0, options.mapProfile ?? "frontier_corridor");""",
"""    this.mapProfile = options.mapProfile ?? "frontier_corridor"; // 11M
    this.state = createInitialState(options.mapSeed ?? 0, this.mapProfile);""")
patch("engine/server.js",
"""    this.state = createInitialState(mapSeed >>> 0, "frontier_corridor");""",
"""    this.state = createInitialState(mapSeed >>> 0, this.mapProfile); // 11M""")
patch("server/index.js",
"""    return replayStore.save({
      mapSeed: gameServer.state.mapSeed,""",
"""    return replayStore.save({
      mapSeed: gameServer.state.mapSeed,
      mapProfile: gameServer.state.mapProfile, // 11M""")
patch("client/js/replay_engine.js",
"""  const initial = createInitialState(record.meta.mapSeed >>> 0, "frontier_corridor");""",
"""  const initial = createInitialState(
    record.meta.mapSeed >>> 0, record.meta.mapProfile ?? "frontier_corridor");""")

# Server CLI: MAP env picks the profile.
patch("server/index.js",
"""  const appServer = createAppServer({ mapSeed, aiDifficulty, enableAi: true });""",
"""  const mapProfile = process.env.MAP ?? "frontier_corridor"; // 11M
  const appServer = createAppServer({ mapSeed, aiDifficulty, mapProfile, enableAi: true });""")
print("11M patched")
