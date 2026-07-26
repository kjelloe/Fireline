import { createAppServer } from "../server/index.js";
import { WebSocket } from "ws";
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

const appServer = createAppServer({ mapSeed: 42, enableAi: false });
const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
const ws = new WebSocket(`ws://localhost:${addr.port}`);
const messages = [];
ws.on("message", (d) => messages.push(JSON.parse(d)));
await new Promise((r) => ws.on("open", r));
ws.send(JSON.stringify({ type: "c_join", team: 0 }));
await settle();
ws.send(JSON.stringify({ type: "select_asset", assetId: 15 }));
await settle();
appServer.pump(appServer.gameServer.step());
const S = () => appServer.gameServer.state;
console.log("truck op:", S().assets[15].operatorId, "truck type:", S().assets[15].type,
  "truck cell:", Math.floor(S().assets[15].x/256), Math.floor(S().assets[15].y/256));
S().assets[0].hp = 0; S().assets[0].state = 2;
S().assets[0].x = S().assets[15].x + 256; S().assets[0].y = S().assets[15].y;
ws.send(JSON.stringify({ type: "tow_order", wreckAssetId: 0 }));
await settle();
appServer.pump(appServer.gameServer.step());
console.log("towedBy:", S().assets[0].towedBy, "recoverTimer:", S().assets[0].recoverTimer);
console.log("last events:", JSON.stringify(S().events));
ws.close();
await appServer.stop();
