p = "client/js/client.js"
src = open(p).read()
src = src.replace('import { describeEvent, summarizeGameOver } from "./feedback_model.js";',
'''import { describeEvent, summarizeGameOver } from "./feedback_model.js";
import { smoothHeading, TURN_RATE_RAD_PER_SEC } from "./heading.js";''')
src = src.replace('''  mesh.position.set(a.x / CELL + 0.5, 0, a.y / CELL + 0.5);
  if (typeof a.heading === "number") mesh.rotation.y = -a.heading; // 4D: face motion''',
'''  mesh.position.set(a.x / CELL + 0.5, 0, a.y / CELL + 0.5);
  // 4D headings, smoothed: axis-major movement flips 90 degrees near
  // diagonals, so turn gradually instead of snapping (playtest 3 fix).
  if (typeof a.heading === "number") {
    const target = -a.heading;
    const prev = mesh.userData.smoothedHeading ?? target;
    const maxStep = TURN_RATE_RAD_PER_SEC / 60;
    mesh.userData.smoothedHeading = smoothHeading(prev, target, maxStep);
    mesh.rotation.y = mesh.userData.smoothedHeading;
  }''')
open(p, "w").write(src)
print("heading smoothing wired")
