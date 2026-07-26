def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

patch("server/metrics.js",
"""    manufactured: 0,""",
"""    manufactured: 0,
    minesDeployed: 0,
    minesDetonated: 0,
    minesCleared: 0,""")
patch("server/metrics.js",
"""          case "asset_manufactured": counters.manufactured++; break;""",
"""          case "asset_manufactured": counters.manufactured++; break;
          case "mine_deployed": counters.minesDeployed++; break;
          case "mine_detonated": counters.minesDetonated++; break;
          case "mine_cleared": counters.minesCleared++; break;""")
print("metrics patched")
