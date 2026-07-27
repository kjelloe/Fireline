// dbg_smoke_stack.mjs — full-stack version of the smoke's join flow.
import { createAppServer } from "../server/index.js";
import { chromium } from "playwright";
const app = createAppServer({ mapSeed: 2026, enableAi: true });
const addr = await app.start(0);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (err) => { console.log("PAGEERROR:", err.stack ?? err.message); });
await page.goto(`http://localhost:${addr.port}`, { waitUntil: "networkidle" });
await page.click("#btn-join-a");
await page.waitForTimeout(1500);
await page.keyboard.press("Enter");
await page.waitForTimeout(4000);
await browser.close();
await app.shutdown();
