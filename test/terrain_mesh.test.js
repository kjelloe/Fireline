// test/terrain_mesh.test.js — art phase 1 (prompt 157): the terrain-v2
// pure model. Relief is SEMANTIC (water sinks, walls contribute no mesh
// height — boxes own them), banding fires only at land/water borders,
// and everything is deterministic in (cells, seed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { heightAt, colorAt } from "../client/js/terrain_mesh.js";

const SIZE = 8;
const pal = [[0.2, 0.4, 0.2], [0.5, 0.5, 0.4], [0.1, 0.3, 0.1], [0.4, 0.35, 0.3], [0.1, 0.1, 0.1], [0.4, 0.37, 0.26], [0.16, 0.29, 0.4]];
const sand = [0.76, 0.7, 0.52];
function grid(fill = 0) { return new Uint8Array(SIZE * SIZE).fill(fill); }

test("terrain v2: open ground stays near flat; water is a sunken flat bed", () => {
  const open = grid(0);
  for (let i = 0; i < 20; i++) {
    const h = heightAt(open, SIZE, 7, 3 + (i % 3), 3);
    assert.ok(Math.abs(h) <= 0.06, `open relief bounded: ${h}`);
  }
  const water = grid(6);
  assert.equal(heightAt(water, SIZE, 7, 4, 4), -0.16, "open water is a flat basin");
});

test("terrain v2: sand banding fires exactly at the land/water border", () => {
  const cells = grid(0);
  for (let y = 0; y < SIZE; y++) for (let x = 4; x < SIZE; x++) cells[y * SIZE + x] = 6;
  const border = colorAt(cells, SIZE, 7, 4, 3, pal, sand); // touches both
  const inland = colorAt(cells, SIZE, 7, 2, 3, pal, sand);
  const sea = colorAt(cells, SIZE, 7, 6, 3, pal, sand);
  assert.ok(border[0] > inland[0] + 0.1, "border warms toward sand");
  assert.ok(Math.abs(sea[0] - pal[6][0]) < 0.03, "open water keeps its palette");
});

test("terrain v2: deterministic in (cells, seed); seed changes the grain", () => {
  const cells = grid(0);
  assert.equal(heightAt(cells, SIZE, 42, 3, 3), heightAt(cells, SIZE, 42, 3, 3));
  assert.notEqual(heightAt(cells, SIZE, 42, 3, 3), heightAt(cells, SIZE, 43, 3, 3));
});
