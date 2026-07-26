# Fix stale-state references in roster ws tests: read state via getter.
p = "test/roster_gaps.test.js"
src = open(p).read()

src = src.replace("""    appServer.pump(appServer.gameServer.step());

    const state = appServer.gameServer.state;
    assert.equal(state.assets[15].operatorId, 0, "human crews the truck");

    // Stage a wreck adjacent to the truck (test shortcut), then tow over ws.
    state.assets[0].hp = 0;
    state.assets[0].state = 2;
    state.assets[0].x = state.assets[15].x + 256;
    state.assets[0].y = state.assets[15].y;
    ws.send(JSON.stringify({ type: "tow_order", wreckAssetId: 0 }));
    await settle();
    appServer.pump(appServer.gameServer.step());
    assert.equal(state.assets[0].towedBy, 15, "tow line attached over the wire");

    // Truck already sits inside the base zone: next tick starts the repair.
    appServer.pump(appServer.gameServer.step());
    assert.ok(state.assets[0].recoverTimer > 0, "repair bay engaged");
    assert.equal(state.assets[0].towedBy, -1, "tow released at the depot");""",
"""    appServer.pump(appServer.gameServer.step());

    // step() replaces gameServer.state — always read through the getter.
    const S = () => appServer.gameServer.state;
    assert.equal(S().assets[15].operatorId, 0, "human crews the truck");

    // Stage a wreck adjacent to the truck (test shortcut), then tow over ws.
    S().assets[0].hp = 0;
    S().assets[0].state = 2;
    S().assets[0].x = S().assets[15].x + 256;
    S().assets[0].y = S().assets[15].y;
    ws.send(JSON.stringify({ type: "tow_order", wreckAssetId: 0 }));
    await settle();
    appServer.pump(appServer.gameServer.step());
    assert.equal(S().assets[0].towedBy, 15, "tow line attached over the wire");

    // Truck already sits inside the base zone: next tick starts the repair.
    appServer.pump(appServer.gameServer.step());
    assert.ok(S().assets[0].recoverTimer > 0, "repair bay engaged");
    assert.equal(S().assets[0].towedBy, -1, "tow released at the depot");""")

src = src.replace("""    const state = appServer.gameServer.state;
    state.assets[1].hp = 0;
    state.assets[1].state = 2;""",
"""    appServer.gameServer.state.assets[1].hp = 0;
    appServer.gameServer.state.assets[1].state = 2;""")
open(p, "w").write(src)
print("roster test fixed")
