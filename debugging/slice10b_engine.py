# Slice 10B (plan 2.2): takeover confirmations — spec 02 §9.
# Claiming an uncrewed asset in a consequential state (carrying the
# standard, towing a wreck, passengers aboard) needs confirm: true.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# reducer: the gate sits right before the seat swap in applySelectAsset.
patch("engine/reducer.js",
"""  if (operator.assetId !== -1 && operator.assetId !== asset.id) {
    const previous = next.assets[operator.assetId];
    if (previous && previous.operatorId === operator.id) previous.operatorId = -1;
  }
  operator.assetId = asset.id;""",
"""  // 10B (spec 02 §9): claiming an asset in a consequential state demands an
  // explicit confirmation — you are about to inherit the standard run, a
  // rescue tow, or living passengers.
  if (asset.operatorId === -1 && command.confirm !== true) {
    const consequential =
      assetCarries(next, asset.id) !== null ||
      towedWreck(next, asset.id) !== null ||
      asset.aboard1 !== -1 || asset.aboard2 !== -1;
    if (consequential) return reject(next, command, "takeover needs confirmation");
  }
  if (operator.assetId !== -1 && operator.assetId !== asset.id) {
    const previous = next.assets[operator.assetId];
    if (previous && previous.operatorId === operator.id) previous.operatorId = -1;
  }
  operator.assetId = asset.id;""")

# commands: confirm is an optional boolean on select_asset.
patch("engine/commands.js",
"""    case CMD_SELECT_ASSET:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.assetId, 63))     return { ok: false, reason: "invalid assetId" };
      return { ok: true };""",
"""    case CMD_SELECT_ASSET:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.assetId, 63))     return { ok: false, reason: "invalid assetId" };
      if (cmd.confirm !== undefined && typeof cmd.confirm !== "boolean") {
        return { ok: false, reason: "invalid confirm" }; // 10B
      }
      return { ok: true };""")

# AI regency continues safely (spec 02 §9): regents always confirm.
patch("engine/ai_regency.js",
"""        commands.push({ type: CMD_SELECT_ASSET, operatorId: agent.operatorId, assetId: agent.assetId });""",
"""        commands.push({ type: CMD_SELECT_ASSET, operatorId: agent.operatorId, assetId: agent.assetId, confirm: true });""")
patch("engine/ai_regency.js",
"""          commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: pick });""",
"""          commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: pick, confirm: true });""")

# view: the client needs aboard1/2 to explain WHAT it is confirming.
patch("engine/view.js",
"""      heading: a.heading, minesLeft: a.minesLeft,""",
"""      heading: a.heading, minesLeft: a.minesLeft,
      aboard1: a.aboard1, aboard2: a.aboard2, // 10B: takeover context""")

# feedback text for the new rejection reason (8H coverage test enforces).
patch("client/js/feedback_model.js",
"""  "no such drone": "That drone is already gone.",""",
"""  "takeover needs confirmation":
    "That asset carries real responsibility — press ENTER to confirm the takeover, ESC to cancel.",
  "no such drone": "That drone is already gone.",""")

# client: on the rejection, arm a pending takeover; Enter resends confirmed.
patch("client/js/client.js",
"""  if (cmd.type === "select_asset") mySelectedAssetId = cmd.assetId;""",
"""  if (cmd.type === "select_asset") {
    mySelectedAssetId = cmd.assetId;
    lastSelectAttempt = cmd.assetId; // 10B: may need a confirmed retry
  }""")
patch("client/js/client.js",
"""const droneMeshes = new Map(); // droneId -> Mesh (9G)""",
"""const droneMeshes = new Map(); // droneId -> Mesh (9G)
let lastSelectAttempt = -1; // 10B
let pendingTakeover = -1;   // 10B: asset awaiting Enter-confirm""")
patch("client/js/client.js",
"""    if (e.key === "r" || e.key === "R") send({ type: "redeploy" }); // 9B""",
"""    if (e.key === "r" || e.key === "R") send({ type: "redeploy" }); // 9B
    // 10B: Enter confirms a pending consequential takeover; Esc declines.
    if (e.key === "Enter" && pendingTakeover !== -1) {
      send({ type: "select_asset", assetId: pendingTakeover, confirm: true });
      pendingTakeover = -1;
    }
    if (e.key === "Escape") pendingTakeover = -1;""")
print("10B patched")
