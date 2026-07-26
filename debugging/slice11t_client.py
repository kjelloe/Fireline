def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

patch("client/index.html",
"""    <div id="settings-overlay" """,
"""    <div id="task-strip" style="position:absolute; right:10px; top:120px; width:230px; display:flex; flex-direction:column; gap:6px; z-index:5;"></div>
    <div id="settings-overlay" """)

p = "client/js/client.js"
patch(p,
"""import { pingOptionsFor } from "./ping_model.js";""",
"""import { pingOptionsFor } from "./ping_model.js";
import { tasksFor } from "./tasks_model.js";""")
patch(p,
"""  updateDirectRing(view);""",
"""  updateDirectRing(view);
  updateTaskStrip(view);""")
patch(p,
"""function updateDirectRing(view) {""",
"""// 11T public tasks (plan 2.4): top mission cards from the pure model.
// Clicking a card jumps the camera there and sends the matching context
// ping — that IS "responding" on the team channel for v2.0.
let lastTaskKey = "";
function updateTaskStrip(view) {
  const el = document.getElementById("task-strip");
  if (!el) return;
  if (joined?.spectator || !joined) {
    if (lastTaskKey !== "") { el.innerHTML = ""; lastTaskKey = ""; }
    return;
  }
  const tasks = tasksFor(view, joined.operatorId).slice(0, 3);
  const key = tasks.map((t) => t.id).join("|");
  if (key === lastTaskKey) return;
  lastTaskKey = key;
  el.innerHTML = "";
  for (const t of tasks) {
    const card = document.createElement("div");
    card.textContent = t.label;
    card.style.cssText =
      "background:rgba(10,14,10,0.78); color:#d8e6c8; padding:7px 10px;" +
      "border-left:3px solid #f5e96b; border-radius:4px; font:12px sans-serif;" +
      "cursor:pointer;";
    card.onclick = () => {
      freeCam.jumpTo(t.cellX, t.cellY);
      send({ type: "ping", kind: t.ping, targetCellX: t.cellX, targetCellY: t.cellY });
    };
    el.appendChild(card);
  }
}

function updateDirectRing(view) {""")
print("11T client patched")
