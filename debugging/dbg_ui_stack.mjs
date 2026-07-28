// Reproduce the hang, then pause V8 and print where it is stuck.
import { createAppServer } from "../server/index.js";
import { chromium } from "playwright";
const app = createAppServer({ mapSeed: 2026, enableAi: true });
const addr = await app.start(0);
const browser = await chromium.launch();
const page = await browser.newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send("Debugger.enable");
cdp.on("Debugger.paused", (ev) => {
  console.log("PAUSED at:");
  for (const f of ev.callFrames.slice(0, 6)) {
    console.log(`  ${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.location.lineNumber + 1}`);
  }
  cdp.send("Debugger.resume").catch(() => {});
});
await page.goto(`http://localhost:${addr.port}`, { waitUntil: "networkidle" });
await page.click("#btn-join-a");
await page.waitForTimeout(1200);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
await page.waitForTimeout(1500); // let it hang
for (let s = 0; s < 6; s++) {
  await cdp.send("Debugger.pause");
  await new Promise((r) => setTimeout(r, 400));
}
await browser.close();
await app.shutdown();
