import * as THREE from 'three';

const urlParams = new URLSearchParams(window.location.search);
const OPERATOR_ID = parseInt(urlParams.get('op') || '0');
const TEAM = parseInt(urlParams.get('team') || '0');

let socket;
let currentView = null;
let lastSnapshotTime = 0;
let scene, camera, renderer, raycaster;
let assets = new Map(); // id -> Mesh

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 20;
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(20, 20, 20); // Tilted view
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    raycaster = new THREE.Raycaster();

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    document.getElementById('btn-recenter').onclick = centerCamera;

    connect();
    animate();
}

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3000`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'c_join', operatorId: OPERATOR_ID, team: TEAM }));
    };

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 's_snapshot') {
            currentView = msg.view;
            lastSnapshotTime = performance.now();
            updateHUD(msg);
        }
    };
}

function updateHUD(msg) {
    const info = document.getElementById('op-info');
    info.innerText = `Op: ${OPERATOR_ID} | Team: ${TEAM === 0 ? "A" : "B"} | Tick: ${msg.tick}`;
    document.getElementById('status-bar').innerText = `Hash: ${msg.stateHash}`;
}

function onPointerDown(event) {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, target)) {
        const cx = Math.floor(target.x);
        const cy = Math.floor(target.z);
        socket.send(JSON.stringify({ type: 'move_order', targetCellX: cx, targetCellY: cy }));
    }
}

function centerCamera() {
    if (!currentView) return;
    // Simple logic: find my asset if possible or just center on known view group
    camera.position.set(20, 20, 20);
    camera.lookAt(0,0,0);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 20;
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

function renderBattlefield() {
    if (!currentView) return;

    // Reconciliation of assets (Create/Update/Remove)
    const seenIds = new Set();

    // Friendly Assets
    currentView.assets.forEach(a => {
        seenIds.add(a.id);
        updateAssetMesh(a, 0x00ff00);
    });

    // Enemy Assets (if visible)
    currentView.visibleEnemies.forEach(e => {
        seenIds.add(e.id);
        updateAssetMesh(e, 0xff0000);
    });

    // Cleanup
    for (let [id, mesh] of assets) {
        if (!seenIds.has(id)) {
            scene.remove(mesh);
            assets.delete(id);
        }
    }
}

function updateAssetMesh(data, color) {
    let mesh = assets.get(data.id);
    if (!mesh) {
        const geometry = new THREE.BoxGeometry(0.8, 0.5, 0.8);
        const material = new THREE.MeshPhongMaterial({ color });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        assets.set(data.id, mesh);
    }
    // Fixed-point to world units (assuming 1 cell = 1 unit)
    const tx = data.x / 256;
    const tz = data.y / 256;
    mesh.position.set(tx, 0.25, tz);
}

init();
