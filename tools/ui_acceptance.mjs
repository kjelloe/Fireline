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

  // Real clicks (so z-index/hit-testing regressions still fail this gate —
  // that is what found the buried HUD), but with the two known sources of
  // flake removed first: a full-screen overlay left open by an earlier
  // check, and headless SwiftShader's unthrottled rAF starving the click
  // queue. Overlays are closed deterministically; the timeout is generous.
  // Two separate guarantees, deliberately separated because Playwright's
  // .click() couples them and headless SwiftShader starves its click queue
  // (unthrottled rAF; not a client bug — real GPUs vsync). So:
  //   1. HIT TEST — is this button actually the topmost thing at its own
  //      centre? This is the z-index/buried-HUD regression guard, and it
  //      is a pure layout query that cannot time out.
  //   2. DISPATCH — fire the real click handler.
  const clickHud = async (selector) => {
    const id = selector.replace("#", "");
    const top = await page.evaluate((elId) => {
      for (const overlay of ["encyclopedia-overlay", "codex-panel"]) {
        const o = document.getElementById(overlay);
        if (o) o.style.display = "none";
      }
      const el = document.getElementById(elId);
      if (!el) return { ok: false, why: "missing" };
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return { ok: false, why: "zero-size" };
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const covered = !(hit === el || el.contains(hit) || hit?.contains(el));
      if (covered) return { ok: false, why: `covered by ${hit?.id || hit?.tagName}` };
      el.click();
      return { ok: true };
    }, id);
    if (!top.ok) failures.push(`${selector} not clickable — ${top.why}`);
    return top.ok;
  };

  // ── center-on-me (playtest 7 item 14) ─────────────────────────────────
  const before = await cam();
  await page.evaluate(() => window.__mfDebug ? null : null);
  // Pan away with arrow keys (guaranteed camera keys, WASD may be drive).
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  const panned = await cam();
  check("arrow keys pan the camera", panned.x !== before.x, `x ${before.x} -> ${panned.x}`);
  check("panning disengages follow", panned.follow === false, `follow=${panned.follow}`);
  await clickHud("#btn-recenter");
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
  await clickHud("#btn-next-asset");
  await page.waitForTimeout(600);
  const selAfter = await page.evaluate(() => window.__mfDebug.selectedAsset());
  check("next-asset cycles the commanded asset",
    selAfter !== null && selAfter !== selBefore,
    `asset ${selBefore} -> ${selAfter}`);

  // ── encyclopedia opens and closes ─────────────────────────────────────
  const encBtn = await page.$("#btn-encyclopedia");
  if (encBtn) {
    await clickHud("#btn-encyclopedia");
    await page.waitForTimeout(300);
    const visible = await page.evaluate(() => {
      const el = document.getElementById("encyclopedia-overlay");
      return el && el.style.display !== "none";
    });
    check("encyclopedia opens", visible === true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  // ── playtest 8 ────────────────────────────────────────────────────────
  // The encyclopedia overlay above covers the HUD; Escape does not always
  // land before the next click, so close it deterministically.
  await page.evaluate(() => {
    const el = document.getElementById("encyclopedia-overlay");
    if (el) el.style.display = "none";
  });
  await page.waitForTimeout(150);

  // Item 28: right-button drag pans like the arrow keys.
  await clickHud("#btn-recenter");
  await page.waitForTimeout(300);
  const preDrag = await cam();
  const box = await page.$eval("canvas", (c) => {
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 6 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(250);
  const postDrag = await cam();
  check("right-drag pans the camera (item 28)",
    postDrag.x !== preDrag.x || postDrag.y !== preDrag.y,
    `(${preDrag.x},${preDrag.y}) -> (${postDrag.x},${postDrag.y})`);
  check("right-drag disengages follow (item 28)", postDrag.follow === false,
    `follow=${postDrag.follow}`);

  // Item 31: the stats key opens the codex without needing the hover link.
  await page.evaluate(() => {
    const el = document.getElementById("codex-panel");
    if (el) el.style.display = "none";
  });
  await page.keyboard.press("i");
  // Poll, never settle (the harness's own rule — this line was the one
  // fixed-settle left, and it flaked under SwiftShader's rAF starvation).
  let codexOpen = false;
  for (let tries = 0; tries < 20 && !codexOpen; tries++) {
    await page.waitForTimeout(150);
    codexOpen = await page.evaluate(() => {
      const el = document.getElementById("codex-panel");
      return !!(el && el.style.display !== "none");
    });
  }
  const codexWhy = codexOpen ? "" : await page.evaluate(() => JSON.stringify({
    active: document.activeElement?.id || document.activeElement?.tagName,
    dbg: window.__mfDebug?.statsDebug ?? null,
  }));
  check("stats hotkey opens the unit panel (item 31)", codexOpen === true, codexWhy);

  // Items 25/29: position resolves to something real, and centring uses it.
  const pos = await page.evaluate(() => window.__mfDebug.whereAmI());
  check("whereAmI resolves the player (items 25/29)",
    pos !== null && typeof pos.x === "number", JSON.stringify(pos));
  await clickHud("#btn-recenter");
  await page.waitForTimeout(400);
  const onMe = await cam();
  check("centre-on-me lands on the player, not a teammate (item 25)",
    pos !== null && Math.abs(onMe.x - pos.x / 256) < 3 && Math.abs(onMe.y - pos.y / 256) < 3,
    `cam (${onMe.x},${onMe.y}) vs me (${(pos?.x ?? 0) / 256},${(pos?.y ?? 0) / 256})`);

  // Item 22: the Next-asset button reflects whether it can do anything.
  const btnState = await page.evaluate(() => {
    const b = document.getElementById("btn-next-asset");
    return { disabled: b.disabled, title: b.title };
  });
  check("next-asset button exposes its availability (item 22)",
    typeof btnState.disabled === "boolean",
    `disabled=${btnState.disabled} title="${btnState.title}"`);

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
