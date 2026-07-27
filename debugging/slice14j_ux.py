def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── strings ──────────────────────────────────────────────────────────────────
patch("client/js/strings.js",
'''    "codex.traits": "Traits",''',
'''    "codex.traits": "Traits",
    "toast.mission": "MISSION COMPLETE  +{n} pts",
    "board.title": "TEAM TOP 5",
    "ui.center_me": "⌖ center on me",''')
patch("client/js/strings.js",
'''    "codex.traits": "Egenskaper",''',
'''    "codex.traits": "Egenskaper",
    "toast.mission": "OPPDRAG FULLFØRT  +{n} pts",
    "board.title": "LAGETS TOPP 5",
    "ui.center_me": "⌖ sentrer på meg",''')

# ── index.html: toast, scoreboard, 5-card strip note ─────────────────────────
patch("client/index.html",
'''    <div id="status-panel"''',
'''    <div id="mission-toast" style="display:none; position:absolute; top:32%; left:50%; transform:translateX(-50%); color:#f5e96b; font:bold 26px sans-serif; text-shadow:0 2px 8px #000; z-index:8; pointer-events:none;"></div>
    <div id="team-board" style="position:absolute; left:10px; top:120px; background:rgba(8,10,14,0.8); color:#d8e6c8; padding:6px 10px; border-radius:8px; font:12px sans-serif; z-index:5; min-width:150px;">
        <div id="team-board-head" style="cursor:pointer; font-weight:bold; color:#f5e96b;"></div>
        <div id="team-board-body"></div>
    </div>
    <div id="status-panel"''')

# ── client: everything wires in ──────────────────────────────────────────────
p = "client/js/client.js"

# 5 visible mission cards.
patch(p,
'''  const tasks = tasksFor(view, joined.operatorId).slice(0, 3);''',
'''  const tasks = tasksFor(view, joined.operatorId).slice(0, 5); // 14J: five''')

# Mission toast + scoreboard state.
patch(p,
'''const orderMarkers = []; // 14I: click-order feedback {sprite, bornMs}''',
'''const orderMarkers = []; // 14I: click-order feedback {sprite, bornMs}
let lastMyScore = null; // 14J: mission-complete toast trigger
let toastUntil = 0;
let boardCollapsed = localStorage.getItem("mf_board_collapsed") === "1";''')

# Score-delta toast + scoreboard update, in the view pipeline.
patch(p,
'''  updateOrderMarkers(performance.now());
  updateStatusPanel(view);
  updateHoverTip(view);''',
'''  updateOrderMarkers(performance.now());
  updateStatusPanel(view);
  updateHoverTip(view);
  updateMissionToast(view);
  updateTeamBoard(view);
  updateTargetRings(view);''')

patch(p,
'''// 14I: the lower-center status panel — the "why am I not firing" answers.''',
'''// 14J (playtest 6.5): Recognition made LOUD — your score rising IS a
// mission completing; toast it center screen with the points.
function updateMissionToast(view) {
  const el = document.getElementById("mission-toast");
  if (!el || joined?.spectator) return;
  const mine = (view?.operators ?? []).find((o) => o.id === joined?.operatorId);
  if (mine) {
    if (lastMyScore !== null && mine.score > lastMyScore) {
      el.textContent = t("toast.mission", { n: mine.score - lastMyScore });
      el.style.display = "block";
      toastUntil = performance.now() + 2600;
    }
    lastMyScore = mine.score;
  }
  if (el.style.display === "block") {
    const left = toastUntil - performance.now();
    if (left <= 0) el.style.display = "none";
    else el.style.opacity = String(Math.min(1, left / 800));
  }
}

// 14J (playtest 6.5): the collapsible team top-5, left side.
let boardKey = "";
function updateTeamBoard(view) {
  const head = document.getElementById("team-board-head");
  const body = document.getElementById("team-board-body");
  if (!head || !body || !joined || joined.spectator) return;
  const top = (view?.operators ?? [])
    .filter((o) => o.team === joined.team && o.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, 5);
  const key = boardCollapsed + "|" + top.map((o) => `${o.id}:${o.score}`).join(",");
  if (key === boardKey) return;
  boardKey = key;
  head.textContent = `${t("board.title")} ${boardCollapsed ? "▸" : "▾"}`;
  head.onclick = () => {
    boardCollapsed = !boardCollapsed;
    localStorage.setItem("mf_board_collapsed", boardCollapsed ? "1" : "0");
    boardKey = "";
  };
  body.innerHTML = boardCollapsed ? "" : top.map((o) =>
    `<div${o.id === joined.operatorId ? ' style="color:#f5e96b;"' : ""}>` +
    `${o.id < 16 ? "Op" : "Regent"} ${o.id} — ${o.score}</div>`).join("") ||
    (boardCollapsed ? "" : "<div style='color:#667'>—</div>");
}

// 14J (playtest 6.9): golden rings on nearby applicable mission targets.
const targetRings = new Map(); // task id -> mesh
function updateTargetRings(view) {
  const live = new Set();
  if (joined && !joined.spectator) {
    const tasks = tasksFor(view, joined.operatorId).slice(0, 5);
    for (const task of tasks) {
      if (task.distance > 15 || task.mine) continue; // close in first
      live.add(task.id);
      let ring = targetRings.get(task.id);
      if (!ring) {
        ring = new THREE.Mesh(
          new THREE.RingGeometry(0.85, 1.05, 40),
          new THREE.MeshBasicMaterial({ color: 0xf5c84a, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        scene.add(ring);
        targetRings.set(task.id, ring);
      }
      ring.position.set(task.cellX + 0.5, 0.06, task.cellY + 0.5);
      const pulse = 1 + 0.12 * Math.sin(performance.now() / 260);
      ring.scale.set(pulse, pulse, 1);
    }
  }
  for (const [id, ring] of targetRings) {
    if (!live.has(id)) {
      scene.remove(ring);
      targetRings.delete(id);
    }
  }
}

// 14I: the lower-center status panel — the "why am I not firing" answers.''')

# Center-on-me button on the status panel (item 8).
patch(p,
'''  if (s.canRequestSupplies) {
    html += `<button id="btn-request-supplies" class="btn" style="margin-top:4px; font-size:12px; padding:2px 10px;">${t("status.request")}</button>`;
  }
  el.innerHTML = html;
  const btn = document.getElementById("btn-request-supplies");
  if (btn) btn.onclick = () => send({ type: "ping", kind: "need_supplies" });''',
'''  if (s.canRequestSupplies) {
    html += `<button id="btn-request-supplies" class="btn" style="margin-top:4px; font-size:12px; padding:2px 10px;">${t("status.request")}</button>`;
  }
  html += ` <button id="btn-center-me" class="btn" style="margin-top:4px; font-size:12px; padding:2px 10px;">${t("ui.center_me")}</button>`;
  el.innerHTML = html;
  const btn = document.getElementById("btn-request-supplies");
  if (btn) btn.onclick = () => send({ type: "ping", kind: "need_supplies" });
  const center = document.getElementById("btn-center-me");
  if (center) center.onclick = () => freeCam.followMode(true); // 14J item 8''')

# Buildings must never cover roads (item 6): footprint terrain check.
patch(p,
'''    for (const piece of baseCompound(b, b.team === 1)) {
      const spec = BUILDING[piece.kind];
      if (!spec) continue;''',
'''    for (const piece of baseCompound(b, b.team === 1)) {
      const spec = BUILDING[piece.kind];
      if (!spec) continue;
      // 14J (playtest 6.6): roads are sacred — no structure may cover a
      // road or path cell (approximate 2-cell footprint check).
      if (coversProtectedTerrain(piece.x, piece.y, piece.kind === "hq" ? 1.4 : 0.9)) continue;''')
patch(p,
'''// 14A: one-time war dressing — antenna clutter at relays, plinths at the''',
'''// 14J: does a footprint touch road (1) or trail (5)? Those stay clear.
function coversProtectedTerrain(x, y, half) {
  if (!cachedMap) return false;
  for (const cx of [Math.floor(x - half), Math.floor(x + half)]) {
    for (const cy of [Math.floor(y - half), Math.floor(y + half)]) {
      const terrain = cachedMap.cells[cy * cachedMap.width + cx];
      if (terrain === 1 || terrain === 5) return true;
    }
  }
  return false;
}

// 14A: one-time war dressing — antenna clutter at relays, plinths at the''')
patch(p,
'''  for (const s of view.sites ?? []) {
    for (const [dx, dz, w, h] of [[-0.9, 0.4, 0.25, 0.35], [0.8, -0.6, 0.3, 0.2], [0.7, 0.7, 0.2, 0.5]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), dark);
      crate.position.set(s.cellX + 0.5 + dx, h / 2, s.cellY + 0.5 + dz);
      dressingGroup.add(crate);
    }
  }''',
'''  for (const s of view.sites ?? []) {
    for (const [dx, dz, w, h] of [[-0.9, 0.4, 0.25, 0.35], [0.8, -0.6, 0.3, 0.2], [0.7, 0.7, 0.2, 0.5]]) {
      // 14J: relay clutter respects the road too.
      if (coversProtectedTerrain(s.cellX + 0.5 + dx, s.cellY + 0.5 + dz, w / 2 + 0.1)) continue;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), dark);
      crate.position.set(s.cellX + 0.5 + dx, h / 2, s.cellY + 0.5 + dz);
      dressingGroup.add(crate);
    }
  }''')
print("14J patched")
