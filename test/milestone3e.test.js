// test/milestone3e.test.js — Milestone 3E: victory conditions & game end.
// Elimination, relay domination with a hold timer, time-limit scoring —
// then the war freezes and rejects further orders.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, SCORE_DISABLE, SCORE_CAPTURE } from "../engine/reducer.js";
import {
  checkVictory, dominatingTeam, DOMINATION_HOLD_TICKS, TIME_LIMIT_TICKS,
  WIN_ELIMINATION, WIN_DOMINATION, WIN_TIME_LIMIT, PHASE_OVER,
} from "../engine/victory.js";
import { ASSET_MOVING } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

test("3E disabling the last enemy asset wins by elimination and scores", () => {
  let s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 2, hp: 20 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.teamScores[0], SCORE_DISABLE);
  assert.equal(s.phase, 0, "verdict lands on the tick, not the shot");

  s = apply(s, { type: "advance_tick" });
  assert.equal(s.phase, PHASE_OVER);
  assert.equal(s.winner, 0);
  assert.deepEqual(
    s.events.filter((e) => e.type === "game_over"),
    [{ type: "game_over", winner: 0, reason: WIN_ELIMINATION }]
  );
});

test("3E teams with no fielded assets are not 'eliminated'", () => {
  let s = sandbox([{ team: 0, cellX: 0, state: ASSET_MOVING, targetX: cellToWorld(5) }]);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.phase, 0, "single-team sandbox keeps running");
  assert.equal(s.assets[0].x, cellToWorld(0) + 32, "and keeps moving");
});

test("3E domination requires holding every relay for the full timer", () => {
  let s = sandbox(
    [{ team: 0, cellX: 30 }],
    [{ cellX: 10, owner: 0 }, { cellX: 20, owner: 0 }]
  );
  assert.equal(dominatingTeam(s), 0);
  for (let i = 0; i < DOMINATION_HOLD_TICKS - 1; i++) {
    s = apply(s, { type: "advance_tick" });
    assert.equal(s.phase, 0, `still running at hold tick ${i + 1}`);
  }
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.phase, PHASE_OVER);
  assert.equal(s.winner, 0);
  assert.equal(s.winReason, WIN_DOMINATION);
});

test("3E losing a relay resets the domination clock", () => {
  let s = sandbox(
    [{ team: 0, cellX: 30 }],
    [{ cellX: 10, owner: 0 }, { cellX: 20, owner: 0 }]
  );
  for (let i = 0; i < 50; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.dominationTicks, 50);
  s.sites[1].owner = -1; // relay contested externally
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.dominationTeam, -1);
  assert.equal(s.dominationTicks, 0);
});

test("3E time limit ends the war on points", () => {
  let s = sandbox([{ team: 0, cellX: 0 }, { team: 1, cellX: 40 }]);
  s.teamScores = [SCORE_CAPTURE, 0];
  s.tick = TIME_LIMIT_TICKS - 1;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.phase, PHASE_OVER);
  assert.equal(s.winner, 0);
  assert.equal(s.winReason, WIN_TIME_LIMIT);

  let d = sandbox([{ team: 0, cellX: 0 }, { team: 1, cellX: 40 }]);
  d.tick = TIME_LIMIT_TICKS - 1;
  d = apply(d, { type: "advance_tick" });
  assert.equal(d.winner, -1, "tied score is a draw");
});

test("3E a finished war rejects orders and freezes movement", () => {
  let s = sandbox([
    { team: 0, cellX: 0, state: ASSET_MOVING, targetX: cellToWorld(20) },
    { team: 1, cellX: 40, hp: 20 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s.assets[1].state = 2; // wreck the enemy -> elimination next tick
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.phase, PHASE_OVER);

  const frozenX = s.assets[0].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x, frozenX, "no movement after game over");
  assert.equal(s.tick > 0, true, "clock still counts");

  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 5, targetCellY: 0 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "move_order", reason: "war is over" },
  ]);
});

test("3E checkVictory is pure", () => {
  const s = sandbox([{ team: 0, cellX: 0 }, { team: 1, cellX: 40 }]);
  const before = JSON.stringify(s);
  checkVictory(s);
  assert.equal(JSON.stringify(s), before);
});
