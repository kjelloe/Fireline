// tools/profile_run.mjs — resource profile for co-hosting (prompt 206/207).
// Answers, with MEASUREMENT: how much RAM and CPU does one Fireline
// server need on the shared box, per map, and what does each human
// player add?
//
//   node --expose-gc tools/profile_run.mjs            # per-map full-war profile
//   node --expose-gc tools/profile_run.mjs --players 8 # marginal cost per human
//
// Method, per map: run a FULL AI war headless at maximum speed, sampling
// rss/heapUsed and cpuUsage every SAMPLE_TICKS. The live server runs 10
// ticks/s, so cpu-per-tick x 10 = the sustained CPU fraction a live war
// costs. View-building (what the transport does per broadcast) is timed
// separately and added per connected socket team.
//
// --players mode: start the REAL app server (pump, transport, ws) on an
// ephemeral port, then attach N ws clients in two waves and compare
// rss/cpu — the marginal footprint of a human is transport + per-socket
// serialization, NOT engine state (operators are preallocated).

import { GameServer } from "../engine/server.js";
import { buildView } from "../engine/view.js";
import { PHASE_OVER } from "../engine/victory.js";

const SAMPLE_TICKS = 200;
const MAX_TICKS = 25000;
const MAPS = ["frontier_corridor", "blackwood", "riverline", "sawtooth", "caldera"];

const mb = (bytes) => Math.round(bytes / (1024 * 1024) * 10) / 10;

function profileMap(profile, seed = 2026) {
  globalThis.gc?.();
  const baseRss = process.memoryUsage().rss;
  const gs = new GameServer({ mapSeed: seed, enableAi: true, mapProfile: profile });
  let peakRss = 0, peakHeap = 0;
  let viewNs = 0n, viewSamples = 0;
  const cpu0 = process.cpuUsage();
  const wall0 = performance.now();
  let ticks = 0;
  while (gs.state.phase !== PHASE_OVER && ticks < MAX_TICKS) {
    gs.step();
    ticks++;
    if (ticks % SAMPLE_TICKS === 0) {
      const m = process.memoryUsage();
      if (m.rss > peakRss) peakRss = m.rss;
      if (m.heapUsed > peakHeap) peakHeap = m.heapUsed;
      const t0 = process.hrtime.bigint();
      buildView(gs.state, 0);
      buildView(gs.state, 1);
      viewNs += process.hrtime.bigint() - t0;
      viewSamples++;
    }
  }
  const cpu = process.cpuUsage(cpu0);
  const wallMs = performance.now() - wall0;
  const m = process.memoryUsage();
  if (m.rss > peakRss) peakRss = m.rss;
  const cpuUsPerTick = (cpu.user + cpu.system) / ticks;
  return {
    profile, ticks,
    over: gs.state.phase === PHASE_OVER,
    logEntries: gs.commandLog.length,
    peakRssMb: mb(peakRss),
    warRssGrowthMb: mb(peakRss - baseRss),
    peakHeapMb: mb(peakHeap),
    wallS: Math.round(wallMs / 100) / 10,
    cpuUsPerTick: Math.round(cpuUsPerTick),
    // sustained live load: 10 ticks/s -> fraction of one core
    liveCpuPct: Math.round(cpuUsPerTick * 10 / 1e6 * 1000) / 10,
    viewMsPerBroadcast: viewSamples
      ? Math.round(Number(viewNs / BigInt(viewSamples)) / 1e6 * 100) / 100
      : null,
  };
}

async function profilePlayers(n) {
  const { createAppServer } = await import("../server/index.js");
  const { default: WebSocket } = await import("ws");
  const app = createAppServer({ mapSeed: 2026, enableAi: true });
  const addr = await app.start(0);
  const url = `ws://localhost:${addr.port}`;
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));

  await settle(3000); // let the war warm up
  globalThis.gc?.();
  const rss0 = process.memoryUsage().rss;
  const cpu0 = process.cpuUsage();
  await settle(10000);
  const cpuIdle = process.cpuUsage(cpu0);

  const clients = [];
  for (let i = 0; i < n; i++) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.send(JSON.stringify({ type: "c_join", team: i % 2, playerId: `prof-${i}` }));
    ws.on("message", () => {}); // consume snapshots like a real client
    clients.push(ws);
  }
  await settle(3000);
  globalThis.gc?.();
  const rss1 = process.memoryUsage().rss;
  const cpu1 = process.cpuUsage();
  await settle(10000);
  const cpuLoaded = process.cpuUsage(cpu1);

  for (const ws of clients) ws.close();
  await app.stop?.() ?? app.shutdown?.();

  const idlePct = (cpuIdle.user + cpuIdle.system) / 10e6 * 100;
  const loadedPct = (cpuLoaded.user + cpuLoaded.system) / 10e6 * 100;
  return {
    players: n,
    rssPerPlayerMb: mb((rss1 - rss0) / n),
    cpuIdlePct: Math.round(idlePct * 10) / 10,
    cpuLoadedPct: Math.round(loadedPct * 10) / 10,
    cpuPerPlayerPct: Math.round((loadedPct - idlePct) / n * 100) / 100,
  };
}

const playersArg = process.argv.indexOf("--players");
if (playersArg >= 0) {
  const n = Number(process.argv[playersArg + 1]) || 8;
  const r = await profilePlayers(n);
  console.log(`\n== marginal human cost (${n} clients, real server + ws) ==`);
  console.log(`rss per player: ~${r.rssPerPlayerMb} MB`);
  console.log(`cpu idle war: ${r.cpuIdlePct}% of a core · with ${n} players: ${r.cpuLoadedPct}%`);
  console.log(`cpu per player: ~${r.cpuPerPlayerPct}% of a core`);
  process.exit(0);
}

console.log("map                | ticks  over  log     peakRSS  warΔ   heap   wall   cpu/tick  live-CPU  view/bcast");
for (const map of MAPS) {
  const r = profileMap(map);
  console.log(
    `${r.profile.padEnd(18)} | ${String(r.ticks).padEnd(6)} ${r.over ? "yes " : "CAP "} ` +
    `${String(r.logEntries).padEnd(7)} ${String(r.peakRssMb).padEnd(8)} ${String(r.warRssGrowthMb).padEnd(6)} ` +
    `${String(r.peakHeapMb).padEnd(6)} ${String(r.wallS).padEnd(6)} ${String(r.cpuUsPerTick).padEnd(9)} ` +
    `${String(r.liveCpuPct).padEnd(9)} ${r.viewMsPerBroadcast}ms`);
}
console.log("\npeakRSS/heap MB · warΔ = growth over one war · cpu/tick µs · live-CPU = % of one core at 10 ticks/s · view/bcast = both team views once");
