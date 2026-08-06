import { createAppServer } from "../server/index.js";
import { chromium } from "playwright";

const app = createAppServer({ mapSeed: 2026, enableAi: true });
const addr = await app.start(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, hasTouch: true });
await page.goto(`http://localhost:${addr.port}`, { waitUntil: "networkidle" });
await page.click("#btn-join-a");
await page.waitForTimeout(1500);
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
// skip tutorial so the HUD is clean, then force the key bar on
await page.evaluate(() => {
  document.getElementById("btn-tut-skip")?.click();
  localStorage.setItem("mf_keybar", "1");
});
await page.waitForTimeout(1200);
await page.screenshot({ path: process.argv[2] ?? "/tmp/mobile_layout.png" });
await browser.close();
await app.stop();
console.log("shot saved");
