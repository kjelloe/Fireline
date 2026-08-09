// Prompt 220 probe: what does the downed body ACTUALLY look like?
// Downs the own operator via engine surgery beside their hull, centres,
// and screenshots at desktop viewport.
import { createAppServer } from "../server/index.js";
import { createDowned } from "../engine/downed.js";
import { chromium } from "playwright";

const app = createAppServer({ mapSeed: 2026, enableAi: false });
const addr = await app.start(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${addr.port}`, { waitUntil: "networkidle" });
await page.click("#btn-join-a");
await page.waitForTimeout(1500);
await page.keyboard.press("Enter");
await page.waitForTimeout(2000);
await page.evaluate(() => document.getElementById("btn-tut-skip")?.click());
await page.waitForTimeout(500);

// Surgery: down the joined operator beside their own asset (synchronous
// capture+mutate — state is replaced each tick).
const OP_DOWN = 2;
const st = app.gameServer.state;
const seat = st.operators.find((o) => o.state === 1 && o.assetId !== -1 && o.id < 16);
if (!seat) { console.error("no seated human"); process.exit(1); }
const hull = st.assets[seat.assetId];
hull.operatorId = -1;
seat.assetId = -1;
seat.state = OP_DOWN;
// Mid-map, far from base carriers (auto-rescue + base delivery eat an
// in-base body within a tick — the acceptance harness lesson).
const body = createDowned(seat, hull);
body.x = 40 * 256 + 128;
body.y = 63 * 256 + 128;
body.targetX = body.x; // stationary — createDowned targets the hull's
body.targetY = body.y; // position, and an unpinned body crawls home
st.downed.push(body);
app.gameServer.step();

await page.waitForTimeout(1500);
await page.keyboard.press("c"); // centre on me → the body
await page.waitForTimeout(1000);
for (let i = 0; i < 14; i++) {
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -240); // zoom to combat-close
  await page.waitForTimeout(150);
}
await page.keyboard.press("c");
await page.waitForTimeout(1000);
await page.screenshot({ path: process.argv[2] ?? "/tmp/downed_shot.png" });

// And what the scene graph says about the mesh.
const info = await page.evaluate(() => {
  const dbg = window.__mfDebug;
  return dbg?.downedMeshInfo ? dbg.downedMeshInfo() : "no debug hook";
});
console.log("mesh info:", JSON.stringify(info));
await browser.close();
await app.stop();
console.log("shot saved");
