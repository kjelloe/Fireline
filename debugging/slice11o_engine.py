def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

# input_mapper: direct mode = weapons-only clicks with generous assist.
patch("client/js/input_mapper.js",
"""// Click semantics (8G): own selectable asset → select; visible live enemy →
// fire; own wreck → tow; anywhere else → move. Priority in that order.
export function buildCommandForClick(view, cellX, cellY, opts = {}) {
  const { fireRadiusCells = 0, myOperatorId = null, canTow = true } = opts;""",
"""// 11O (Q23): direct drive is not an FPS — clicks get a generous snap
// radius onto the nearest visible target near the cursor.
export const DIRECT_ASSIST_CELLS = 3;

// Click semantics (8G): own selectable asset → select; visible live enemy →
// fire; own wreck → tow; anywhere else → move. Priority in that order.
// 11O: in directMode, clicks are WEAPONS ONLY — drone or enemy near the
// cursor fires (with assist); anything else returns null (the wheel owns
// movement, so a stray click must never send the tank somewhere).
export function buildCommandForClick(view, cellX, cellY, opts = {}) {
  const { fireRadiusCells = 0, myOperatorId = null, canTow = true, directMode = false } = opts;
  if (directMode) {
    const assist = Math.max(fireRadiusCells, DIRECT_ASSIST_CELLS);
    const drone = (view?.drones ?? [])
      .filter((d) => d.team !== view?.team)
      .filter((d) => atCell(d, cellX, cellY, assist))
      .sort((a, b) => a.id - b.id)[0];
    if (drone) return { type: "fire_order", targetDroneId: drone.id };
    const target = enemyAtCell(view, cellX, cellY, assist);
    if (target) return { type: "fire_order", targetAssetId: target.id };
    return null;
  }""")

p = "client/js/client.js"
patch(p,
"""  const own = view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  const cmd = buildCommandForClick(view, cellX, cellY, {
    fireRadiusCells: 1, myOperatorId: joined.operatorId,
    canTow: own ? own.type === 3 : false,
  });
  if (cmd.type === "select_asset") {""",
"""  const own = view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  const cmd = buildCommandForClick(view, cellX, cellY, {
    fireRadiusCells: 1, myOperatorId: joined.operatorId,
    canTow: own ? own.type === 3 : false,
    directMode, // 11O: weapons-only clicks with aim assist
  });
  if (!cmd) return; // direct mode: nothing near the cursor — hold fire
  if (cmd.type === "select_asset") {""")

# The tracking targeting circle: follows the asset every frame in direct mode.
patch(p,
"""let directMode = false;
const driveHeld = { w: false, a: false, s: false, d: false };
let lastDriveSent = "0,0";""",
"""let directMode = false;
const driveHeld = { w: false, a: false, s: false, d: false };
let lastDriveSent = "0,0";
let directRing = null; // 11O: the tracking targeting circle""")
patch(p,
"""function updatePingLabels(view) {""",
"""// 11O: in direct mode a targeting circle rides the asset — your gun's
// true reach, always visible while you drive.
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

function updatePingLabels(view) {""")
patch(p,
"""  updateDroneMeshes(view, performance.now());
  updatePingLabels(view);""",
"""  updateDroneMeshes(view, performance.now());
  updatePingLabels(view);
  updateDirectRing(view);""")
patch("client/index.html",
"G direct drive (WASD)",
"G direct drive (WASD, click = assisted fire)")
print("11O patched")
