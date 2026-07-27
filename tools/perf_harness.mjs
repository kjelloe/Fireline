// tools/perf_harness.mjs — Playwright+WebGL render-perf harness (prompt 18).
// Starts the real server with AI enabled, stages a WORST-CASE THEATER on
// top of the live war (32 operable labeled assets, 24 armed mines, 8
// drones, walking downed operators), connects Chromium as a SPECTATOR
// (the maximum-draw view — sees everything), and samples per-second FPS
// plus three.js renderer stats for DURATION seconds.
//
//   node tools/perf_harness.mjs            # full run -> reports/sweeps/perf.csv
//   DRY_RUN=1 node tools/perf_harness.mjs  # no browser; validates the scene
//   HEADED=1 node tools/perf_harness.mjs   # watch it render
//   DURATION=60 SEED=777 node tools/perf_harness.mjs
//
// Playwright is intentionally NOT a dependency of this repo — install it
// on the perf machine only: npm i -D playwright && npx playwright install chromium

import { mkdirSync, writeFileSync } from "node:fs";
import { createAppServer } from "../server/index.js";
import { buildSpectatorView } from "../engine/view.js";
import { cellToWorld } from "../shared/fixedmath.js";

const SEED = Number(process.env.SEED ?? 2026);
const DURATION = Number(process.env.DURATION ?? 30);
const DRY_RUN = process.env.DRY_RUN === "1";
const HEADED = process.env.HEADED === "1";

const THEATER = { mines: 24, drones: 8, downed: 4 };

// Re-assert the worst-case scene on top of the live war. The reducer will
// fight back (mines detonate, drones recall, wrecks pile up) — that churn
// is realistic; we top the scene back up every second.
function stageTheater(gameServer) {
  const s = gameServer.state;
  for (const a of s.assets) { // everyone on the field, drawing hp bars
    if (a.state === 2 || a.state === 3) { a.state = 0; a.hp = 50; }
  }
  let mineId = 1000;
  const have = s.mines.length;
  for (let i = 0; have + i < THEATER.mines; i++) {
    const cellX = 40 + ((i * 7) % 48);
    const cellY = 40 + ((i * 11) % 40);
    if (s.mines.some((m) => m.cellX === cellX && m.cellY === cellY)) continue;
    s.mines.push({
      id: mineId + s.tick * 100 + i, team: i % 2, cellX, cellY,
      armTimer: 0, marked: 1, // marked: visible in every view
    });
  }
  for (let i = s.drones.length; i < THEATER.drones; i++) {
    const target = s.assets[(i * 3) % 32];
    s.drones.push({
      id: 5000 + s.tick * 10 + i, team: i % 2,
      x: cellToWorld(30 + i * 8), y: cellToWorld(30 + (i % 3) * 12),
      targetAssetId: target.id, ageTicks: 0, hitTimer: 0,
    });
  }
  for (let i = s.downed.length; i < THEATER.downed; i++) {
    const op = s.operators[i];
    s.downed.push({
      operatorId: op.id, team: i % 2,
      x: cellToWorld(50 + i * 5), y: cellToWorld(70),
      targetX: cellToWorld(50 + i * 5), targetY: cellToWorld(70), downTicks: 1,
    });
  }
}

async function main() {
  const appServer = createAppServer({ mapSeed: SEED, enableAi: true });
  const addr = await appServer.start(0);
  const url = `http://localhost:${addr.port}`;
  stageTheater(appServer.gameServer);
  const theaterTimer = setInterval(() => stageTheater(appServer.gameServer), 1000);

  const view = buildSpectatorView(appServer.gameServer.state);
  const sceneCounts = {
    assets: view.friendlyAssets.length,
    operable: view.friendlyAssets.filter((a) => a.state !== 2 && a.state !== 3).length,
    mines: view.mines.length,
    drones: view.drones.length,
    downed: view.downedOperators.length,
  };
  console.log("theater:", sceneCounts, "at", url);

  if (DRY_RUN) {
    const ok = sceneCounts.operable === 32 &&
      sceneCounts.mines >= THEATER.mines && sceneCounts.drones >= THEATER.drones &&
      sceneCounts.downed >= THEATER.downed;
    console.log(ok ? "DRY RUN PASS — scene stages correctly" : "DRY RUN FAIL");
    clearInterval(theaterTimer);
    await appServer.stop();
    process.exit(ok ? 0 : 1);
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright is not installed on this machine.");
    console.error("  npm i -D playwright && npx playwright install chromium");
    clearInterval(theaterTimer);
    await appServer.stop();
    process.exit(2);
  }

  const browser = await chromium.launch({
    headless: !HEADED,
    // Let Chromium use the real GPU. The first PC run STILL fell back to
    // SwiftShader (the summary's "gl" field is the tell) — headless
    // needs ANGLE told which backend to use, not just the blocklist off.
    // d3d11 is the Windows-native path; on Linux use ANGLE=gl.
    args: [
      "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--enable-gpu",
      `--use-angle=${process.env.ANGLE ?? "d3d11"}`,
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url);
  await page.click("#btn-spectate");
  await page.waitForTimeout(3000); // let meshes build and interpolation settle

  const gl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const ctx = c.getContext("webgl2");
    const info = ctx?.getExtension("WEBGL_debug_renderer_info");
    return info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  console.log("GL renderer:", gl);
  if (/swiftshader|software/i.test(gl)) {
    console.warn("WARNING: software rasterizer — results will not reflect the 4070.");
  }

  const samples = await page.evaluate(async (seconds) => {
    const out = [];
    for (let s = 0; s < seconds; s++) {
      const t0 = performance.now();
      let frames = 0;
      await new Promise((done) => {
        const tick = () => {
          frames++;
          if (performance.now() - t0 < 1000) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
      const info = window.__mfDebug?.renderer()?.info;
      out.push({
        fps: frames,
        drawCalls: info?.render?.calls ?? -1,
        triangles: info?.render?.triangles ?? -1,
        labels: window.__mfDebug?.labelCount() ?? -1,
      });
    }
    return out;
  }, DURATION);

  clearInterval(theaterTimer);
  await browser.close();
  await appServer.stop();

  const fps = samples.map((s) => s.fps).sort((a, b) => a - b);
  const pick = (q) => fps[Math.min(fps.length - 1, Math.floor(q * fps.length))];
  const summary = {
    gl, seed: SEED, seconds: DURATION, scene: sceneCounts,
    fpsMedian: pick(0.5), fpsP5: pick(0.05), fpsMin: fps[0], fpsMax: fps.at(-1),
    drawCallsLast: samples.at(-1)?.drawCalls, trianglesLast: samples.at(-1)?.triangles,
  };
  mkdirSync("reports/sweeps", { recursive: true });
  writeFileSync("reports/sweeps/perf.csv",
    "second,fps,drawCalls,triangles,labels\n" +
    samples.map((s, i) => `${i},${s.fps},${s.drawCalls},${s.triangles},${s.labels}`).join("\n") + "\n");
  writeFileSync("reports/sweeps/perf_summary.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(summary);
  console.log("wrote reports/sweeps/perf.csv + perf_summary.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
