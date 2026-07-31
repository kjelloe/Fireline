// test/milestone11n.test.js — Slice 11N: PATH terrain (prompt 20 Q22).
// Dirt roads / woodland trails: 1.2x for every chassis EXCEPT the heavy
// tank, which crosses them at rough speed. Both maps grow mirrored paths.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { speedMultiplier, PATH_SPEED_HEAVY, PATH_SPEED_AMPHIBIOUS, TERRAIN_SPEED } from "../engine/terrain.js";
import { T_PATH } from "../engine/mapgen.js";
import { getUnitStats, UNIT_STATS } from "../engine/units.js";
import { generateFrontierCorridor } from "../engine/frontier_corridor.js";
import { generateRiverline } from "../engine/riverline.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("11N only the tank is heavy; paths pay out per chassis", () => {
  for (const type of Object.keys(UNIT_STATS).map(Number)) {
    const stats = getUnitStats(type);
    assert.equal(stats.heavy, type === 0 || type === 7 || type === 9,
      `chassis ${type} heavy flag (tank + sentinel + landship)`);
    // Prompt-54: amphibious hulls RACE trails (Riverline Drive affinity).
    const expected = stats.amphibious ? PATH_SPEED_AMPHIBIOUS
      : stats.heavy ? PATH_SPEED_HEAVY : TERRAIN_SPEED[T_PATH];
    assert.equal(
      speedMultiplier(T_PATH, stats),
      expected,
      `chassis ${type} path multiplier`
    );
  }
});

test("11N a scout outruns a tank on the trail (movement integration)", () => {
  const size = 64;
  const cells = new Uint8Array(size * size).fill(T_PATH);
  const map = { width: size, height: size, cells, seed: 1 };

  const run = (type) => {
    let s = sandbox([{ team: 0, cellX: 5, cellY: 5, type }], [], { map });
    s = joinAndSelect(s, 0, 0, 0);
    s = apply(s, { type: "drive", operatorId: 0, throttle: 1, turn: 0 });
    const x0 = s.assets[0].x;
    s = apply(s, { type: "advance_tick" });
    return s.assets[0].x - x0;
  };
  // Tank: 32 * 128/256 = 16 (rough speed). Scout: 56 * 307/256 = 67.
  assert.equal(run(0), 16, "tank crawls the trail at rough speed");
  assert.equal(run(1), 67, "scout flies down it");
});

test("11N both maps carry mirrored paths", () => {
  for (const [name, map] of [
    ["frontier", generateFrontierCorridor(42)],
    ["riverline", generateRiverline(42)],
  ]) {
    let paths = 0;
    let mirrored = true;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.cells[y * map.width + x] !== T_PATH) continue;
        paths += 1;
        if (map.cells[y * map.width + (map.width - 1 - x)] !== T_PATH) mirrored = false;
      }
    }
    assert.ok(paths > 50, `${name} has real trails (${paths} cells)`);
    assert.equal(mirrored, true, `${name} trails keep the mirror invariant`);
  }
});
