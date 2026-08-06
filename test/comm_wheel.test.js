// test/comm_wheel.test.js — B5: the comm wheel model and the "thanks"
// ping kind. The wheel is pure data (client renders it); the kind is
// engine vocabulary and must survive the reducer, not just the menu.

import { test } from "node:test";
import assert from "node:assert/strict";
import { wheelOptionsFor, pingOptionsFor } from "../client/js/ping_model.js";
import { PING_KINDS, pingRejection } from "../engine/pings.js";
import { apply } from "../engine/reducer.js";
import { OP_ACTIVE, OP_DOWN } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const scene = (assets, downed = []) => ({
  friendlyAssets: assets, downedOperators: downed, standards: [],
});

test("B5 a downed seat's wheel is one option: the cry for rescue", () => {
  const wheel = wheelOptionsFor(scene([], [{ operatorId: 3 }]), 3);
  assert.deepEqual(wheel.map((o) => o.kind), ["need_rescue"],
    "no THANKS from a ditch — rescue first");
});

test("B5 a towing truck's wheel carries its whole vocabulary, capped and deduped", () => {
  const view = scene([
    { id: 0, operatorId: 0, type: 3, towedBy: -1 },
    { id: 1, operatorId: -1, type: 0, towedBy: 0 },
  ]);
  const wheel = wheelOptionsFor(view, 0);
  const kinds = wheel.map((o) => o.kind);
  for (const k of ["recovery_in_progress", "need_escort", "road_blocked",
    "attack", "defend", "rally", "need_supplies", "thanks"]) {
    assert.ok(kinds.includes(k), `wheel offers ${k}`);
  }
  assert.ok(wheel.length <= 8, "eight sectors maximum");
  assert.equal(new Set(kinds).size, kinds.length, "no duplicate sectors");
  for (const k of kinds) assert.ok(PING_KINDS.includes(k), `${k} is engine vocabulary`);
  // The 1/2/3 keys still offer their top three, unchanged in shape.
  assert.equal(pingOptionsFor(view, 0).length, 3);
});

test("B5 'thanks' is legal vocabulary and survives the reducer", () => {
  assert.ok(PING_KINDS.includes("thanks"));
  assert.equal(pingRejection(OP_ACTIVE, OP_ACTIVE, OP_DOWN, "thanks"), null,
    "a driving seat may say thanks");
  assert.equal(pingRejection(OP_DOWN, OP_ACTIVE, OP_DOWN, "thanks"),
    "only rescue pings while down");

  let s = sandbox([{ team: 0, cellX: 10, cellY: 10 }]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "ping", operatorId: 0, kind: "thanks" });
  const ev = s.events.find((e) => e.type === "ping" && e.kind === "thanks");
  assert.ok(ev, "the ping resolved");
  assert.equal(ev.toTeam, 0, "team-scoped like every ping");
});

// ── prompt 202/210: the need_gunner call (prompt-100 vocabulary, made
// reachable by the seats fix — it was never tested because the UI that
// offered it crashed on first touch for its whole life) ──

test("a carrier driver with an OPEN station is offered need_gunner", () => {
  const view = scene([{ id: 1, operatorId: 3, type: 4, stationOp: -1 }]);
  const kinds = wheelOptionsFor(view, 3).map((o) => o.kind);
  assert.ok(kinds.includes("need_gunner"), `wheel: ${kinds.join(",")}`);
});

test("a MANNED station offers no gunner call", () => {
  const view = scene([{ id: 1, operatorId: 3, type: 4, stationOp: 7 }]);
  const kinds = wheelOptionsFor(view, 3).map((o) => o.kind);
  assert.ok(!kinds.includes("need_gunner"), `wheel: ${kinds.join(",")}`);
});

test("the scout's AT rack qualifies too; a tank never does", () => {
  const scout = scene([{ id: 1, operatorId: 3, type: 1, stationOp: -1 }]);
  assert.ok(wheelOptionsFor(scout, 3).map((o) => o.kind).includes("need_gunner"));
  const tank = scene([{ id: 1, operatorId: 3, type: 0, stationOp: -1 }]);
  assert.ok(!wheelOptionsFor(tank, 3).map((o) => o.kind).includes("need_gunner"));
});

test("need_gunner survives the reducer from a driving seat", () => {
  let s = sandbox([{ team: 0, cellX: 10, cellY: 10, type: 4 }]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "ping", operatorId: 0, kind: "need_gunner" });
  const ping = s.events.find((e) => e.type === "ping");
  assert.ok(ping, "the call went out");
  assert.equal(ping.kind, "need_gunner");
});
