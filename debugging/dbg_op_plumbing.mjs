// ORDERPARITY plumbing check v2 (prompt 171). Intercept every plan()
// over 3000 ticks and measure whether the odd-tick partition ever
// actually reorders: count odd-tick plans where an A command precedes a
// B command (partition would forbid it), plus how many plans mix teams
// at all — if plans are effectively single-team or team-grouped-B-last
// already, the partition is a semantic no-op and the identical 300-war
// pairs are EXPLAINED (not a plumbing bug).
import { GameServer } from "../engine/server.js";

for (const parity of [false, true]) {
  const server = new GameServer({ mapSeed: 2026, enableAi: true, uniqueCrewing: true, orderParity: parity });
  const origPlan = server.ai.plan.bind(server.ai);
  let oddMixed = 0, oddAFirst = 0, oddPlans = 0, totalCmds = 0;
  server.ai.plan = (state) => {
    const cmds = origPlan(state);
    totalCmds += cmds.length;
    if ((state.tick & 1) === 1 && cmds.length > 1) {
      const t = cmds.map((c) => state.operators[c.operatorId]?.team ?? -1);
      const hasA = t.includes(0), hasB = t.includes(1);
      if (hasA && hasB) {
        oddMixed++;
        if (t.indexOf(0) < t.indexOf(1)) oddAFirst++;
      }
      oddPlans++;
    }
    return cmds;
  };
  for (let t = 0; t < 3000; t++) server.step();
  console.log(
    `orderParity=${parity}: totalCmds=${totalCmds} oddPlans(>1cmd)=${oddPlans} ` +
    `oddMixedTeams=${oddMixed} oddWithAFirst=${oddAFirst} finalTick=${server.state.tick}`
  );
}
