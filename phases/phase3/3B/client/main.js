// client/main.js — Phase 2 Vertical Slice Entry Point (2F)
import * as THREE from 'three';
import { createInterpolator } from './interpolator.js';
import { createSceneAdapter } from './scene.js';
import { createInputHandler } from './input_handler.js';
import { createUIOverlay } from './ui_overlay.js';

let socket = null;
let opId = null;
let team = null;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

camera.position.set(4, 8, 12);
camera.lookAt(4, 0, 4);

const interp = createInterpolator();
const adapter = createSceneAdapter(THREE, scene);
const input = createInputHandler(THREE, camera, renderer, adapter);

const ui = createUIOverlay((id, t) => {
  opId = id;
  team = t;
  connect();
});

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'JOIN', opId, team }));
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'snapshot') {
      interp.pushSnapshot(msg.view);
      // Initialize terrain only once
      if (msg.view.mapCells && !adapter.terrainBuilt) {
        adapter.buildTerrain(msg.view.mapCells, msg.view.mapWidth, msg.view.mapHeight);
        adapter.terrainBuilt = true;
      }
    }
  };
}

window.addEventListener('mousedown', (e) => {
  if (!socket || !opId) return;
  const cmd = input.handlePointerDown(e, scene, opId);
  if (cmd) socket.send(JSON.stringify(cmd));
});

function animate() {
  requestAnimationFrame(animate);
  const frame = interp.getFrame();
  if (frame) {
    adapter.updateAssets(frame);
  }
  renderer.render(scene, camera);
}

animate();
