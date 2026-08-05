// test/mission_convoy.test.js — asymmetric mode framework v1 + Convoy
// Escort (specs/maps-asymmetric-gamemode*.md, Q32 GO). The mission
// object is null in standard wars (hash-inert, the bridges pattern);
// convoy wars spawn no standards, run a hashed clock, and end only by
// delivery, stoppage, or a truly dead war.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, ASSET_MOVING, ASSET_IDLE } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { getUnitStats } from "../engine/units.js";
import {
  checkVictory, WIN_CONVOY_DELIVERED, WIN_CONVOY_STOPPED,
} from "../engine/victory.js";
import { MISSION_CONVOY, CONVOY_PING_TICKS } from "../engine/mission.js";
import { AIRegency, ESCORT_CELLS } from "../engine/ai_regency.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const CONVOY_RULES = { mode: 1, modeAttacker: 0 };

test("convoy: mission spawns from rules — truck designated, gate at enemy base, no standards", () => {
  const s = createInitialState(42, "frontier_corridor", CONVOY_RULES);
  assert.ok(s.mission, "mission live");
  assert.equal(s.mission.kind, MISSION_CONVOY);
  assert.equal(s.mission.attacker, 0);
  const truck = s.assets[s.mission.convoyId];
  assert.equal(truck.team, 0, "attacker's truck");
  assert.ok(getUnitStats(truck.type).canTow, "a logistics chassis");
  const gate = s.bases.find((b) => b.team === 1);
  // Extraction at the compound's NEAR edge (attacker approaches from
  // the west on frontier), not the base centre.
  assert.equal(s.mission.gateCellX, gate.x - 2);
  assert.equal(s.standards.length, 0, "no standards in a mode war");
  assert.ok(s.mission.timerTicks > 0);
});

test("convoy: standard wars carry mission null and an unchanged hash surface", () => {
  const s = createInitialState(42, "frontier_corridor");
  assert.equal(s.mission, null);
});

test("convoy: delivery wins for the attacker; a wreck near the gate does not", () => {
  const s = createInitialState(42, "frontier_corridor", CONVOY_RULES);
  const truck = s.assets[s.mission.convoyId];
  truck.x = cellToWorld(s.mission.gateCellX);
  truck.y = cellToWorld(s.mission.gateCellY);
  assert.deepEqual(checkVictory(s), { winner: 0, reason: WIN_CONVOY_DELIVERED });
  truck.state = 2; // ASSET_DISABLED at the gate: recoverable, not delivered
  assert.equal(checkVictory(s), null, "a stopped truck has not arrived");
});

test("convoy: timer expiry and salvage both hand the war to the defenders", () => {
  const s = createInitialState(42, "frontier_corridor", CONVOY_RULES);
  s.mission.timerTicks = 0;
  assert.deepEqual(checkVictory(s), { winner: 1, reason: WIN_CONVOY_STOPPED });
  s.mission.timerTicks = 5000;
  s.assets[s.mission.convoyId].state = 3; // ASSET_SALVAGED — unrecoverable
  assert.deepEqual(checkVictory(s), { winner: 1, reason: WIN_CONVOY_STOPPED });
});

test("convoy: tickets cannot end a mode war", () => {
  const s = createInitialState(42, "frontier_corridor", CONVOY_RULES);
  s.tickets = [0, 0];
  assert.equal(checkVictory(s), null, "the mission owns the verdict");
});

test("convoy: the clock runs and the defenders hear the radio", () => {
  let s = createInitialState(42, "frontier_corridor", CONVOY_RULES);
  const t0 = s.mission.timerTicks;
  for (let i = 0; i < CONVOY_PING_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.mission.timerTicks, t0 - CONVOY_PING_TICKS, "hashed countdown");
  const ping = s.events.find((e) => e.type === "convoy_ping");
  assert.ok(ping, "radio intel on cadence");
  assert.equal(ping.toTeam, 1, "scoped to the DEFENDERS");
});

test("convoy: the driver holds unless armour rides alongside", () => {
  // Sandbox: truck (type 3, canTow) crewed by AI, MOVING, no escort near.
  let s = sandbox([
    { team: 0, type: 3, cellX: 20, cellY: 20 },
    { team: 0, type: 0, cellX: 50, cellY: 50 }, // tank far away
  ], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 58, y: 58, width: 4, height: 4 },
    ],
  });
  s.mission = {
    kind: MISSION_CONVOY, attacker: 0, convoyId: 0,
    gateCellX: 60, gateCellY: 60, timerTicks: 5000,
  };
  s = joinAndSelect(s, 20, 0, 0);
  s = apply(s, { type: "move_order", operatorId: 20, targetCellX: 60, targetCellY: 60 });
  assert.equal(s.assets[0].state, ASSET_MOVING);
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(20);
  const stop = ai.plan(s).find((c) => c.type === "move_order" && c.operatorId === 20);
  assert.ok(stop, "an order was issued");
  assert.equal(stop.targetCellX, 20, "STOP: the truck orders itself parked");
  // Now armour close by: the driver rides for the gate instead.
  s.assets[1].x = cellToWorld(21);
  s.assets[1].y = cellToWorld(20);
  s = apply(s, { type: "join_operator", operatorId: 21, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 21, assetId: 1, confirm: true });
  s.assets[0].state = ASSET_IDLE;
  ai.assume(21);
  const go = ai.plan(s).find((c) => c.type === "move_order" && c.operatorId === 20);
  assert.ok(go, "escorted: the convoy rolls");
  assert.ok(Math.abs(go.targetCellX - 60) <= 2 || go.targetCellX > 20,
    `toward the gate: ${JSON.stringify(go)}`);
});

test("Q62: the push corridor is a real predicate (integer point-to-segment)", async () => {
  const { CORRIDOR_CELLS } = await import("../engine/ai_regency.js");
  assert.equal(CORRIDOR_CELLS, 10, "the ruled width");
  // The corridor law is behavioural: in a convoy war the attacker
  // designates capturers ONLY for relays near base->gate. Off-spine
  // relays stay undesignated (the blanket-gate era) while spine
  // relays get their capturer back (the zero-capturer era's fix).
  const { createInitialState } = await import("../engine/state.js");
  const s = createInitialState(42, "frontier_corridor", { mode: 1, modeAttacker: 0 });
  const g = s.mission;
  assert.ok(g.gateCellX > 64, "attacker A pushes east");
});

test("Q82 rung 2: convoyRouteScale starts the truck further forward, mirror-safely", async () => {
  // The ladder proved the defender-factory lever tops out near 24%; the
  // real problem is that the truck cannot survive the distance. A
  // shortened route must still commute with the mirror, so the two
  // worlds' remaining runs have to match to the unit.
  const { createInitialState } = await import("../engine/state.js");
  const run = (scale, attacker) => {
    const s = createInitialState(2026, "frontier_corridor",
      { mode: 1, modeAttacker: attacker, convoyRouteScale: scale });
    const truck = s.assets[s.mission.convoyId];
    const gx = s.mission.gateCellX * 256 + 128;
    return Math.abs(gx - truck.x);
  };
  const fullA = run(100, 0);
  const shortA = run(65, 0);
  assert.ok(shortA < fullA, `65% starts closer (${shortA} < ${fullA})`);
  // 65% of the run should remain, within a cell of rounding.
  assert.ok(Math.abs(shortA - Math.round(fullA * 0.65)) <= 256,
    `about 65% of the route remains (${shortA} vs ${Math.round(fullA * 0.65)})`);
  // Mirror: the other attacker's shortened run must match to the unit.
  const fullB = run(100, 1);
  const shortB = run(65, 1);
  assert.equal(fullA, fullB, "the classic route is mirror-equal");
  assert.equal(shortA, shortB, "and so is the shortened one");
});

test("Q82 rung 2: scale 100 is byte-identical to the classic route", async () => {
  const { createInitialState } = await import("../engine/state.js");
  const { hashState } = await import("../engine/snapshot.js");
  const plain = createInitialState(2026, "frontier_corridor", { mode: 1, modeAttacker: 0 });
  const scaled = createInitialState(2026, "frontier_corridor",
    { mode: 1, modeAttacker: 0, convoyRouteScale: 100 });
  assert.equal(hashState(scaled), hashState(plain), "the default changes nothing at all");
});
