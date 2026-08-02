import { chromium } from "playwright";
import { createAppServer } from "../server/index.js";
const app = createAppServer({ mapSeed: 42, enableAi: true });
const addr = await app.start(0);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("PAGE ERROR:", m.text()); });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto(`http://localhost:${addr.port}`);
await page.waitForTimeout(1200);
await page.evaluate(() => { const s = document.getElementById("splash-overlay"); if (s) s.style.display = "none"; });
await page.click("#btn-join-a");
await page.waitForTimeout(800);
await page.evaluate(() => { const b = document.getElementById("briefing-overlay"); if (b) b.style.display = "none"; });
await page.waitForTimeout(2500);
await page.evaluate(() => document.getElementById("btn-encyclopedia")?.click());
await page.waitForTimeout(400);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById("btn-next-asset")?.click());
await page.waitForTimeout(600);
// right-drag like acceptance item 28
await page.mouse.move(400, 300);
await page.mouse.down({ button: "right" });
await page.mouse.move(500, 380, { steps: 5 });
await page.mouse.up({ button: "right" });
await page.waitForTimeout(300);
const hov = await page.evaluate(() => window.__mfDebug?.hover ?? "n/a");
console.log("hoverAssetId-ish:", JSON.stringify(hov));
const pre = await page.evaluate(() => ({
  joined: !!window.__mfDebug, codex: document.getElementById("codex-panel")?.style.display,
}));
await page.keyboard.press("i");
await page.waitForTimeout(400);
const post = await page.evaluate(() => ({
  codex: document.getElementById("codex-panel")?.style.display,
  active: document.activeElement?.id ?? document.activeElement?.tagName,
}));
console.log("pre:", JSON.stringify(pre), "post:", JSON.stringify(post));
await browser.close();
await app.stop();
