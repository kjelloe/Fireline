# Slice 11B: Battlefield-2-style capture countdown (prompt 16 Q3).
# Contested relays freeze; a lone team neutralizes (~3 s) then captures
# (~3 s). Per-site captureProgress/capturingTeam in hashed state.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# sites.js: the configurable countdown constants.
patch("engine/sites.js",
"""export const RELAY_FOG_CELLS = 16;""",
"""export const RELAY_FOG_CELLS = 16;

// 11B (prompt 16 Q3): Battlefield-2-inspired capture countdown, configurable.
// A lone team on a relay first drains it to NEUTRAL, then captures it.
export const SITE_NEUTRALIZE_TICKS = 30; // ~3 s enemy -> neutral
export const SITE_CAPTURE_TICKS = 30;    // ~3 s neutral -> yours""")

# state.js: per-site countdown bookkeeping.
patch("engine/state.js",
"""    id, type: 1 /* SITE_RELAY */, owner: -1 /* SITE_NEUTRAL */,""",
"""    id, type: 1 /* SITE_RELAY */, owner: -1 /* SITE_NEUTRAL */,
    captureProgress: 0, capturingTeam: -1, // 11B countdown""")

# reducer: replace the instant-flip pass with the countdown pass.
patch("engine/reducer.js",
"""  for (const asset of next.assets) {
    const site = captureCheck(next, asset.id);
    if (site && site.owner !== asset.team) {
      site.owner = asset.team;
      next.teamScores[asset.team] += SCORE_CAPTURE;
      next.events.push({ type: "site_captured", siteId: site.id, team: asset.team });
    }
  }""",
"""  // 11B capture pass: BF2-style countdown. Contested = frozen; empty =
  // progress drains; a lone team neutralizes the enemy flag, then raises
  // its own. Stable site order; team presence from operable assets only.
  {
    const present = new Map(); // siteId -> bitmask of teams standing on it
    for (const asset of next.assets) {
      const site = captureCheck(next, asset.id);
      if (site) present.set(site.id, (present.get(site.id) ?? 0) | (1 << asset.team));
    }
    for (const site of next.sites) {
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
  }""")
patch("engine/reducer.js",
"""import { captureCheck } from "./sites.js";""",
"""import { captureCheck, SITE_NEUTRALIZE_TICKS, SITE_CAPTURE_TICKS } from "./sites.js";""")

# view: expose the countdown so the client can show a flip bar (public info,
# like ownership itself).
patch("engine/view.js",
"""  const sites = state.sites.map((s) => ({
    id: s.id, type: s.type, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
  }));""",
"""  const sites = state.sites.map((s) => ({
    id: s.id, type: s.type, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
    captureProgress: s.captureProgress, capturingTeam: s.capturingTeam, // 11B
  }));""")

# hashing: snapshot + 1A twin.
for p in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    who = "s" if p.endswith("milestone1a.test.js") else "state"
    src = open(p).read()
    old = "    w.writeI32LE(site.cellX); w.writeI32LE(site.cellY);\n  }" \
        if "site.cellX" in src else \
        "    w.writeI32LE(s.cellX); w.writeI32LE(s.cellY);\n  }"
    var = "site" if "site.cellX" in src else "s"
    new = old.replace("  }",
        f"  w.writeI32LE({var}.captureProgress); w.writeI32LE({var}.capturingTeam); // added 11B\n  }}")
    assert src.count(old) == 1, p
    open(p, "w").write(src.replace(old, new))

# feedback: the neutralize event gets a feed line.
patch("client/js/feedback_model.js",
"""    case "site_captured":""",
"""    case "site_neutralized":
      return e.byTeam === myTeam
        ? `Relay ${e.siteId} neutralized — hold to capture!`
        : `Relay ${e.siteId} is being taken — defend it!`;
    case "site_captured":""")
print("11B patched")
