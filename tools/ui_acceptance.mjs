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
  // Prompt 210: make the acceptance war UNENDABLE. The harness's own
  // surgeries create wrecks, wrecks bleed tickets, and a mid-checks war
  // reset reseats everyone into fresh hulls — which read as "the player
  // got mysteriously reseated" until the fresh full-HP scout gave it
  // away. Deep pools + a distant horn keep ONE war running throughout.
  {
    const st = appServer.gameServer.state;
    st.tickets = [99999, 99999];
  }
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
      for (const overlay of ["encyclopedia-overlay", "codex-panel", "tutorial-overlay"]) {
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

  // ── W4-12: the tutorial arms for a fresh profile, SKIP dismisses ──────
  // This check MUST run first: this browser profile has no mf_tutorial,
  // so the intro overlay is up right now — every later hit-test depends
  // on SKIP actually clearing it.
  const tutUp = await page.evaluate(() => {
    const el = document.getElementById("tutorial-overlay");
    return el && el.style.display !== "none";
  });
  check("tutorial intro arms for a first-time player", tutUp === true);
  // NOT clickHud — that helper force-hides tutorial-overlay first, which
  // would hide the very buttons under test. Same hit-test, done inline.
  const clickTut = (elId) => page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return { ok: false, why: "missing" };
    const r = el.getBoundingClientRect();
    if (r.width === 0) return { ok: false, why: "zero-size" };
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!(hit === el || el.contains(hit))) return { ok: false, why: `covered by ${hit?.id || hit?.tagName}` };
    el.click();
    return { ok: true };
  }, elId);
  if (tutUp) {
    const start = await clickTut("btn-tut-start");
    check("tour starts from the intro", start.ok, start.why ?? "");
    await page.waitForTimeout(200);
    const tour = await page.evaluate(() => ({
      spot: document.getElementById("tut-spotlight").style.display !== "none",
      bubble: document.getElementById("tut-bubble").style.display !== "none",
    }));
    check("tour shows spotlight + arrow bubble", tour.spot && tour.bubble);
    for (let i = 0; i < 12; i++) { // 7 stops + slack for auto-skipped ones
      const open = await page.evaluate(() =>
        document.getElementById("tutorial-overlay").style.display !== "none");
      if (!open) break;
      await clickTut("btn-tut-next");
      await page.waitForTimeout(120);
    }
    const quests = await page.evaluate(() => ({
      overlayGone: document.getElementById("tutorial-overlay").style.display === "none",
      card: document.getElementById("tutorial-quest").style.display !== "none",
      head: document.getElementById("tut-quest-head").textContent,
    }));
    check("tour hands off to the quest ladder", quests.overlayGone && quests.card,
      `overlayGone=${quests.overlayGone} card=${quests.card}`);
    // Skip past move/waypoint (need canvas clicks), then complete the
    // CAMERA quest with the real Center button — a live completion.
    await clickTut("tut-quest-skipstep");
    await page.waitForTimeout(120);
    await clickTut("tut-quest-skipstep");
    await page.waitForTimeout(120);
    await clickHud("#btn-recenter");
    await page.waitForTimeout(250);
    const advanced = await page.evaluate(() =>
      document.getElementById("tut-quest-head").textContent);
    check("a real action completes its quest (camera -> 4/12)",
      /4\s*\/\s*12/.test(advanced), `head="${advanced}"`);
    const skipRes = await clickTut("btn-tut-quest-skip");
    check("SKIP TUTORIAL is topmost and clicks", skipRes.ok, skipRes.why ?? "");
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
      card: document.getElementById("tutorial-quest").style.display !== "none",
      flagged: localStorage.getItem("mf_tutorial") === "1",
    }));
    check("SKIP TUTORIAL dismisses and persists", after.card === false && after.flagged,
      `card=${after.card} flagged=${after.flagged}`);
  }

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

  // ── prompt 197: the YOU marker rides the player's embodiment ─────────
  const marker = await page.evaluate(() => {
    const m = window.__mfDebug.scene()?.getObjectByName?.("you-marker");
    return m ? { visible: m.visible, y: m.position.y } : null;
  });
  check("YOU marker exists and is visible while embodied",
    marker !== null && marker.visible === true && marker.y > 0.5,
    JSON.stringify(marker));

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

  // WAR REALITY (prompt 210): the acceptance war is LIVE — the longer
  // the check list grows, the deeper into the fighting the late checks
  // run, and the player's hull sometimes dies organically. ensureSeated
  // puts the joined operator back in an operable hull through state
  // surgery so checks that assume a seat stay deterministic.
  const opIdEarly = await page.evaluate(() => window.__mfDebug.joined()?.operatorId);
  const ensureSeated = () => {
    const st = appServer.gameServer.state;
    const op = st.operators[opIdEarly];
    if (!op) return;
    const seated = op.state === 1 && op.assetId !== -1 &&
      st.assets[op.assetId]?.operatorId === opIdEarly &&
      st.assets[op.assetId]?.state !== 2 && st.assets[op.assetId]?.state !== 3;
    if (seated) return;
    const i = st.downed.findIndex((d) => d.operatorId === opIdEarly);
    if (i >= 0) st.downed.splice(i, 1);
    const hull = st.assets.find((a) =>
      a.team === op.team && a.operatorId === -1 && a.state !== 2 && a.state !== 3)
      ?? st.assets.find((a) => a.team === op.team && a.operatorId === opIdEarly);
    if (!hull) return;
    if (hull.state === 2 || hull.state === 3) { hull.state = 0; hull.hp = 50; }
    if (hull.operatorId !== -1 && hull.operatorId !== opIdEarly) {
      const prev = st.operators[hull.operatorId];
      if (prev) prev.assetId = -1;
    }
    op.state = 1; op.respawnTicks = 0; op.assetId = hull.id;
    hull.operatorId = opIdEarly;
  };
  ensureSeated();
  await page.waitForTimeout(400);

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

  // ── prompt 205: the three round-2 playtest items get automated proof ──
  // Searchlight anchor (203): the beam's geometry must hang FROM its
  // apex — a centred cone pivots about mid-beam and the arc floats off
  // its tower. bbox y must be [-h, 0], never [-h/2, +h/2].
  const beamBox = await page.evaluate(() => {
    const scene = window.__mfDebug.scene();
    let beam = null;
    scene.traverse((o) => { if (!beam && o.name === "searchlight") beam = o; });
    if (!beam) return null;
    beam.geometry.computeBoundingBox();
    return { minY: beam.geometry.boundingBox.min.y, maxY: beam.geometry.boundingBox.max.y };
  });
  check("searchlight beam hangs from its apex (prompt 203)",
    beamBox !== null && beamBox.maxY < 0.01 && beamBox.minY < -2,
    JSON.stringify(beamBox));

  // Downed body + ring + diamond (196-197): put the joined player's own
  // seat DOWN through the ENGINE'S OWN shapes (createDowned — the same
  // constructor the reducer uses), then assert the client renders the
  // body ABOVE the terrain surface with the locator ring and the YOU
  // diamond over it.
  const { createDowned } = await import("../engine/downed.js");
  const opId = await page.evaluate(() => window.__mfDebug.joined()?.operatorId);
  ensureSeated(); // the war may have downed the player organically by now
  await page.waitForTimeout(300);
  // CAPTURE AND MUTATE SYNCHRONOUSLY: gameServer.state is REPLACED every
  // tick (the reducer returns a fresh copy), so state captured before an
  // await is a dead object by the time you touch it — the first cut of
  // this check mutated a stale snapshot and proved nothing.
  const downOk = (() => {
    const st = appServer.gameServer.state;
    const myAsset = st.assets.find((a) => a.operatorId === opId);
    if (!myAsset) return false;
    const seat = st.operators[opId];
    seat.state = 2; // OP_DOWN
    seat.assetId = -1;
    const body = createDowned(seat, myAsset);
    // Away from ALL friendly hulls: the reducer's auto-rescue boards an
    // adjacent body on the very next tick (correct game law — the first
    // cut of this check downed the player beside the base carrier and
    // the body vanished into a bunk before one snapshot shipped; the
    // second cut used mid-map and a passing carrier still got it).
    // The ENEMY corner is the one place friendly carriers don't roam.
    body.x = 118 * 256 + 128; body.y = 10 * 256 + 128;
    body.targetX = body.x; body.targetY = body.y;
    st.downed.push(body);
    myAsset.state = 2; // ASSET_DISABLED
    myAsset.operatorId = -1;
    return true;
  })();
  check("surgery precondition: the joined player crews a hull", downOk,
    `operator ${opId}`);
  if (downOk) {
    await page.waitForTimeout(900); // two snapshots + render frames
    const downedView = await page.evaluate(() => {
      const scene = window.__mfDebug.scene();
      const dbg = { body: null, marker: null, ring: false };
      scene.traverse((o) => {
        if (o.name === "you-marker") dbg.marker = { visible: o.visible, y: o.position.y };
      });
      // downed meshes are unnamed groups; identify by the label instead
      dbg.labels = window.__mfDebug.labelCount();
      dbg.whereAmI = window.__mfDebug.whereAmI();
      return dbg;
    });
    check("downed: whereAmI resolves to the body", downedView.whereAmI?.kind === "downed",
      JSON.stringify(downedView.whereAmI));
    check("downed: the YOU diamond rides the body (low anchor)",
      downedView.marker?.visible === true && downedView.marker.y < 1.0,
      JSON.stringify(downedView.marker));
    const ringUp = await page.evaluate(() => {
      const scene = window.__mfDebug.scene();
      let ring = false;
      scene.traverse((o) => {
        if (o.geometry?.type === "RingGeometry" && o.material?.color?.getHex?.() === 0x59e07a) ring = true;
      });
      return ring;
    });
    check("downed: the green locator ring pulses on the body", ringUp === true);

    // Bodiless-respawn narration (195): redeploy the seat, then walk the
    // status-panel states — countdown, then pick-a-hull/wave-wait.
    // Same rule: fresh state capture, synchronous mutation.
    (() => {
      const st = appServer.gameServer.state;
      const i = st.downed.findIndex((d) => d.operatorId === opId);
      if (i >= 0) st.downed.splice(i, 1);
      st.operators[opId].state = 1; // OP_ACTIVE
      st.operators[opId].respawnTicks = 40;
    })();
    await page.waitForTimeout(500); // < 40 ticks: the countdown is still live
    const counting = await page.evaluate(() =>
      document.getElementById("status-panel").textContent);
    check("bodiless: the respawn countdown narrates",
      /RESPAWNING|GJENOPPSTÅR/.test(counting), `panel="${counting}"`);
    (() => { appServer.gameServer.state.operators[opId].respawnTicks = 0; })();
    await page.waitForTimeout(700);
    const landed = await page.evaluate(() =>
      document.getElementById("status-panel").textContent);
    check("bodiless: the panel points at a hull or promises the wave",
      /NEXT ASSET|free hull|RESERVED|NESTE ENHET|RESERVERT/.test(landed),
      `panel="${landed}"`);
  }

  // ── prompt 211: the on-screen key bar ─────────────────────────────────
  // Headless Chromium is not a touch device, so the bar is off by
  // default; the ⚙ override turns it on, and a tap on G must enter
  // direct mode through the SAME dispatch as the real key.
  ensureSeated();
  await page.evaluate(() => localStorage.setItem("mf_keybar", "1"));
  await page.waitForTimeout(700);
  const keybar = await page.evaluate(() => {
    const el = document.getElementById("key-bar");
    return el ? [...el.querySelectorAll("button")].map((b) => b.textContent) : null;
  });
  check("key bar renders for a seated player when enabled",
    Array.isArray(keybar) && keybar.length > 0, JSON.stringify(keybar));
  if (keybar?.includes("G")) {
    await page.evaluate(() => {
      [...document.querySelectorAll("#key-bar button")]
        .find((b) => b.textContent === "G")?.click();
    });
    await page.waitForTimeout(400);
    const direct = await page.evaluate(() =>
      document.getElementById("btn-direct-exit")?.style.display !== "none");
    check("tapping G on the bar enters direct mode (shared dispatch)", direct === true);
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
    });
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => localStorage.setItem("mf_keybar", "0"));
  await page.waitForTimeout(500);
  const barGone = await page.evaluate(() => document.getElementById("key-bar") === null);
  check("the ⚙ override removes the bar", barGone === true);

  // ── prompt 210: THE GOLDEN LINE on a real card ────────────────────────
  // Use a card EVERY chassis is shown: defend_relay (the capability
  // filter is personal by design — the first cut used a rescue card and
  // the scout-driving player was legitimately never shown it). Surgery:
  // an owned relay flips to under-enemy-capture.
  const relayThreatened = (() => {
    const st = appServer.gameServer.state;
    const team = st.operators[opId]?.team ?? 0;
    const site = st.sites.find((s) => s.owner === team) ?? st.sites[0];
    if (!site) return false;
    site.owner = team;
    site.capturingTeam = team === 0 ? 1 : 0;
    site.captureProgress = 20;
    return true;
  })();
  await page.waitForTimeout(900);
  const goldCard = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#task-strip div")];
    const gold = cards.find((c) => c.textContent.startsWith("★"));
    if (gold) return { text: gold.textContent, title: gold.title };
    return { all: cards.map((c) => c.textContent), gold: null };
  });
  check("golden surgery precondition: an owned relay is threatened", relayThreatened === true);
  check("golden line: an untried mission card wears the star",
    goldCard?.gold !== null && (goldCard?.title?.length ?? 0) > 0, JSON.stringify(goldCard));
  if (goldCard?.title) {
    await page.evaluate(() => {
      [...document.querySelectorAll("#task-strip div")]
        .find((c) => c.textContent.startsWith("★"))?.click();
    });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      tried: JSON.parse(localStorage.getItem("mf_goldline") ?? "[]"),
      stillGold: [...document.querySelectorAll("#task-strip div")]
        .some((c) => c.textContent === document.__lastGold),
    }));
    check("golden line: clicking retires the kind into mf_goldline",
      after.tried.length > 0, JSON.stringify(after.tried));
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
