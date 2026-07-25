// test/milestone1c.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../engine/server.js";
import { NetworkTransport } from "../engine/transport.js";

test("1C WebSocket Join and Snapshot Round-trip", async () => {
    const server = new GameServer({ mapSeed: 42 });
    const wss = new WebSocketServer({ port: 0 }); // Random port
    const transport = new NetworkTransport(server, wss);
    const port = wss.address().port;

    const client = new WebSocket(`ws://localhost:${port}`);

    const messages = [];
    client.on("message", (data) => messages.push(JSON.parse(data)));

    await new Promise(resolve => client.on("open", resolve));

    // 1. Join request
    client.send(JSON.stringify({ type: "c_join", operatorId: 5, team: 0 }));

    // Wait for join confirm and then one server tick
    await new Promise(r => setTimeout(r, 50));
    const snap = server.step();
    transport.broadcastSnapshots(snap);

    await new Promise(r => setTimeout(r, 50));

    // Verify messages
    assert.ok(messages.some(m => m.type === "s_joined"), "should receive s_joined");
    assert.ok(messages.some(m => m.type === "s_snapshot"), "should receive s_snapshot");

    const snapshotMsg = messages.find(m => m.type === "s_snapshot");
    assert.equal(snapshotMsg.view.team, 0);
    assert.equal(snapshotMsg.tick, 1);

    client.close();
    wss.close();
});
