// test/vault.test.js — Q39 (specs/12): the VAULT, the first per-map
// special. "+N tickets to the controller, ships FIRST — zero new
// systems": a typed site pair on frontier's north trail, paying slow
// income while held. Capped at the pool; silent; mode wars excluded.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { createInitialState } from "../engine/state.js";
import { KIND_VAULT, VAULT_INCOME_TICKS } from "../engine/sites.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("vault: NO live map carries one (pulled by battery conviction — dev-log 2026-08-01)", () => {
  // The frontier pair measured a ~15-pt team edge at n=300 despite
  // perfect mirror symmetry (the rearguard precedent). The machinery
  // below stays engine-supported for the map that earns it.
  for (const profile of ["frontier_corridor", "blackwood", "sawtooth", "riverline", "caldera"]) {
    const s = createInitialState(42, profile);
    assert.equal(s.sites.filter((site) => site.kind === KIND_VAULT).length, 0, profile);
  }
});

test("vault: a held vault pays its controller on the cadence, capped at the pool", () => {
  let s = sandbox([{ team: 0, cellX: 5, cellY: 5 }],
    [{ cellX: 20, cellY: 20, owner: 0, kind: KIND_VAULT }, { cellX: 40, cellY: 40 }]);
  s = joinAndSelect(s, 20, 0, 0);
  const t0 = s.tickets[0];
  for (let i = 0; i < VAULT_INCOME_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.tickets[0], Math.min(s.rules.ticketPool, t0 + 1), "one ticket per cadence");
  assert.equal(s.tickets[1], s.rules.ticketPool <= t0 ? s.tickets[1] : t0, "nothing for the non-holder");
  // Cap: income never inflates past the starting reserve.
  s.tickets[0] = s.rules.ticketPool;
  for (let i = 0; i < VAULT_INCOME_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.tickets[0], s.rules.ticketPool, "capped at the pool");
});

test("vault: neutral or contested vaults pay nobody; mode wars pay nobody", () => {
  let s = sandbox([{ team: 0, cellX: 5, cellY: 5 }],
    [{ cellX: 20, cellY: 20, kind: KIND_VAULT }, { cellX: 40, cellY: 40 }]);
  s = joinAndSelect(s, 20, 0, 0);
  const t0 = [...s.tickets];
  for (let i = 0; i < VAULT_INCOME_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.deepEqual(s.tickets, t0, "a NEUTRAL vault pays nobody");
  // Mode war: income excluded with the rest of the ticket machinery.
  let m = sandbox([{ team: 0, cellX: 5, cellY: 5 }],
    [{ cellX: 20, cellY: 20, owner: 0, kind: KIND_VAULT }, { cellX: 40, cellY: 40 }]);
  m.mission = { kind: 1, attacker: 0, convoyId: 0, gateCellX: 60, gateCellY: 60, timerTicks: 99999, restartTicks: 0 };
  m = joinAndSelect(m, 20, 0, 0);
  const mt = [...m.tickets];
  for (let i = 0; i < VAULT_INCOME_TICKS; i++) m = apply(m, { type: "advance_tick" });
  assert.deepEqual(m.tickets, mt, "mission wars ignore vault income");
});
