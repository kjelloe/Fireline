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
