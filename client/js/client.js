// client/js/client.js — browser presentation adapter (slice 2F).
// Renders fog-filtered server views with three.js, interpolates 10Hz
// snapshots, and translates clicks into commands. No game logic here:
// every outcome comes back from the server.

import * as THREE from "three";
import { createInterpolator } from "./interpolator.js";
import { scenePointToCell, buildCommandForClick, buildSelectCommand } from "./input_mapper.js";
import { diffVisibleEnemies, visibleEnemyIds } from "./fog_culler.js";

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
let cameraFollow = true;
const eventFeed = [];

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
  document.getElementById("btn-recenter").onclick = () => { cameraFollow = true; };
  document.getElementById("btn-next-asset").onclick = selectNextAsset;
  document.getElementById("btn-join-a").onclick = () => joinTeam(0);
  document.getElementById("btn-join-b").onclick = () => joinTeam(1);

  connect();
  animate();
}

function connect() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}`);
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "s_joined") {
      joined = { operatorId: msg.operatorId, team: msg.team };
      document.getElementById("join-overlay").style.display = "none";
      updateOpInfo(null);
    } else if (msg.type === "s_snapshot") {
      interpolator.push(msg.view, performance.now());
      handleEvents(msg.view.events ?? []);
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
  socket.send(JSON.stringify({ type: "c_join", team }));
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
  const cmd = buildCommandForClick(view, cellX, cellY, { fireRadiusCells: 1 });
  send(cmd);
}

function handleEvents(events) {
  for (const e of events) {
    if (e.type === "site_captured") pushEvent(`relay ${e.siteId} captured by team ${e.team === 0 ? "A" : "B"}`);
    if (e.type === "asset_disabled") pushEvent(`asset ${e.assetId} disabled`);
    if (e.type === "resupplied") pushEvent(`asset ${e.assetId} resupplied`);
    if (e.type === "rejected") pushEvent(`order rejected: ${e.reason}`);
  }
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

function buildTerrain(view) {
  if (terrainMesh || !view.mapCells) return;
  const size = Math.sqrt(view.mapCells.length ?? Object.keys(view.mapCells).length);
  const cells = view.mapCells instanceof Uint8Array
    ? view.mapCells
    : Uint8Array.from(Object.values(view.mapCells));
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

function assetColor(a, friendly) {
  if (a.state === STATE_DISABLED) return 0x444444;
  return friendly ? (joined?.team === 1 ? 0xcc4444 : 0x44cc44)
                  : (joined?.team === 1 ? 0x44cc44 : 0xcc4444);
}

function upsertAssetMesh(a, friendly) {
  let mesh = assetMeshes.get(a.id);
  if (!mesh) {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshPhongMaterial({ color: 0xffffff })
    );
    scene.add(mesh);
    assetMeshes.set(a.id, mesh);
  }
  mesh.material.color.setHex(assetColor(a, friendly));
  mesh.position.set(a.x / CELL + 0.5, a.state === STATE_DISABLED ? 0.15 : 0.35, a.y / CELL + 0.5);
  if (friendly && a.operatorId === joined?.operatorId) {
    mesh.scale.set(1.2, 1.2, 1.2);
  } else {
    mesh.scale.set(1, 1, 1);
  }
  return mesh;
}

function upsertSiteMesh(site) {
  let mesh = siteMeshes.get(site.id);
  if (!mesh) {
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 1.4, 8),
      new THREE.MeshPhongMaterial({ color: 0x888888 })
    );
    scene.add(mesh);
    siteMeshes.set(site.id, mesh);
  }
  const color = site.owner === -1 ? 0x888888 : site.owner === joined?.team ? 0x44cc44 : 0xcc4444;
  mesh.material.color.setHex(color);
  mesh.position.set(site.cellX + 0.5, 0.7, site.cellY + 0.5);
}

function renderBattlefield() {
  const view = interpolator.sample(performance.now());
  if (!view) return;
  buildTerrain(view);
  updateSupplyBar(view);

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

  if (cameraFollow && joined) {
    const own = view.friendlyAssets.find((a) => a.operatorId === joined.operatorId)
      ?? view.friendlyAssets[0];
    if (own) {
      const cx = own.x / CELL;
      const cz = own.y / CELL;
      camera.position.set(cx + 18, 26, cz + 18);
      camera.lookAt(cx, 0, cz);
    }
  }
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
