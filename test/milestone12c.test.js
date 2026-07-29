// test/milestone12c.test.js — Slice 12C: the Outlier Skimmer (designer
// ruling, prompt 29). Riverline Drive: water is misery for hulls and a
// trail for the Skimmer — the river becomes the Outliers' highway.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { getUnitStats, UNIT_SKIMMER, UNIT_STATS } from "../engine/units.js";
import { T_WATER } from "../engine/mapgen.js";
import { speedMultiplier } from "../engine/terrain.js";
import { createInitialState } from "../engine/state.js";
import { generateRiverline } from "../engine/riverline.js";
import { GameServer } from "../engine/server.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("12C contract: only the Skimmer swims; Outlier-only fielding", () => {
  for (const [type, stats] of Object.entries(UNIT_STATS)) {
    assert.equal(typeof stats.amphibious, "boolean", `chassis ${type} explicit`);
    assert.equal(stats.amphibious, Number(type) === UNIT_SKIMMER);
  }
  const s0 = createInitialState(42, "frontier_corridor");
  const skimmers = s0.assets.filter((a) => a.type === UNIT_SKIMMER);
  assert.equal(skimmers.length, 1, "one Skimmer in the whole war");
  assert.deepEqual([skimmers[0].team, skimmers[0].id], [1, 30],
    "Outlier garage slot idx 10 (no 17th asset)");
});

test("12C Riverline Drive: the Skimmer crosses water at trail speed, hulls ford in misery", () => {
  assert.equal(speedMultiplier(T_WATER, getUnitStats(0)), 64, "a tank fords at 0.25x");
  assert.equal(speedMultiplier(T_WATER, getUnitStats(UNIT_SKIMMER)), 307, "the Skimmer flies it");

  // Movement integration on a water field: skimmer 56*307/256 = 67/tick,
  // tank 32*64/256 = 8/tick — an 8x mobility gap on the river.
  const size = 64;
  const cells = new Uint8Array(size * size).fill(T_WATER);
  const map = { width: size, height: size, cells, seed: 1 };
  const run = (type) => {
    let s = sandbox([{ team: 0, cellX: 5, cellY: 5, type }], [], { map });
    s = joinAndSelect(s, 0, 0, 0);
    s = apply(s, { type: "drive", operatorId: 0, throttle: 1, turn: 0 });
    const x0 = s.assets[0].x;
    s = apply(s, { type: "advance_tick" });
    return s.assets[0].x - x0;
  };
  assert.equal(run(UNIT_SKIMMER), 67);
  assert.equal(run(0), 8);
});

test("12C the riverline river is real water; bridges stay road; mirror holds", () => {
  const map = generateRiverline(2026);
  const at = (x, y) => map.cells[y * map.width + x];
  assert.equal(at(63, 40), T_WATER, "river between bridges");
  assert.equal(at(60, 40), T_WATER, "full band is water");
  assert.equal(at(63, 63), 1, "central bridge is road");
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width / 2; x++) {
      assert.equal(map.cells[y * map.width + x], map.cells[y * map.width + (map.width - 1 - x)]);
    }
  }
});

test("12C riverline AI wars still run and stay deterministic with water", () => {
  const run = () => {
    const server = new GameServer({ mapSeed: 777, mapProfile: "riverline", enableAi: true });
    let captures = 0;
    for (let i = 0; i < 4000 && server.state.phase === 0; i++) {
      server.step();
      captures += server.state.events.filter((e) => e.type === "site_captured").length;
    }
    return { server, captures };
  };
  const { server, captures } = run();
  assert.ok(captures >= 1, `the war is fought (${captures} captures)`);
  assert.equal(hashState(server.state), hashState(run().server.state));
});

test("prompt-54: Riverline Drive races TRAILS at road grade — amphibious only", async () => {
  const { speedMultiplier, PATH_SPEED_AMPHIBIOUS, TERRAIN_SPEED } = await import("../engine/terrain.js");
  const { getUnitStats, UNIT_SKIMMER, UNIT_BIKE, UNIT_TANK } = await import("../engine/units.js");
  const T_PATH = 5;
  assert.equal(speedMultiplier(T_PATH, getUnitStats(UNIT_SKIMMER)), PATH_SPEED_AMPHIBIOUS);
  assert.ok(PATH_SPEED_AMPHIBIOUS >= 384, "at least road-grade; exact value is band-tuned (prompt-56)");
  assert.equal(speedMultiplier(T_PATH, getUnitStats(UNIT_BIKE)), TERRAIN_SPEED[T_PATH],
    "bikes keep ordinary trail speed — the affinity is the Skimmer's alone");
  assert.equal(speedMultiplier(T_PATH, getUnitStats(UNIT_TANK)), 128, "heavies unchanged");
});

test("band lane: setPathSpeedAmphibious ladders the lever and resets clean", async () => {
  // The SKIMTRAIL= sweep lane (2026-07-31). Tuning-only: set before a
  // war, never during one. Bad input restores the shipped default.
  const { speedMultiplier, setPathSpeedAmphibious, PATH_SPEED_AMPHIBIOUS } =
    await import("../engine/terrain.js");
  const { getUnitStats, UNIT_SKIMMER } = await import("../engine/units.js");
  const T_PATH = 5;
  try {
    setPathSpeedAmphibious(352);
    assert.equal(speedMultiplier(T_PATH, getUnitStats(UNIT_SKIMMER)), 352);
    setPathSpeedAmphibious(NaN);
    assert.equal(speedMultiplier(T_PATH, getUnitStats(UNIT_SKIMMER)), PATH_SPEED_AMPHIBIOUS,
      "garbage input falls back to the shipped default");
  } finally {
    setPathSpeedAmphibious(PATH_SPEED_AMPHIBIOUS); // never leak into other tests
  }
});
