// client/js/objective_model.js — "what do I do now?" (post-playtest slice).
// Pure view-derived guidance: standard status lines, relay tally, and one
// prioritized hint. Born from LAN playtest #1: "did not understand what was
// relay, no text on screen". Node-testable; renderer just prints it.

const STD_AT_BASE = 0, STD_CARRIED = 1, STD_DROPPED = 2, STD_SCORED = 3;

export function ownStandardLine(view, myTeam) {
  const st = (view?.standards ?? []).find((s) => s.team === myTeam);
  if (!st) return "";
  switch (st.status) {
    case STD_AT_BASE: return "Your standard: SAFE at base";
    case STD_CARRIED: return "Your standard: STOLEN — stop the carrier!";
    case STD_DROPPED: return "Your standard: DROPPED — touch it to recover";
    case STD_SCORED: return "Your standard: LOST";
    default: return "";
  }
}

export function enemyStandardLine(view, myTeam) {
  const st = (view?.standards ?? []).find((s) => s.team !== myTeam);
  if (!st) return "";
  switch (st.status) {
    case STD_AT_BASE: return "Their standard: at their base — go steal it";
    case STD_CARRIED: return "Their standard: WE HAVE IT — escort it home!";
    case STD_DROPPED: return "Their standard: dropped in the field — grab it";
    case STD_SCORED: return "Their standard: CAPTURED!";
    default: return "";
  }
}

export function relayTally(view, myTeam) {
  const sites = view?.sites ?? [];
  const yours = sites.filter((s) => s.owner === myTeam).length;
  const theirs = sites.filter((s) => s.owner !== myTeam && s.owner !== -1).length;
  return { yours, theirs, neutral: sites.length - yours - theirs, total: sites.length };
}

// One hint, highest-priority first. This is presentation guidance only.
export function currentHint(view, myTeam) {
  const own = (view?.standards ?? []).find((s) => s.team === myTeam);
  const enemy = (view?.standards ?? []).find((s) => s.team !== myTeam);
  if (enemy?.status === STD_CARRIED) {
    return own?.status === STD_AT_BASE
      ? "ESCORT the carrier into your command zone to WIN"
      : "You hold their standard — but RECOVER YOURS or you cannot score";
  }
  if (own?.status === STD_CARRIED) return "STOP the enemy carrier before they score";
  if (own?.status === STD_DROPPED) return "Touch your dropped standard to send it home";
  const relays = relayTally(view, myTeam);
  if (relays.yours < relays.total) {
    return "Capture RELAY masts — they project the supply you need to fight forward";
  }
  return "Push for their Command Standard";
}

// The join briefing, shown once per war (playtest: nobody reads a hint bar).
export function briefingText(myTeam) {
  const teamName = myTeam === 0 ? "GREEN (west)" : "RED (east)";
  return [
    `You fight for ${teamName}.`,
    "WIN: steal the enemy Command Standard (tall banner) and carry it into your base zone while your own standard is home.",
    "RELAYS (masts on the road) project supply — out of supply you crawl and cannot fire.",
    "Enemies are hidden by fog until your units get close. Wrecks can be towed home and repaired.",
    "Click: your unit = take it · ground = move · enemy = fire · friendly wreck = tow.",
  ].join("\n");
}

// Auto-crew (playtest: players didn't know to take an asset): pick the
// lowest-id free, operable friendly asset — or null when nothing to do.
export function autoSelectTarget(view, myOperatorId) {
  const mine = (view?.friendlyAssets ?? []).some((a) => a.operatorId === myOperatorId);
  if (mine) return null;
  const free = (view?.friendlyAssets ?? [])
    .filter((a) => a.state !== 2 && a.state !== 3 && a.operatorId === -1)
    .sort((a, b) => a.id - b.id);
  return free.length ? free[0].id : null;
}
