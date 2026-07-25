// server/ws.js — WebSocket networking handler (2B)
import { WebSocketServer } from 'ws';
import { buildView } from '../engine/view.js';

export function setupNetwork(server, loop) {
  const wss = new WebSocketServer({ server });
  const clients = new Map(); // ws -> operatorId

  wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
      try {
        const cmd = JSON.parse(message);

        if (cmd.type === 'JOIN') {
          // No-lobby join: client claims an operator ID and team
          clients.set(ws, { id: cmd.opId, team: cmd.team });
          // In a real implementation, we'd persist this in state.operators via loop.dispatch
          loop.dispatch({ type: 'JOIN_INTERNAL', opId: cmd.opId, team: cmd.team });
        } else {
          // Standard game command
          loop.dispatch(cmd);
        }
      } catch (e) {
        console.error('Invalid message format:', e);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected');
    });
  });

  // Broadcast fog-filtered snapshots at 10Hz
  const broadcastInterval = setInterval(() => {
    const state = loop.getState();
    for (const [ws, opInfo] of clients.entries()) {
      const view = buildView(state, opInfo.id);
      if (ws.readyState === 1) { // OPEN
        ws.send(JSON.stringify({ type: 'snapshot', view }));
      }
    }
  }, 100);

  return {
    stop: () => {
      clearInterval(broadcastInterval);
      wss.close();
    }
  };
}
