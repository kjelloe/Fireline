// test/map_blackwood.test.js — Slice 18A: blackwood, map 3 (prompt 60,
// specs/10_map_roster.md §3). The DENSE map: forest dominates, heavies
// are road-bound, the trail ring + center alleys belong to the lights,
// and the contested heart sits OFF the road in the deep woods.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBlackwood, BLACKWOOD } from "../engine/blackwood.js";
import { countTerrain } from "../engine/frontier_corridor.js";
import { createInitialState } from "../engine/state.js";
import { GameServer } from "../engine/server.js";
import { hashState } from "../engine/snapshot.js";
import { createReplayPlayer } from "../client/js/replay_engine.js";

const T_OPEN = 0, T_ROAD = 1, T_FOREST = 2, T_PATH = 5;

test("18A blackwood terrain is deterministic and mirror-symmetric", () => {
  const a = generateBlackwood(2026);
  const b = generateBlackwood(2026);
  assert.deepEqual(Array.from(a.cells), Array.from(b.cells), "deterministic");
  assert.notDeepEqual(Array.from(a.cells), Array.from(generateBlackwood(777).cells));
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width / 2; x++) {
      assert.equal(a.cells[y * a.width + x], a.cells[y * a.width + (a.width - 1 - x)],
        `mirror broken at ${x},${y}`);
    }
  }
});

test("18A the woods dominate but the infrastructure survives them", () => {
  const m = generateBlackwood(42);
  const at = (x, y) => m.cells[y * m.width + x];
  const counts = countTerrain(m.cells);
  // Dense-map identity: forest is the single largest terrain, by far the
  // densest of any profile — but bounded, so clearings and lanes exist.
  assert.ok(counts[T_FOREST] > 4500, `forest cells: ${counts[T_FOREST]}`);
  assert.ok(counts[T_FOREST] < 11000, `forest cells: ${counts[T_FOREST]}`);
  // The one road: corridor rows plus base approaches, nothing else.
  assert.equal(at(63, 63), T_ROAD, "central road");
  assert.equal(at(14, 60), T_ROAD, "A approach");
  assert.equal(at(113, 60), T_ROAD, "B approach");
  // Trail ring and center alleys (mirror-closed columns/rows).
  assert.equal(at(36, 45), T_PATH, "west ring column");
  assert.equal(at(91, 45), T_PATH, "east ring column");
  assert.equal(at(60, 28), T_PATH, "north ring row");
  assert.equal(at(60, 99), T_PATH, "south ring row");
  assert.equal(at(58, 50), T_PATH, "west center alley");
  assert.equal(at(69, 50), T_PATH, "east center alley");
  // 18G logging roads: lateral recovery corridors through the heart.
  assert.equal(at(45, 45), T_PATH, "north logging road, west leg");
  assert.equal(at(82, 45), T_PATH, "north logging road, east leg");
  assert.equal(at(45, 82), T_PATH, "south logging road, west leg");
  assert.equal(at(82, 82), T_PATH, "south logging road, east leg");
  // Relay clearings are carved open (sampled beside the trail crossings —
  // the alleys AND the 18G logging roads both run through them).
  assert.equal(at(60, 44), T_OPEN, "deep-woods clearing NW pair");
  assert.equal(at(67, 80), T_OPEN, "deep-woods clearing SE pair");
  assert.equal(at(34, 30), T_OPEN, "ring corner clearing");
  // Bases are clear operational ground.
  assert.equal(at(10, 60), T_OPEN, "A base");
  assert.equal(at(117, 60), T_OPEN, "B base");
});

test("18A blackwood states build with their own relays and remember the profile", () => {
  const s = createInitialState(42, "blackwood");
  assert.equal(s.mapProfile, "blackwood");
  assert.deepEqual(
    s.sites.map((x) => [x.cellX, x.cellY]),
    [[36, 28], [91, 28], [36, 99], [91, 99],
     [58, 45], [69, 45], [58, 82], [69, 82]],
    "ring corners + the deep-woods pairs (specs/10 §3)"
  );
  assert.equal(s.assets.length, 33, "same roster on every map (+the neutral landship, Q42)");
  assert.notEqual(hashState(s), hashState(createInitialState(42, "frontier_corridor")));
});

test("18A an AI war on blackwood is fought and stays deterministic", () => {
  const run = () => {
    const server = new GameServer({ mapSeed: 777, mapProfile: "blackwood", enableAi: true });
    const events = { site_captured: 0, asset_disabled: 0 };
    for (let i = 0; i < 4000 && server.state.phase === 0; i++) {
      server.step();
      for (const e of server.state.events) {
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

test("18A the profile survives war rotation and rides replay records", () => {
  const server = new GameServer({ mapSeed: 42, mapProfile: "blackwood", enableAi: false });
  server.resetWar(1234);
  assert.equal(server.state.mapProfile, "blackwood", "rotation keeps the map");

  const war = new GameServer({ mapSeed: 777, mapProfile: "blackwood", enableAi: true });
  for (let i = 0; i < 400; i++) war.step();
  const player = createReplayPlayer({
    meta: { mapSeed: 777, mapProfile: "blackwood", ticks: war.state.tick },
    commandLog: war.commandLog,
  });
  assert.equal(hashState(player.seek(war.state.tick)), hashState(war.state),
    "blackwood replays byte-exactly");
});

test("18A the map keeps the 16B runway (trails) so uniques crew", () => {
  const m = generateBlackwood(1);
  assert.ok(Array.from(m.cells).includes(T_PATH), "trails exist — mapHasRunway holds");
});
