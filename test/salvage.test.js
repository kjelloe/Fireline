// test/salvage.test.js — the salvage economy (ruled 2026-07-31: MPG
// sink first, garage refit banked). A recovered wreck banks a point
// beside its B1 ticket refund; banked points discount the next Slow
// Manufacture wave, consumed only when the wave launches.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apply, SALVAGE_PER_RECOVERY, SALVAGE_BOOST_CAP, SALVAGE_TICKS_PER_POINT,
  MPG_TICKS,
} from "../engine/reducer.js";
import { hashState } from "../engine/snapshot.js";
import { ASSET_DISABLED } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("salvage: a recovery banks a point beside its ticket refund", () => {
  let s = sandbox([{ team: 0, type: 0, cellX: 20, cellY: 20, state: ASSET_DISABLED, hp: 0 }]);
  s.assets[0].recoverTimer = 1;
  s.tickets = [200, 200];
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].state, 0, "restored");
  assert.equal(s.salvage[0], SALVAGE_PER_RECOVERY, "the tow bought future materiel");
  assert.equal(s.salvage[1], 0);
  assert.equal(s.tickets[0], 201, "and the B1 refund still stands");
});

test("salvage: banked points shorten the wave, and the wave drinks them", () => {
  // One lone operable asset -> below mpgMinOperable, the clock runs.
  // A wreck waits for the wave. Three banked points = 300 ticks off.
  const build = (salvage) => {
    let s = sandbox([
      { team: 0, cellX: 5, cellY: 5 },
      { team: 0, cellX: 20, cellY: 20, state: ASSET_DISABLED, hp: 0 },
      { team: 1, cellX: 50, cellY: 50 },
    ]);
    s.salvage = [salvage, 0];
    return s;
  };
  const need = MPG_TICKS - 3 * SALVAGE_TICKS_PER_POINT;
  let s = build(3);
  for (let i = 0; i < need; i++) s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "asset_manufactured"),
    "the discounted wave launched early");
  assert.equal(s.salvage[0], 0, "the wave consumed exactly what it used");

  let plain = build(0);
  for (let i = 0; i < need; i++) plain = apply(plain, { type: "advance_tick" });
  assert.ok(!plain.events.some((e) => e.type === "asset_manufactured"),
    "without salvage the same tick count launches nothing");
});

test("salvage: the boost caps — a hoard cannot buy an instant wave", () => {
  let s = sandbox([
    { team: 0, cellX: 5, cellY: 5 },
    { team: 0, cellX: 20, cellY: 20, state: ASSET_DISABLED, hp: 0 },
    { team: 1, cellX: 50, cellY: 50 },
  ]);
  s.salvage = [50, 0];
  const need = MPG_TICKS - SALVAGE_BOOST_CAP * SALVAGE_TICKS_PER_POINT;
  for (let i = 0; i < need; i++) s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "asset_manufactured"), "capped discount fired");
  assert.equal(s.salvage[0], 50 - SALVAGE_BOOST_CAP, "only the cap was consumed");
});

test("salvage is hashed state and rides the public view", async () => {
  const { buildView } = await import("../engine/view.js");
  const a = sandbox([{ team: 0, cellX: 5 }]);
  const b = sandbox([{ team: 0, cellX: 5 }]);
  b.salvage = [3, 0];
  assert.notEqual(hashState(a), hashState(b));
  assert.deepEqual(buildView(b, 1).salvage, [3, 0], "both teams read the same ledger");
});
