// client/js/client.js — browser presentation adapter (slice 2F).
// Renders fog-filtered server views with three.js, interpolates 10Hz
// snapshots, and translates clicks into commands. No game logic here:
// every outcome comes back from the server.

import * as THREE from "three";
import { createInterpolator } from "./interpolator.js";
import { scenePointToCell, buildCommandForClick, buildSelectCommand } from "./input_mapper.js";
import { diffVisibleEnemies, visibleEnemyIds } from "./fog_culler.js";
import { supplyOverlays, weaponRangeOverlay, healthBars } from "./overlay_model.js";
import { mapEventsToCues } from "./audio_cues.js";
import { mapEventsToVfx, pruneVfx, vfxAge } from "./vfx_cues.js";
import { buildMinimapModel, minimapClickToCell } from "./minimap_model.js";
import { createCamera, panForKey } from "./camera_model.js";
import { describeEvent, summarizeGameOver } from "./feedback_model.js";
import { smoothHeading, TURN_RATE_RAD_PER_SEC } from "./heading.js";
import { buildProcedural, setStyleTokens, applyTeamColor } from "./asset_factory.js";
import { visualKeyFor, standardVisualKey, resolveVisual, teamToken } from "./asset_resolver.js";
import {
  ownStandardLine, enemyStandardLine, relayTally, currentHint, briefingText, autoSelectTarget,
} from "./objective_model.js";

const CELL = 256; // fixed world units per cell
const TERRAIN_COLORS = [0x3e5a3e, 0x8a8a72, 0x274427, 0x5e5240, 0x2b2b33];
const STATE_DISABLED = 2;

let socket = null;
let joined = null; // { operatorId, team }
let scene, camera, renderer, raycaster;
let terrainMesh = null;
const assetMeshes = new Map(); // id -> Mesh
const siteMeshes = new Map(); // id -> Mesh
let renderedEnemyIds = new Set();
const interpolator = createInterpolator({ delayMs: 150 });
let mySelectedAssetId = null;
let autoSelectSent = false; // post-playtest: crew a unit automatically on join
const worldLabels = new Map(); // labelKey -> Sprite
const freeCam = createCamera({ mapSize: 128 }); // 8G
const standardMeshes = new Map(); // team -> Mesh (8F/8A)
const eventFeed = [];
let liveVfx = [];
const vfxMeshes = new Map(); // effect object -> Mesh
const barMeshes = new Map(); // asset id -> Sprite
let overlayGroup = null;
let overlayKey = "";
let audioCtx = null;

const CUE_TONES = {
  fire_cannon: { freq: 110, ms: 90, type: "square", gain: 0.12 },
  explosion: { freq: 55, ms: 350, type: "sawtooth", gain: 0.2 },
  capture: { freq: 660, ms: 250, type: "sine", gain: 0.12 },
  resupply: { freq: 440, ms: 120, type: "triangle", gain: 0.08 },
  war_over: { freq: 330, ms: 900, type: "sine", gain: 0.15 },
};

// Placeholder synth cues until an art/audio direction is chosen.
function playCue(cue) {
  const tone = CUE_TONES[cue];
  if (!tone) return;
  try {
    audioCtx ??= new (window.AudioContext ?? window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = tone.type;
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(tone.gain, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + tone.ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + tone.ms / 1000);
  } catch { /* audio unavailable */ }
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101018);

  const aspect = window.innerWidth / window.innerHeight;
  const d = 18;
  camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
  camera.position.set(64 + 18, 26, 64 + 18);
  camera.lookAt(64, 0, 64);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("canvas-container").appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  raycaster = new THREE.Raycaster();

  window.addEventListener("resize", onWindowResize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  document.getElementById("btn-recenter").onclick = () => freeCam.followMode(true);
  document.getElementById("btn-next-asset").onclick = selectNextAsset;

  // 8G: free camera controls.
  window.addEventListener("keydown", (e) => {
    const pan = panForKey(e.key);
    if (pan) { freeCam.pan(pan.dx, pan.dy); return; }
    if (e.key === "f" || e.key === "F") freeCam.followMode(true);
    if (e.key === "Home") {
      const zone = interpolator.latest()?.bases?.find((b) => b.team === joined?.team);
      if (zone) freeCam.jumpTo(zone.x + zone.width / 2, zone.y + zone.height / 2);
    }
    if (e.key === "x" || e.key === "X") {
      const enemyStd = interpolator.latest()?.standards?.find((st) => st.team !== joined?.team);
      if (enemyStd) freeCam.jumpTo(enemyStd.x / CELL, enemyStd.y / CELL);
    }
  });
  renderer.domElement.addEventListener("wheel", (e) => {
    freeCam.zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15);
    e.preventDefault();
  }, { passive: false });

  // 8F: minimap click jumps the camera.
  const minimap = document.getElementById("minimap");
  minimap.addEventListener("pointerdown", (e) => {
    const rect = minimap.getBoundingClientRect();
    const { cellX, cellY } = minimapClickToCell(
      e.clientX - rect.left, e.clientY - rect.top, rect.width, 128
    );
    freeCam.jumpTo(cellX, cellY);
  });
  document.getElementById("btn-join-a").onclick = () => joinTeam(0);
  document.getElementById("btn-join-b").onclick = () => joinTeam(1);

  loadAssetMetadata().then(() => {
    connect();
    animate();
  });
}

// 5B: stable per-browser identity so a refresh reattaches to your operator.
function myPlayerId() {
  let id = localStorage.getItem("mf_player_id");
  if (!id) {
    id = `p-${Math.random().toString(36).slice(2, 12)}`; // identity only, never game logic
    localStorage.setItem("mf_player_id", id);
  }
  return id;
}

let cachedMap = null; // 6A: terrain arrives once via s_map
let ASSET_TOKENS = null; // Art Slice A: style tokens + manifest drive visuals
let ASSET_MANIFEST = null;

async function loadAssetMetadata() {
  const [tokens, manifest] = await Promise.all([
    fetch("assets/metadata/style_tokens.json").then((r) => r.json()),
    fetch("assets/metadata/asset_manifest.json").then((r) => r.json()),
  ]);
  ASSET_TOKENS = tokens;
  ASSET_MANIFEST = manifest;
  setStyleTokens(tokens);
}

function connect() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}`);
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "s_map") {
      cachedMap = { width: msg.width, height: msg.height, cells: Uint8Array.from(msg.mapCells) };
      if (terrainMesh) { scene.remove(terrainMesh); terrainMesh = null; } // new war terrain
    } else if (msg.type === "s_war_reset") {
      hideEndScreen();
      mySelectedAssetId = null;
      autoSelectSent = false; // re-crew automatically in the new war
      pushEvent("A new war has begun!");
    } else if (msg.type === "s_server_closing") {
      pushEvent("server shutting down");
    } else if (msg.type === "s_joined") {
      joined = { operatorId: msg.operatorId, team: msg.team };
      document.getElementById("join-overlay").style.display = "none";
      showBriefing();
      updateOpInfo(null);
    } else if (msg.type === "s_snapshot") {
      interpolator.push(msg.view, performance.now());
      if (!autoSelectSent && joined) {
        const target = autoSelectTarget(msg.view, joined.operatorId);
        if (target !== null) {
          autoSelectSent = true;
          mySelectedAssetId = target;
          send(buildSelectCommand(target));
          pushEvent(`You are crewing asset ${target} — click ground to move`);
        } else if ((msg.view.friendlyAssets ?? []).some((a) => a.operatorId === joined.operatorId)) {
          autoSelectSent = true; // rejoin case: already crewed
        }
      }
      updateObjectiveStrip(msg.view);
      handleEvents(msg.view.events ?? []);
      for (const cue of mapEventsToCues(msg.view.events, msg.view)) playCue(cue.cue);
      liveVfx.push(...mapEventsToVfx(msg.view.events, msg.view, performance.now()));
      updateOpInfo(msg);
    } else if (msg.type === "s_rejected") {
      pushEvent(`rejected: ${msg.reason}`);
    }
  };
  socket.onclose = () => {
    pushEvent("connection lost — refresh to rejoin");
  };
}

function joinTeam(team) {
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "c_join", team, playerId: myPlayerId() }));
}

function send(cmd) {
  if (!socket || socket.readyState !== 1 || !joined) return;
  socket.send(JSON.stringify(cmd));
}

function selectNextAsset() {
  const view = interpolator.latest();
  if (!view) return;
  const own = view.friendlyAssets.filter((a) => a.state !== STATE_DISABLED);
  if (own.length === 0) return;
  const free = own.filter((a) => a.operatorId === -1 || a.operatorId === joined.operatorId);
  const pool = free.length ? free : own;
  const idx = pool.findIndex((a) => a.id === mySelectedAssetId);
  const next = pool[(idx + 1) % pool.length];
  mySelectedAssetId = next.id;
  send(buildSelectCommand(next.id));
}

function onPointerDown(event) {
  if (!joined) return;
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, target)) return;

  const view = interpolator.latest();
  const { cellX, cellY } = scenePointToCell(target.x, target.z);
  const own = view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  const cmd = buildCommandForClick(view, cellX, cellY, {
    fireRadiusCells: 1, myOperatorId: joined.operatorId,
    canTow: own ? own.type === 3 : false,
  });
  if (cmd.type === "select_asset") mySelectedAssetId = cmd.assetId;
  send(cmd);
}

function handleEvents(events) {
  for (const e of events) {
    const line = describeEvent(e, joined?.team);
    if (line) pushEvent(line);
    if (e.type === "game_over") showEndScreen();
  }
}

function showEndScreen() {
  const view = interpolator.latest();
  const summary = summarizeGameOver(view, joined?.team);
  if (!summary) return;
  const el = document.getElementById("end-overlay");
  document.getElementById("end-title").innerText = summary.title;
  document.getElementById("end-reason").innerText = summary.reason;
  document.getElementById("end-scores").innerText =
    `Team A ${summary.scores[0]} — ${summary.scores[1]} Team B`;
  document.getElementById("end-next").innerText = summary.nextWarText;
  el.style.display = "flex";
}

function hideEndScreen() {
  document.getElementById("end-overlay").style.display = "none";
}

function pushEvent(text) {
  eventFeed.push(text);
  while (eventFeed.length > 6) eventFeed.shift();
  document.getElementById("event-feed").innerHTML =
    eventFeed.map((t) => `<div>${t}</div>`).join("");
}

function updateOpInfo(msg) {
  const info = document.getElementById("op-info");
  if (!joined) { info.innerText = "Not joined"; return; }
  const teamName = joined.team === 0 ? "A" : "B";
  const tick = msg ? msg.tick : "-";
  info.innerText = `Op ${joined.operatorId} | Team ${teamName} | Tick ${tick}`;
  if (msg) document.getElementById("status-bar").innerText = `Hash ${msg.stateHash}`;
}

function updateSupplyBar(view) {
  const el = document.getElementById("supply-bar");
  const own = view?.friendlyAssets.find((a) => a.operatorId === joined?.operatorId);
  if (!own) { el.innerText = ""; return; }
  el.innerText = `Asset ${own.id} | HP ${own.hp} | Ammo ${own.ammo} | Fuel ${own.fuel}`;
}

function buildTerrain() {
  if (terrainMesh || !cachedMap) return;
  const size = cachedMap.width;
  const cells = cachedMap.cells;
  const group = new THREE.Group();
  const geometries = new Map();
  for (let terrain = 0; terrain < TERRAIN_COLORS.length; terrain++) {
    geometries.set(terrain, []);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      geometries.get(cells[y * size + x])?.push([x, y]);
    }
  }
  for (const [terrain, positions] of geometries) {
    if (!positions.length) continue;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, terrain === 4 ? 0.8 : 0.1, 1),
      new THREE.MeshLambertMaterial({ color: TERRAIN_COLORS[terrain] }),
      positions.length
    );
    const m = new THREE.Matrix4();
    positions.forEach(([x, y], i) => {
      m.setPosition(x + 0.5, terrain === 4 ? 0.4 : 0, y + 0.5);
      mesh.setMatrixAt(i, m);
    });
    group.add(mesh);
  }
  terrainMesh = group;
  scene.add(group);
}

function upsertAssetMesh(a, friendly) {
  // Manifest-resolved visuals (Art Slice A): unit_<chassis> or wreck_<chassis>,
  // painted GLB when it exists, procedural stand-in until then.
  const visualKey = visualKeyFor(a);
  let mesh = assetMeshes.get(a.id);
  if (mesh && mesh.userData.visualKey !== visualKey) {
    scene.remove(mesh);
    assetMeshes.delete(a.id);
    mesh = null;
  }
  if (!mesh) {
    const resolved = resolveVisual(ASSET_MANIFEST, visualKey);
    mesh = (resolved.kind === "procedural" ? buildProcedural(resolved.key) : null)
      ?? new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x888888 }));
    mesh.userData.visualKey = visualKey;
    applyTeamColor(mesh, teamToken(ASSET_TOKENS, a.team).color);
    scene.add(mesh);
    assetMeshes.set(a.id, mesh);
  }
  mesh.position.set(a.x / CELL + 0.5, 0, a.y / CELL + 0.5);
  // 4D headings, smoothed: axis-major movement flips 90 degrees near
  // diagonals, so turn gradually instead of snapping (playtest 3 fix).
  if (typeof a.heading === "number") {
    const target = -a.heading;
    const prev = mesh.userData.smoothedHeading ?? target;
    const maxStep = TURN_RATE_RAD_PER_SEC / 60;
    mesh.userData.smoothedHeading = smoothHeading(prev, target, maxStep);
    mesh.rotation.y = mesh.userData.smoothedHeading;
  }
  if (friendly && a.operatorId === joined?.operatorId) {
    mesh.scale.setScalar(1.15);
  } else if (a.state !== STATE_DISABLED) {
    mesh.scale.setScalar(1);
  }
  return mesh;
}

// 8D readability: tow cables between friendly towers and their wrecks.
const towCables = new Map(); // wreck id -> mesh
function updateTowCables(view) {
  const live = new Set();
  for (const wreck of view.friendlyAssets ?? []) {
    if (wreck.towedBy === -1 || wreck.towedBy === undefined) continue;
    const tower = view.friendlyAssets.find((t) => t.id === wreck.towedBy);
    if (!tower) continue;
    live.add(wreck.id);
    let cable = towCables.get(wreck.id);
    if (!cable) {
      cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1, 5),
        new THREE.MeshStandardMaterial({ color: 0x2e2418, roughness: 0.95 })
      );
      scene.add(cable);
      towCables.set(wreck.id, cable);
    }
    const ax = tower.x / CELL + 0.5, az = tower.y / CELL + 0.5;
    const bx = wreck.x / CELL + 0.5, bz = wreck.y / CELL + 0.5;
    const dx = bx - ax, dz = bz - az;
    const len = Math.max(0.2, Math.hypot(dx, dz));
    cable.scale.set(1, len, 1);
    cable.position.set((ax + bx) / 2, 0.18, (az + bz) / 2);
    cable.rotation.z = Math.PI / 2;
    cable.rotation.y = -Math.atan2(dz, dx);
  }
  for (const [id, cable] of towCables) {
    if (!live.has(id)) { scene.remove(cable); towCables.delete(id); }
  }
}

function updateOverlays(view) {
  // 4A: supply rings + weapon range ring, rebuilt only when ownership changes.
  const key = JSON.stringify([
    view.sites?.map((s) => s.owner), joined?.operatorId,
    view.friendlyAssets.find((a) => a.operatorId === joined?.operatorId)?.id ?? -1,
  ]);
  if (key === overlayKey) return;
  overlayKey = key;
  if (overlayGroup) scene.remove(overlayGroup);
  overlayGroup = new THREE.Group();
  const ringMat = (color, opacity) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
  for (const o of supplyOverlays(view)) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(o.radiusCells - 0.15, o.radiusCells, 48),
      ringMat(0x4488ff, 0.35)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(o.centerX, 0.05, o.centerY);
    overlayGroup.add(ring);
  }
  const range = weaponRangeOverlay(view, joined?.operatorId);
  if (range) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.2, range.radiusCells - 0.1), range.radiusCells, 48),
      ringMat(0xffcc44, 0.4)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(range.centerX, 0.06, range.centerY);
    overlayGroup.add(ring);
  }
  scene.add(overlayGroup);
}

function updateHealthBars(view) {
  const seen = new Set();
  for (const bar of healthBars(view)) {
    if (bar.fraction === null) continue;
    seen.add(bar.id);
    let sprite = barMeshes.get(bar.id);
    if (!sprite) {
      sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x44ff44 }));
      scene.add(sprite);
      barMeshes.set(bar.id, sprite);
    }
    sprite.scale.set(Math.max(0.05, bar.fraction), 0.08, 1);
    sprite.material.color.setHex(bar.fraction > 0.5 ? 0x44ff44 : bar.fraction > 0.25 ? 0xffcc44 : 0xff4444);
    sprite.position.set(bar.x, 0.9, bar.y);
  }
  for (const [id, sprite] of barMeshes) {
    if (!seen.has(id)) { scene.remove(sprite); barMeshes.delete(id); }
  }
}

function updateVfx(nowMs) {
  liveVfx = pruneVfx(liveVfx, nowMs);
  const alive = new Set(liveVfx);
  for (const [fx, mesh] of vfxMeshes) {
    if (!alive.has(fx)) { scene.remove(mesh); vfxMeshes.delete(fx); }
  }
  for (const fx of liveVfx) {
    let mesh = vfxMeshes.get(fx);
    if (!mesh) {
      const color = fx.kind === "muzzle_flash" ? 0xffee88 : fx.kind === "explosion" ? 0xff6622 : 0x66ffcc;
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true })
      );
      mesh.position.set(fx.at.x, 0.6, fx.at.y);
      scene.add(mesh);
      vfxMeshes.set(fx, mesh);
    }
    const age = vfxAge(fx, nowMs);
    const grow = fx.kind === "capture_pulse" ? 1 + age * 3 : 1 + age * 1.5;
    mesh.scale.set(grow, grow, grow);
    mesh.material.opacity = 1 - age;
  }
}

function upsertStandardMesh(st) {
  const key = standardVisualKey(st);
  let mesh = standardMeshes.get(st.team);
  if (mesh && mesh.userData.visualKey !== key) {
    scene.remove(mesh);
    standardMeshes.delete(st.team);
    mesh = null;
  }
  if (!mesh) {
    const resolved = resolveVisual(ASSET_MANIFEST, key);
    mesh = buildProcedural(resolved.key ?? "standard_upright");
    mesh.userData.visualKey = key;
    scene.add(mesh);
    standardMeshes.set(st.team, mesh);
  }
  const token = teamToken(ASSET_TOKENS, st.team);
  applyTeamColor(mesh, st.status === 3 ? ASSET_TOKENS.colors.selection : token.color);
  // Carried standards ride high and bob (procedural anim per spec §11).
  const carried = st.status === 1;
  const bob = carried ? 0.12 * Math.sin(performance.now() / 180) : 0;
  mesh.position.set(st.x / CELL + 0.5, (carried ? 0.35 : 0) + bob, st.y / CELL + 0.5);
  mesh.rotation.y = performance.now() / 900;
}

function showBriefing() {
  const el = document.getElementById("briefing-overlay");
  document.getElementById("briefing-text").innerText = briefingText(joined?.team);
  el.style.display = "flex";
  const close = () => { el.style.display = "none"; window.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Enter" || e.key === "Escape") close(); };
  document.getElementById("btn-briefing-ok").onclick = close;
  window.addEventListener("keydown", onKey);
}

function updateObjectiveStrip(view) {
  if (!joined) return;
  const own = view.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  document.getElementById("obj-hint").innerText =
    currentHint(view, joined.team, { canCarry: own ? own.type === 4 : false });
  document.getElementById("obj-standards").innerText =
    `${ownStandardLine(view, joined.team)}  ·  ${enemyStandardLine(view, joined.team)}`;
  const relays = relayTally(view, joined.team);
  document.getElementById("obj-relays").innerText =
    `Relays ${relays.yours}/${relays.total}`;
}

// Floating world labels so objectives stop being anonymous polygons
// (playtest: "did not understand what was relay").
function makeTextSprite(text, colorHex) {
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
}

function upsertWorldLabel(key, text, colorHex, x, y, z) {
  let entry = worldLabels.get(key);
  if (!entry || entry.text !== text) {
    if (entry) scene.remove(entry.sprite);
    const sprite = makeTextSprite(text, colorHex);
    entry = { sprite, text };
    scene.add(sprite);
    worldLabels.set(key, entry);
  }
  entry.sprite.position.set(x, y, z);
}

function updateWorldLabels(view) {
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
}

function renderMinimap(view) {
  const canvas = document.getElementById("minimap");
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const k = size / 128;
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, size, size);

  const cam = freeCam.state;
  const aspect = window.innerWidth / window.innerHeight;
  const model = buildMinimapModel(
    { ...view, myOperatorId: joined?.operatorId },
    128,
    { x: cam.x, y: cam.y, halfW: cam.zoom * aspect, halfH: cam.zoom }
  );

  for (const z of model.zones) {
    ctx.fillStyle = z.team === joined?.team ? "rgba(60,180,60,0.25)" : "rgba(190,60,60,0.25)";
    ctx.fillRect(z.x * k, z.y * k, z.width * k, z.height * k);
  }
  for (const r of model.relays) {
    ctx.fillStyle = r.owner === -1 ? "#888"
      : r.owner === joined?.team ? "#4c4" : "#c44";
    ctx.fillRect(r.x * k - 2, r.y * k - 2, 4, 4);
  }
  for (const d of model.dots) {
    ctx.fillStyle = d.kind === "wreck" ? "#555"
      : d.kind === "friendly" ? (d.mine ? "#aaffaa" : "#3a3") : "#d33";
    ctx.fillRect(d.x * k - 1.5, d.y * k - 1.5, d.mine ? 4 : 3, d.mine ? 4 : 3);
  }
  for (const st of model.standards) {
    ctx.fillStyle = st.team === joined?.team ? "#8f8" : "#f88";
    if (st.status === 1 || st.status === 2) ctx.fillStyle = "#fd0"; // hot standard
    ctx.beginPath();
    ctx.arc(st.x * k, st.y * k, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (model.viewport) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.strokeRect(model.viewport.x * k, model.viewport.y * k,
      model.viewport.width * k, model.viewport.height * k);
  }
}

function upsertSiteMesh(site) {
  let mesh = siteMeshes.get(site.id);
  if (!mesh) {
    const resolved = resolveVisual(ASSET_MANIFEST, "relay_site");
    mesh = buildProcedural(resolved.key ?? "relay");
    scene.add(mesh);
    siteMeshes.set(site.id, mesh);
  }
  const color = site.owner === -1
    ? "#888888" : teamToken(ASSET_TOKENS, site.owner).color;
  applyTeamColor(mesh, color);
  mesh.position.set(site.cellX + 0.5, 0, site.cellY + 0.5);
}

function renderBattlefield() {
  const view = interpolator.sample(performance.now());
  if (!view || !ASSET_TOKENS) return;
  buildTerrain();
  updateSupplyBar(view);
  updateTowCables(view);

  const seen = new Set();
  for (const a of view.friendlyAssets ?? []) {
    seen.add(a.id);
    upsertAssetMesh(a, true);
  }
  const latest = interpolator.latest();
  const diff = diffVisibleEnemies(renderedEnemyIds, latest);
  for (const id of diff.removed) {
    const mesh = assetMeshes.get(id);
    if (mesh) { scene.remove(mesh); assetMeshes.delete(id); }
  }
  renderedEnemyIds = visibleEnemyIds(latest);
  for (const e of view.visibleEnemies ?? []) {
    seen.add(e.id);
    upsertAssetMesh(e, false);
  }
  for (const [id, mesh] of assetMeshes) {
    if (!seen.has(id)) { scene.remove(mesh); assetMeshes.delete(id); }
  }
  for (const site of view.sites ?? []) upsertSiteMesh(site);
  for (const st of view.standards ?? []) upsertStandardMesh(st);
  updateWorldLabels(view);
  updateOverlays(view);
  updateHealthBars(view);
  updateVfx(performance.now());
  renderMinimap(interpolator.latest());

  // 8G: follow tracks your asset; manual pan/zoom takes over seamlessly.
  if (joined) {
    const own = view.friendlyAssets.find((a) => a.operatorId === joined.operatorId)
      ?? view.friendlyAssets[0];
    if (own) freeCam.trackIfFollowing(own.x / CELL, own.y / CELL);
  }
  const cam = freeCam.state;
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -cam.zoom * aspect;
  camera.right = cam.zoom * aspect;
  camera.top = cam.zoom;
  camera.bottom = -cam.zoom;
  camera.updateProjectionMatrix();
  camera.position.set(cam.x + 18, 26, cam.y + 18);
  camera.lookAt(cam.x, 0, cam.y);
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const d = 18;
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  renderBattlefield();
  renderer.render(scene, camera);
}

init();
