// test/milestone10c.test.js — Slice 10C (plan 2.3): context pings.
// Bounded team signals with a deterministic per-seat cooldown; toTeam-scoped
// events keep them off the enemy's wire entirely (spec 02 §14 + fog safety).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { PING_KINDS, PING_COOLDOWN_TICKS, PING_TTL_TICKS, activePings } from "../engine/pings.js";
import { validate } from "../engine/commands.js";
import { OP_DOWN } from "../engine/state.js";
import { buildView } from "../engine/view.js";
import { hashState } from "../engine/snapshot.js";
import { pingOptionsFor } from "../client/js/ping_model.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function crewed() {
  let s = sandbox([{ team: 0, cellX: 10, cellY: 12 }, { team: 1, cellX: 50 }]);
  s = joinAndSelect(s, 0, 0, 0);
  return joinAndSelect(s, 16, 1, 1);
}

test("10C a driving seat pings its cell (or a named cell); cooldown gates spam", () => {
  let s = crewed();
  s = apply(s, { type: "ping", operatorId: 0, kind: "attack" });
  const ping = s.events.find((e) => e.type === "ping");
  assert.deepEqual(ping, {
    type: "ping", toTeam: 0, operatorId: 0, kind: "attack",
    cellX: 10, cellY: 12, tick: s.tick,
  });

  const spam = apply(s, { type: "ping", operatorId: 0, kind: "defend" });
  assert.equal(spam.events[0].reason, "ping cooling down");

  for (let i = 0; i < PING_COOLDOWN_TICKS; i++) s = apply(s, { type: "advance_tick" });
  s = apply(s, { type: "ping", operatorId: 0, kind: "defend", targetCellX: 33, targetCellY: 44 });
  const aimed = s.events.find((e) => e.type === "ping");
  assert.deepEqual({ x: aimed.cellX, y: aimed.cellY }, { x: 33, y: 44 }, "named cell wins");
});

test("10C pings never reach the enemy view; own team always gets them", () => {
  let s = crewed();
  s = apply(s, { type: "ping", operatorId: 0, kind: "rally" });
  assert.equal(buildView(s, 0).events.some((e) => e.type === "ping"), true);
  assert.equal(buildView(s, 1).events.some((e) => e.type === "ping"), false,
    "toTeam scoping holds");
  // Everything else still flows to both teams unchanged.
  assert.equal(
    buildView(s, 1).events.length,
    s.events.length - 1,
    "only the ping is withheld"
  );
});

test("10C downed seats can only cry need_rescue, pinned at their body", () => {
  let s = crewed();
  s.operators[0] = { ...s.operators[0], state: OP_DOWN, assetId: -1 };
  s.assets[0].operatorId = -1;
  s.downed.push({
    operatorId: 0, team: 0, x: 20 * 256, y: 21 * 256,
    targetX: 20 * 256, targetY: 21 * 256, downTicks: 0,
  });
  const wrong = apply(s, { type: "ping", operatorId: 0, kind: "attack" });
  assert.equal(wrong.events[0].reason, "only rescue pings while down");

  s = apply(s, { type: "ping", operatorId: 0, kind: "need_rescue", targetCellX: 1, targetCellY: 1 });
  const cry = s.events.find((e) => e.type === "ping");
  assert.deepEqual({ x: cry.cellX, y: cry.cellY }, { x: 20, y: 21 },
    "the body's cell, whatever the command claimed");

  const standing = apply(crewed(), { type: "ping", operatorId: 0, kind: "need_rescue" });
  assert.equal(standing.events[0].reason, "not downed");
});

test("10C unknown kinds and seatless pings reject; validation guards shape", () => {
  const s = crewed();
  const unknown = apply(s, { type: "ping", operatorId: 0, kind: "teleport" });
  assert.equal(unknown.events[0].reason, "unknown ping kind");

  let garage = sandbox([{ team: 0, cellX: 10 }]);
  garage = apply(garage, { type: "join_operator", operatorId: 0, team: 0 });
  const seatless = apply(garage, { type: "ping", operatorId: 0, kind: "attack" });
  assert.equal(seatless.events[0].reason, "ping needs a target cell");
  const ok = apply(garage, { type: "ping", operatorId: 0, kind: "attack", targetCellX: 5, targetCellY: 6 });
  assert.equal(ok.events.find((e) => e.type === "ping").cellX, 5);

  assert.equal(validate({ type: "ping", operatorId: 0, kind: 7 }).ok, false);
  assert.equal(validate({ type: "ping", operatorId: 0, kind: "attack", targetCellX: -1 }).ok, false);
  assert.equal(validate({ type: "ping", operatorId: 0, kind: "attack" }).ok, true);
});

test("10C ping options follow the seat's context; TTL expires displays", () => {
  const base = { friendlyAssets: [], downedOperators: [], standards: [] };
  assert.deepEqual(
    pingOptionsFor({ ...base, downedOperators: [{ operatorId: 3 }] }, 3).map((o) => o.kind),
    ["need_rescue"]
  );
  const carrier = {
    ...base,
    friendlyAssets: [{ id: 4, type: 4, operatorId: 3 }],
    standards: [{ carrierAssetId: 4 }],
  };
  assert.equal(pingOptionsFor(carrier, 3)[0].kind, "need_escort");
  const towTruck = {
    ...base,
    friendlyAssets: [{ id: 1, type: 3, operatorId: 3 }, { id: 2, towedBy: 1 }],
  };
  assert.deepEqual(pingOptionsFor(towTruck, 3).map((o) => o.kind).slice(0, 2),
    ["recovery_in_progress", "need_escort"]);
  const scout = { ...base, friendlyAssets: [{ id: 1, type: 1, operatorId: 3 }] };
  assert.equal(pingOptionsFor(scout, 3).some((o) => o.kind === "mines_detected"), true);
  assert.deepEqual(pingOptionsFor(base, 99).map((o) => o.kind), ["attack", "defend", "rally"]);
  for (const kindList of [pingOptionsFor(carrier, 3), pingOptionsFor(scout, 3)]) {
    for (const o of kindList) assert.ok(PING_KINDS.includes(o.kind), o.kind);
  }

  const pings = [{ tick: 100 }, { tick: 100 + PING_TTL_TICKS - 1 }];
  assert.equal(activePings(pings, 100 + PING_TTL_TICKS - 1).length, 2);
  assert.equal(activePings(pings, 100 + PING_TTL_TICKS).length, 1);
});

test("10C ping cooldowns are hashed and deterministic", () => {
  const run = () => apply(crewed(), { type: "ping", operatorId: 0, kind: "attack" });
  assert.equal(hashState(run()), hashState(run()));
  const a = run();
  const b = run();
  b.operators[0].lastPingTick += 1;
  assert.notEqual(hashState(a), hashState(b));
});
