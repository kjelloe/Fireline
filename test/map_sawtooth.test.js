// test/map_sawtooth.test.js — Slice 18B: sawtooth, map 4 (prompt 60,
// specs/10_map_roster.md §4). The ARMOR map: three open lanes split by
// impassable mesa bands, pierced by narrow T_PATH gaps. First map to
// use T_BLOCKING at scale — which forces the movement WALL rule: speed
// is sampled at the current cell, so without a guard a fast chassis
// could leap into a 0-speed cell and be trapped forever.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSawtooth, SAWTOOTH } from "../engine/sawtooth.js";
import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { GameServer } from "../engine/server.js";
import { hashState } from "../engine/snapshot.js";
import { createReplayPlayer } from "../client/js/replay_engine.js";
import { sandbox, joinSelectMove, joinAndSelect } from "./helpers.js";
import { CAPTURE_SEEK_CELLS, PATROLS } from "../engine/ai_regency.js";

const T_ROAD = 1, T_BLOCKING = 4, T_PATH = 5;

test("18B sawtooth terrain is deterministic and mirror-symmetric", () => {
  const a = generateSawtooth(2026);
  const b = generateSawtooth(2026);
  assert.deepEqual(Array.from(a.cells), Array.from(b.cells), "deterministic");
  assert.notDeepEqual(Array.from(a.cells), Array.from(generateSawtooth(777).cells));
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width / 2; x++) {
      assert.equal(a.cells[y * a.width + x], a.cells[y * a.width + (a.width - 1 - x)],
        `mirror broken at ${x},${y}`);
    }
  }
});

test("18B mesas wall the lanes, gaps pierce them, corridors go around", () => {
  const m = generateSawtooth(42);
  const at = (x, y) => m.cells[y * m.width + x];
  assert.equal(at(60, 46), T_BLOCKING, "north mesa");
  assert.equal(at(60, 82), T_BLOCKING, "south mesa");
  assert.equal(at(42, 46), T_PATH, "north-west gap");
  assert.equal(at(85, 82), T_PATH, "south-east gap");
  assert.equal(at(63, 63), T_ROAD, "canyon road");
  // Edge corridors around the mesa ends are never walled.
  for (const y of [46, 82]) {
    for (const x of [5, 12, 19, 108, 115, 122]) {
      assert.notEqual(at(x, y), T_BLOCKING, `corridor walled at ${x},${y}`);
    }
  }
  // Lanes are open ground (never walled), relays reachable.
  for (const [x, y] of [[44, 34], [83, 34], [44, 93], [83, 93]]) {
    assert.notEqual(at(x, y), T_BLOCKING, `relay walled at ${x},${y}`);
  }
});

test("18C every relay sits within capture-seek reach of a gap a patrol uses", () => {
  // The 18B pacing bug in one assertion: a relay no unit ever comes
  // within CAPTURE_SEEK_CELLS of is never captured by anyone, so the
  // ticket majority is unreachable and the war runs to the horn. Each
  // lane relay must be reachable from the gap its side's patrol rides.
  const s = createInitialState(42, "sawtooth");
  const GAPS = [[42, 46], [85, 46], [42, 82], [85, 82]];
  for (const site of s.sites) {
    if (site.cellY === 63) continue; // heart relays sit on the road itself
    const reach = GAPS.some(([gx, gy]) =>
      Math.abs(site.cellX - gx) + Math.abs(site.cellY - gy) <= CAPTURE_SEEK_CELLS);
    assert.ok(reach, `relay (${site.cellX},${site.cellY}) is out of capture-seek reach of every gap`);
  }
});

test("18C heavy patrols reach the enemy heart relay", () => {
  // The other half of the 18B bug: the patrol tables stood off at 18
  // cells Manhattan — two past the seek radius — so neither side ever
  // designated a capturer for the enemy's heart relay.
  const enemyHeart = { 0: [69, 63], 1: [58, 63] };
  for (const team of [0, 1]) {
    const [ex, ey] = enemyHeart[team];
    const reach = PATROLS.sawtooth[team].some(([px, py]) =>
      Math.abs(px - ex) + Math.abs(py - ey) <= CAPTURE_SEEK_CELLS);
    assert.ok(reach, `team ${team}'s patrol never reaches the enemy heart relay`);
  }
});

test("18B sawtooth states build with their own relays and remember the profile", () => {
  const s = createInitialState(42, "sawtooth");
  assert.equal(s.mapProfile, "sawtooth");
  assert.deepEqual(
    s.sites.map((x) => [x.cellX, x.cellY]),
    [[58, 63], [69, 63], [44, 34], [83, 34], [44, 93], [83, 93]],
    "canyon heart + one pair per outer lane, at the gap exits (18C)"
  );
  assert.equal(s.assets.length, 32, "same roster on every map");
});

test("18B the wall rule: a unit ordered into a mesa stalls at its face", () => {
  // A 20x20 sandbox with a vertical wall at x=10: the wall rule is
  // engine-wide, not sawtooth-specific.
  const size = 20;
  const cells = new Uint8Array(size * size); // T_OPEN
  for (let y = 0; y < size; y++) cells[y * size + 10] = T_BLOCKING;
  let s = sandbox([{ team: 0, type: 5 /* bike — the fastest leaper */, cellX: 8, cellY: 10 }],
    [], { map: { width: size, height: size, cells, seed: 1 } });
  s = joinSelectMove(s, 0, 0, 0, 15, 10); // target beyond the wall
  for (let i = 0; i < 200; i++) s = apply(s, { type: "advance_tick" });
  const cellX = (s.assets[0].x / 256) | 0;
  assert.ok(cellX < 10, `stalled before the wall, at cell ${cellX}`);

  // Direct drive at the wall stalls the same way.
  let d = sandbox([{ team: 0, type: 5, cellX: 8, cellY: 10, heading: 0 }],
    [], { map: { width: size, height: size, cells, seed: 1 } });
  d = joinAndSelect(d, 0, 0, 0);
  d = apply(d, { type: "drive", operatorId: 0, throttle: 1, turn: 0 }); // heading 0 = +x
  for (let i = 0; i < 200; i++) d = apply(d, { type: "advance_tick" });
  assert.ok(((d.assets[0].x / 256) | 0) < 10, "drive stalls at the face");
});

test("18B an AI war on sawtooth is fought, deterministic, and NOBODY enters a mesa", () => {
  const run = () => {
    const server = new GameServer({ mapSeed: 777, mapProfile: "sawtooth", enableAi: true });
    const events = { site_captured: 0, asset_disabled: 0 };
    for (let i = 0; i < 4000 && server.state.phase === 0; i++) {
      server.step();
      const st = server.state;
      for (const a of st.assets) {
        const cell = st.map.cells[((a.y / 256) | 0) * st.map.width + ((a.x / 256) | 0)];
        assert.notEqual(cell, T_BLOCKING,
          `asset ${a.id} inside a mesa at tick ${st.tick}`);
      }
      for (const e of st.events) {
        if (e.type in events) events[e.type] += 1;
      }
    }
    return { server, events };
  };
  const { server, events } = run();
  assert.ok(events.site_captured >= 1, `captures: ${events.site_captured}`);
  assert.ok(events.asset_disabled >= 1, `disables: ${events.asset_disabled}`);
  assert.equal(hashState(server.state), hashState(run().server.state), "deterministic war");
});

test("18B the profile survives war rotation and rides replay records", () => {
  const server = new GameServer({ mapSeed: 42, mapProfile: "sawtooth", enableAi: false });
  server.resetWar(1234);
  assert.equal(server.state.mapProfile, "sawtooth", "rotation keeps the map");

  const war = new GameServer({ mapSeed: 777, mapProfile: "sawtooth", enableAi: true });
  for (let i = 0; i < 400; i++) war.step();
  const player = createReplayPlayer({
    meta: { mapSeed: 777, mapProfile: "sawtooth", ticks: war.state.tick },
    commandLog: war.commandLog,
  });
  assert.equal(hashState(player.seek(war.state.tick)), hashState(war.state),
    "sawtooth replays byte-exactly");
});

test("18B the gaps keep the 16B runway (trails) so uniques crew", () => {
  const m = generateSawtooth(1);
  assert.ok(Array.from(m.cells).includes(T_PATH), "gap trails — mapHasRunway holds");
});
