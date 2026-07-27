def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# state: hashed rules block, defaults identical to today's constants.
patch("engine/state.js",
"""export function createInitialState(mapSeed, mapArg = "frontier_corridor") {""",
"""// 13F (playtest 6.7 plumbing): session-tunable rules, hashed. DEFAULTS
// ARE TODAY'S CONSTANTS — passing nothing changes nothing. Difficulty
// presets wire in when the user ratifies numbers (night-2 clarification 3).
export const DEFAULT_RULES = Object.freeze({
  mpgMinOperable: 6, // Slow Manufacture triggers below this many operable
  mpgTicks: 900,     // ...and rebuilds on this cadence
});

export function createInitialState(mapSeed, mapArg = "frontier_corridor", rules = null) {""")
patch("engine/state.js",
"""    mapProfile: typeof mapArg === "string" ? mapArg : "frontier_corridor", // 11M""",
"""    mapProfile: typeof mapArg === "string" ? mapArg : "frontier_corridor", // 11M
    rules: { ...DEFAULT_RULES, ...(rules ?? {}) }, // 13F: hashed session rules""")

# reducer: read rules from state (constants stay as the exported defaults).
patch("engine/reducer.js",
"""    if (operable >= MPG_MIN_OPERABLE) {""",
"""    if (operable >= (next.rules?.mpgMinOperable ?? MPG_MIN_OPERABLE)) {""")
src = open("engine/reducer.js").read()
assert src.count("next.manufacture[team] < MPG_TICKS") == 2
src = src.replace("next.manufacture[team] < MPG_TICKS",
                  "next.manufacture[team] < (next.rules?.mpgTicks ?? MPG_TICKS)")
open("engine/reducer.js", "w").write(src)
patch("engine/reducer.js",
"""    downed: state.downed.map((d) => ({ ...d })),""",
"""    downed: state.downed.map((d) => ({ ...d })),
    rules: { ...state.rules }, // 13F""")

# server carries rules through construction and rotation; replay meta too.
patch("engine/server.js",
"""    this.mapProfile = options.mapProfile ?? "frontier_corridor"; // 11M
    this.state = createInitialState(options.mapSeed ?? 0, this.mapProfile);""",
"""    this.mapProfile = options.mapProfile ?? "frontier_corridor"; // 11M
    this.rules = options.rules ?? null; // 13F: session rules
    this.state = createInitialState(options.mapSeed ?? 0, this.mapProfile, this.rules);""")
patch("engine/server.js",
"""    this.state = createInitialState(mapSeed >>> 0, this.mapProfile); // 11M""",
"""    this.state = createInitialState(mapSeed >>> 0, this.mapProfile, this.rules); // 11M/13F""")
patch("server/index.js",
"""      mapProfile: gameServer.state.mapProfile, // 11M""",
"""      mapProfile: gameServer.state.mapProfile, // 11M
      rules: gameServer.state.rules, // 13F: replays must re-simulate the same law""")
patch("client/js/replay_engine.js",
"""  const initial = createInitialState(
    record.meta.mapSeed >>> 0, record.meta.mapProfile ?? "frontier_corridor");""",
"""  const initial = createInitialState(
    record.meta.mapSeed >>> 0, record.meta.mapProfile ?? "frontier_corridor",
    record.meta.rules ?? null);""")

# hashing (snapshot + 1A twin).
for p in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    who = "state" if p.endswith("snapshot.js") else "s"
    patch(p,
f"""  w.writeI32LE({who}.nextMineId ?? 0); // added 9E""",
f"""  w.writeI32LE({who}.rules?.mpgMinOperable ?? 6); w.writeI32LE({who}.rules?.mpgTicks ?? 900); // added 13F
  w.writeI32LE({who}.nextMineId ?? 0); // added 9E""")
print("13F plumbed")
