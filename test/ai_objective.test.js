// test/ai_objective.test.js — AI objective doctrine for backend standard-war
// sims (dev-prompts prompt 12): raiders steal, carriers head home, per-team
// recoverers reclaim dropped standards, roles re-designate when assets die.
// Plus heading smoothing math (playtest 3 wiggle fix).

import { test } from "node:test";
import assert from "node:assert/strict";
import { GameServer } from "../engine/server.js";
import { STD_CARRIED, STD_AT_BASE } from "../engine/standards.js";
import { angleDelta, smoothHeading } from "../client/js/heading.js";
import { cellToWorld, worldToCellFloor } from "../shared/fixedmath.js";

test("ai objective: the scout raider is ordered onto the enemy standard", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.step(); // joins
  server.step(); // first orders
  const enemyHome = server.state.standards[1];
  const raiderMove = server.commandLog.find(
    (e) => e.cmd.type === "move_order" && e.cmd.operatorId === 18 // op 18 drives scout 2
  );
  assert.ok(raiderMove, "raider got a move order");
  assert.deepEqual(
    { x: raiderMove.cmd.targetCellX, y: raiderMove.cmd.targetCellY },
    { x: enemyHome.homeCellX, y: enemyHome.homeCellY },
    "target is the enemy standard's home"
  );
});

test("ai objective: a carrier turns for home; a dead raider is replaced", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.step();
  // Stage the grab MID-MAP: teleporting the scout into the enemy base gets it
  // shot before the pickup pass, and staging at the scout's spawn scores
  // instantly (spawn sits inside the command zone). The engine is right both
  // times; the test needs neutral ground.
  const S = () => server.state;
  S().assets[2].x = cellToWorld(50);
  S().assets[2].y = cellToWorld(50);
  S().assets[2].state = 0; // idle so the doctrine may issue fresh orders
  S().assets[2].targetX = S().assets[2].x;
  S().assets[2].targetY = S().assets[2].y;
  S().standards[1].x = S().assets[2].x;
  S().standards[1].y = S().assets[2].y;
  server.step(); // pickup happens in the tick's standard pass
  assert.equal(S().standards[1].status, STD_CARRIED);
  assert.equal(S().standards[1].carrierAssetId, 2);

  server.step(); // next plan: carrier is idle at pickup spot -> ordered home
  const home = S().standards[0];
  const homeward = server.commandLog.filter(
    (e) => e.cmd.type === "move_order" && e.cmd.operatorId === 18
  ).at(-1);
  assert.deepEqual(
    { x: homeward.cmd.targetCellX, y: homeward.cmd.targetCellY },
    { x: home.homeCellX, y: home.homeCellY },
    "carrier escorts itself toward the scoring zone"
  );

  // Kill the carrier: standard drops, and a NEW raider must be designated.
  // Role reassignment is lazy (doctrine only re-tasks idle assets), so idle
  // the deterministic fallback (highest fixed-agent asset, id 11) for the test.
  S().assets[2].hp = 0;
  S().assets[2].state = 2;
  S().standards[1].status = 2; // dropped (as the reducer would on disablement)
  S().standards[1].carrierAssetId = -1;
  S().assets[11].state = 0;
  S().assets[11].targetX = S().assets[11].x;
  S().assets[11].targetY = S().assets[11].y;
  server.step();
  server.step();
  const dropCell = { x: worldToCellFloor(S().standards[1].x), y: worldToCellFloor(S().standards[1].y) };
  const replacementRaid = server.commandLog.filter(
    (e) => e.cmd.type === "move_order" &&
      e.cmd.targetCellX === dropCell.x && e.cmd.targetCellY === dropCell.y &&
      e.cmd.operatorId !== 18 && e.cmd.operatorId >= 16 && e.cmd.operatorId <= 27
  );
  assert.ok(replacementRaid.length >= 1, "another team-A asset takes over the raid");
});

test("ai objective: each team recovers its OWN dropped standard (sim-found bug pin)", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.step();
  const S = () => server.state;
  // Drop TEAM B's standard in the open field near B's lines.
  S().standards[1].status = 2;
  S().standards[1].x = cellToWorld(100);
  S().standards[1].y = cellToWorld(60);
  server.step();
  const bRecovery = server.commandLog.filter(
    (e) => e.cmd.type === "move_order" &&
      e.cmd.targetCellX === 100 && e.cmd.targetCellY === 60 &&
      e.cmd.operatorId >= 20 // a TEAM B operator
  );
  assert.ok(bRecovery.length >= 1,
    "a team-B asset is sent to recover — the global-recoverer bug stays dead");
});

test("ai objective: standard-war sims stay deterministic and replay-exact", () => {
  const run = () => {
    const server = new GameServer({ mapSeed: 777, enableAi: true, aiDifficulty: 1 });
    for (let i = 0; i < 500; i++) server.step();
    return server.getLatestSnapshot().stateHash;
  };
  assert.equal(run(), run());
});

// ── heading smoothing (playtest 3 wiggle fix) ────────────────────────────────

test("heading: shortest-arc delta wraps correctly", () => {
  assert.equal(angleDelta(0, Math.PI / 2), Math.PI / 2);
  assert.equal(angleDelta(Math.PI / 2, 0), -Math.PI / 2);
  assert.ok(Math.abs(angleDelta(-Math.PI + 0.1, Math.PI - 0.1) + 0.2) < 1e-9,
    "crossing the seam takes the short way");
});

test("heading: turns are bounded per step and settle exactly on target", () => {
  let h = 0;
  const target = Math.PI / 2;
  const step = 0.2;
  const path = [];
  for (let i = 0; i < 12 && h !== target; i++) {
    h = smoothHeading(h, target, step);
    path.push(h);
  }
  assert.ok(path.every((v, i) => i === 0 || Math.abs(v - path[i - 1]) <= step + 1e-9),
    "never snaps more than the max step");
  assert.equal(h, target, "settles exactly");
  assert.equal(smoothHeading(1.2, null, step), 1.2, "null target keeps last heading");
});
