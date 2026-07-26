# Slice 11U: Playtest-4 fixes (prompt 24).
# 1. Vehicles ran 90° right of travel: the brads->radians conversion
#    assumed models face +x; they are authored facing +z. phi = pi/2 - theta.
# 2. Downed UX: bottom-center banner with the 10 s countdown, then a
#    clickable REDEPLOY button (R still works); on redeploy the camera
#    jumps home and auto-select re-arms.
# 3. Tow UX: adjacency prompt "TOW ASSET N (T)" + T key; mission card
#    turns green "you're on it" while towing.
# 4. Labels: two-line sprites + countdowns (relay capture, repair bay,
#    dropped-standard auto-return, downed redeploy).

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

p = "client/js/client.js"

# ── 1. orientation ───────────────────────────────────────────────────────────
patch(p,
"""    const target = brads !== null ? -(brads * Math.PI * 2) / 256 : null;""",
"""    // 11U: models are authored facing +z; engine theta runs from +x (east)
    // toward +y (south). rotation.y = pi/2 - theta makes barrel follow travel.
    const target = brads !== null ? Math.PI / 2 - (brads * Math.PI * 2) / 256 : null;""")

# ── 4. two-line label sprites ────────────────────────────────────────────────
patch(p,
"""function makeTextSprite(text, colorHex) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 52px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  const w = ctx.measureText(text).width + 40;
  ctx.fillRect((512 - w) / 2, 8, w, 72);
  ctx.fillStyle = colorHex;
  ctx.fillText(text, 256, 62);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false,
  }));
  sprite.scale.set(4.4, 0.85, 1);
  return sprite;
}""",
"""function makeTextSprite(text, colorHex) {
  // 11U: up to two lines ("\\n"-separated) — details and countdowns fit.
  const lines = String(text).split("\\n").slice(0, 2);
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = lines.length > 1 ? 160 : 96;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 52px sans-serif";
  ctx.textAlign = "center";
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect((512 - w) / 2, 8, w, canvas.height - 16);
  ctx.fillStyle = colorHex;
  lines.forEach((line, i) => ctx.fillText(line, 256, 62 + i * 58));
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false,
  }));
  sprite.scale.set(4.4, lines.length > 1 ? 1.45 : 0.85, 1);
  return sprite;
}""")

# ── 4. countdown labels on relays / repairs / dropped standards ──────────────
patch(p,
"""function updateWorldLabels(view) {
  for (const site of view.sites ?? []) {
    const who = site.owner === -1 ? "NEUTRAL" : site.owner === joined?.team ? "YOURS" : "ENEMY";
    const color = site.owner === -1 ? "#cccccc"
      : site.owner === joined?.team ? "#9fe89f" : "#f0a0a0";
    upsertWorldLabel(`site${site.id}`, `RELAY — ${who}`, color,
      site.cellX + 0.5, 2.1, site.cellY + 0.5);
  }
  for (const st of view.standards ?? []) {
    const mine = st.team === joined?.team;
    upsertWorldLabel(`std${st.team}`,
      mine ? "YOUR STANDARD" : "ENEMY STANDARD — STEAL IT",
      mine ? "#9fe89f" : "#ffd75e",
      st.x / CELL + 0.5, 2.6, st.y / CELL + 0.5);
  }
}""",
"""function updateWorldLabels(view) {
  for (const site of view.sites ?? []) {
    const who = site.owner === -1 ? "NEUTRAL" : site.owner === joined?.team ? "YOURS" : "ENEMY";
    let color = site.owner === -1 ? "#cccccc"
      : site.owner === joined?.team ? "#9fe89f" : "#f0a0a0";
    let detail = null;
    if (site.hp === 0) {
      detail = "DAMAGED — truck + materiel rebuilds";
      color = "#c9b28a";
    } else if (site.captureProgress > 0 && site.capturingTeam !== -1) {
      // 11U: the flip countdown, live over the flag.
      const phase = site.owner === -1 ? "RAISING" : "DROPPING";
      const secs = Math.ceil((30 - site.captureProgress) / 10);
      const hostile = site.capturingTeam !== joined?.team;
      detail = `${phase} ${secs}s${hostile ? " — DEFEND!" : ""}`;
      color = hostile ? "#ffb066" : "#f5e96b";
    }
    upsertWorldLabel(`site${site.id}`,
      detail ? `RELAY — ${who}\\n${detail}` : `RELAY — ${who}`, color,
      site.cellX + 0.5, 2.1, site.cellY + 0.5);
  }
  for (const st of view.standards ?? []) {
    const mine = st.team === joined?.team;
    let text = mine ? "YOUR STANDARD" : "ENEMY STANDARD — STEAL IT";
    if (st.status === 2) { // DROPPED: the auto-return countup matters
      const secs = Math.max(0, Math.ceil((600 - (st.droppedTimer ?? 0)) / 10));
      text = (mine ? "YOUR STANDARD IS DOWN" : "ENEMY STANDARD IN THE OPEN") +
        `\\nauto-returns in ${secs}s`;
    }
    upsertWorldLabel(`std${st.team}`, text,
      mine ? "#9fe89f" : "#ffd75e",
      st.x / CELL + 0.5, 2.6, st.y / CELL + 0.5);
  }
  // 11U: repair bays count down over the hull.
  for (const a of view.friendlyAssets ?? []) {
    const key = `repair${a.id}`;
    if (a.recoverTimer > 0) {
      upsertWorldLabel(key, `REPAIRING ${Math.ceil(a.recoverTimer / 10)}s`, "#8fd4ff",
        a.x / CELL + 0.5, 1.5, a.y / CELL + 0.5);
    } else {
      const entry = worldLabels.get(key);
      if (entry) { scene.remove(entry.sprite); worldLabels.delete(key); }
    }
  }
}""")

# ── 2+3. the action banner (downed countdown + tow prompt) ───────────────────
patch("client/index.html",
"""    <div id="task-strip" """,
"""    <div id="action-banner" style="display:none; position:absolute; bottom:70px; left:50%; transform:translateX(-50%); background:rgba(10,10,14,0.85); color:#ffd75e; padding:10px 22px; border-radius:8px; font:bold 16px sans-serif; z-index:6; cursor:pointer; text-align:center;"></div>
    <div id="task-strip" """)

patch(p,
"""// 11T public tasks (plan 2.4): top mission cards from the pure model.""",
"""// 11U: the one-action banner — DOWN countdown/redeploy, or the tow
// prompt. Clicking it performs the action; the key shortcut still works.
let bannerAction = null;
function updateActionBanner(view) {
  const el = document.getElementById("action-banner");
  if (!el || !joined || joined.spectator) return;
  let text = null;
  bannerAction = null;
  const myDown = view?.downedOperators?.find((d) => d.operatorId === joined.operatorId);
  if (myDown) {
    const wait = Math.ceil((100 - (myDown.downTicks ?? 0)) / 10);
    if (wait > 0) {
      text = `YOU ARE DOWN — redeploy in ${wait}s`;
    } else {
      text = "REDEPLOY NOW (R) — or crawl to a carrier";
      bannerAction = () => send({ type: "redeploy" });
    }
  } else {
    const wreck = adjacentTowableWreck(view);
    if (wreck) {
      text = `TOW ASSET ${wreck.id} (T)`;
      bannerAction = () => send({ type: "tow_order", wreckAssetId: wreck.id });
    }
  }
  if (text) {
    if (el.textContent !== text) el.textContent = text;
    el.style.display = "block";
    el.style.color = bannerAction ? "#9fe89f" : "#ffd75e";
  } else {
    el.style.display = "none";
  }
}

// 11U: the claimable friendly wreck beside my truck, if I drive one.
function adjacentTowableWreck(view) {
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me || me.type !== 3) return null;
  const towingAlready = (view?.friendlyAssets ?? []).some((a) => a.towedBy === me.id);
  if (towingAlready) return null;
  return (view?.friendlyAssets ?? []).find((a) =>
    (a.state === STATE_DISABLED || a.state === 3) &&
    a.towedBy === -1 && a.recoverTimer === 0 && a.id !== me.id &&
    Math.max(Math.abs(Math.floor(a.x / CELL) - Math.floor(me.x / CELL)),
             Math.abs(Math.floor(a.y / CELL) - Math.floor(me.y / CELL))) <= 1) ?? null;
}

// 11T public tasks (plan 2.4): top mission cards from the pure model.""")

patch(p,
"""  updateDirectRing(view);
  updateTaskStrip(view);""",
"""  updateDirectRing(view);
  updateTaskStrip(view);
  updateActionBanner(view);""")

# Banner click + T key + redeploy homecoming.
patch(p,
"""  document.getElementById("btn-spectate").onclick = spectate; // 10A""",
"""  document.getElementById("btn-spectate").onclick = spectate; // 10A
  document.getElementById("action-banner").onclick = () => bannerAction?.(); // 11U""")
patch(p,
"""    if (e.key === "u" || e.key === "U") send({ type: "unboard" });""",
"""    if (e.key === "u" || e.key === "U") send({ type: "unboard" });
    // 11U: T tows the adjacent claimable wreck (same as the banner).
    if (e.key === "t" || e.key === "T") {
      const wreck = adjacentTowableWreck(interpolator.latest());
      if (wreck) send({ type: "tow_order", wreckAssetId: wreck.id });
    }""")
patch(p,
"""    // 10B: arm the Enter-confirm retry for a consequential takeover.""",
"""    // 11U: your redeploy brings the view HOME and re-arms auto-select —
    // the answer to "my camera stayed on my corpse".
    if (e.type === "operator_redeployed" && e.operatorId === joined?.operatorId) {
      const zone = interpolator.latest()?.bases?.find((b) => b.team === joined?.team);
      if (zone) freeCam.jumpTo(zone.x + zone.width / 2, zone.y + zone.height / 2);
      autoSelectSent = false; // pick a fresh garage asset automatically
      mySelectedAssetId = null;
      freeCam.followMode(true);
    }
    // 10B: arm the Enter-confirm retry for a consequential takeover.""")

# ── 3. mission card shows "you're on it" while towing ────────────────────────
patch("client/js/tasks_model.js",
"""  // Claimable friendly wrecks: the rescue fantasy's bread and butter.
  for (const a of (view?.friendlyAssets ?? [])) {
    if ((a.state === 2 || a.state === 3) && a.towedBy === -1 && a.recoverTimer === 0) {
      tasks.push({
        kind: "recover", priority: 5,
        label: `Recover asset ${a.id} — tow it home`,
        cellX: cellOf(a.x), cellY: cellOf(a.y), ping: "recovery_in_progress",
      });
    }
  }""",
"""  // Claimable friendly wrecks: the rescue fantasy's bread and butter.
  const myAsset = (view?.friendlyAssets ?? []).find((a) => a.operatorId === myOperatorId);
  for (const a of (view?.friendlyAssets ?? [])) {
    if (a.state !== 2 && a.state !== 3) continue;
    if (a.recoverTimer > 0) continue;
    if (myAsset && a.towedBy === myAsset.id) {
      // 11U: you're on it — the card flips to in-progress.
      tasks.push({
        kind: "towing_now", priority: 2, mine: true,
        label: `Towing asset ${a.id} — head home`,
        cellX: cellOf(a.x), cellY: cellOf(a.y), ping: "recovery_in_progress",
      });
    } else if (a.towedBy === -1) {
      tasks.push({
        kind: "recover", priority: 5,
        label: `Recover asset ${a.id} — tow it home`,
        cellX: cellOf(a.x), cellY: cellOf(a.y), ping: "recovery_in_progress",
      });
    }
  }""")
patch(p,
"""    card.style.cssText =
      "background:rgba(10,14,10,0.78); color:#d8e6c8; padding:7px 10px;" +
      "border-left:3px solid #f5e96b; border-radius:4px; font:12px sans-serif;" +
      "cursor:pointer;";""",
"""    card.style.cssText =
      "background:rgba(10,14,10,0.78); color:#d8e6c8; padding:7px 10px;" +
      `border-left:3px solid ${t.mine ? "#57c46b" : "#f5e96b"}; border-radius:4px;` +
      "font:12px sans-serif; cursor:pointer;";""")
patch(p,
"""  const tasks = tasksFor(view, joined.operatorId).slice(0, 3);
  const key = tasks.map((t) => t.id).join("|");""",
"""  const tasks = tasksFor(view, joined.operatorId).slice(0, 3);
  const key = tasks.map((t) => t.id + (t.mine ? "*" : "")).join("|");""")

patch("client/index.html",
"B board / U unboard",
"B board / U unboard / T tow")
print("11U patched")
