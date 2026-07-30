// test/map_caldera.test.js — item 40, the circle map. Terrain contract,
// mirror symmetry, side-gate ring connectivity, and a live AI war.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCaldera, CALDERA } from "../engine/caldera.js";
import { createInitialState, MAP_LAYOUTS } from "../engine/state.js";
import { GameServer } from "../engine/server.js";
import { hashState } from "../engine/snapshot.js";

const at = (m, x, y) => m.cells[y * m.width + x];

test("caldera terrain is deterministic and mirror-symmetric", () => {
  const a = generateCaldera(42);
  const b = generateCaldera(42);
  assert.deepEqual(Array.from(a.cells), Array.from(b.cells), "same seed, same bowl");
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      assert.equal(at(a, x, y), at(a, 127 - x, y), `mirror at ${x},${y}`);
    }
  }
});

test("caldera: ring road, centre trail, side gates, mountains", () => {
  const m = generateCaldera(7);
  assert.equal(at(m, 60, 30), 1, "north ring is ROAD");
  assert.equal(at(m, 60, 97), 1, "south ring is ROAD");
  assert.equal(at(m, 14, 45), 1, "west gate column is ROAD");
  assert.equal(at(m, 60, 63), 5, "the centre is DIRT — trail, not pavement");
  // The owner's design assembles at the walls: the ring column crosses
  // each base's north/south edge, and roads are never walled — the
  // SIDE GATES are road gates by construction.
  assert.equal(at(m, 14, CALDERA.teamABase.y), 1, "north side gate open (road)");
  assert.equal(at(m, 14, CALDERA.teamABase.y + CALDERA.teamABase.height - 1), 1, "south side gate open");
  assert.equal(at(m, 113, CALDERA.teamBBase.y), 1, "B north side gate open");
  // Mountains: blocking, and a mirror pair.
  assert.equal(at(m, 45, 44), 4, "west mountain");
  assert.equal(at(m, 82, 44), 4, "east mountain (mirror)");
});

test("caldera relays sit on arteries and the state builds", () => {
  const s = createInitialState(42, "caldera");
  assert.equal(s.sites.length, 6, "6 relays, majority 4");
  const m = s.map;
  for (const site of s.sites) {
    const t = at(m, site.cellX, site.cellY);
    assert.ok(t === 1 || t === 5, `relay ${site.id} on road/trail (got ${t})`);
  }
  for (const site of MAP_LAYOUTS.caldera.relayCells) {
    const partner = MAP_LAYOUTS.caldera.relayCells.find(
      (p) => p.cellX === 127 - site.cellX && p.cellY === site.cellY);
    assert.ok(partner, `relay (${site.cellX},${site.cellY}) has a mirror partner`);
  }
});

test("caldera: an AI war runs, decides or fights, and stays deterministic", () => {
  const a = new GameServer({ mapSeed: 2026, enableAi: true, aiDifficulty: 1, mapProfile: "caldera" });
  const b = new GameServer({ mapSeed: 2026, enableAi: true, aiDifficulty: 1, mapProfile: "caldera" });
  for (let i = 0; i < 3000; i++) { a.step(); b.step(); }
  assert.equal(hashState(a.state), hashState(b.state), "same seed, same war");
  const captures = a.state.sites.filter((s) => s.owner !== -1).length;
  assert.ok(captures > 0, "relays change hands — the map is ALIVE");
});
