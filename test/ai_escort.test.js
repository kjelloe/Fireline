// test/ai_escort.test.js — playtest 7 item 11 (ruled: BOTH triggers).
// The carrier raider launches only as a GROUP ATTACK (>=2 combat escorts
// alongside) or through a SNEAK WINDOW (thin defenses near the route);
// a raider mid-approach whose window closes breaks off for home.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AIRegency, ESCORT_CELLS } from "../engine/ai_regency.js";
import { UNIT_CARRIER } from "../engine/units.js";
import { apply } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const STD_HOME = { cellX: 55, cellY: 12 };

function raidWorld(extraAssets, { escortDist = 2 } = {}) {
  // Carrier at (30,30); enemy standard home NE at (55,12); enemy garrison
  // placement decides whether a sneak window exists.
  let s = sandbox(
    [{ team: 0, cellX: 30, cellY: 30, type: UNIT_CARRIER }, ...extraAssets],
    [],
    { standards: [
      { team: 0, cellX: 5, cellY: 60, homeCellX: 5, homeCellY: 60 },
      { team: 1, cellX: STD_HOME.cellX, cellY: STD_HOME.cellY, homeCellX: STD_HOME.cellX, homeCellY: STD_HOME.cellY },
    ] }
  );
  s = joinAndSelect(s, 16, 0, 0);
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  return { s, ai };
}

const raidOrder = (cmds) => cmds.find((c) =>
  c.type === "move_order" && c.operatorId === 16 &&
  Math.abs(c.targetCellX - STD_HOME.cellX) <= 2 && Math.abs(c.targetCellY - STD_HOME.cellY) <= 2);

test("11: defended route + no escorts — the carrier HOLDS", () => {
  const { s, ai } = raidWorld([
    { team: 1, cellX: 44, cellY: 20 }, // two defenders on the track
    { team: 1, cellX: 52, cellY: 14 },
  ]);
  assert.equal(raidOrder(ai.plan(s)), undefined, "no solo raid into the guns");
});

test("11: group attack — two crewed combat escorts unlock the raid", () => {
  let { s, ai } = raidWorld([
    { team: 1, cellX: 44, cellY: 20 },
    { team: 1, cellX: 52, cellY: 14 },
    { team: 0, cellX: 31, cellY: 30 }, // tank escort 1
    { team: 0, cellX: 30, cellY: 31 }, // tank escort 2
  ]);
  s = apply(s, { type: "join_operator", operatorId: 17, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 17, assetId: 3, confirm: true });
  s = apply(s, { type: "join_operator", operatorId: 18, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 18, assetId: 4, confirm: true });
  ai.assume(17); ai.assume(18);
  assert.ok(raidOrder(ai.plan(s)), "escorted raid launches");
});

test("11: uncrewed hulls are not escorts", () => {
  const { s, ai } = raidWorld([
    { team: 1, cellX: 44, cellY: 20 },
    { team: 1, cellX: 52, cellY: 14 },
    { team: 0, cellX: 31, cellY: 30 }, // parked, nobody aboard
    { team: 0, cellX: 30, cellY: 31 },
  ]);
  assert.equal(raidOrder(ai.plan(s)), undefined, "empty hulls escort nobody");
});

test("11: sneak window — thin defenses let the carrier slip out alone", () => {
  const { s, ai } = raidWorld([
    { team: 1, cellX: 100, cellY: 100 }, // garrison far from the track
    { team: 1, cellX: 98, cellY: 102 },
  ]);
  assert.ok(raidOrder(ai.plan(s)), "the opportune moment");
});

test("11: mid-approach abort — window closes, raider turns for home", () => {
  // Sneak-launch, then the enemy pair appears on the track: the raider's
  // next plan issues a rally order home instead of pressing on.
  let { s, ai } = raidWorld([
    { team: 1, cellX: 100, cellY: 100 },
    { team: 1, cellX: 98, cellY: 102 },
  ]);
  let cmds = ai.plan(s);
  const launch = raidOrder(cmds);
  assert.ok(launch, "launched in the window");
  s = apply(s, { type: "move_order", operatorId: 16, targetCellX: launch.targetCellX, targetCellY: launch.targetCellY });
  s = apply(s, { type: "advance_tick" });
  s.assets[1].x = 44 * 256; s.assets[1].y = 20 * 256;  // defenders slam the door
  s.assets[2].x = 52 * 256; s.assets[2].y = 14 * 256;
  cmds = ai.plan(s);
  const abort = cmds.find((c) => c.type === "move_order" && c.operatorId === 16);
  assert.ok(abort, "an order was issued mid-raid");
  assert.ok(Math.abs(abort.targetCellX - STD_HOME.cellX) > 4 || Math.abs(abort.targetCellY - STD_HOME.cellY) > 4,
    `order breaks off the raid: ${JSON.stringify(abort)}`);
});

test("11 assembly: closed window designates the two nearest tanks to converge", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 30, cellY: 30, type: UNIT_CARRIER },
      { team: 1, cellX: 44, cellY: 20 },  // defenders close the window
      { team: 1, cellX: 52, cellY: 14 },
      { team: 0, cellX: 45, cellY: 45 },  // tank, 15 cells out
      { team: 0, cellX: 20, cellY: 44 },  // tank, 14 cells out
    ],
    [],
    { standards: [
      { team: 0, cellX: 5, cellY: 60, homeCellX: 5, homeCellY: 60 },
      { team: 1, cellX: 55, cellY: 12, homeCellX: 55, homeCellY: 12 },
    ] }
  );
  s = joinAndSelect(s, 16, 0, 0);
  s = apply(s, { type: "join_operator", operatorId: 17, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 17, assetId: 3, confirm: true });
  s = apply(s, { type: "join_operator", operatorId: 18, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 18, assetId: 4, confirm: true });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16); ai.assume(17); ai.assume(18);
  const cmds = ai.plan(s);
  for (const opId of [17, 18]) {
    const move = cmds.find((c) => c.type === "move_order" && c.operatorId === opId);
    assert.ok(move, `escort ${opId} gets a converge order`);
    assert.ok(Math.abs(move.targetCellX - 30) <= 3 && Math.abs(move.targetCellY - 30) <= 3,
      `escort ${opId} converges on the carrier: ${JSON.stringify(move)}`);
  }
});
