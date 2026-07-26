import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAppServer } from "../server/index.js";

const dir = mkdtempSync(path.join(tmpdir(), "mf-dbg-"));
const appServer = createAppServer({ mapSeed: 42, enableAi: false, replayDir: dir, postgameTicks: 5 });
await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
const S = () => appServer.gameServer.state;
appServer.pump(appServer.gameServer.step());
S().mines.push({ id: 9, team: 0, cellX: 50, cellY: 50, armTimer: 0, marked: 1 });
for (const a of S().assets) if (a.team === 1) { a.hp = 0; a.state = 2; }
appServer.pump(appServer.gameServer.step());
console.log("phase after wreck:", S().phase, "tick", S().tick);
for (let i = 0; i < 6; i++) {
  appServer.pump(appServer.gameServer.step());
  console.log("tick", S().tick, "phase", S().phase, "mines", S().mines.length, "wars", appServer.warsStarted);
}
await appServer.stop();
rmSync(dir, { recursive: true, force: true });
