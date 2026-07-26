def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

patch("client/js/feedback_model.js",
"""  "war is over": "The war is over — next one starts shortly.",
});""",
"""  "cannot deploy mines": "Only an assault tank carries mines.",
  "no mines left": "Mine rack empty.",
  "mine already here": "A mine already sits on this ground.",
  "cannot mine a base zone": "Base zones are protected — no mining here.",
  "cannot mine a site": "Sites are protected — no mining here.",
  "cannot clear mines": "Only a logistics truck can clear mines.",
  "no such mine": "No mine there.",
  "too far to clear": "Get adjacent to the mine to clear it.",
  "mine not marked": "Unknown minefield — a scout must mark it first.",
  "war is over": "The war is over — next one starts shortly.",
});""")
patch("client/js/feedback_model.js",
"""    case "asset_disabled": return `Asset ${e.assetId} disabled.`;""",
"""    case "asset_disabled": return `Asset ${e.assetId} disabled.`;
    case "mine_deployed":
      return e.team === myTeam ? `Mine laid (${e.minesLeft} left in the rack).` : null;
    case "mine_marked": return "Scouts marked an enemy mine.";
    case "mine_detonated": return `MINE! Asset ${e.assetId} hit.`;
    case "mine_cleared": return `Mine cleared by asset ${e.assetId}.`;""")
print("feedback patched")
