// tools/ui_acceptance.mjs — playtest-7 directive: UI buttons must be
// covered by acceptance tests that prove they trigger and invoke the
// right behavior in a REAL browser (the wiring net proves ids exist;
// this proves the handlers work). Pattern: join a war, drive each HUD
// control, assert observable state through window.__mfDebug.
//
//   node tools/ui_acceptance.mjs          # needs playwright installed
// Exit 0 = all pass · 1 = failures listed · 2 = playwright missing.

import { createAppServer } from "../server/index.js";

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
  const browser = await chromium.launch();
  // Small viewport: headless SwiftShader renders unthrottled rAF frames —
  // a busy full-size scene saturates the main thread and starves clicks
  // (not a client bug; real GPUs vsync). Keep frames cheap instead.
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const failures = [];
  const check = (name, ok, detail = "") => {
    if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`${ok ? "ok " : "FAIL"} ${name}${detail && !ok ? ` — ${detail}` : ""}`);
  };

  page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.click("#btn-join-a");
  await page.waitForTimeout(1200);
  await page.keyboard.press("Enter"); // dismiss briefing
  await page.waitForTimeout(1500);

  const cam = () => page.evaluate(() => window.__mfDebug.cam());

  // ── center-on-me (playtest 7 item 14) ─────────────────────────────────
  const before = await cam();
  await page.evaluate(() => window.__mfDebug ? null : null);
  // Pan away with arrow keys (guaranteed camera keys, WASD may be drive).
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  const panned = await cam();
  check("arrow keys pan the camera", panned.x !== before.x, `x ${before.x} -> ${panned.x}`);
  check("panning disengages follow", panned.follow === false, `follow=${panned.follow}`);
  await page.click("#btn-recenter");
  await page.waitForTimeout(400);
  const centered = await cam();
  check("center-on-me re-engages follow", centered.follow === true, `follow=${centered.follow}`);
  const own = await page.evaluate(() => {
    const j = window.__mfDebug.joined();
    return j ? j.operatorId : null;
  });
  check("joined operator known", own !== null);

  // ── next-asset cycles selection ───────────────────────────────────────
  const selBefore = await page.evaluate(() => window.__mfDebug.selectedAsset());
  await page.click("#btn-next-asset");
  await page.waitForTimeout(600);
  const selAfter = await page.evaluate(() => window.__mfDebug.selectedAsset());
  check("next-asset cycles the commanded asset",
    selAfter !== null && selAfter !== selBefore,
    `asset ${selBefore} -> ${selAfter}`);

  // ── encyclopedia opens and closes ─────────────────────────────────────
  const encBtn = await page.$("#btn-encyclopedia");
  if (encBtn) {
    await encBtn.click();
    await page.waitForTimeout(300);
    const visible = await page.evaluate(() => {
      const el = document.getElementById("encyclopedia-overlay");
      return el && el.style.display !== "none";
    });
    check("encyclopedia opens", visible === true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  await browser.close();
  await appServer.stop();
  if (failures.length) {
    console.error("\nUI ACCEPTANCE FAILED:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("\nUI acceptance OK");
}

main().catch((e) => { console.error(e); process.exit(1); });
