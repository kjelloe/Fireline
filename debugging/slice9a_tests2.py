# helpers: droppedTimer default
p = "test/helpers.js"
src = open(p).read()
src = src.replace("""    carrierAssetId: spec.carrierAssetId ?? -1,
      status: spec.status ?? 0,""",
"""    carrierAssetId: spec.carrierAssetId ?? -1,
      status: spec.status ?? 0,
      droppedTimer: spec.droppedTimer ?? 0,""")
open(p, "w").write(src)

# phase8: untaken standard stays AT_BASE
p = "test/phase8_gaps.test.js"
src = open(p).read()
src = src.replace('''  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].status, STD_DROPPED,
    "truck drove over the enemy standard and could NOT take it");''',
'''  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].status, STD_AT_BASE,
    "truck stood on the enemy standard and could NOT take it");''')
open(p, "w").write(src)

# ai_objective: carrier raider (op 24 / asset 8); single-carrier fragility pinned
p = "test/ai_objective.test.js"
src = open(p).read()
src = src.replace('''test("ai objective: the scout raider is ordered onto the enemy standard", () => {
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
});''',
'''test("ai objective: the CARRIER raider is ordered onto the enemy standard (9A)", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.step(); // joins
  server.step(); // first orders
  const enemyHome = server.state.standards[1];
  const raiderMove = server.commandLog.find(
    (e) => e.cmd.type === "move_order" && e.cmd.operatorId === 24 // op 24 drives carrier 8
  );
  assert.ok(raiderMove, "carrier raider got a move order");
  assert.deepEqual(
    { x: raiderMove.cmd.targetCellX, y: raiderMove.cmd.targetCellY },
    { x: enemyHome.homeCellX, y: enemyHome.homeCellY },
    "target is the enemy standard's home"
  );
  const scoutRaid = server.commandLog.find(
    (e) => e.cmd.type === "move_order" && e.cmd.operatorId === 18 &&
      e.cmd.targetCellX === enemyHome.homeCellX && e.cmd.targetCellY === enemyHome.homeCellY
  );
  assert.equal(scoutRaid, undefined, "scouts no longer raid — they cannot carry");
});''')
src = src.replace('''test("ai objective: a carrier turns for home; a dead raider is replaced", () => {''',
'''test("ai objective: a carrier turns for home; a lone AI carrier is irreplaceable (pinned)", () => {''')
src = src.replace("""  const S = () => server.state;
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
  ).at(-1);""",
"""  const S = () => server.state;
  S().assets[8].x = cellToWorld(50);
  S().assets[8].y = cellToWorld(50);
  S().assets[8].state = 0; // idle so the doctrine may issue fresh orders
  S().assets[8].targetX = S().assets[8].x;
  S().assets[8].targetY = S().assets[8].y;
  S().standards[1].x = S().assets[8].x;
  S().standards[1].y = S().assets[8].y;
  server.step(); // pickup happens in the tick's standard pass
  assert.equal(S().standards[1].status, STD_CARRIED);
  assert.equal(S().standards[1].carrierAssetId, 8);

  server.step(); // next plan: carrier is idle at pickup spot -> ordered home
  const home = S().standards[0];
  const homeward = server.commandLog.filter(
    (e) => e.cmd.type === "move_order" && e.cmd.operatorId === 24
  ).at(-1);""")
src = src.replace("""  // Kill the carrier: standard drops, and a NEW raider must be designated.
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
});""",
"""  // Kill the carrier. Team A's only OTHER carrier (19) is garage stock, not
  // AI-crewed — so no replacement raid happens. PINNED as a known limitation
  // (night-session question for the designer: should regency crew garage
  // carriers when the raider dies?). The dropped standard's auto-return (Q2)
  // prevents a permanent stalemate.
  const before = server.commandLog.length;
  S().assets[8].hp = 0;
  S().assets[8].state = 2;
  S().standards[1].status = 2; // dropped (as the reducer would on disablement)
  S().standards[1].carrierAssetId = -1;
  server.step();
  server.step();
  const dropCell = { x: worldToCellFloor(S().standards[1].x), y: worldToCellFloor(S().standards[1].y) };
  const replacementRaid = server.commandLog.slice(before).filter(
    (e) => e.cmd.type === "move_order" &&
      e.cmd.targetCellX === dropCell.x && e.cmd.targetCellY === dropCell.y &&
      e.cmd.operatorId >= 16 && e.cmd.operatorId <= 27
  );
  assert.equal(replacementRaid.length, 0, "no AI-crewed carrier left to raid");
});""")
open(p, "w").write(src)
print("batch 2 done")
