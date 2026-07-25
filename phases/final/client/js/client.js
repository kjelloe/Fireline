// client/js/client.js — Milestone 1F
// Three.js orthographic renderer. Consumes fog-filtered snapshots.
// Renders terrain grid from mapCells broadcast in each view.
// No Math.random — all visual state driven by server snapshots.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// ── URL params ────────────────────────────────────────────────────────────────
const params   = new URLSearchParams(location.search);
const OP_ID    = parseInt(params.get("op")   ?? "0", 10);
const TEAM     = parseInt(params.get("team") ?? "0", 10);

// ── Three.js setup ────────────────────────────────────────────────────────────
const canvas   = document.getElementById("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(devicePixelRatio);

const W = window.innerWidth, H = window.innerHeight;
renderer.setSize(W, H);

const CELL = 8; // pixels per cell at zoom=1
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -100, 100);
cam.position.set(0, 0, 10);

// ── Terrain colours ───────────────────────────────────────────────────────────
const TERRAIN_COLOUR = [
  0x4a7c59,  // 0 open
  0xb5a642,  // 1 road
  0x2d5a27,  // 2 forest
  0x7a6a50,  // 3 rough
  0x1a1a1a,  // 4 blocking
];

// ── State ─────────────────────────────────────────────────────────────────────
let latestView   = null;
let terrainMesh  = null;   // InstancedMesh for terrain tiles
let unitMeshes   = {};     // assetId -> Mesh
let mapBuilt     = false;
let camCentred   = false;

// ── Terrain grid ──────────────────────────────────────────────────────────────
function buildTerrain(view) {
  if (terrainMesh) {
    scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
    terrainMesh = null;
  }

  const { mapWidth: W, mapHeight: H, mapCells } = view;
  if (!mapCells || !W || !H) return;

  const geo  = new THREE.PlaneGeometry(CELL - 1, CELL - 1);
  const mat  = new THREE.MeshBasicMaterial({ vertexColors: true });
  const mesh = new THREE.InstancedMesh(geo, mat, W * H);

  const dummy  = new THREE.Object3D();
  const colour = new THREE.Color();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tid = mapCells[y * W + x] ?? 0;
      const i   = y * W + x;
      dummy.position.set(x * CELL, -y * CELL, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      colour.setHex(TERRAIN_COLOUR[tid] ?? 0x333333);
      mesh.setColorAt(i, colour);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  terrainMesh = mesh;
  mapBuilt = true;
}

// ── Camera centering ──────────────────────────────────────────────────────────
function centreCamera(view) {
  // Find our team's first asset and centre on it
  for (const asset of Object.values(view.assets)) {
    if (asset.team === TEAM) {
      cam.position.set(asset.x * CELL, -asset.y * CELL, 10);
      camCentred = true;
      return;
    }
  }
}

// ── Unit rendering ────────────────────────────────────────────────────────────
const GEO_UNIT = new THREE.BoxGeometry(CELL * 0.7, CELL * 0.7, 1);
const MAT_A    = new THREE.MeshBasicMaterial({ color: 0x00cc44 });
const MAT_B    = new THREE.MeshBasicMaterial({ color: 0xcc2200 });

function syncUnits(view) {
  const seen = new Set();

  for (const [id, asset] of Object.entries(view.assets)) {
    seen.add(id);
    let mesh = unitMeshes[id];
    if (!mesh) {
      mesh = new THREE.Mesh(GEO_UNIT, asset.team === 0 ? MAT_A : MAT_B);
      mesh.position.z = 1;
      scene.add(mesh);
      unitMeshes[id] = mesh;
    }
    // Interpolate toward server position
    const tx = asset.x * CELL;
    const ty = -asset.y * CELL;
    mesh.position.x += (tx - mesh.position.x) * 0.3;
    mesh.position.y += (ty - mesh.position.y) * 0.3;
  }

  // Remove stale units
  for (const id of Object.keys(unitMeshes)) {
    if (!seen.has(id)) {
      scene.remove(unitMeshes[id]);
      delete unitMeshes[id];
    }
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function updateHud(view) {
  document.getElementById("hud-tick").textContent    = view.tick;
  document.getElementById("hud-score-a").textContent = view.scores?.[0] ?? 0;
  document.getElementById("hud-score-b").textContent = view.scores?.[1] ?? 0;
  document.getElementById("hud-status").textContent  = `team ${TEAM} | op ${OP_ID}`;
}

// ── Render loop ───────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  if (latestView) {
    if (!mapBuilt) buildTerrain(latestView);
    if (!camCentred) centreCamera(latestView);
    syncUnits(latestView);
    updateHud(latestView);
  }
  renderer.render(scene, cam);
}
animate();

// ── Click-to-move ─────────────────────────────────────────────────────────────
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx   = e.clientX - rect.left;
  const sy   = e.clientY - rect.top;

  // NDC
  const ndcX = (sx / W) * 2 - 1;
  const ndcY = -(sy / H) * 2 + 1;

  // World coords
  const worldX = ndcX * (W / 2) + cam.position.x;
  const worldY = ndcY * (H / 2) + cam.position.y;

  const cellX = Math.floor(worldX / CELL);
  const cellY = Math.floor(-worldY / CELL);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "move_order", targetCellX: cellX, targetCellY: cellY }));
  }
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
const proto = location.protocol === "https:" ? "wss" : "ws";
const ws    = new WebSocket(`${proto}://${location.host}`);

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ type: "c_join", operatorId: OP_ID, team: TEAM }));
});

ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "s_snapshot") {
    latestView = msg;
  }
});

ws.addEventListener("close", () => {
  document.getElementById("hud-status").textContent = "disconnected";
});
