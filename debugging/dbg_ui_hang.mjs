// Is the page main thread alive at each step?
import { createAppServer } from "../server/index.js";
import { chromium } from "playwright";
const app = createAppServer({ mapSeed: 2026, enableAi: true });
const addr = await app.start(0);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
const alive = async (label) => {
  try {
    const t = await Promise.race([
      page.evaluate(() => 1 + 1),
      new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), 3000)),
    ]);
    console.log(label, "alive", t);
  } catch { console.log(label, "MAIN THREAD HUNG"); }
};
await page.goto(`http://localhost:${addr.port}`, { waitUntil: "networkidle" });
await alive("after load");
await page.click("#btn-join-a");
await page.waitForTimeout(1200);
await alive("after join");
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
await alive("after briefing");
for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
await alive("after arrows");
await page.waitForTimeout(500);
await alive("after settle");
await browser.close();
await app.shutdown();
