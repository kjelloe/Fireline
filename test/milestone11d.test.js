// test/milestone11d.test.js — Slice 11D: alive-world doctrine
// (prompt 16 Q11/Q16): tanks fortify owned relays with mines, trucks clear
// marked mines en route, regents ping sparingly, vocabulary grows.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { AIRegency, AI_PING_INTERVAL_TICKS, MINE_FORTIFY_CELLS } from "../engine/ai_regency.js";
import { PING_KINDS } from "../engine/pings.js";
import { STD_CARRIED } from "../engine/standards.js";
import { pingOptionsFor } from "../client/js/ping_model.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 60, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

function regencyFor(...operatorIds) {
  const ai = new AIRegency({ fixedAgents: false });
  for (const id of operatorIds) ai.assume(id);
  return ai;
}

test("11D the new ping kinds are in the book and accepted by the engine", () => {
  for (const kind of ["carrier_under_attack", "road_blocked", "safe_route"]) {
    assert.ok(PING_KINDS.includes(kind), kind);
    let s = sandbox([{ team: 0, cellX: 10 }], [], { bases: OFF_BASES });
    s = joinAndSelect(s, 0, 0, 0);
    s = apply(s, { type: "ping", operatorId: 0, kind });
    assert.ok(s.events.some((e) => e.type === "ping" && e.kind === kind), kind);
  }
});

test("11D a tank near its owned relay steps off the site and mines the ground", () => {
  // Tank standing ON its captured relay: doctrine steps it one cell south.
  let onSite = sandbox([{ team: 0, cellX: 20, cellY: 20 }],
    [{ cellX: 20, cellY: 20, owner: 0 }], { bases: OFF_BASES });
  onSite = joinAndSelect(onSite, 0, 0, 0);
  const step = regencyFor(0).plan(onSite).find((c) => c.type === "move_order");
  assert.deepEqual({ x: step?.targetCellX, y: step?.targetCellY }, { x: 20, y: 21 });

  // Tank idle beside the owned relay: lay a mine.
  let beside = sandbox([{ team: 0, cellX: 20, cellY: 21 }],
    [{ cellX: 20, cellY: 20, owner: 0 }], { bases: OFF_BASES });
  beside = joinAndSelect(beside, 0, 0, 0);
  const lay = regencyFor(0).plan(beside).find((c) => c.type === "deploy_mine");
  assert.ok(lay, "fortify the approach");
  beside = apply(beside, lay);
  assert.equal(beside.mines.length, 1);

  // Rack empty or relay unowned: no mining.
  let unowned = sandbox([{ team: 0, cellX: 20, cellY: 21 }],
    [{ cellX: 20, cellY: 20 }], { bases: OFF_BASES });
  unowned = joinAndSelect(unowned, 0, 0, 0);
  assert.equal(regencyFor(0).plan(unowned).some((c) => c.type === "deploy_mine"), false);

  let empty = sandbox([{ team: 0, cellX: 20, cellY: 21, minesLeft: 0 }],
    [{ cellX: 20, cellY: 20, owner: 0 }], { bases: OFF_BASES });
  empty = joinAndSelect(empty, 0, 0, 0);
  assert.equal(regencyFor(0).plan(empty).some((c) => c.type === "deploy_mine"), false);
});

test("11D a truck clears the marked mine it stands next to", () => {
  let s = sandbox([{ team: 0, cellX: 30, cellY: 30, type: 3 }], [], { bases: OFF_BASES });
  s = joinAndSelect(s, 0, 0, 0);
  s.mines.push({ id: 5, team: 1, cellX: 31, cellY: 30, armTimer: 0, marked: 1 });
  const clear = regencyFor(0).plan(s).find((c) => c.type === "clear_mine");
  assert.equal(clear?.mineId, 5);
  s = apply(s, clear);
  assert.equal(s.mines.length, 0);

  // Unmarked mines are invisible to the doctrine too — no clairvoyance.
  let blind = sandbox([{ team: 0, cellX: 30, cellY: 30, type: 3 }], [], { bases: OFF_BASES });
  blind = joinAndSelect(blind, 0, 0, 0);
  blind.mines.push({ id: 5, team: 1, cellX: 31, cellY: 30, armTimer: 0, marked: 0 });
  assert.equal(regencyFor(0).plan(blind).some((c) => c.type === "clear_mine"), false);
});

test("11D the raiding regent pings for escort, at most once per interval", () => {
  let s = sandbox(
    [{ team: 0, cellX: 30, type: 4 }],
    [],
    {
      bases: OFF_BASES,
      standards: [
        { team: 0, cellX: 1 },
        { team: 1, cellX: 30, status: STD_CARRIED, carrierAssetId: 0 },
      ],
    }
  );
  s = joinAndSelect(s, 0, 0, 0);
  const ai = regencyFor(0);
  const ping = ai.plan(s).find((c) => c.type === "ping");
  assert.equal(ping?.kind, "need_escort");

  s = apply(s, ping); // lastPingTick stamps
  assert.equal(ai.plan(s).some((c) => c.type === "ping"), false, "interval respected");
  for (let i = 0; i < AI_PING_INTERVAL_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(ai.plan(s).some((c) => c.type === "ping"), true, "signal returns");
});

test("11D scouts flag marked mines; client options grow with the vocabulary", () => {
  let s = sandbox([{ team: 0, cellX: 30, cellY: 30, type: 1 }], [], { bases: OFF_BASES });
  s = joinAndSelect(s, 0, 0, 0);
  s.mines.push({ id: 2, team: 1, cellX: 33, cellY: 30, armTimer: 0, marked: 1 });
  const ping = regencyFor(0).plan(s).find((c) => c.type === "ping");
  assert.deepEqual(
    { kind: ping?.kind, x: ping?.targetCellX, y: ping?.targetCellY },
    { kind: "mines_detected", x: 33, y: 30 }
  );

  const base = { friendlyAssets: [], downedOperators: [], standards: [] };
  const carrier = {
    ...base,
    friendlyAssets: [{ id: 4, type: 4, operatorId: 3 }],
    standards: [{ carrierAssetId: 4 }],
  };
  assert.deepEqual(pingOptionsFor(carrier, 3).map((o) => o.kind).slice(0, 2),
    ["need_escort", "carrier_under_attack"]);
  const scout = { ...base, friendlyAssets: [{ id: 1, type: 1, operatorId: 3 }] };
  assert.ok(pingOptionsFor(scout, 3).some((o) => o.kind === "safe_route"));
  const truck = { ...base, friendlyAssets: [{ id: 1, type: 3, operatorId: 3 }] };
  assert.ok(pingOptionsFor(truck, 3).some((o) => o.kind === "road_blocked"));
  for (const opts of [pingOptionsFor(carrier, 3), pingOptionsFor(scout, 3), pingOptionsFor(truck, 3)]) {
    assert.ok(opts.length <= 3);
    for (const o of opts) assert.ok(PING_KINDS.includes(o.kind), o.kind);
  }
});
