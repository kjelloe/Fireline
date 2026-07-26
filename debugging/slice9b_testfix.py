p = "test/milestone9b.test.js"
src = open(p).read()
src = src.replace("""function shootDown(extraAssets = []) {
  // Gunner (1) disables the crewed tank (0) held by operator 0.
  let s = sandbox([
    { team: 0, cellX: 10, hp: 20 },
    { team: 1, cellX: 12 },
    ...extraAssets,
  ]);""",
"""function shootDown(extraAssets = []) {
  // Gunner (1) disables the crewed tank (0) held by operator 0. A bystander
  // (2) keeps team 0 fielded so elimination never ends these sandbox wars.
  let s = sandbox([
    { team: 0, cellX: 10, hp: 20 },
    { team: 1, cellX: 12 },
    { team: 0, cellX: 50 },
    ...extraAssets,
  ]);""")
src = src.replace("""test("9B a downed seat cannot select, move, or fire", () => {
  let s = shootDown([{ team: 0, cellX: 20 }]);""",
"""test("9B a downed seat cannot select, move, or fire", () => {
  let s = shootDown();""")
src = src.replace("""test("9B redeploy is gated, then frees the seat for a new asset", () => {
  let s = shootDown([{ team: 0, cellX: 20 }]);""",
"""test("9B redeploy is gated, then frees the seat for a new asset", () => {
  let s = shootDown();""")
src = src.replace("""  // Repair the wreck meanwhile so the paired asset is available again.
  S().assets[0].state = 0;
  S().assets[0].hp = 50;""",
"""  // Banish the gunner, then repair the wreck so the paired asset is free —
  // otherwise the enemy just knocks it out again before the AI can re-crew.
  S().assets[4].x = 117 * 256;
  S().assets[4].y = 60 * 256;
  S().assets[0].state = 0;
  S().assets[0].hp = 50;""")
open(p, "w").write(src)
print("9B tests fixed")
