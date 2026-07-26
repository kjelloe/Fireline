# factory: downed operator figure
p = "client/js/asset_factory.js"
src = open(p).read()
src = src.replace("""function buildStandard(dropped) {""",
"""function buildOperatorDown() {
  const g = new THREE.Group();
  const C = colors();
  const body = box(0.14, 0.09, 0.34, C.hullShadow); body.position.set(0, 0.06, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(C.hullPaint));
  head.position.set(0, 0.08, 0.22);
  const panel = teamPanel(0.1, 0.03, 0.1); panel.position.set(0, 0.12, -0.05);
  g.add(body, head, panel);
  return g;
}

function buildStandard(dropped) {""")
src = src.replace("""  wreck_carrier: () => buildWreck("wreck_carrier"),
  standard_upright:""",
"""  wreck_carrier: () => buildWreck("wreck_carrier"),
  operator_down: buildOperatorDown,
  standard_upright:""")
open(p, "w").write(src)

# strip test tile count 15 -> 16
p = "test/art_pipeline.test.js"
src = open(p).read()
src = src.replace('assert.equal(width, 15 * 176, "one tile per procedural key + the red standard");',
                  'assert.equal(width, 16 * 176, "one tile per procedural key + the red standard");')
open(p, "w").write(src)

# client: render downed, crawl clicks, redeploy key
p = "client/js/client.js"
src = open(p).read()
src = src.replace("""const standardMeshes = new Map(); // team -> Mesh (8F/8A)""",
"""const standardMeshes = new Map(); // team -> Mesh (8F/8A)
const downedMeshes = new Map(); // operatorId -> Mesh (9B)""")
src = src.replace("""    if (e.key === "x" || e.key === "X") {""",
"""    if (e.key === "r" || e.key === "R") send({ type: "redeploy" }); // 9B
    if (e.key === "x" || e.key === "X") {""")
src = src.replace("""  const view = interpolator.latest();
  const { cellX, cellY } = scenePointToCell(target.x, target.z);
  const own = view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  const cmd = buildCommandForClick(view, cellX, cellY, {
    fireRadiusCells: 1, myOperatorId: joined.operatorId,
    canTow: own ? own.type === 3 : false,
  });""",
"""  const view = interpolator.latest();
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
  });""")
src = src.replace("""  for (const site of view.sites ?? []) upsertSiteMesh(site);
  for (const st of view.standards ?? []) upsertStandardMesh(st);""",
"""  for (const site of view.sites ?? []) upsertSiteMesh(site);
  for (const st of view.standards ?? []) upsertStandardMesh(st);
  updateDownedMeshes(view);""")
src = src.replace("""function upsertSiteMesh(site) {""",
"""function updateDownedMeshes(view) {
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
    upsertWorldLabel(`down${d.operatorId}`,
      d.operatorId === joined?.operatorId ? "YOU ARE DOWN — R TO REDEPLOY" : "OPERATOR DOWN",
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

function upsertSiteMesh(site) {""")
open(p, "w").write(src)

# hint bar mentions redeploy
p = "client/index.html"
src = open(p).read()
src = src.replace("WASD/arrows pan · wheel zoom · F follow · Home base · X standard · click: select/fire/tow/move",
                  "WASD/arrows pan · wheel zoom · F follow · Home base · X standard · R redeploy · click: select/fire/tow/move (crawl when down)")
open(p, "w").write(src)
print("9B client wired")
