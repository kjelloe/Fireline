// test/collision_mirror.test.js — THE LINE ROOT pin (prompt 170).
// The line instrument traced the merged team-keyed hunt to the
// meeting-stop law: sequential collision checks let the first mover of
// the decisive tick claim the last legal step, so one twin of every
// head-on mirror pair parked one speed quantum deeper (88 v 143 from
// the boundary, measured at the centre-road meeting), entered enemy
// support range ~2 ticks early, and lost the opening exchange war-wide.
// Since the fix, verdicts read START-OF-TICK snapshot positions:
// - a head-on mirror-pair meeting must come to rest at EXACT mirror
//   positions about the meeting centre, either id order;
// - collision.test.js's team-swap check stays (this is the stricter
//   mirror form: midpoint AT the centre, not merely equal midpoints).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, ENEMY_BLOCK_RADIUS } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function meet(specs, orders) {
  let s = sandbox(specs);
  specs.forEach((spec, i) => { s = joinAndSelect(s, i, spec.team, i); });
  for (const o of orders) s = apply(s, { type: "move_order", ...o });
  for (let i = 0; i < 300; i++) s = apply(s, { type: "advance_tick" });
  return s;
}

test("line root: a head-on mirror pair parks at exact mirror positions", () => {
  // Same chassis, same row, mirror cells about the 64-wide sandbox's
  // centre line x = 32*256 = 8192 (cells 22 and 41 are mirror twins).
  // SCOUTS on the 19-cell gap: the decisive-tick gap lands at 272, in
  // the sequential law's skew window [192+v, 192+2v) — the first mover
  // claimed 216 while its twin froze, which is exactly the measured
  // war skew. This geometry FAILED before the snapshot fix.
  const s = meet(
    [
      { team: 0, type: 1, cellX: 22, cellY: 20, heading: 0 },
      { team: 1, type: 1, cellX: 41, cellY: 20, heading: 128 },
    ],
    [
      { operatorId: 0, targetCellX: 41, targetCellY: 20 },
      { operatorId: 1, targetCellX: 22, targetCellY: 20 },
    ]
  );
  const a = s.assets[0];
  const b = s.assets[1];
  assert.equal(a.y, b.y, "stayed on the row");
  const gap = b.x - a.x;
  assert.ok(gap > 0, `still on their own sides (gap ${gap})`);
  assert.equal(
    a.x + b.x, 2 * 32 * 256,
    `resting positions mirror about the meeting centre (A ${a.x}, B ${b.x})`
  );
  // Snapshot verdicts allow one mutual closing step past the radius,
  // symmetrically — never interpenetration.
  assert.ok(gap > ENEMY_BLOCK_RADIUS / 2, `no tunnelling (gap ${gap})`);
});

test("line root: id order does not choose who parks deeper", () => {
  // The same meeting with the TEAMS' ids swapped (B is asset 0). Under
  // sequential verdicts the lower id claimed the decisive step; under
  // snapshot verdicts both arrangements rest at the same mirror-exact
  // geometry.
  const s = meet(
    [
      { team: 1, type: 1, cellX: 41, cellY: 20, heading: 128 },
      { team: 0, type: 1, cellX: 22, cellY: 20, heading: 0 },
    ],
    [
      { operatorId: 0, targetCellX: 22, targetCellY: 20 },
      { operatorId: 1, targetCellX: 41, targetCellY: 20 },
    ]
  );
  const a = s.assets[1];
  const b = s.assets[0];
  assert.equal(
    a.x + b.x, 2 * 32 * 256,
    `id-swapped meeting rests mirror-exact too (A ${a.x}, B ${b.x})`
  );
});
