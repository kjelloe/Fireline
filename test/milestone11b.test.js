// test/milestone11b.test.js — Slice 11B: BF2 capture countdown (prompt 16 Q3).
// Contested = frozen; a lone team drains an enemy relay to neutral (~3 s),
// then raises its own flag (~3 s); leaving drains the attacker's progress.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { SITE_NEUTRALIZE_TICKS, SITE_CAPTURE_TICKS } from "../engine/sites.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinSelectMove } from "./helpers.js";

// Two relays so the contested freeze can never hand anyone a domination win.
function field(sites, assets) {
  return sandbox(assets, [...sites, { cellX: 60, cellY: 60, owner: 1 }]);
}

test("11B a lone attacker neutralizes, then captures, on the full countdown", () => {
  let s = field([{ cellX: 5, owner: 1 }], [{ team: 0, cellX: 5 }]);
  for (let i = 0; i < SITE_NEUTRALIZE_TICKS - 1; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  assert.equal(s.sites[0].owner, 1, "still theirs mid-drain");
  assert.equal(s.sites[0].capturingTeam, 0);

  s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "site_neutralized"));
  assert.equal(s.sites[0].owner, -1, "drained to neutral");

  for (let i = 0; i < SITE_CAPTURE_TICKS - 1; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.sites[0].owner, -1, "not yet");
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.sites[0].owner, 0, "captured after the second countdown");
  assert.equal(s.sites[0].capturingTeam, -1, "clock cleared");
  assert.ok(s.events.some((e) => e.type === "site_captured"));
});

test("11B contested ground freezes the clock; wrecks don't contest", () => {
  // The far bystander keeps team 1 fielded when its defender is wrecked
  // (elimination would otherwise freeze the war before the flip).
  let s = field(
    [{ cellX: 5, owner: 1 }],
    [{ team: 0, cellX: 5 }, { team: 1, cellX: 5 }, { team: 1, cellX: 50 }]
  );
  for (let i = 0; i < SITE_NEUTRALIZE_TICKS * 3; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.sites[0].owner, 1, "contested relays never flip");
  assert.equal(s.sites[0].captureProgress, 0, "no progress while contested");

  // The defender falls: its wreck no longer holds the flag.
  s.assets[1].state = 2; // ASSET_DISABLED
  for (let i = 0; i <= SITE_NEUTRALIZE_TICKS + SITE_CAPTURE_TICKS; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  assert.equal(s.sites[0].owner, 0, "a wreck is scenery, not a garrison");
});

test("11B walking away drains attacker progress; returning restarts honestly", () => {
  let s = field([{ cellX: 5, owner: 1 }], [{ team: 0, cellX: 5 }]);
  for (let i = 0; i < 10; i++) s = apply(s, { type: "advance_tick" });
  const mid = s.sites[0].captureProgress;
  assert.ok(mid > 0);

  // Leave early enough that the few ticks spent driving off the cell can't
  // finish the neutralize countdown.
  s = joinSelectMove(s, 0, 0, 0, 30, 0);
  for (let i = 0; i < 60; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.sites[0].captureProgress, 0, "progress drained while empty");
  assert.equal(s.sites[0].capturingTeam, -1);
  assert.equal(s.sites[0].owner, 1, "flag never moved");
});

test("11B a defender standing home heals its own flag's clock", () => {
  let s = field([{ cellX: 5, owner: 0, captureProgress: 20, capturingTeam: 1 }],
    [{ team: 0, cellX: 5 }]);
  for (let i = 0; i < 25; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.sites[0].captureProgress, 0, "secured back to zero");
  assert.equal(s.sites[0].capturingTeam, -1);
  assert.equal(s.sites[0].owner, 0);
});

test("11B countdown state is hashed and deterministic", () => {
  const run = () => {
    let s = field([{ cellX: 5, owner: 1 }], [{ team: 0, cellX: 5 }]);
    for (let i = 0; i < 10; i++) s = apply(s, { type: "advance_tick" });
    return s;
  };
  assert.equal(hashState(run()), hashState(run()));
  const a = run();
  const b = run();
  b.sites[0].captureProgress += 1;
  assert.notEqual(hashState(a), hashState(b));
});
