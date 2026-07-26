p = "test/milestone9d.test.js"
src = open(p).read()
src = src.replace("""test("9D wrecks under tow or in the repair bay are not cannibalized", () => {
  let s = depletedState();
  s.assets[8].towedBy = 0;      // player rescue in progress
  s.assets[9].recoverTimer = 50; // already in the bay
  for (let i = 0; i < MPG_TICKS; i++) s = apply(s, { type: "advance_tick" });
  const rebuilt = s.events.find((e) => e.type === "asset_manufactured");
  assert.equal(rebuilt.assetId, 10, "skips towed and recovering hulls");
});""",
"""test("9D wrecks under tow or in the repair bay are not cannibalized", () => {
  let s = depletedState();
  // Stage the claims OUTSIDE the base (a towed wreck inside the base would
  // legitimately enter the repair bay and stop being a wreck at all).
  s.assets[8].towedBy = 99;                 // rescue claim, tower far away
  s.assets[8].x = cellToWorld(60);
  s.assets[9].recoverTimer = MPG_TICKS + 50; // deep in the repair bay
  for (let i = 0; i < MPG_TICKS; i++) s = apply(s, { type: "advance_tick" });
  const rebuilt = s.events.find((e) => e.type === "asset_manufactured");
  assert.equal(rebuilt.assetId, 10, "skips towed and recovering hulls");
});""")
src = src.replace("""test("9D with no eligible hull the timer holds and fires when one appears", () => {
  let s = depletedState();
  for (const a of s.assets) {
    if (a.team === 0 && a.state === ASSET_DISABLED) a.towedBy = 0; // all claimed
  }
  for (let i = 0; i < MPG_TICKS + 20; i++) s = apply(s, { type: "advance_tick" });""",
"""test("9D with no eligible hull the timer holds and fires when one appears", () => {
  let s = depletedState();
  for (const a of s.assets) {
    if (a.team === 0 && a.state === ASSET_DISABLED) {
      a.towedBy = 99;            // all claimed by rescues...
      a.x = cellToWorld(60 + a.id); // ...parked outside the repair bay
    }
  }
  for (let i = 0; i < MPG_TICKS + 20; i++) s = apply(s, { type: "advance_tick" });""")
open(p, "w").write(src)
print("staging fixed")
