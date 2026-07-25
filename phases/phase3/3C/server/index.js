// server/index.js — Production Entry Point (2F)
import express from 'express';
import { createServer } from 'http';
import { apply, createInitialState } from '../engine/reducer.js';
import { startServerLoop } from './clock.js';
import { setupNetwork } from './ws.js';
import { getMap } from '../engine/mapgen.js';

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// Static serving of client files
app.use(express.static('client'));

// Game Setup: 16x16 Frontier Corridor map
const map = getMap(Date.now(), 16, 16);
const initialState = createInitialState(Date.now(), map);
const loop = startServerLoop(initialState, apply);

setupNetwork(server, loop);

server.listen(port, () => {
  console.log(`Phase 2 Vertical Slice running at http://localhost:${port}`);
});
