# Slice 11V: AI doctrine for bike / mortar / paths (prompt 24 approval).
# 1. Courier: the recoverer role prefers the FASTEST controlled asset, and
#    a dropped own standard lets a free seat crew a garage bike.
# 2. Fire support: a team with no crewed indirect tube crews a free
#    mortar/artillery from the garage (replacement artillery doctrine).
# 3. Paths: light chassis (fast + not heavy) patrol the TRAILS — the
#    flanking routes tanks can't use well.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

p = "engine/ai_regency.js"

# ── recoverer = fastest controlled asset (courier doctrine, part 1) ──────────
patch(p,
"""      if (recovererFor[a.team] === -1) recovererFor[a.team] = operatorId;
      if (raiderFor[a.team] === -1 && getUnitStats(a.type).canCarryStandard) {
        raiderFor[a.team] = a.id; // first operable controlled carrier raids
      }
    }""",
"""      // 11V: the recoverer is the FASTEST controlled seat (ties: lowest
      // operator) — a crewed bike naturally becomes the standard courier.
      const speed = getUnitStats(a.type).speed;
      const cur = recovererFor[a.team];
      if (cur === -1 || speed > (recovererSpeed[a.team] ?? -1)) {
        recovererFor[a.team] = operatorId;
        recovererSpeed[a.team] = speed;
      }
      if (raiderFor[a.team] === -1 && getUnitStats(a.type).canCarryStandard) {
        raiderFor[a.team] = a.id; // first operable controlled carrier raids
      }
    }""")
patch(p,
"""    const recovererFor = { 0: -1, 1: -1 };
    const raiderFor = { 0: -1, 1: -1 };""",
"""    const recovererFor = { 0: -1, 1: -1 };
    const recovererSpeed = { 0: -1, 1: -1 };
    const raiderFor = { 0: -1, 1: -1 };""")

# ── role-crewing: courier bike + fire-support tube (parts 1+2) ───────────────
patch(p,
"""        const roleCarrier = !carrierCrewed
          ? state.assets.find((a) =>
              a.team === team && a.operatorId === -1 && !isWreck(a) &&
              getUnitStats(a.type).canCarryStandard)
          : null;
        if (roleCarrier) {
          pick = roleCarrier.id;
        } else if (agent) {""",
"""        const roleCarrier = !carrierCrewed
          ? state.assets.find((a) =>
              a.team === team && a.operatorId === -1 && !isWreck(a) &&
              getUnitStats(a.type).canCarryStandard)
          : null;
        // 11V courier: our standard lies in the open and nobody fast is on
        // it — grab the garage bike (fastest return in the war).
        let roleBike = null;
        if (!roleCarrier && state.standards.length === 2 &&
            state.standards[team].status === STD_DROPPED &&
            (recovererSpeed[team] ?? -1) < 72) {
          roleBike = state.assets.find((a) =>
            a.team === team && a.operatorId === -1 && !isWreck(a) &&
            getUnitStats(a.type).speed >= 72);
        }
        // 11V fire support: no crewed indirect tube on the team — crew a
        // free mortar/artillery (replacement-artillery doctrine).
        let roleTube = null;
        if (!roleCarrier && !roleBike) {
          const tubeCrewed = state.assets.some((a) =>
            a.team === team && a.operatorId !== -1 && !isWreck(a) &&
            getUnitStats(a.type).indirect);
          if (!tubeCrewed) {
            roleTube = state.assets.find((a) =>
              a.team === team && a.operatorId === -1 && !isWreck(a) &&
              getUnitStats(a.type).indirect);
          }
        }
        if (roleCarrier) {
          pick = roleCarrier.id;
        } else if (roleBike) {
          pick = roleBike.id;
        } else if (roleTube) {
          pick = roleTube.id;
        } else if (agent) {""")

# ── light chassis patrol the trails (part 3) ─────────────────────────────────
patch(p,
"""const PATROLS = Object.freeze({
  frontier_corridor: Object.freeze({
    0: [[48, 56], [60, 56], [58, 63], [56, 70]],
    1: [[79, 56], [67, 56], [69, 63], [71, 70]],
  }),
  riverline: Object.freeze({
    0: [[44, 33], [52, 63], [44, 94], [36, 63]],
    1: [[83, 33], [75, 63], [83, 94], [91, 63]],
  }),
});

function patrolTarget(agent, tick, profileName = "frontier_corridor", mirrored = false) {
  const set = PATROLS[profileName] ?? PATROLS.frontier_corridor;
  // 11P: in a reflected world each team patrols the OTHER side's routes —
  // legal because the tables are exact mirrors of each other (11C).
  const side = (agent.team === 0) !== mirrored ? 0 : 1;
  const patrol = set[side];
  const phase = ((tick / 80) | 0) + (agent.assetId & 3);
  return patrol[phase % patrol.length];
}""",
"""const PATROLS = Object.freeze({
  frontier_corridor: Object.freeze({
    0: [[48, 56], [60, 56], [58, 63], [56, 70]],
    1: [[79, 56], [67, 56], [69, 63], [71, 70]],
    // 11V: light chassis (scout/bike) run the TRAILS — the flanking loops
    // at rows 40/86 that heavy hulls cross at rough speed. Exact mirrors.
    light0: [[30, 40], [60, 40], [60, 86], [30, 86]],
    light1: [[97, 40], [67, 40], [67, 86], [97, 86]],
  }),
  riverline: Object.freeze({
    0: [[44, 33], [52, 63], [44, 94], [36, 63]],
    1: [[83, 33], [75, 63], [83, 94], [91, 63]],
    // Riverline's main routes already ride the trail columns; the light
    // variant leans harder up and down them.
    light0: [[44, 33], [44, 60], [44, 94], [44, 66]],
    light1: [[83, 33], [83, 60], [83, 94], [83, 66]],
  }),
});

function patrolTarget(agent, tick, profileName = "frontier_corridor", mirrored = false, light = false) {
  const set = PATROLS[profileName] ?? PATROLS.frontier_corridor;
  // 11P: in a reflected world each team patrols the OTHER side's routes —
  // legal because the tables are exact mirrors of each other (11C).
  const side = (agent.team === 0) !== mirrored ? 0 : 1;
  const patrol = (light ? set[`light${side}`] : null) ?? set[side];
  const phase = ((tick / 80) | 0) + (agent.assetId & 3);
  return patrol[phase % patrol.length];
}""")
patch(p,
"""      if (!target && agent && this.difficulty !== AI_HARD) {
        target = patrolTarget(agent, state.tick, state.mapProfile, this.mirrored);
      } else if (!target) {
        const relay = nearestUnownedRelay(state, asset);
        if (relay) target = [relay.cellX, relay.cellY];
        else if (agent) target = patrolTarget(agent, state.tick, state.mapProfile, this.mirrored);
      }""",
"""      // 11V: fast, path-loving chassis take the trail routes.
      const lightRunner = !stats.heavy && stats.speed >= 56;
      if (!target && agent && this.difficulty !== AI_HARD) {
        target = patrolTarget(agent, state.tick, state.mapProfile, this.mirrored, lightRunner);
      } else if (!target) {
        const relay = nearestUnownedRelay(state, asset);
        if (relay) target = [relay.cellX, relay.cellY];
        else if (agent) target = patrolTarget(agent, state.tick, state.mapProfile, this.mirrored, lightRunner);
      }""")
print("11V patched")
