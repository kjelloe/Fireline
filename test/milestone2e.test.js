// test/milestone2e.test.js — Milestone 2E: fog-of-war client culling contract.
// The scene must mirror the server's visibility mask exactly, every frame.

import { test } from "node:test";
import assert from "node:assert/strict";
import { diffVisibleEnemies, visibleEnemyIds } from "../client/js/fog_culler.js";
import { GameServer } from "../engine/server.js";

function view(enemyIds) {
  return { visibleEnemies: enemyIds.map((id) => ({ id, x: 0, y: 0, state: 0 })) };
}

test("2E appearing enemies are added, vanishing enemies removed", () => {
  const diff = diffVisibleEnemies(new Set([4, 5]), view([5, 6]));
  assert.deepEqual(diff, { added: [6], removed: [4], kept: [5] });
});

test("2E empty view clears the whole enemy scene", () => {
  const diff = diffVisibleEnemies(new Set([1, 2, 3]), view([]));
  assert.deepEqual(diff.removed, [1, 2, 3]);
  assert.equal(diff.added.length + diff.kept.length, 0);
});

test("2E null view renders nothing", () => {
  assert.equal(visibleEnemyIds(null).size, 0);
  const diff = diffVisibleEnemies(new Set([9]), null);
  assert.deepEqual(diff.removed, [9]);
});

test("2E culling tracks a live server's fog exactly over time", () => {
  // Server truth: team 0 sees nothing at spawn; drag an enemy into range via
  // state, then out again, and verify the culler mirrors each transition.
  const server = new GameServer({ mapSeed: 42 });
  let rendered = new Set();

  let snap = server.step();
  let diff = diffVisibleEnemies(rendered, snap.views[0]);
  assert.deepEqual(diff, { added: [], removed: [], kept: [] }, "all fogged at spawn");

  server.state.assets[4].x = server.state.assets[0].x + 256;
  server.state.assets[4].y = server.state.assets[0].y;
  snap = server.step();
  diff = diffVisibleEnemies(rendered, snap.views[0]);
  assert.deepEqual(diff.added, [4], "enemy 4 appears");
  rendered = visibleEnemyIds(snap.views[0]);

  server.state.assets[4].x = 117 * 256;
  server.state.assets[4].y = 60 * 256;
  snap = server.step();
  diff = diffVisibleEnemies(rendered, snap.views[0]);
  assert.deepEqual(diff.removed, [4], "enemy 4 fogs out again");
});
