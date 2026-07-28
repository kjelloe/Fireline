// No arrows — just watch the page over time. Hang = war-event-driven.
import { createAppServer } from "../server/index.js";
import { chromium } from "playwright";
const app = createAppServer({ mapSeed: 2026, enableAi: true });
const addr = await app.start(0);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
const alive = async (label) => {
  try {
    await Promise.race([
      page.evaluate(() => 1 + 1),
      new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), 2500)),
    ]);
    console.log(label, "alive");
    return true;
  } catch { console.log(label, "MAIN THREAD HUNG"); return false; }
};
await page.goto(`http://localhost:${addr.port}`, { waitUntil: "networkidle" });
await page.click("#btn-join-a");
await page.waitForTimeout(1200);
await page.keyboard.press("Enter");
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(700);
  if (!(await alive(`t+${(i + 1) * 0.7}s`))) break;
}
await browser.close();
await app.shutdown();
