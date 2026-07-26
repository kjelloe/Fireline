# Slice 11K: Recognition scoring (prompt 19 confirmation of the table).
# Per-operator score for verified reducer facts — rescue > kill (spec):
# tow-complete 8, operator rescue (delivery) 10, standard return 10,
# standard capture 25, relay capture 10, kill 5. Auto-returns and
# mine/drone kills award nobody (no operator behind them).

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

p = "engine/reducer.js"
patch(p,
"""// Scoring (3E): what a capture or a kill is worth on the war clock scoreboard.
export const SCORE_CAPTURE = 10;
export const SCORE_DISABLE = 5;""",
"""// Scoring (3E): what a capture or a kill is worth on the war clock scoreboard.
export const SCORE_CAPTURE = 10;
export const SCORE_DISABLE = 5;

// 11K Recognition scoring (prompt 19): per-OPERATOR credit for verified
// reducer facts. Rescue work outranks kills by design (spec 04 §4).
export const RECOG_TOW = 8;
export const RECOG_RESCUE = 10;
export const RECOG_STANDARD_RETURN = 10;
export const RECOG_STANDARD_CAPTURE = 25;
export const RECOG_RELAY = 10;
export const RECOG_KILL = 5;

function awardOperator(next, operatorId, points) {
  if (operatorId === -1 || operatorId === undefined) return;
  const seat = next.operators[operatorId];
  if (seat) seat.score += points;
}""")

# Kill credit: at the fire call site (mine/drone kills have no operator).
patch(p,
"""  if (target.hp === 0) disableAsset(next, target, attacker.team);
  return next;
}""",
"""  if (target.hp === 0) {
    disableAsset(next, target, attacker.team);
    awardOperator(next, attacker.operatorId, RECOG_KILL); // 11K
  }
  return next;
}""")

# Standard capture: the carrier's operator.
patch(p,
"""    if (carrier && canScore(next, carrier)) {
      st.status = STD_SCORED;
      st.carrierAssetId = -1;
      next.events.push({ type: "standard_scored", standardId: st.id, byTeam: carrier.team });
    }""",
"""    if (carrier && canScore(next, carrier)) {
      st.status = STD_SCORED;
      st.carrierAssetId = -1;
      awardOperator(next, carrier.operatorId, RECOG_STANDARD_CAPTURE); // 11K
      next.events.push({ type: "standard_scored", standardId: st.id, byTeam: carrier.team });
    }""")

# Manual standard return: the returning asset's operator (auto-return: nobody).
patch(p,
"""      next.events.push({ type: "standard_returned", standardId: returnable.id, team: asset.team });""",
"""      awardOperator(next, asset.operatorId, RECOG_STANDARD_RETURN); // 11K
      next.events.push({ type: "standard_returned", standardId: returnable.id, team: asset.team });""")

# Tow complete: the tower's operator, the moment the wreck enters the bay.
patch(p,
"""    if (wreck.towedBy !== -1 && inOwnBase(next, wreck)) {
      wreck.towedBy = -1;
      wreck.recoverTimer = REPAIR_TICKS;
      next.events.push({ type: "recovery_started", assetId: wreck.id });
    }""",
"""    if (wreck.towedBy !== -1 && inOwnBase(next, wreck)) {
      awardOperator(next, next.assets[wreck.towedBy]?.operatorId, RECOG_TOW); // 11K
      wreck.towedBy = -1;
      wreck.recoverTimer = REPAIR_TICKS;
      next.events.push({ type: "recovery_started", assetId: wreck.id });
    }""")

# Rescue: the carrier's operator, on DELIVERY (boarding alone scores
# nothing — no board/unboard point farming).
patch(p,
"""    for (const slot of ["aboard1", "aboard2"]) {
      const operatorId = carrier[slot];
      if (operatorId === -1) continue;
      carrier[slot] = -1;
      const seat = next.operators[operatorId];
      seat.state = OP_ACTIVE;
      seat.assetId = -1;
      next.events.push({ type: "operator_delivered", operatorId });
    }""",
"""    for (const slot of ["aboard1", "aboard2"]) {
      const operatorId = carrier[slot];
      if (operatorId === -1) continue;
      carrier[slot] = -1;
      const seat = next.operators[operatorId];
      seat.state = OP_ACTIVE;
      seat.assetId = -1;
      awardOperator(next, carrier.operatorId, RECOG_RESCUE); // 11K
      next.events.push({ type: "operator_delivered", operatorId });
    }""")

# Relay capture: every operator standing the flag out gets the credit.
patch(p,
"""      } else if (site.owner === -1 && site.captureProgress >= SITE_CAPTURE_TICKS) {
        site.owner = team;
        site.captureProgress = 0;
        site.capturingTeam = -1;
        next.teamScores[team] += SCORE_CAPTURE;
        next.events.push({ type: "site_captured", siteId: site.id, team });
      }""",
"""      } else if (site.owner === -1 && site.captureProgress >= SITE_CAPTURE_TICKS) {
        site.owner = team;
        site.captureProgress = 0;
        site.capturingTeam = -1;
        next.teamScores[team] += SCORE_CAPTURE;
        for (const a of next.assets) { // 11K: whoever stood the flag out
          if (a.team === team && a.operatorId !== -1 &&
              captureCheck(next, a.id)?.id === site.id) {
            awardOperator(next, a.operatorId, RECOG_RELAY);
          }
        }
        next.events.push({ type: "site_captured", siteId: site.id, team });
      }""")

# Views: a public scoreboard (operator scores are team-neutral facts).
patch("engine/view.js",
"""  return {
    tick: state.tick,
    team,""",
"""  // 11K: the public scoreboard — recognition is meant to be SEEN.
  const operators = state.operators
    .filter((o) => o.state !== 0)
    .map((o) => ({ id: o.id, team: o.team, score: o.score }));

  return {
    tick: state.tick,
    team,
    operators,""")
print("11K patched")
