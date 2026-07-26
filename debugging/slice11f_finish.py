def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

patch("engine/snapshot.js",
"""  w.writeI32LE(s.captureProgress); w.writeI32LE(s.capturingTeam); // added 11B""",
"""  w.writeI32LE(s.captureProgress); w.writeI32LE(s.capturingTeam); // added 11B
  w.writeI32LE(s.hp ?? 60); // added 11F""")
patch("test/milestone1a.test.js",
"""  w.writeI32LE(site.captureProgress); w.writeI32LE(site.capturingTeam); // added 11B""",
"""  w.writeI32LE(site.captureProgress); w.writeI32LE(site.capturingTeam); // added 11B
  w.writeI32LE(site.hp ?? 60); // added 11F""")
patch("engine/snapshot.js",
"""    w.writeI32LE(a.campTicks); // added 9G""",
"""    w.writeI32LE(a.campTicks); // added 9G
    w.writeU8(a.materiel ?? 0); // added 11F""")
patch("test/milestone1a.test.js",
"""    w.writeI32LE(a.campTicks); // added 9G""",
"""    w.writeI32LE(a.campTicks); // added 9G
    w.writeU8(a.materiel ?? 0); // added 11F""")

patch("test/helpers.js",
"""    captureProgress: spec.captureProgress ?? 0, capturingTeam: spec.capturingTeam ?? -1, // 11B
  }));""",
"""    captureProgress: spec.captureProgress ?? 0, capturingTeam: spec.capturingTeam ?? -1, // 11B
    hp: spec.hp ?? 60, // 11F
  }));""")
patch("test/helpers.js",
"""    campTicks: spec.campTicks ?? 0, // 9G""",
"""    campTicks: spec.campTicks ?? 0, // 9G
    materiel: spec.materiel ?? 0, // 11F""")

patch("engine/ai_regency.js",
"""      // 11E full AI rescue play (Q5). Trucks: hook the nearest claimable""",
"""      // 11F repair errands (Q9): a truck carrying materiel heads for a
      // damaged own/neutral site nearby; adjacency auto-repairs it.
      if (!target && stats.canTow && asset.materiel === 1) {
        let hurt = null;
        let bestDist = Infinity;
        for (const site of state.sites) {
          if ((site.hp ?? 1) > 0) continue;
          if (site.owner === (asset.team === 0 ? 1 : 0)) continue;
          const d = Math.max(Math.abs(site.cellX - cellX0), Math.abs(site.cellY - cellY0));
          if (d < bestDist) { bestDist = d; hurt = site; }
        }
        if (hurt && bestDist > 1 && bestDist <= RESCUE_SEEK_CELLS) {
          target = [hurt.cellX, hurt.cellY + 1]; // park beside, not on it
        }
      }

      // 11E full AI rescue play (Q5). Trucks: hook the nearest claimable""")

patch("client/js/feedback_model.js",
"""  "no such drone": "That drone is already gone.",""",
"""  "no such site": "No such site.",
  "cannot breach sites": "Only artillery can breach infrastructure.",
  "site already damaged": "That site is already in ruins.",
  "no such drone": "That drone is already gone.",""")
patch("client/js/feedback_model.js",
"""    case "site_neutralized":""",
"""    case "site_shelled": return `Relay ${e.siteId} under artillery fire!`;
    case "site_damaged":
      return `Relay ${e.siteId} is DOWN — a truck with materiel can rebuild it.`;
    case "site_repaired": return `Relay ${e.siteId} rebuilt and humming.`;
    case "materiel_loaded": return null;
    case "site_neutralized":""")
print("11F finished")
