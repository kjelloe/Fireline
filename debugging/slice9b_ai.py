p = "engine/ai_regency.js"
src = open(p).read()
src = src.replace('import { STD_AT_BASE, STD_CARRIED, STD_DROPPED } from "./standards.js";',
'''import { STD_AT_BASE, STD_CARRIED, STD_DROPPED } from "./standards.js";
import { CMD_REDEPLOY } from "./commands.js";
import { downedFor, REDEPLOY_TICKS } from "./downed.js";
import { OP_DOWN } from "./state.js";''')
src = src.replace("""    for (const [operatorId, agent] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
      const operator = state.operators[operatorId];
      if (operator.state !== OP_ACTIVE || operator.assetId === -1) continue;
      const asset = state.assets[operator.assetId];
      // The AI never evicts humans or drives assets it does not operate.
      if (!asset || asset.operatorId !== operatorId || isWreck(asset)) continue;""",
"""    for (const [operatorId, agent] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
      const operator = state.operators[operatorId];

      // 9B down-management: redeploy once the timer allows; after redeploy or
      // delivery, re-crew — fixed agents retake their paired asset when it is
      // operable and free; regented seats take the lowest free operable asset.
      if (operator.state === OP_DOWN) {
        const down = downedFor(state, operatorId);
        if (down && down.downTicks >= REDEPLOY_TICKS) {
          commands.push({ type: CMD_REDEPLOY, operatorId });
        }
        continue; // aboard a carrier or waiting out the timer
      }
      if (operator.state === OP_ACTIVE && operator.assetId === -1) {
        let pick = null;
        if (agent) {
          const paired = state.assets[agent.assetId];
          if (paired && paired.operatorId === -1 && !isWreck(paired)) pick = paired.id;
        } else {
          const free = state.assets.find((a) =>
            a.team === state.operators[operatorId].team &&
            a.operatorId === -1 && !isWreck(a));
          if (free) pick = free.id;
        }
        if (pick !== null) {
          commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: pick });
        }
        continue;
      }
      if (operator.state !== OP_ACTIVE || operator.assetId === -1) continue;
      const asset = state.assets[operator.assetId];
      // The AI never evicts humans or drives assets it does not operate.
      if (!asset || asset.operatorId !== operatorId || isWreck(asset)) continue;""")
open(p, "w").write(src)

# v1 acceptance: downed/aboard seats are still participants
p = "test/v1_acceptance.test.js"
src = open(p).read()
src = src.replace('''test("v1: all 32 operator slots are active and every asset is crewed", () => {
  assert.equal(result.activeOperators, 32);
  assert.equal(result.operatedAssets, 32);
});''',
'''test("v1: all 32 operator seats participate (active, downed, or aboard)", () => {
  // Since 9B, crews bail out of disabled assets: a seat may legitimately be
  // OP_DOWN (walking or aboard a carrier) instead of driving. Nobody may be
  // ABSENT, and the driving seats must match the crewed assets.
  const s = result.server.state;
  const absent = s.operators.filter((o) => o.state === 0).length;
  assert.equal(absent, 0, "no seat abandoned the war");
  const driving = s.operators.filter((o) => o.state === 1 && o.assetId !== -1).length;
  assert.equal(driving, result.operatedAssets, "seat/asset links symmetric");
  assert.ok(result.activeOperators >= 24, `${result.activeOperators} active seats`);
});''')
open(p, "w").write(src)

# soak harness: operatedAssets counts crewed assets (unchanged) — fine.
print("9B AI + acceptance updated")
