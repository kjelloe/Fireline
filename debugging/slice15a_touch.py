def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# viewport meta + touch pad markup + touch CSS.
patch("client/index.html",
'''    <div id="mission-toast"''',
'''    <div id="touch-pad" style="display:none; position:absolute; left:14px; bottom:90px; z-index:6; width:150px; height:150px;">
        <!-- 15A: 8-direction steering pad + center stop (ruling Q10) -->
    </div>
    <div id="mission-toast"''')
patch("client/index.html",
'''  :root { --ui-scale: 1; }''',
'''  :root { --ui-scale: 1; }
  canvas { touch-action: none; }
  .tp-btn {
    position: absolute; width: 44px; height: 44px; border-radius: 10px;
    background: rgba(20,24,32,0.75); color: #f5e96b; border: 1px solid #444;
    font: bold 18px sans-serif; display: flex; align-items: center;
    justify-content: center; user-select: none; -webkit-user-select: none;
  }
  .tp-btn:active { background: rgba(80,90,60,0.9); }''')

p = "client/js/client.js"
patch(p,
'''import { DEFAULT_BINDS, loadBinds, saveBinds } from "./keybinds.js";''',
'''import { DEFAULT_BINDS, loadBinds, saveBinds } from "./keybinds.js";
import {
  arrowDrive, ARROW_BRADS, classifyTouch, pinchFactor, isTouchDevice,
} from "./touch_model.js";''')
patch(p,
'''let BINDS = loadBinds(); // 15C: remappable action keys''',
'''let BINDS = loadBinds(); // 15C: remappable action keys
// 15A mobile: the arrow pad sets a desired heading; a controller loop
// converts it into drive intents until the unit is tapped to stop.
let touchDesiredBrads = null;
let lastTouchDrive = "";''')

# Build the pad + touch gesture wiring at init.
patch(p,
'''  renderer.domElement.addEventListener("pointermove", (event) => { // 14I''',
'''  if (isTouchDevice()) setupTouch(); // 15A

  renderer.domElement.addEventListener("pointermove", (event) => { // 14I''')
patch(p,
'''function spectate() { // 10A''',
'''// ── 15A: the touch layer (ruling Q10) ───────────────────────────────────
function setupTouch() {
  const pad = document.getElementById("touch-pad");
  if (!pad) return;
  pad.style.display = "block";
  const POS = {
    nw: [0, 0], n: [53, 0], ne: [106, 0],
    w: [0, 53], stop: [53, 53], e: [106, 53],
    sw: [0, 106], s: [53, 106], se: [106, 106],
  };
  const GLYPH = {
    n: "↑", ne: "↗", e: "→", se: "↘", s: "↓", sw: "↙", w: "←", nw: "↖", stop: "■",
  };
  for (const [key, [x, y]] of Object.entries(POS)) {
    const b = document.createElement("div");
    b.className = "tp-btn";
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    b.textContent = GLYPH[key];
    if (key === "stop") b.style.color = "#ff6b52";
    b.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (key === "stop") stopTouchDrive();
      else touchDesiredBrads = ARROW_BRADS[key]; // set off in that direction
    });
    pad.appendChild(b);
  }

  // Canvas gestures: tap = order, drag = pan, pinch = zoom.
  const canvas = renderer.domElement;
  let touchStart = null;
  let lastPan = null;
  let pinchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      const to = e.touches[0];
      touchStart = { x: to.clientX, y: to.clientY, t: performance.now() };
      lastPan = { x: to.clientX, y: to.clientY };
    } else if (e.touches.length === 2) {
      touchStart = null;
      pinchStart = touchDistance(e.touches);
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && lastPan) {
      const to = e.touches[0];
      freeCam.pan((lastPan.x - to.clientX) / 14, (lastPan.y - to.clientY) / 14);
      lastPan = { x: to.clientX, y: to.clientY };
    } else if (e.touches.length === 2 && pinchStart) {
      const d = touchDistance(e.touches);
      freeCam.zoomBy(pinchFactor(pinchStart, d));
      pinchStart = d;
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchend", (e) => {
    if (touchStart && e.changedTouches.length === 1) {
      const to = e.changedTouches[0];
      const kind = classifyTouch(touchStart, { x: to.clientX, y: to.clientY },
        performance.now() - touchStart.t);
      if (kind === "tap") {
        // Tap MY unit = STOP (the Q10 rule); anywhere else = the normal
        // click order path.
        const fake = { clientX: to.clientX, clientY: to.clientY };
        if (tapIsOnMyUnit(fake)) stopTouchDrive();
        else onPointerDown(fake);
      }
    }
    touchStart = null;
    lastPan = null;
    pinchStart = null;
  });
}

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function tapIsOnMyUnit(event) {
  const me = interpolator.latest()?.friendlyAssets?.find(
    (a) => a.operatorId === joined?.operatorId);
  if (!me) return false;
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const mesh = assetMeshes.get(me.id);
  return !!mesh && raycaster.intersectObject(mesh, true).length > 0;
}

function stopTouchDrive() {
  touchDesiredBrads = null;
  lastTouchDrive = "";
  send({ type: "drive", throttle: 0, turn: 0 });
}

// The per-frame controller: steer toward the arrow heading via drive
// intents, sent only on change (rate-limit friendly).
function updateTouchDrive(view) {
  if (touchDesiredBrads === null) return;
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me) return;
  const intent = arrowDrive(me.heading ?? 0, touchDesiredBrads);
  const key = `${intent.throttle},${intent.turn}`;
  if (key !== lastTouchDrive) {
    lastTouchDrive = key;
    send({ type: "drive", throttle: intent.throttle, turn: intent.turn });
  }
}

function spectate() { // 10A''')
patch(p,
'''  updateMissionToast(view);
  updateTeamBoard(view);
  updateTargetRings(view);''',
'''  updateMissionToast(view);
  updateTeamBoard(view);
  updateTargetRings(view);
  updateTouchDrive(view);''')
print("15A wired")
