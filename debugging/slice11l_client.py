def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

p = "client/js/client.js"
patch(p,
"""const teamPings = []; // 10C: recent own-team pings for world labels""",
"""const teamPings = []; // 10C: recent own-team pings for world labels
// 11L direct control (G toggles): WASD becomes tank controls.
let directMode = false;
const driveHeld = { w: false, a: false, s: false, d: false };
let lastDriveSent = "0,0";""")
patch(p,
"""  // 8G: free camera controls.
  window.addEventListener("keydown", (e) => {
    const pan = panForKey(e.key);
    if (pan) { freeCam.pan(pan.dx, pan.dy); return; }""",
"""  // 8G: free camera controls (11L: direct mode claims WASD first).
  window.addEventListener("keydown", (e) => {
    if (e.key === "g" || e.key === "G") {
      directMode = !directMode;
      if (!directMode) { for (const k in driveHeld) driveHeld[k] = false; }
      sendDriveIntent();
      pushEvent(directMode
        ? "DIRECT DRIVE — W/S throttle, A/D steer, G to exit"
        : "Direct drive off — click-to-move restored.");
      if (directMode) freeCam.followMode(true);
      return;
    }
    if (directMode && e.key.toLowerCase() in driveHeld) {
      driveHeld[e.key.toLowerCase()] = true;
      sendDriveIntent();
      return;
    }
    const pan = panForKey(e.key);
    if (pan) { freeCam.pan(pan.dx, pan.dy); return; }""")
patch(p,
"""  renderer.domElement.addEventListener("wheel", (e) => {""",
"""  window.addEventListener("keyup", (e) => { // 11L
    if (directMode && e.key.toLowerCase() in driveHeld) {
      driveHeld[e.key.toLowerCase()] = false;
      sendDriveIntent();
    }
  });
  renderer.domElement.addEventListener("wheel", (e) => {""")
patch(p,
"""function joinTeam(team) {""",
"""// 11L: stream the current WASD intent, only on change.
function sendDriveIntent() {
  const throttle = driveHeld.w ? 1 : driveHeld.s ? -1 : 0;
  const turn = driveHeld.d ? 1 : driveHeld.a ? -1 : 0;
  const key = `${throttle},${turn}`;
  if (key === lastDriveSent) return;
  lastDriveSent = key;
  send({ type: "drive", throttle, turn });
}

function joinTeam(team) {""")
patch("client/index.html",
"B board / U unboard",
"B board / U unboard · G direct drive (WASD)")
print("11L client patched")
