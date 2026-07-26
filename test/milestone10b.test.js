// test/milestone10b.test.js — Slice 10B (plan 2.2): takeover confirmations.
// Claiming an uncrewed asset in a consequential state — carrying the
// standard, towing a wreck, passengers aboard — demands confirm: true
// (spec 02 §9). Plain assets keep the friction-free single click.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { validate } from "../engine/commands.js";
import { STD_CARRIED } from "../engine/standards.js";
import { ASSET_DISABLED } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 60, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

test("10B plain free assets need no confirmation (single click stays)", () => {
  let s = sandbox([{ team: 0, cellX: 10 }], [], { bases: OFF_BASES });
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0 });
  assert.equal(s.assets[0].operatorId, 0);
});

test("10B a carrier holding the standard demands confirmation", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10, type: 4 }],
    [],
    {
      bases: OFF_BASES,
      standards: [
        { team: 0, cellX: 1 },
        { team: 1, cellX: 10, status: STD_CARRIED, carrierAssetId: 0 },
      ],
    }
  );
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  const blind = apply(s, { type: "select_asset", operatorId: 0, assetId: 0 });
  assert.equal(blind.events[0].reason, "takeover needs confirmation");
  assert.equal(blind.assets[0].operatorId, -1, "seat untouched");

  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
  assert.equal(s.assets[0].operatorId, 0, "confirmed takeover succeeds");
  assert.ok(s.events.some((e) => e.type === "asset_selected"));
});

test("10B a truck mid-tow and a carrier with passengers demand confirmation", () => {
  let tow = sandbox(
    [
      { team: 0, cellX: 10, type: 3 },
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0, towedBy: 0 },
    ],
    [], { bases: OFF_BASES }
  );
  tow = apply(tow, { type: "join_operator", operatorId: 0, team: 0 });
  const blindTow = apply(tow, { type: "select_asset", operatorId: 0, assetId: 0 });
  assert.equal(blindTow.events[0].reason, "takeover needs confirmation");
  tow = apply(tow, { type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
  assert.equal(tow.assets[0].operatorId, 0);

  let bus = sandbox([{ team: 0, cellX: 10, type: 4, aboard1: 5 }], [], { bases: OFF_BASES });
  bus = apply(bus, { type: "join_operator", operatorId: 0, team: 0 });
  const blindBus = apply(bus, { type: "select_asset", operatorId: 0, assetId: 0 });
  assert.equal(blindBus.events[0].reason, "takeover needs confirmation");
  bus = apply(bus, { type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
  assert.equal(bus.assets[0].operatorId, 0);
});

test("10B your own asset never re-demands confirmation while you drive it", () => {
  // The gate is for CLAIMING an uncrewed asset: once you drive it (and it
  // becomes consequential under you), reselecting it stays silent.
  let s = sandbox(
    [
      { team: 0, cellX: 10, type: 3 },
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0 },
    ],
    [], { bases: OFF_BASES }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s.assets[1].towedBy = 0;
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0 });
  assert.equal(s.events[0]?.type, "asset_selected", "no confirmation demanded");
});

test("10B validation: confirm must be boolean when present", () => {
  assert.equal(validate({ type: "select_asset", operatorId: 0, assetId: 0, confirm: 1 }).ok, false);
  assert.equal(validate({ type: "select_asset", operatorId: 0, assetId: 0, confirm: true }).ok, true);
  assert.equal(validate({ type: "select_asset", operatorId: 0, assetId: 0 }).ok, true);
});
