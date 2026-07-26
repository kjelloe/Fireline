def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

p = "client/js/client.js"
patch(p,
"""import { describeEvent, summarizeGameOver } from "./feedback_model.js";""",
"""import { describeEvent, summarizeGameOver } from "./feedback_model.js";
import { pingOptionsFor } from "./ping_model.js";
import { activePings } from "../../engine/pings.js";""")
patch(p,
"""let lastSelectAttempt = -1; // 10B
let pendingTakeover = -1;   // 10B: asset awaiting Enter-confirm""",
"""let lastSelectAttempt = -1; // 10B
let pendingTakeover = -1;   // 10B: asset awaiting Enter-confirm
const teamPings = []; // 10C: recent own-team pings for world labels""")
patch(p,
"""    if (e.key === "m" || e.key === "M") send({ type: "deploy_mine" });""",
"""    if (e.key === "m" || e.key === "M") send({ type: "deploy_mine" });
    // 10C: 1/2/3 send context pings (what they mean depends on your seat).
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      const opts = pingOptionsFor(interpolator.latest(), joined?.operatorId);
      const pick = opts[Number(e.key) - 1];
      if (pick) send({ type: "ping", kind: pick.kind });
    }""")
patch(p,
"""    if (e.type === "rejected" && e.reason === "takeover needs confirmation") {
      pendingTakeover = lastSelectAttempt;
    }""",
"""    if (e.type === "rejected" && e.reason === "takeover needs confirmation") {
      pendingTakeover = lastSelectAttempt;
    }
    if (e.type === "ping") teamPings.push(e); // 10C (view is already team-scoped)""")
patch(p,
"""  updateDownedMeshes(view);
  updateMineMeshes(view);
  updateDroneMeshes(view, performance.now());""",
"""  updateDownedMeshes(view);
  updateMineMeshes(view);
  updateDroneMeshes(view, performance.now());
  updatePingLabels(view);""")
patch(p,
"""function updateDownedMeshes(view) {""",
"""function updatePingLabels(view) {
  const alive = activePings(teamPings, view.tick ?? 0);
  teamPings.length = 0;
  teamPings.push(...alive);
  const live = new Set();
  for (const p of alive) {
    const key = `ping${p.operatorId}`;
    live.add(key);
    upsertWorldLabel(key, `◈ ${(p.kind ?? "").replace(/_/g, " ").toUpperCase()}`,
      "#7fd4ff", p.cellX + 0.5, 1.6, p.cellY + 0.5);
  }
  for (const [key, label] of worldLabels) {
    if (key.startsWith("ping") && !live.has(key)) {
      scene.remove(label.sprite);
      worldLabels.delete(key);
    }
  }
}

function updateDownedMeshes(view) {""")
patch("client/index.html",
"M lay mine · C clear mine · click drone = shoot it",
"M lay mine · C clear mine · click drone = shoot it · 1/2/3 context pings")
print("10C client patched")
