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

  await browser.close();
  await appServer.stop();
  if (failures.length) {
    console.error("CLIENT SMOKE FAILED:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("client smoke OK: both factions join, briefing shows, war ticks, zero page errors");
}

main().catch((e) => { console.error(e); process.exit(1); });
