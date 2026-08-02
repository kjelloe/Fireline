import { t } from "./strings.js";
import { MAP_PREMIUM, MAP_TICKET_OFFSET } from "../../engine/premium.js";
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
// opts.canCarry: whether the player's current chassis can take the enemy
// standard (9A: Command Carriers only).
export function currentHint(view, myTeam, opts = {}) {
  // Convoy Escort mode: one mission, one hint per side, with the clock.
  if (view?.mission?.kind === 1 || view?.mission?.kind === 2) {
    const m = view.mission;
    const mins = Math.max(0, Math.floor(m.timerTicks / 600));
    const secs = Math.max(0, Math.floor((m.timerTicks % 600) / 10));
    const clock = `${mins}:${String(secs).padStart(2, "0")}`;
    const kind = m.kind === 1 ? "convoy" : "heist";
    return myTeam === m.attacker
      ? t(`hint.${kind}_attack`, { clock })
      : t(`hint.${kind}_defend`, { clock });
  }
  const own = (view?.standards ?? []).find((s) => s.team === myTeam);
  const enemy = (view?.standards ?? []).find((s) => s.team !== myTeam);
  if (enemy?.status === STD_CARRIED) {
    return own?.status === STD_AT_BASE
      ? "ESCORT the carrier into your command zone to WIN"
      : "You hold their standard — but RECOVER YOURS or you cannot score";
  }
  if (own?.status === STD_CARRIED) return "STOP the enemy carrier before they score";
  if (own?.status === STD_DROPPED) return "Touch your dropped standard to send it home";
  if (opts.canCarry === false &&
      (enemy?.status === STD_AT_BASE || enemy?.status === STD_DROPPED)) {
    return "Only a COMMAND CARRIER can take their standard — crew one or escort it";
  }
  const relays = relayTally(view, myTeam);
  if (relays.yours < relays.total) {
    return "Capture RELAY masts — they project the supply you need to fight forward";
  }
  return "Push for their Command Standard";
}

// The join briefing, shown once per war (playtest: nobody reads a hint bar).
// The underdog premium (prompt-68) must be DISCLOSED — a hidden
// handicap system reads as favouritism the day someone finds it.
export function briefingText(myTeam, faction = null, mapProfile = null, mission = null) {
  const teamName = faction
    ? `${faction.name.toUpperCase()} — ${faction.tacticalIdentity}`
    : myTeam === 0 ? "GREEN (west)" : "RED (east)";
  const premiumTeam = mapProfile != null ? MAP_PREMIUM[mapProfile] : undefined;
  const offset = mapProfile != null ? MAP_TICKET_OFFSET[mapProfile] : undefined;
  return [
    t("brief.fight_for", { name: teamName }),
    ...(faction ? [faction.line] : []),
    ...(mission?.kind === 1 || mission?.kind === 2
      ? [mission.attacker === myTeam
          ? t(mission.kind === 1 ? "brief.convoy_attack" : "brief.heist_attack")
          : t(mission.kind === 1 ? "brief.convoy_defend" : "brief.heist_defend")]
      : [t("brief.win")]),
    t("brief.relays"),
    t("brief.fog"),
    t("brief.clicks"),
    ...(premiumTeam === myTeam ? [t("brief.premium_underdog")] : []),
    ...(premiumTeam !== undefined && premiumTeam !== myTeam ? [t("brief.premium_favoured")] : []),
    ...(offset?.team === myTeam ? [t("brief.offset_underdog", { n: offset.tickets })] : []),
    ...(offset !== undefined && offset.team !== myTeam ? [t("brief.offset_favoured", { n: offset.tickets })] : []),
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
