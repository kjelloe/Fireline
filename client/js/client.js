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
import { describeEvent, summarizeGameOver, topOperators } from "./feedback_model.js";
import { pingOptionsFor } from "./ping_model.js";
import { tasksFor } from "./tasks_model.js";
import { propsFor } from "./props_model.js";
import { updateGhosts, ghostOpacity } from "./ghosts_model.js";
import { t, setLocale, getLocale } from "./strings.js";
import { factionFor } from "../../shared/factions.js";
import { factionFor } from "../../shared/factions.js";
import { activePings } from "../../engine/pings.js";
import { smoothHeading, TURN_RATE_RAD_PER_SEC } from "./heading.js";
import { buildProcedural, setStyleTokens, applyTeamColor, applyFactionScheme } from "./asset_factory.js";
import { visualKeyFor, standardVisualKey, resolveVisual, teamToken } from "./asset_resolver.js";
import {
  ownStandardLine, enemyStandardLine, relayTally, currentHint, briefingText, autoSelectTarget,
} from "./objective_model.js";

const CELL = 256; // fixed world units per cell
const TERRAIN_COLORS = [0x3e5a3e, 0x8a8a72, 0x274427, 0x5e5240, 0x2b2b33, 0x6e5f42, 0x2a4a66]; // 11N path, 12C water
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
const downedMeshes = new Map(); // operatorId -> Mesh (9B)
const mineMeshes = new Map(); // mineId -> Mesh (9E)
const droneMeshes = new Map(); // droneId -> Mesh (9G)
let fogGhosts = []; // 13E: last-seen enemy contacts
const ghostMeshes = new Map(); // enemyId -> Mesh (13E)
let lastSelectAttempt = -1; // 10B
let pendingTakeover = -1;   // 10B: asset awaiting Enter-confirm
const teamPings = []; // 10C: recent own-team pings for world labels
// 11L direct control (G toggles): WASD becomes tank controls.
let directMode = false;
const driveHeld = { w: false, a: false, s: false, d: false };
let lastDriveSent = "0,0";
let directRing = null; // 11O: the tracking targeting circle
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

  // 8G: free camera controls (11L: direct mode claims WASD first).
  window.addEventListener("keydown", (e) => {
    if (e.key === "g" || e.key === "G") {
      directMode = !directMode;
      if (!directMode) { for (const k in driveHeld) driveHeld[k] = false; }
      sendDriveIntent();
      pushEvent(directMode ? t("ui.direct_on") : t("ui.direct_off"));
      if (directMode) freeCam.followMode(true);
      return;
    }
    if (directMode && e.key.toLowerCase() in driveHeld) {
      driveHeld[e.key.toLowerCase()] = true;
      sendDriveIntent();
      return;
    }
    const pan = panForKey(e.key);
    if (pan) { freeCam.pan(pan.dx, pan.dy); return; }
    if (e.key === "f" || e.key === "F") freeCam.followMode(true);
    if (e.key === "Home") {
      const zone = interpolator.latest()?.bases?.find((b) => b.team === joined?.team);
      if (zone) freeCam.jumpTo(zone.x + zone.width / 2, zone.y + zone.height / 2);
    }
    if (e.key === "r" || e.key === "R") send({ type: "redeploy" }); // 9B
    // 11G manual rescue: B boards the adjacent carrier, U hops out.
    if (e.key === "b" || e.key === "B") {
      const carrier = adjacentBoardableCarrier(interpolator.latest());
      if (carrier) send({ type: "board_carrier", carrierAssetId: carrier.id });
    }
    if (e.key === "u" || e.key === "U") send({ type: "unboard" });
    // 12B: H toggles the Sentinel's hardpoint.
    if (e.key === "h" || e.key === "H") {
      const me = interpolator.latest()?.friendlyAssets?.find(
        (a) => a.operatorId === joined?.operatorId);
      if (me?.type === 7) {
        send({ type: me.deployed === 1 ? "undeploy" : "deploy_hardpoint" });
      }
    }
    // 11U: T tows the adjacent claimable wreck (same as the banner).
    if (e.key === "t" || e.key === "T") {
      const wreck = adjacentTowableWreck(interpolator.latest());
      if (wreck) send({ type: "tow_order", wreckAssetId: wreck.id });
    }
    // 10B: Enter confirms a pending consequential takeover; Esc declines.
    if (e.key === "Enter" && pendingTakeover !== -1) {
      send({ type: "select_asset", assetId: pendingTakeover, confirm: true });
      pendingTakeover = -1;
    }
    if (e.key === "Escape") pendingTakeover = -1;
    // 9E: M lays a mine under the tank; C clears the nearest adjacent
    // known mine with a truck.
    if (e.key === "m" || e.key === "M") send({ type: "deploy_mine" });
    // 10C: 1/2/3 send context pings (what they mean depends on your seat).
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      const opts = pingOptionsFor(interpolator.latest(), joined?.operatorId);
      const pick = opts[Number(e.key) - 1];
      if (pick) send({ type: "ping", kind: pick.kind });
    }
    if (e.key === "c" || e.key === "C") {
      const v = interpolator.latest();
      const mine = nearestAdjacentMine(v);
      if (mine) send({ type: "clear_mine", mineId: mine.id });
    }
    if (e.key === "x" || e.key === "X") {
      const enemyStd = interpolator.latest()?.standards?.find((st) => st.team !== joined?.team);
      if (enemyStd) freeCam.jumpTo(enemyStd.x / CELL, enemyStd.y / CELL);
    }
  });
  window.addEventListener("keyup", (e) => { // 11L
    if (directMode && e.key.toLowerCase() in driveHeld) {
      driveHeld[e.key.toLowerCase()] = false;
      sendDriveIntent();
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
  document.getElementById("btn-spectate").onclick = spectate; // 10A
  document.getElementById("action-banner").onclick = () => bannerAction?.(); // 11U
  // 15B: locale — restore, and offer the switch in ⚙.
  setLocale(localStorage.getItem("mf_locale") ?? "en");
  const localeSel = document.getElementById("opt-locale");
  if (localeSel) {
    localeSel.value = getLocale();
    localeSel.onchange = (e) => {
      setLocale(e.target.value);
      localStorage.setItem("mf_locale", e.target.value);
      lastTaskKey = ""; // force HUD rebuilds in the new language
      for (const [, entry] of worldLabels) scene.remove(entry.sprite);
      worldLabels.clear();
    };
  }
  // 11G: settings panel.
  const settingsOverlay = document.getElementById("settings-overlay");
  document.getElementById("btn-settings").onclick = () => {
    settingsOverlay.style.display = settingsOverlay.style.display === "flex" ? "none" : "flex";
  };
  document.getElementById("btn-settings-close").onclick = () => {
    settingsOverlay.style.display = "none";
  };
  document.getElementById("opt-auto-rescue").onchange = (e) => {
    send({ type: "set_option", option: "auto_rescue", value: e.target.checked ? 1 : 0 });
  };

  // Perf-harness hook (tools/perf_harness.mjs): read-only telemetry.
  window.__mfDebug = {
    renderer: () => renderer,
    scene: () => scene,
    labelCount: () => worldLabels.size,
  };

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
      cachedMap = {
        width: msg.width, height: msg.height,
        cells: Uint8Array.from(msg.mapCells),
        profile: msg.mapProfile ?? "frontier_corridor",
      };
      if (terrainMesh) { scene.remove(terrainMesh); terrainMesh = null; } // new war terrain
    } else if (msg.type === "s_war_reset") {
      hideEndScreen();
      mySelectedAssetId = null;
      autoSelectSent = false; // re-crew automatically in the new war
      pushEvent(t("ui.new_war"));
    } else if (msg.type === "s_server_closing") {
      pushEvent("server shutting down");
    } else if (msg.type === "s_spectating") { // 10A: omniscient read-only seat
      joined = { operatorId: -1, team: -1, spectator: true };
      autoSelectSent = true; // nothing to crew
      document.getElementById("join-overlay").style.display = "none";
      pushEvent(t("ui.spectating"));
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
          pushEvent(t("ui.crewing", { id: target }));
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

// 11L: stream the current WASD intent, only on change.
function sendDriveIntent() {
  const throttle = driveHeld.w ? 1 : driveHeld.s ? -1 : 0;
  const turn = driveHeld.d ? 1 : driveHeld.a ? -1 : 0;
  const key = `${throttle},${turn}`;
  if (key === lastDriveSent) return;
  lastDriveSent = key;
  send({ type: "drive", throttle, turn });
}

function joinTeam(team) {
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "c_join", team, playerId: myPlayerId() }));
}

function spectate() { // 10A
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "c_spectate" }));
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
  // 9B: while your seat is down, clicks crawl instead of commanding vehicles.
  if (view?.downedOperators?.some((d) => d.operatorId === joined.operatorId)) {
    send({ type: "crawl_order", targetCellX: cellX, targetCellY: cellY });
    return;
  }
  const own = view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  const cmd = buildCommandForClick(view, cellX, cellY, {
    fireRadiusCells: 1, myOperatorId: joined.operatorId,
    canTow: own ? own.type === 3 : false,
    directMode, // 11O: weapons-only clicks with aim assist
  });
  if (!cmd) return; // direct mode: nothing near the cursor — hold fire
  if (cmd.type === "select_asset") {
    mySelectedAssetId = cmd.assetId;
    lastSelectAttempt = cmd.assetId; // 10B: may need a confirmed retry
  }
  send(cmd);
}

function handleEvents(events) {
  for (const e of events) {
    const line = describeEvent(e, joined?.team);
    if (line) pushEvent(line);
    // 11U: your redeploy brings the view HOME and re-arms auto-select —
    // the answer to "my camera stayed on my corpse".
    if (e.type === "operator_redeployed" && e.operatorId === joined?.operatorId) {
      const zone = interpolator.latest()?.bases?.find((b) => b.team === joined?.team);
      if (zone) freeCam.jumpTo(zone.x + zone.width / 2, zone.y + zone.height / 2);
      autoSelectSent = false; // pick a fresh garage asset automatically
      mySelectedAssetId = null;
      freeCam.followMode(true);
    }
    // 10B: arm the Enter-confirm retry for a consequential takeover.
    if (e.type === "rejected" && e.reason === "takeover needs confirmation") {
      pendingTakeover = lastSelectAttempt;
    }
    if (e.type === "ping") teamPings.push(e); // 10C (view is already team-scoped)
    if (e.type === "game_over") showEndScreen();
  }
}

function showEndScreen() {
  const view = interpolator.latest();
  const summary = summarizeGameOver(view, joined?.team);
  if (!summary) return;
  const el = document.getElementById("end-overlay");
  document.getElementById("end-title").innerText = summary.title;
  const honors = topOperators(view);
  document.getElementById("end-reason").innerText = summary.reason +
    (honors.length ? "\n\nHONORS\n" + honors.join("\n") : "");
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
  const tick = msg ? msg.tick : "-";
  const who = joined.spectator ? "Spectator" : factionFor(joined.team).short; // 12A
  info.innerText = `Op ${joined.operatorId} | ${who} | Tick ${tick}`;
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
  // Art round 2c (prompt 25): instanced battlefield props — forest reads
  // as trees, rough as rocks, trails as trodden ruts, at a glance.
  const props = propsFor(cells, size, size, cachedMap.profile);
  const byKind = { tree: [], rock: [], rut: [], water: [], rail: [], reed: [] };
  for (const pr of props) byKind[pr.kind]?.push(pr);
  const PROP_GEO = {
    tree: () => {
      const g = new THREE.ConeGeometry(0.28, 0.85, 6);
      g.translate(0, 0.5, 0);
      return g;
    },
    rock: () => {
      const g = new THREE.DodecahedronGeometry(0.2, 0);
      g.translate(0, 0.12, 0);
      return g;
    },
    rut: () => {
      const g = new THREE.BoxGeometry(0.5, 0.02, 0.14);
      g.translate(0, 0.06, 0);
      return g;
    },
    water: () => {
      const g = new THREE.BoxGeometry(1, 0.04, 1);
      g.translate(0, 0.08, 0); // floats above the rough tile: reads as river
      return g;
    },
    rail: () => {
      const g = new THREE.BoxGeometry(0.12, 0.3, 1);
      g.translate(0, 0.25, 0);
      return g;
    },
    reed: () => {
      const g = new THREE.ConeGeometry(0.06, 0.5, 4);
      g.translate(0, 0.3, 0);
      return g;
    },
  };
  const PROP_COLOR = {
    tree: 0x1f3a1f, rock: 0x6a6a5e, rut: 0x574a34,
    water: 0x2a4a66, rail: 0x4a4136, reed: 0x3d5a2e,
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3();
  for (const [kind, list] of Object.entries(byKind)) {
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(
      PROP_GEO[kind](),
      new THREE.MeshLambertMaterial({ color: PROP_COLOR[kind] }),
      list.length
    );
    list.forEach((pr, i) => {
      q.setFromAxisAngle(up, pr.rotation);
      one.set(pr.scale, pr.scale, pr.scale);
      m.compose(new THREE.Vector3(pr.x, 0.05, pr.y), q, one);
      inst.setMatrixAt(i, m);
    });
    group.add(inst);
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
    // 11Y: faction paint scheme + per-hull weathering (wrecks stay ashen).
    if (!visualKey.startsWith("wreck_")) {
      applyFactionScheme(mesh, teamToken(ASSET_TOKENS, a.team).color, a.id);
    }
    scene.add(mesh);
    assetMeshes.set(a.id, mesh);
  }
  mesh.position.set(a.x / CELL + 0.5, 0, a.y / CELL + 0.5);
  // 9F: the engine now owns headings (brads 0-255). Convert and smooth the
  // last visual step; fall back to motion-derived heading for old snapshots.
  const brads = typeof a.heading === "number" && a.heading >= 0 && a.heading <= 255
    ? a.heading : null;
  {
    // 11U: models are authored facing +z; engine theta runs from +x (east)
    // toward +y (south). rotation.y = pi/2 - theta makes barrel follow travel.
    const target = brads !== null ? Math.PI / 2 - (brads * Math.PI * 2) / 256 : null;
    if (target !== null) {
      const prev = mesh.userData.smoothedHeading ?? target;
      const maxStep = TURN_RATE_RAD_PER_SEC / 60;
      mesh.userData.smoothedHeading = smoothHeading(prev, target, maxStep);
      mesh.rotation.y = mesh.userData.smoothedHeading;
    }
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
  document.getElementById("briefing-text").innerText =
    briefingText(joined?.team, joined ? factionFor(joined.team) : null); // 12A/15B
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
  // 11U: up to two lines ("\n"-separated) — details and countdowns fit.
  const lines = String(text).split("\n").slice(0, 2);
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
    const who = site.owner === -1 ? t("label.who_neutral")
      : site.owner === joined?.team ? t("label.who_yours") : t("label.who_enemy");
    let color = site.owner === -1 ? "#cccccc"
      : site.owner === joined?.team ? "#9fe89f" : "#f0a0a0";
    let detail = null;
    if (site.hp === 0) {
      detail = t("label.relay_damaged");
      color = "#c9b28a";
    } else if (site.captureProgress > 0 && site.capturingTeam !== -1) {
      // 11U: the flip countdown, live over the flag.
      const secs = Math.ceil((30 - site.captureProgress) / 10);
      const hostile = site.capturingTeam !== joined?.team;
      detail = hostile && site.owner !== -1
        ? t("label.relay_dropping", { s: secs })
        : t("label.relay_raising", { s: secs });
      color = hostile ? "#ffb066" : "#f5e96b";
    }
    upsertWorldLabel(`site${site.id}`,
      detail ? `${t("label.relay", { who })}\n${detail}` : t("label.relay", { who }), color,
      site.cellX + 0.5, 2.1, site.cellY + 0.5);
  }
  for (const st of view.standards ?? []) {
    const mine = st.team === joined?.team;
    let text = mine ? t("label.std_yours") : t("label.std_enemy");
    if (st.status === 2) { // DROPPED: the auto-return countup matters
      const secs = Math.max(0, Math.ceil((600 - (st.droppedTimer ?? 0)) / 10));
      text = (mine ? t("label.std_yours_down") : t("label.std_enemy_open")) +
        "\n" + t("label.std_returns", { s: secs });
    }
    upsertWorldLabel(`std${st.team}`, text,
      mine ? "#9fe89f" : "#ffd75e",
      st.x / CELL + 0.5, 2.6, st.y / CELL + 0.5);
  }
  // 12B: hardpoint states over the Sentinel.
  for (const a of view.friendlyAssets ?? []) {
    const key = `hard${a.id}`;
    let textHp = null;
    if (a.deployTimer > 0) {
      textHp = a.deployed === 1
        ? t("label.deploying", { s: Math.ceil(a.deployTimer / 10) })
        : t("label.undeploying", { s: Math.ceil(a.deployTimer / 10) });
    } else if (a.deployed === 1) {
      textHp = t("label.hardpoint");
    }
    if (textHp) {
      upsertWorldLabel(key, textHp, "#bfe3e8", a.x / CELL + 0.5, 1.7, a.y / CELL + 0.5);
    } else {
      const entry = worldLabels.get(key);
      if (entry) { scene.remove(entry.sprite); worldLabels.delete(key); }
    }
  }
  // 11U: repair bays count down over the hull.
  for (const a of view.friendlyAssets ?? []) {
    const key = `repair${a.id}`;
    if (a.recoverTimer > 0) {
      upsertWorldLabel(key, t("label.repairing", { s: Math.ceil(a.recoverTimer / 10) }), "#8fd4ff",
        a.x / CELL + 0.5, 1.5, a.y / CELL + 0.5);
    } else {
      const entry = worldLabels.get(key);
      if (entry) { scene.remove(entry.sprite); worldLabels.delete(key); }
    }
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

// 11G: the friendly carrier (free bunk) next to MY downed body, if any.
function adjacentBoardableCarrier(view) {
  const me = view?.downedOperators?.find((d) => d.operatorId === joined?.operatorId);
  if (!me) return null;
  return (view?.friendlyAssets ?? []).find((a) =>
    a.type === 4 && a.state !== STATE_DISABLED &&
    (a.aboard1 === -1 || a.aboard2 === -1) &&
    Math.max(Math.abs(Math.floor(a.x / CELL) - Math.floor(me.x / CELL)),
             Math.abs(Math.floor(a.y / CELL) - Math.floor(me.y / CELL))) <= 1) ?? null;
}

function nearestAdjacentMine(view) {
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me) return null;
  const cx = Math.floor(me.x / CELL);
  const cy = Math.floor(me.y / CELL);
  let best = null;
  let bestDist = 2;
  for (const m of view.mines ?? []) {
    const d = Math.max(Math.abs(m.cellX - cx), Math.abs(m.cellY - cy));
    if (d < bestDist) { best = m; bestDist = d; }
  }
  return best;
}

function updateMineMeshes(view) {
  const live = new Set();
  for (const m of view.mines ?? []) {
    live.add(m.id);
    let mesh = mineMeshes.get(m.id);
    if (!mesh) {
      mesh = buildProcedural("mine"); // 11Q: factory model
      scene.add(mesh);
      mineMeshes.set(m.id, mesh);
    }
    // Own mines read as ordnance (team-panel tinted); marked enemy mines
    // scream danger (red panel).
    const own = m.team === joined?.team;
    applyTeamColor(mesh, own
      ? teamToken(ASSET_TOKENS, m.team).color
      : "#d03a2a");
    mesh.position.set(m.cellX + 0.5, 0, m.cellY + 0.5);
  }
  for (const [id, mesh] of mineMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      mineMeshes.delete(id);
    }
  }
}

function updateDroneMeshes(view, nowMs) {
  const live = new Set();
  for (const d of view.drones ?? []) {
    live.add(d.id);
    let mesh = droneMeshes.get(d.id);
    if (!mesh) {
      mesh = buildProcedural("drone"); // 11Q: factory quad
      applyTeamColor(mesh, teamToken(ASSET_TOKENS, d.team).color);
      scene.add(mesh);
      droneMeshes.set(d.id, mesh);
    }
    mesh.position.set(d.x / CELL + 0.5, 1.1, d.y / CELL + 0.5);
    mesh.rotation.y = (nowMs % 2000) / 2000 * Math.PI * 2; // slow menace spin
  }
  for (const [id, mesh] of droneMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      droneMeshes.delete(id);
    }
  }
}

// 11O: in direct mode a targeting circle rides the asset — your gun's
// true reach, always visible while you drive.
// 11U: the one-action banner — DOWN countdown/redeploy, or the tow
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
      text = t("banner.down_wait", { s: wait });
    } else {
      text = t("banner.down_ready");
      bannerAction = () => send({ type: "redeploy" });
    }
  } else {
    const wreck = adjacentTowableWreck(view);
    const me = view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
    if (wreck) {
      text = t("banner.tow", { id: wreck.id });
      bannerAction = () => send({ type: "tow_order", wreckAssetId: wreck.id });
    } else if (me?.type === 7 && me.deployTimer === 0) { // 12B
      text = me.deployed === 1 ? t("banner.undeploy") : t("banner.deploy");
      bannerAction = () => send({ type: me.deployed === 1 ? "undeploy" : "deploy_hardpoint" });
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

// 11T public tasks (plan 2.4): top mission cards from the pure model.
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
  const key = tasks.map((t) => t.id + (t.mine ? "*" : "")).join("|");
  if (key === lastTaskKey) return;
  lastTaskKey = key;
  el.innerHTML = "";
  for (const t of tasks) {
    const card = document.createElement("div");
    card.textContent = t.label;
    card.style.cssText =
      "background:rgba(10,14,10,0.78); color:#d8e6c8; padding:7px 10px;" +
      `border-left:3px solid ${t.mine ? "#57c46b" : "#f5e96b"}; border-radius:4px;` +
      "font:12px sans-serif; cursor:pointer;";
    card.onclick = () => {
      freeCam.jumpTo(t.cellX, t.cellY);
      send({ type: "ping", kind: t.ping, targetCellX: t.cellX, targetCellY: t.cellY });
    };
    el.appendChild(card);
  }
}

function updateDirectRing(view) {
  const own = directMode
    ? view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId)
    : null;
  const range = own ? weaponRangeOverlay(view, joined.operatorId) : null;
  if (!range) {
    if (directRing) { scene.remove(directRing); directRing = null; }
    return;
  }
  if (!directRing) {
    directRing = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff5533, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(range.radiusCells - 0.18, range.radiusCells, 64), mat);
    outer.rotation.x = -Math.PI / 2;
    outer.name = "outer";
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 24), mat);
    inner.rotation.x = -Math.PI / 2;
    directRing.add(outer, inner);
    scene.add(directRing);
  }
  directRing.position.set(range.centerX, 0.07, range.centerY);
}

function updatePingLabels(view) {
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

// 13E fog ghosts: translucent last-seen hulls, fading over 10 s.
function updateGhostMeshes(nowMs) {
  const live = new Set();
  for (const g of fogGhosts) {
    const alpha = ghostOpacity(g, nowMs);
    if (alpha <= 0) continue;
    live.add(g.id);
    let mesh = ghostMeshes.get(g.id);
    if (!mesh) {
      const resolved = resolveVisual(ASSET_MANIFEST, visualKeyFor(g));
      mesh = buildProcedural(resolved.key ?? "tank") ?? buildProcedural("tank");
      mesh.traverse((n) => {
        if (n.isMesh) {
          n.material = n.material.clone();
          n.material.transparent = true;
          n.material.color.set(0x9fb4c8); // spectral, faction-less memory
        }
      });
      scene.add(mesh);
      ghostMeshes.set(g.id, mesh);
    }
    mesh.position.set(g.x / CELL + 0.5, 0, g.y / CELL + 0.5);
    mesh.rotation.y = Math.PI / 2 - ((g.heading ?? 0) * Math.PI * 2) / 256;
    mesh.traverse((n) => { if (n.isMesh) n.material.opacity = alpha * 0.45; });
  }
  for (const [id, mesh] of ghostMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      ghostMeshes.delete(id);
    }
  }
}

function updateDownedMeshes(view) {
  const live = new Set();
  for (const d of view.downedOperators ?? []) {
    live.add(d.operatorId);
    let mesh = downedMeshes.get(d.operatorId);
    if (!mesh) {
      mesh = buildProcedural("operator_down");
      applyTeamColor(mesh, teamToken(ASSET_TOKENS, joined?.team ?? 0).color);
      scene.add(mesh);
      downedMeshes.set(d.operatorId, mesh);
    }
    mesh.position.set(d.x / CELL + 0.5, 0.05, d.y / CELL + 0.5);
    const mine = d.operatorId === joined?.operatorId;
    const canBoard = mine && adjacentBoardableCarrier(view);
    upsertWorldLabel(`down${d.operatorId}`,
      mine
        ? (canBoard ? t("label.board_here") : t("label.you_down"))
        : t("label.operator_down"),
      "#ffd75e", d.x / CELL + 0.5, 1.2, d.y / CELL + 0.5);
  }
  for (const [id, mesh] of downedMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      downedMeshes.delete(id);
      const label = worldLabels.get(`down${id}`);
      if (label) { scene.remove(label.sprite); worldLabels.delete(`down${id}`); }
    }
  }
}

// 14A: one-time war dressing — antenna clutter at relays, plinths at the
// standard homes. Rebuilt when the war (terrain) changes.
let dressingGroup = null;
let dressingKey = "";
function updateWarDressing(view) {
  const key = `${cachedMap?.profile ?? ""}:${(view.sites ?? []).map((s) => s.id).join(",")}` +
    `:${(view.standards ?? []).map((st) => `${st.homeCellX},${st.homeCellY}`).join("|")}`;
  if (key === dressingKey) return;
  dressingKey = key;
  if (dressingGroup) scene.remove(dressingGroup);
  dressingGroup = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e2e38 });
  const pale = new THREE.MeshLambertMaterial({ color: 0x8a8a72 });
  for (const s of view.sites ?? []) {
    for (const [dx, dz, w, h] of [[-0.9, 0.4, 0.25, 0.35], [0.8, -0.6, 0.3, 0.2], [0.7, 0.7, 0.2, 0.5]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), dark);
      crate.position.set(s.cellX + 0.5 + dx, h / 2, s.cellY + 0.5 + dz);
      dressingGroup.add(crate);
    }
  }
  for (const st of view.standards ?? []) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.12, 8), pale);
    plinth.position.set(st.homeCellX + 0.5, 0.06, st.homeCellY + 0.5);
    dressingGroup.add(plinth);
  }
  scene.add(dressingGroup);
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
  applyTeamColor(mesh, site.hp === 0 ? "#3a3028" : color); // 11F: ruins go dark
  mesh.scale.y = site.hp === 0 ? 0.45 : 1; // visibly knocked down
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
  updateWarDressing(view);
  for (const st of view.standards ?? []) upsertStandardMesh(st);
  updateDownedMeshes(view);
  updateMineMeshes(view);
  updateDroneMeshes(view, performance.now());
  updatePingLabels(view);
  updateDirectRing(view);
  updateTaskStrip(view);
  updateActionBanner(view);
  fogGhosts = updateGhosts(fogGhosts, view, performance.now());
  updateGhostMeshes(performance.now());
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
