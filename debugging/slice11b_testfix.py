def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# helpers: sandbox sites carry the countdown fields.
patch("test/helpers.js",
"""  state.sites = siteSpecs.map((spec, id) => ({
    id, type: spec.type ?? SITE_RELAY, owner: spec.owner ?? SITE_NEUTRAL,
    cellX: spec.cellX, cellY: spec.cellY ?? 0,
  }));""",
"""  state.sites = siteSpecs.map((spec, id) => ({
    id, type: spec.type ?? SITE_RELAY, owner: spec.owner ?? SITE_NEUTRAL,
    cellX: spec.cellX, cellY: spec.cellY ?? 0,
    captureProgress: spec.captureProgress ?? 0, capturingTeam: spec.capturingTeam ?? -1, // 11B
  }));""")

# 1I: rewrite instant-capture expectations to the countdown contract.
patch("test/milestone1i.test.js",
"""  s = apply(s, { type: "advance_tick" });
  assert.equal(s.sites[0].owner, 0, "team 0 captures by standing on it");

  s = joinSelectMove(s, 1, 1, 1, 3, 0);
  for (let i = 0; i < 80 && s.sites[0].owner !== 1; i++) {
    s = apply(s, { type: "advance_tick" });
  }""",
"""  for (let i = 0; i < 30 && s.sites[0].owner !== 0; i++) {
    s = apply(s, { type: "advance_tick" }); // 11B: neutral relay takes ~3 s
  }
  assert.equal(s.sites[0].owner, 0, "team 0 captures by standing on it");

  s = joinSelectMove(s, 1, 1, 1, 3, 0);
  for (let i = 0; i < 400 && s.sites[0].owner !== 1; i++) {
    s = apply(s, { type: "advance_tick" });
  }""")
patch("test/milestone1i.test.js",
"""test("1I standing on an owned relay emits no repeat capture events", () => {
  let s = sandbox([{ team: 0, cellX: 3 }], [{ cellX: 3 }]);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.filter((e) => e.type === "site_captured").length, 1);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.filter((e) => e.type === "site_captured").length, 0);
});""",
"""test("1I standing on an owned relay emits no repeat capture events", () => {
  let s = sandbox([{ team: 0, cellX: 3 }], [{ cellX: 3 }]);
  let captures = 0;
  for (let i = 0; i < 40; i++) { // 11B: capture lands once the countdown runs
    s = apply(s, { type: "advance_tick" });
    captures += s.events.filter((e) => e.type === "site_captured").length;
  }
  assert.equal(captures, 1);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.filter((e) => e.type === "site_captured").length, 0);
});""")

# 1I view-fields pin grows the two new public fields.
src = open("test/milestone1i.test.js").read()
old = "cellX: 5,"
assert old in src
patch("test/milestone1i.test.js",
"""test("1I view includes sites array with correct fields", () => {""",
"""test("1I view includes sites array with correct fields", () => {
  // 11B: capture countdown telemetry is public, like ownership itself.""")

# 3B: the on-the-spot capture now takes the countdown.
patch("test/milestone3b.test.js",
"""  s = apply(s, { type: "advance_tick" }); // standing on relay -> capture
  assert.equal(s.sites[0].owner, 0);""",
"""  for (let i = 0; i < 30 && s.sites[0].owner !== 0; i++) {
    s = apply(s, { type: "advance_tick" }); // 11B: stand the countdown out
  }
  assert.equal(s.sites[0].owner, 0);""")
print("test fixes applied")
