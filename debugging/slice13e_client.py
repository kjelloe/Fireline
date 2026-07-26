def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

p = "client/js/client.js"
patch(p,
"""import { propsFor } from "./props_model.js";""",
"""import { propsFor } from "./props_model.js";
import { updateGhosts, ghostOpacity } from "./ghosts_model.js";""")
patch(p,
"""const droneMeshes = new Map(); // droneId -> Mesh (9G)""",
"""const droneMeshes = new Map(); // droneId -> Mesh (9G)
let fogGhosts = []; // 13E: last-seen enemy contacts
const ghostMeshes = new Map(); // enemyId -> Mesh (13E)""")
patch(p,
"""  updateTaskStrip(view);
  updateActionBanner(view);""",
"""  updateTaskStrip(view);
  updateActionBanner(view);
  fogGhosts = updateGhosts(fogGhosts, view, performance.now());
  updateGhostMeshes(performance.now());""")
patch(p,
"""function updateDownedMeshes(view) {""",
"""// 13E fog ghosts: translucent last-seen hulls, fading over 10 s.
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

function updateDownedMeshes(view) {""")
print("13E wired")
