// test/headless/sim2a.js — 2A Server Tick & Join Demo
import { apply, createInitialState } from '../../engine/reducer.js';
import { joinWorld } from '../../engine/operators.js';
import { startServerLoop } from '../../server/clock.js';

const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
let initialState = createInitialState(1, map);

console.log('--- Server Integration Demo (10Hz) ---');
const loop = startServerLoop(initialState, apply);

console.log('Player 1 joining Team 0...');
loop.dispatch({ type: 'JOIN', opId: 'p1', team: 0 }); // In a real app, joinWorld would be inside apply or a wrapper

let seconds = 0;
const monitor = setInterval(() => {
  const s = loop.getState();
  console.log(`Time: ${++seconds * 500}ms | Tick: ${s.tick} | Cmds: ${s.commands.length}`);
  if (seconds >= 4) {
    clearInterval(monitor);
    loop.stop();
    console.log('Server loop stopped.');
  }
}, 500);
