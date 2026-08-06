// tools/host_probe.mjs — candidate-host quality probe (prompt 208).
// Rent the box for an hour, copy the repo, run:
//
//   node tools/host_probe.mjs            # 5 minutes
//   node tools/host_probe.mjs 15         # 15 minutes
//
// It runs a REAL Fireline war at the live 10 Hz cadence and measures the
// three things a shared-vCPU host can ruin:
//   1. TICK LATENESS — the 100 ms pump firing behind schedule (CPU
//      steal / noisy neighbours). This is what players feel as lag.
//   2. EVENT-LOOP DELAY — scheduling jitter inside Node (perf_hooks
//      histogram), the same signal at finer grain.
//   3. WRITE STALLS — autosave-sized fsync latency (shared disk).
//
// Interpretation for a 10 Hz war: a tick that lands <150 ms after the
// last is invisible (the client interpolates across two snapshots).
// p99 gap under 120 ms = excellent · under 150 = fine · repeated
// 200+ ms gaps or late% over 2 = players will feel it.

import { GameServer } from "../engine/server.js";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const minutes = Number(process.argv[2]) || 5;
const TICK_MS = 100;
const gaps = [];
const writeLat = [];

const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();

const gs = new GameServer({ mapSeed: 2026, enableAi: true });
let last = 0;
let ticks = 0;
const tmp = mkdtempSync(path.join(tmpdir(), "mf-probe-"));
const saveBody = "x".repeat(2 * 1024 * 1024); // autosave-sized write

console.log(`probing for ${minutes} min — a REAL war at 10 Hz, ${new Date().toISOString()}`);
const timer = setInterval(() => {
  const now = performance.now();
  if (last > 0) gaps.push(now - last);
  last = now;
  gs.step();
  ticks++;
  if (gs.state.phase === 1) gs.resetWar((ticks * 2654435761) >>> 0); // wars roll over
  if (ticks % 300 === 0) { // every 30 s: an autosave-like write, timed
    const w0 = performance.now();
    writeFileSync(path.join(tmp, "probe-save.tmp"), saveBody);
    writeLat.push(performance.now() - w0);
  }
  if (ticks >= minutes * 60 * 10) finish();
}, TICK_MS);

function pct(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function finish() {
  clearInterval(timer);
  loop.disable();
  rmSync(tmp, { recursive: true, force: true });
  const g = [...gaps].sort((a, b) => a - b);
  const late = g.filter((x) => x > TICK_MS * 1.5).length;
  const bad = g.filter((x) => x > TICK_MS * 2).length;
  console.log(`\n== tick cadence (${g.length} gaps, expected ${TICK_MS} ms) ==`);
  console.log(`p50 ${pct(g, 0.5).toFixed(1)} · p95 ${pct(g, 0.95).toFixed(1)} · p99 ${pct(g, 0.99).toFixed(1)} · max ${g[g.length - 1].toFixed(1)} ms`);
  console.log(`late (>150 ms): ${late} (${(late / g.length * 100).toFixed(2)}%) · slipped a full tick (>200 ms): ${bad}`);
  console.log(`\n== event-loop delay ==`);
  console.log(`p50 ${(loop.percentile(50) / 1e6).toFixed(1)} · p99 ${(loop.percentile(99) / 1e6).toFixed(1)} · max ${(loop.max / 1e6).toFixed(1)} ms`);
  if (writeLat.length) {
    const w = [...writeLat].sort((a, b) => a - b);
    console.log(`\n== 2 MB autosave-like writes (${w.length}) ==`);
    console.log(`p50 ${pct(w, 0.5).toFixed(1)} · max ${w[w.length - 1].toFixed(1)} ms`);
  }
  const verdict = pct(g, 0.99) < 120 && bad / g.length < 0.005 ? "EXCELLENT"
    : pct(g, 0.99) < 150 && bad / g.length < 0.02 ? "FINE for a 10 Hz war"
    : "RISKY — players will feel the spikes";
  console.log(`\nVERDICT: ${verdict}`);
  process.exit(0);
}
