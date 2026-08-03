// tools/client_smoke.mjs — Playwright join-flow smoke (prompt 35): can a
// real browser load the client WITHOUT errors, join BOTH factions, and
// see the war tick? Catches what node tests structurally cannot — load
// order, DOM wiring, module-graph 404s — in ~15 s.
//
//   node tools/client_smoke.mjs          # needs playwright installed
//   HEADED=1 node tools/client_smoke.mjs # watch it
//
// Exit 0 = healthy · 1 = FAILURES (listed) · 2 = playwright not installed.

import { createAppServer } from "../server/index.js";

const HEADED = process.env.HEADED === "1";

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright not installed: npm i -D playwright && npx playwright install chromium");
    process.exit(2);
  }

  const appServer = createAppServer({ mapSeed: 2026, enableAi: true });
  const addr = await appServer.start(0);
  const url = `http://localhost:${addr.port}`;
  const browser = await chromium.launch({ headless: !HEADED });
  const failures = [];

  async function joinAs(buttonId, expectText) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });
    await page.goto(url, { waitUntil: "networkidle" });
    if (errors.length) {
      failures.push(`${buttonId}: errors at LOAD — ${errors[0]}`);
      await page.close();
      return;
    }
    await page.click(`#${buttonId}`);
    // Briefing appears; dismiss it; the op-info line must speak faction.
    await page.waitForTimeout(1500);
    const briefing = await page.textContent("#briefing-text").catch(() => "");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500); // a couple of server ticks
    const opInfo = await page.textContent("#op-info").catch(() => "");
    const tick = Number((opInfo.match(/Tick (\d+)/) ?? [])[1] ?? -1);
    if (!opInfo.includes(expectText)) {
      failures.push(`${buttonId}: op-info "${opInfo}" lacks "${expectText}"`);
    }
    if (buttonId !== "btn-spectate" && !briefing.includes("fight for")) {
      failures.push(`${buttonId}: briefing missing ("${briefing.slice(0, 60)}")`);
    }
    if (!(tick > 0)) failures.push(`${buttonId}: war not ticking (op-info: "${opInfo}")`);
    if (errors.length) failures.push(`${buttonId}: runtime errors — ${errors[0]}`);
    await page.close();
  }

  await joinAs("btn-join-a", "Directorate");
  await joinAs("btn-join-b", "Outliers");
  await joinAs("btn-spectate", "Spectator");

  // Prompt 166 (the 2D join blocker): the fallback renderer must also
  // let a player JOIN — the socket comes before the sprites now, and
  // this gate keeps it that way.
  const page2d = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors2d = [];
  page2d.on("pageerror", (e) => errors2d.push(`2d: ${e.message}`));
  await page2d.goto(`${url}?renderer=2d`, { waitUntil: "networkidle" });
  await page2d.waitForTimeout(1200);
  await page2d.evaluate(() => { const s = document.getElementById("splash-overlay"); if (s) s.style.display = "none"; });
  await page2d.click("#btn-join-b");
  let joined2d = false;
  for (let i = 0; i < 20 && !joined2d; i++) {
    await page2d.waitForTimeout(250);
    joined2d = await page2d.evaluate(() =>
      document.getElementById("join-overlay")?.style.display === "none");
  }
  if (!joined2d) {
    const dbg = await page2d.evaluate(() => ({
      socket: window.__mfDebug?.socketState ?? "n/a",
      overlay: document.getElementById("join-overlay")?.style.display,
      hasCanvas: !!document.querySelector("#canvas-container canvas"),
    }));
    console.error("2D FALLBACK: join did not complete", JSON.stringify(dbg));
    process.exit(1);
  }
  if (errors2d.length) { console.error("2D errors:", errors2d.join(" | ")); process.exit(1); }
  await browser.close();
  await appServer.stop();
  if (failures.length) {
    console.error("CLIENT SMOKE FAILED:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("client smoke OK: both factions join, briefing shows, war ticks, zero page errors, 2D fallback joins");
}

main().catch((e) => { console.error(e); process.exit(1); });
