// test/milestone11m.test.js — Slice 11M: second map prep (prompt 19).
// Riverline joins the registry; layout is per-profile; the MIRROR
// INVARIANT (the 11C lesson) is now enforced by test for every map.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, MAP_LAYOUTS } from "../engine/state.js";
import { generateRiverline, RIVERLINE } from "../engine/riverline.js";
import { GameServer } from "../engine/server.js";
import { hashState } from "../engine/snapshot.js";
import { createReplayPlayer } from "../client/js/replay_engine.js";

test("11M riverline terrain is deterministic and mirror-symmetric", () => {
  const a = generateRiverline(2026);
  const b = generateRiverline(2026);
  assert.deepEqual(Array.from(a.cells), Array.from(b.cells), "deterministic");
  assert.notDeepEqual(Array.from(a.cells), Array.from(generateRiverline(777).cells));

  // Fairness by construction: every cell mirrors across x' = 127-x.
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width / 2; x++) {
      assert.equal(a.cells[y * a.width + x], a.cells[y * a.width + (a.width - 1 - x)],
        `mirror broken at ${x},${y}`);
    }
  }
  // The road crosses the river on every bridge row; the river is rough
  // elsewhere.
  const at = (x, y) => a.cells[y * a.width + x];
  assert.equal(at(63, 63), 1, "central bridge is road");
  assert.equal(at(63, 21), 1, "north bridge is road");
  assert.equal(at(63, 105), 1, "south bridge is road");
  assert.equal(at(63, 40), 3, "river is rough between bridges");
});

test("11M every registered layout keeps the mirror invariant", () => {
  for (const [name, layout] of Object.entries(MAP_LAYOUTS)) {
    for (const relay of layout.relayCells) {
      const mirror = layout.relayCells.find(
        (r) => r.cellX === 127 - relay.cellX && r.cellY === relay.cellY);
      assert.ok(mirror, `${name}: relay (${relay.cellX},${relay.cellY}) has no mirror`);
    }
    const [a, b] = layout.standardHomes;
    assert.equal(b.cellX, 127 - a.cellX, `${name}: standard homes mirror`);
    assert.equal(b.cellY, a.cellY);
  }
});

test("11M riverline states build with their own relays and remember the profile", () => {
  const s = createInitialState(42, "riverline");
  assert.equal(s.mapProfile, "riverline");
  assert.deepEqual(
    s.sites.map((x) => [x.cellX, x.cellY]),
    [[44, 32], [83, 32], [44, 95], [83, 95]]
  );
  assert.equal(s.assets.length, 32, "same roster on every map");

  const f = createInitialState(42, "frontier_corridor");
  assert.equal(f.mapProfile, "frontier_corridor");
  assert.notEqual(hashState(s), hashState(f), "different worlds");
});

test("11M an AI war on riverline is fought and stays deterministic", () => {
  const run = () => {
    const server = new GameServer({ mapSeed: 777, mapProfile: "riverline", enableAi: true });
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

test("11M the profile survives war rotation and rides replay records", () => {
  const server = new GameServer({ mapSeed: 42, mapProfile: "riverline", enableAi: false });
  server.resetWar(1234);
  assert.equal(server.state.mapProfile, "riverline", "rotation keeps the map");

  // Replay round-trip on riverline.
  const war = new GameServer({ mapSeed: 777, mapProfile: "riverline", enableAi: true });
  for (let i = 0; i < 400; i++) war.step();
  const player = createReplayPlayer({
    meta: { mapSeed: 777, mapProfile: "riverline", ticks: war.state.tick },
    commandLog: war.commandLog,
  });
  assert.equal(hashState(player.seek(war.state.tick)), hashState(war.state),
    "riverline replays byte-exactly");
});
