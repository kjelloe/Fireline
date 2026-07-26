def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

# input_mapper: an enemy drone under the click outranks the ground move —
# and even an enemy asset (the drone hovers ABOVE it).
patch("client/js/input_mapper.js",
"""  const target = enemyAtCell(view, cellX, cellY, fireRadiusCells);
  if (target) {
    return { type: "fire_order", targetAssetId: target.id };
  }""",
"""  // 9G: drones hover above everything — an enemy drone under the click is
  // the target, even over an enemy asset on the same cell.
  const drone = (view?.drones ?? [])
    .filter((d) => d.team !== view?.team)
    .filter((d) => atCell(d, cellX, cellY, fireRadiusCells))
    .sort((a, b) => a.id - b.id)[0];
  if (drone) {
    return { type: "fire_order", targetDroneId: drone.id };
  }

  const target = enemyAtCell(view, cellX, cellY, fireRadiusCells);
  if (target) {
    return { type: "fire_order", targetAssetId: target.id };
  }""")

# client.js: drone meshes (spinning quad above the ground plane).
patch("client/js/client.js",
"""const mineMeshes = new Map(); // mineId -> Mesh (9E)""",
"""const mineMeshes = new Map(); // mineId -> Mesh (9E)
const droneMeshes = new Map(); // droneId -> Mesh (9G)""")
patch("client/js/client.js",
"""function updateDownedMeshes(view) {""",
"""function updateDroneMeshes(view, nowMs) {
  const live = new Set();
  for (const d of view.drones ?? []) {
    live.add(d.id);
    let mesh = droneMeshes.get(d.id);
    if (!mesh) {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.08, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x30343c })
      );
      const rotor = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.03, 0.07),
        new THREE.MeshLambertMaterial({ color: 0xcccccc })
      );
      rotor.position.y = 0.08;
      body.add(rotor);
      body.userData.rotor = rotor;
      scene.add(body);
      droneMeshes.set(d.id, body);
    }
    mesh = droneMeshes.get(d.id);
    mesh.position.set(d.x / CELL + 0.5, 1.1, d.y / CELL + 0.5);
    mesh.userData.rotor.rotation.y = (nowMs % 1000) / 1000 * Math.PI * 8;
  }
  for (const [id, mesh] of droneMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      droneMeshes.delete(id);
    }
  }
}

function updateDownedMeshes(view) {""")
patch("client/js/client.js",
"""  updateDownedMeshes(view);
  updateMineMeshes(view);""",
"""  updateDownedMeshes(view);
  updateMineMeshes(view);
  updateDroneMeshes(view, performance.now());""")
print("9G client patched")
