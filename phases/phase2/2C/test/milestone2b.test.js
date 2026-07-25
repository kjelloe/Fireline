// test/milestone2b.test.js — Milestone 2B: WebSocket Network Sync
import { test } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'http';
import { WebSocket } from 'ws';
import { apply, createInitialState } from '../engine/reducer.js';
import { startServerLoop } from '../server/clock.js';
import { setupNetwork } from '../server/ws.js';

test('2B client receives fog-filtered snapshot after join', (t, done) => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  const initial = createInitialState(1, map);

  const server = createServer();
  const loop = startServerLoop(initial, apply);
  const net = setupNetwork(server, loop);

  server.listen(0, () => {
    const port = server.address().port;
    const client = new WebSocket(`ws://localhost:${port}`);

    client.on('open', () => {
      client.send(JSON.stringify({ type: 'JOIN', opId: 'player_1', team: 0 }));
    });

    client.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'snapshot') {
        assert.strictEqual(msg.view.operatorId, 'player_1');
        assert.strictEqual(msg.view.team, 0);
        assert.ok(Array.isArray(msg.view.assets));

        // Cleanup
        client.close();
        net.stop();
        loop.stop();
        server.close();
        done();
      }
    });
  });
});
