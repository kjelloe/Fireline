def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

p = "client/js/client.js"
patch(p,
"""const downedMeshes = new Map(); // operatorId -> Mesh (9B)""",
"""const downedMeshes = new Map(); // operatorId -> Mesh (9B)
const mineMeshes = new Map(); // mineId -> Mesh (9E)""")

patch(p,
"""    if (e.key === "r" || e.key === "R") send({ type: "redeploy" }); // 9B""",
"""    if (e.key === "r" || e.key === "R") send({ type: "redeploy" }); // 9B
    // 9E: M lays a mine under the tank; C clears the nearest adjacent
    // known mine with a truck.
    if (e.key === "m" || e.key === "M") send({ type: "deploy_mine" });
    if (e.key === "c" || e.key === "C") {
      const v = interpolator.latest();
      const mine = nearestAdjacentMine(v);
      if (mine) send({ type: "clear_mine", mineId: mine.id });
    }""")

patch(p,
"""function updateDownedMeshes(view) {""",
"""function nearestAdjacentMine(view) {
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
      const geo = new THREE.CylinderGeometry(0.18, 0.22, 0.08, 10);
      const mat = new THREE.MeshLambertMaterial();
      mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      mineMeshes.set(m.id, mesh);
    }
    // Own mines read as ordnance (dark, team-ringed); marked enemy mines
    // scream danger.
    const own = m.team === joined?.team;
    mesh.material.color.set(own ? 0x2a2a30 : 0xd03a2a);
    mesh.material.emissive.set(own ? 0x000000 : (m.armed ? 0x551111 : 0x000000));
    mesh.position.set(m.cellX + 0.5, 0.04, m.cellY + 0.5);
  }
  for (const [id, mesh] of mineMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      mineMeshes.delete(id);
    }
  }
}

function updateDownedMeshes(view) {""")

patch(p,
"""  updateDownedMeshes(view);""",
"""  updateDownedMeshes(view);
  updateMineMeshes(view);""")
print("client patched")
