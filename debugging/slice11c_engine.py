# Slice 11C: AI doctrine — hunt & guard (prompt 16 Q1, Q2d, Q14).
# 1) fire doctrine prioritizes enemy standard-carriers (Q2d),
# 2) a unit stung by a drone shoots it down (Q14),
# 3) role-based garage crewing: an unfilled RAIDER role lets any free AI
#    seat crew a spare carrier, beyond fixed pairings (Q1).

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

p = "engine/ai_regency.js"

# Q2d: standard-carriers outrank proximity in target selection.
patch(p,
"""  for (const enemy of state.assets) {
    if (enemy.team === asset.team || isWreck(enemy)) continue;
    if (!visibleSet.has(enemy.id)) continue;
    if (!inFireRange(asset, enemy)) continue;
    const dx = enemy.x - asset.x;
    const dy = enemy.y - asset.y;
    const key = dx * dx + dy * dy;
    if (best === null || key < bestKey || (key === bestKey && enemy.id < best.id)) {
      best = enemy;
      bestKey = key;
    }
  }
  return best;
}""",
"""  // Q2d (prompt 16): an enemy CARRYING a standard is the priority target —
  // the ruled counter to the mutual-carry standoff. Rank: carrier-of-standard
  // first, then nearest, ties on lowest id.
  const carryingIds = new Set(
    state.standards.filter((st) => st.carrierAssetId !== -1).map((st) => st.carrierAssetId)
  );
  let bestCarries = false;
  for (const enemy of state.assets) {
    if (enemy.team === asset.team || isWreck(enemy)) continue;
    if (!visibleSet.has(enemy.id)) continue;
    if (!inFireRange(asset, enemy)) continue;
    const carries = carryingIds.has(enemy.id);
    const dx = enemy.x - asset.x;
    const dy = enemy.y - asset.y;
    const key = dx * dx + dy * dy;
    const better =
      best === null ||
      (carries && !bestCarries) ||
      (carries === bestCarries && (key < bestKey || (key === bestKey && enemy.id < best.id)));
    if (better) {
      best = enemy;
      bestKey = key;
      bestCarries = carries;
    }
  }
  return best;
}""")

# Q14: swat the drone stinging you before anything else (direct guns only).
patch(p,
"""      if (dutyOpen && asset.reloadTimer === 0 && asset.ammo > 0 && inSupply(state, asset)) {
        const target = pickFireTarget(state, asset, visibleByTeam[asset.team]);
        if (target) {
          commands.push({ type: CMD_FIRE_ORDER, operatorId, targetAssetId: target.id });
          continue;
        }
      }""",
"""      if (dutyOpen && asset.reloadTimer === 0 && asset.ammo > 0 && inSupply(state, asset)) {
        // Q14 (prompt 16): a drone stinging THIS asset gets swatted first —
        // cheap shot, ends the pestering. Indirect tubes can't track it.
        if (!getUnitStats(asset.type).indirect) {
          const pest = state.drones.find(
            (d) => d.targetAssetId === asset.id && inFireRange(asset, d)
          );
          if (pest) {
            commands.push({ type: CMD_FIRE_ORDER, operatorId, targetDroneId: pest.id });
            continue;
          }
        }
        const target = pickFireTarget(state, asset, visibleByTeam[asset.team]);
        if (target) {
          commands.push({ type: CMD_FIRE_ORDER, operatorId, targetAssetId: target.id });
          continue;
        }
      }""")

# Q1: role-based crewing — an unfilled raider role pulls a free carrier out
# of the garage, whoever the seat is.
patch(p,
"""      if (operator.state === OP_ACTIVE && operator.assetId === -1) {
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
          commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: pick, confirm: true });
        }
        continue;
      }""",
"""      if (operator.state === OP_ACTIVE && operator.assetId === -1) {
        let pick = null;
        const team = operator.team;
        // Q1 (prompt 16): "AI may crew free assets when a ROLE is unfilled."
        // No crewed operable carrier on the team → the raider role is empty:
        // ANY free seat grabs a spare carrier before its default pick.
        const roleCarrier = raiderFor[team] === -1
          ? state.assets.find((a) =>
              a.team === team && a.operatorId === -1 && !isWreck(a) &&
              getUnitStats(a.type).canCarryStandard)
          : null;
        if (roleCarrier) {
          pick = roleCarrier.id;
        } else if (agent) {
          const paired = state.assets[agent.assetId];
          if (paired && paired.operatorId === -1 && !isWreck(paired)) pick = paired.id;
        } else {
          const free = state.assets.find((a) =>
            a.team === team &&
            a.operatorId === -1 && !isWreck(a));
          if (free) pick = free.id;
        }
        if (pick !== null) {
          commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: pick, confirm: true });
        }
        continue;
      }""")
print("11C patched")
