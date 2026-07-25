// test/unit_gaps.test.js — unit-level edges not covered by milestone tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createByteWriter, hashToHex64, computeFnv1a64 } from "../shared/canonical.js";
import { speedMultiplier, TERRAIN_SPEED } from "../engine/terrain.js";
import { UNIT_STATS, getUnitStats } from "../engine/units.js";
import { dominatingTeam } from "../engine/victory.js";
import { captureCheck } from "../engine/sites.js";
import { validate } from "../engine/commands.js";
import { sandbox } from "./helpers.js";

test("unit: writeOptionalU32 present-path emits flag byte plus LE payload", () => {
  const w = createByteWriter();
  w.writeOptionalU32(true, 0x01020304);
  assert.deepEqual(Array.from(w.toBytes()), [1, 4, 3, 2, 1]);
  const absent = createByteWriter();
  absent.writeOptionalU32(false, 999999); // value ignored when absent
  assert.deepEqual(Array.from(absent.toBytes()), [0]);
});

test("unit: hashToHex64 zero-pads both 32-bit halves", () => {
  assert.equal(hashToHex64(0x1, 0x2), "0000000100000002");
  assert.equal(hashToHex64(0, 0), "0000000000000000");
  const { hashHi, hashLo } = computeFnv1a64([]);
  assert.equal(hashToHex64(hashHi, hashLo).length, 16);
});

test("unit: unknown terrain id falls back to open-ground speed", () => {
  assert.equal(speedMultiplier(99), 256);
  assert.equal(speedMultiplier(-1), 256);
  assert.equal(Object.isFrozen(TERRAIN_SPEED), true);
});

test("unit: unit stat tables are frozen against accidental mutation", () => {
  assert.equal(Object.isFrozen(UNIT_STATS), true);
  assert.equal(Object.isFrozen(getUnitStats(0)), true);
  assert.throws(() => { "use strict"; getUnitStats(0).damage = 999; }, TypeError);
});

test("unit: dominatingTeam handles contested and neutral boards", () => {
  const contested = sandbox([], [{ cellX: 1, owner: 0 }, { cellX: 2, owner: 1 }]);
  assert.equal(dominatingTeam(contested), -1);
  const partNeutral = sandbox([], [{ cellX: 1, owner: 0 }, { cellX: 2, owner: -1 }]);
  assert.equal(dominatingTeam(partNeutral), -1);
  const empty = sandbox([], []);
  assert.equal(dominatingTeam(empty), -1);
});

test("unit: captureCheck tolerates missing assets and off-site positions", () => {
  const s = sandbox([{ team: 0, cellX: 5 }], [{ cellX: 9 }]);
  assert.equal(captureCheck(s, 0), null, "not standing on the site");
  assert.equal(captureCheck(s, 42), null, "no such asset");
});

test("unit: command validation rejects non-integer and boundary payloads", () => {
  assert.equal(validate({ type: "move_order", operatorId: 0, targetCellX: 1.5, targetCellY: 0 }).ok, false);
  assert.equal(validate({ type: "move_order", operatorId: 0, targetCellX: 127, targetCellY: 127 }).ok, true);
  assert.equal(validate({ type: "fire_order", operatorId: 32, targetAssetId: 0 }).ok, false);
  assert.equal(validate({ type: "fire_order", operatorId: 0, targetAssetId: 64 }).ok, false);
  assert.equal(validate({ type: "join_operator", operatorId: 0, team: -1 }).ok, false);
  assert.equal(validate(null).ok, false);
});
