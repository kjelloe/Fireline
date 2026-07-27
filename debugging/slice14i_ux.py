def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── ping kind: need_supplies (engine vocab + models) ─────────────────────────
patch("engine/pings.js",
'''  "safe_route",           // scout-marked clean path (Q16)''',
'''  "safe_route",           // scout-marked clean path (Q16)
  "need_supplies",        // 14I: the fuel/ammo mission request''')

# ── strings ──────────────────────────────────────────────────────────────────
patch("client/js/strings.js",
'''    "ping.need_rescue": "NEED RESCUE",''',
'''    "ping.need_rescue": "NEED RESCUE",
    "ping.need_supplies": "NEED SUPPLIES",
    "status.no_fuel": "OUT OF FUEL — a truck can refuel you (V beside you)",
    "status.low_fuel": "Fuel low ({n})",
    "status.no_ammo": "OUT OF AMMO — resupply at base or from a truck",
    "status.low_ammo": "Ammo low ({n})",
    "status.no_supply": "OUT OF SUPPLY — no firing; hold a relay or fall back",
    "status.reloading": "Reloading {s}s",
    "status.suppressed": "Suppressed {s}s — sensors degraded",
    "status.deploying": "Deploying {s}s",
    "status.undeploying": "Undeploying {s}s",
    "status.deployed": "HARDPOINT ACTIVE — undeploy to move",
    "status.request": "REQUEST SUPPLIES",
    "hover.vacant": "{name} — vacant · click to take",
    "hover.stats": "ⓘ stats",
    "codex.traits": "Traits",''')
patch("client/js/strings.js",
'''    "ping.need_rescue": "TRENGER REDNING",''',
'''    "ping.need_rescue": "TRENGER REDNING",
    "ping.need_supplies": "TRENGER FORSYNINGER",
    "status.no_fuel": "TOM FOR DRIVSTOFF — en lastebil kan fylle deg (V ved siden av)",
    "status.low_fuel": "Lite drivstoff ({n})",
    "status.no_ammo": "TOM FOR AMMO — etterforsyn i basen eller fra en lastebil",
    "status.low_ammo": "Lite ammo ({n})",
    "status.no_supply": "UTEN FORSYNING — kan ikke skyte; hold et relé eller trekk tilbake",
    "status.reloading": "Lader om {s}s",
    "status.suppressed": "Undertrykt {s}s — sensorer svekket",
    "status.deploying": "Utplasserer {s}s",
    "status.undeploying": "Pakker {s}s",
    "status.deployed": "STILLING AKTIV — pakk sammen for å flytte",
    "status.request": "BE OM FORSYNINGER",
    "hover.vacant": "{name} — ledig · klikk for å ta",
    "hover.stats": "ⓘ fakta",
    "codex.traits": "Egenskaper",''')

# ── index.html: status panel + hover tooltip + codex panel ───────────────────
patch("client/index.html",
'''    <div id="action-banner"''',
'''    <div id="status-panel" style="display:none; position:absolute; bottom:8px; left:50%; transform:translateX(-50%); background:rgba(8,10,14,0.85); color:#d8e6c8; padding:8px 16px; border-radius:8px; font:13px sans-serif; z-index:5; min-width:340px; text-align:center;"></div>
    <div id="hover-tip" style="display:none; position:absolute; background:rgba(8,10,14,0.92); color:#e8e8d8; padding:5px 10px; border-radius:6px; font:bold 12px sans-serif; z-index:7; border-left:3px solid #f5e96b;"></div>
    <div id="codex-panel" style="display:none; position:absolute; right:10px; bottom:110px; width:250px; background:rgba(8,10,14,0.92); color:#d8e6c8; padding:10px 14px; border-radius:8px; font:12px sans-serif; z-index:7;"></div>
    <div id="action-banner"''')

# ── client wiring ────────────────────────────────────────────────────────────
p = "client/js/client.js"
patch(p,
'''import { updateGhosts, ghostOpacity } from "./ghosts_model.js";''',
'''import { updateGhosts, ghostOpacity } from "./ghosts_model.js";
import { statusFor } from "./status_model.js";
import { codexFor } from "./codex.js";''')

# Facing chevron on every asset mesh (item 4 instrument).
patch(p,
'''  if (!mesh) {
    const resolved = resolveVisual(ASSET_MANIFEST, visualKey);
    mesh = (resolved.kind === "procedural" ? buildProcedural(resolved.key) : null)
      ?? new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x888888 }));''',
'''  if (!mesh) {
    const resolved = resolveVisual(ASSET_MANIFEST, visualKey);
    mesh = (resolved.kind === "procedural" ? buildProcedural(resolved.key) : null)
      ?? new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x888888 }));
    // 14I: an unmissable facing chevron at the model's FRONT (+z). If a
    // unit ever reads as driving backwards, this arrow is the referee.
    const chevGeo = new THREE.ConeGeometry(0.09, 0.22, 3);
    chevGeo.rotateX(Math.PI / 2);
    const chev = new THREE.Mesh(chevGeo,
      new THREE.MeshBasicMaterial({ color: 0xf5e96b }));
    chev.position.set(0, 0.06, 0.55);
    mesh.add(chev);
    mesh.userData.assetId = a.id;''')

# Order markers (item 2).
patch(p,
'''let directRing = null; // 11O: the tracking targeting circle''',
'''let directRing = null; // 11O: the tracking targeting circle
const orderMarkers = []; // 14I: click-order feedback {sprite, bornMs}''')
patch(p,
'''  if (!cmd) return; // direct mode: nothing near the cursor — hold fire''',
'''  if (!cmd) return; // direct mode: nothing near the cursor — hold fire
  spawnOrderMarker(cmd, cellX, cellY); // 14I: show WHAT was ordered WHERE''')
patch(p,
'''function updateDirectRing(view) {''',
'''// 14I: a brief glyph at the click point — the order made visible.
const ORDER_GLYPHS = {
  move_order: ["►", "#f5e96b"],
  fire_order: ["✚", "#ff6b52"],
  tow_order: ["⛓", "#7fd4ff"],
  crawl_order: ["►", "#ffd75e"],
  select_asset: ["✓", "#9fe89f"],
};
function spawnOrderMarker(cmd, cellX, cellY) {
  const g = ORDER_GLYPHS[cmd.type];
  if (!g) return;
  const sprite = makeTextSprite(g[0], g[1]);
  sprite.scale.set(1.2, 1.2, 1);
  sprite.position.set(cellX + 0.5, 0.6, cellY + 0.5);
  scene.add(sprite);
  orderMarkers.push({ sprite, bornMs: performance.now() });
}
function updateOrderMarkers(nowMs) {
  for (let i = orderMarkers.length - 1; i >= 0; i--) {
    const m = orderMarkers[i];
    const age = nowMs - m.bornMs;
    if (age > 1100) {
      scene.remove(m.sprite);
      orderMarkers.splice(i, 1);
    } else {
      m.sprite.material.opacity = 1 - age / 1100;
      m.sprite.material.transparent = true;
      m.sprite.position.y = 0.6 + age / 1100 * 0.5;
    }
  }
}

function updateDirectRing(view) {''')
patch(p,
'''  fogGhosts = updateGhosts(fogGhosts, view, performance.now());
  updateGhostMeshes(performance.now());''',
'''  fogGhosts = updateGhosts(fogGhosts, view, performance.now());
  updateGhostMeshes(performance.now());
  updateOrderMarkers(performance.now());
  updateStatusPanel(view);
  updateHoverTip(view);''')

# Status panel (item 3).
patch(p,
'''// 14I: a brief glyph at the click point — the order made visible.''',
'''// 14I: the lower-center status panel — the "why am I not firing" answers.
let statusKey = "";
function updateStatusPanel(view) {
  const el = document.getElementById("status-panel");
  if (!el) return;
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me || joined?.spectator) {
    if (statusKey !== "") { el.style.display = "none"; statusKey = ""; }
    return;
  }
  const supplied = !(view?.events ?? []).length || true; // engine truth arrives via rejections;
  const s = statusFor(me, { inSupplyNow: me.fuel > 0 ? isSupplied(view, me) : isSupplied(view, me) });
  const key = JSON.stringify([s.hp, s.ammo, s.fuel, s.reasons, s.cargo]);
  if (key === statusKey) return;
  statusKey = key;
  el.style.display = "block";
  const bar = (v, max, color) => {
    const pct = Math.max(0, Math.min(100, Math.round((v / max) * 100)));
    return `<span style="display:inline-block; width:70px; background:#222; border-radius:3px; margin:0 4px; vertical-align:middle;">` +
      `<span style="display:block; width:${pct}%; height:7px; background:${color}; border-radius:3px;"></span></span>`;
  };
  let html = `<b>${s.name}</b> · HP ${s.hp}${bar(s.hp, s.hpMax, "#57c46b")}` +
    `AMMO ${s.ammo}${bar(s.ammo, s.ammoMax, "#f5e96b")}` +
    `FUEL ${s.fuel}${bar(s.fuel, s.fuelMax, "#7fd4ff")}` +
    (s.cargo ? ` · ${t("ui.cargo", { fuel: s.cargo.fuel, ammo: s.cargo.ammo })}` : "");
  const colors = { bad: "#ff6b52", warn: "#f5e96b", info: "#9ab" };
  for (const r of s.reasons) {
    html += `<div style="color:${colors[r.level]}; font-weight:${r.level === "bad" ? "bold" : "normal"};">` +
      `${t(r.key, r.params ?? undefined)}</div>`;
  }
  if (s.canRequestSupplies) {
    html += `<button id="btn-request-supplies" class="btn" style="margin-top:4px; font-size:12px; padding:2px 10px;">${t("status.request")}</button>`;
  }
  el.innerHTML = html;
  const btn = document.getElementById("btn-request-supplies");
  if (btn) btn.onclick = () => send({ type: "ping", kind: "need_supplies" });
}

// Supply truth the client can know: within 20 cells of an own base rect
// or 12 of an owned relay (mirrors engine/supply.js for display only).
function isSupplied(view, me) {
  const cx = Math.floor(me.x / CELL);
  const cy = Math.floor(me.y / CELL);
  for (const b of view?.bases ?? []) {
    if (b.team !== joined?.team) continue;
    const dx = Math.max(b.x - cx, 0, cx - (b.x + b.width - 1));
    const dy = Math.max(b.y - cy, 0, cy - (b.y + b.height - 1));
    if (Math.max(dx, dy) <= 20) return true;
  }
  for (const sIte of view?.sites ?? []) {
    if (sIte.owner !== joined?.team || sIte.hp === 0) continue;
    if (Math.max(Math.abs(sIte.cellX - cx), Math.abs(sIte.cellY - cy)) <= 12) return true;
  }
  return false;
}

// 14I: hover a vacant friendly — name tag + the stats shortcut.
let hoverAssetId = null;
let lastHoverMs = 0;
function updateHoverTip(view) {
  const el = document.getElementById("hover-tip");
  if (!el || hoverAssetId === null) { if (el) el.style.display = "none"; return; }
  const a = view?.friendlyAssets?.find((x) => x.id === hoverAssetId);
  if (!a || a.operatorId !== -1 || a.state === STATE_DISABLED || a.state === 3) {
    el.style.display = "none";
    return;
  }
  const pos = new THREE.Vector3(a.x / CELL + 0.5, 1.2, a.y / CELL + 0.5).project(camera);
  const sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-pos.y * 0.5 + 0.5) * window.innerHeight;
  el.style.left = `${Math.round(sx - 60)}px`;
  el.style.top = `${Math.round(sy - 46)}px`;
  el.style.display = "block";
  const name = codexFor(a.type)?.name?.toUpperCase() ?? "UNIT";
  el.innerHTML = `${t("hover.vacant", { name })} ` +
    `<span id="hover-stats" style="color:#7fd4ff; cursor:pointer;">${t("hover.stats")}</span>`;
  const link = document.getElementById("hover-stats");
  if (link) link.onclick = (ev) => { ev.stopPropagation(); showCodex(a.type); };
}

// 14I: the inline stats panel — seed of the encyclopedia.
function showCodex(type) {
  const el = document.getElementById("codex-panel");
  const c = codexFor(type);
  if (!el || !c) return;
  el.style.display = "block";
  el.innerHTML = `<b style="font-size:14px;">${c.name.toUpperCase()}</b>` +
    `<div style="color:#9ab; margin:4px 0;">${c.role}</div>` +
    c.lines.map(([k, v]) => `<div>${k}: <b>${v}</b></div>`).join("") +
    (c.traits.length
      ? `<div style="margin-top:4px; color:#f5e96b;">${t("codex.traits")}: ${c.traits.join(" · ")}</div>`
      : "") +
    `<div style="margin-top:6px; text-align:right;"><span id="codex-close" style="cursor:pointer; color:#7fd4ff;">×</span></div>`;
  document.getElementById("codex-close").onclick = () => { el.style.display = "none"; };
}

// 14I: a brief glyph at the click point — the order made visible.''')

# Hover raycast on pointermove (throttled).
patch(p,
'''  renderer.domElement.addEventListener("pointerdown", onPointerDown);''',
'''  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", (event) => { // 14I
    const now = performance.now();
    if (now - lastHoverMs < 90) return;
    lastHoverMs = now;
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...assetMeshes.values()], true);
    let found = null;
    for (const hit of hits) {
      let node = hit.object;
      while (node && node.userData.assetId === undefined) node = node.parent;
      if (node) { found = node.userData.assetId; break; }
    }
    hoverAssetId = found;
  });''')
print("14I patched")
