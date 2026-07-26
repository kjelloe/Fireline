import { t, hasKey } from "./strings.js";
// client/js/feedback_model.js — order feedback + war resolution text (slice 8H).
// Pure mapping from reducer events to human-readable, team-perspective text.
// Every rejection reason the reducer can emit has a line here (pinned by test).

// 15B: rejection texts live in strings.js catalogs (en/no). This proxy
// keeps the historic REJECTION_TEXT contract (8H sweeps it) while t()
// serves the active locale.
export const REJECTION_TEXT = new Proxy({}, {
  get: (_, reason) =>
    typeof reason === "string" && hasKey(`rej.${reason}`) ? t(`rej.${reason}`) : undefined,
  has: (_, reason) => typeof reason === "string" && hasKey(`rej.${reason}`),
});

export function describeRejection(reason) {
  if (hasKey(`rej.${reason}`)) return t(`rej.${reason}`);
  return t("rej.fallback", { reason });
}


const WIN_REASON_TEXT = Object.freeze({
  0: "war interrupted",
  1: "enemy force eliminated",
  2: "all relays dominated",
  3: "time limit — points decide",
  4: "Command Standard captured",
});

export function describeWinReason(reason) {
  return WIN_REASON_TEXT[reason] ?? "unknown";
}

// Feed line for an event, from `myTeam`'s perspective; null = not feed-worthy.
export function describeEvent(e, myTeam) {
  switch (e?.type) {
    case "rejected": return describeRejection(e.reason);
    case "operator_unboarded": return `Operator ${e.operatorId} hopped off.`;
    case "option_set": return null;
    case "hardpoint_deploying": return t("ev.hardpoint_deploying");
    case "hardpoint_active": return t("ev.hardpoint_active");
    case "hardpoint_undeploying": return t("ev.hardpoint_undeploying");
    case "hardpoint_stowed": return t("ev.hardpoint_stowed");
    case "site_shelled": return `Relay ${e.siteId} under artillery fire!`;
    case "site_damaged":
      return `Relay ${e.siteId} is DOWN — a truck with materiel can rebuild it.`;
    case "site_repaired": return `Relay ${e.siteId} rebuilt and humming.`;
    case "site_neutralized":
      return e.byTeam === myTeam
        ? `Relay ${e.siteId} neutralized — hold to capture!`
        : `Relay ${e.siteId} is being taken — defend it!`;
    case "site_captured":
      return e.team === myTeam ? `Relay ${e.siteId} secured.` : `Relay ${e.siteId} lost to the enemy!`;
    case "asset_disabled": return `Asset ${e.assetId} disabled.`;
    case "mine_deployed":
      return e.team === myTeam ? `Mine laid (${e.minesLeft} left in the rack).` : null;
    case "mine_marked": return "Scouts marked an enemy mine.";
    case "mine_detonated": return `MINE! Asset ${e.assetId} hit.`;
    case "mine_cleared": return `Mine cleared by asset ${e.assetId}.`;
    case "ping": {
      const label = (e.kind ?? "").replace(/_/g, " ").toUpperCase();
      return `[PING] ${label} @ (${e.cellX},${e.cellY})`;
    }
    case "drone_launched":
      return "DRONE UP — someone idled too long off supply. Move or shoot it down.";
    case "drone_hit": return `Drone stinging asset ${e.assetId} — move!`;
    case "drone_downed": return `Drone downed by asset ${e.byAssetId}.`;
    case "drone_recalled": return "The drone broke off.";
    case "resupplied": return `Asset ${e.assetId} resupplied.`;
    case "standard_taken":
      return e.byTeam === myTeam ? "WE HAVE THEIR STANDARD! Escort it home!" : "THEY TOOK OUR STANDARD! Stop the carrier!";
    case "standard_dropped": return "The standard is down — race for it!";
    case "standard_returned":
      return e.team === myTeam ? "Our standard is safe at base." : "Enemy standard recovered to their base.";
    case "standard_scored":
      return e.byTeam === myTeam ? "STANDARD CAPTURED — VICTORY!" : "Enemy scored our standard.";
    case "operator_downed": return `Operator ${e.operatorId} is DOWN — crawl to cover, redeploy, or await a carrier.`;
    case "operator_rescued": return `Carrier ${e.byAssetId} picked up operator ${e.operatorId}!`;
    case "operator_delivered": return `Operator ${e.operatorId} delivered safe — take a new asset.`;
    case "operator_redeployed": return `Operator ${e.operatorId} redeployed — take a new asset.`;
    case "operator_returned": return `Operator ${e.operatorId} made it back on foot.`;
    case "crawl_ordered": return null;
    case "tow_started": return `Asset ${e.by} is towing wreck ${e.assetId}.`;
    case "recovery_started": return `Wreck ${e.assetId} in the repair bay.`;
    case "asset_restored": return `Asset ${e.assetId} restored to duty!`;
    case "asset_manufactured": return `Home base rebuilt asset ${e.assetId} — reinforcements!`;
    case "game_over": return null; // handled by the end screen
    default: return null;
  }
}

// 11K: top recognition earners for the end screen. Pure; human seats are
// ids 0-15, AI regents 16-31 — both can earn honors.
export function topOperators(view, n = 3) {
  return (view?.operators ?? [])
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, n)
    .map((o) => {
      const who = o.id < 16 ? `Operator ${o.id}` : `Regent ${o.id}`;
      const side = o.team === 0 ? "A" : "B";
      return `${who} (${side}) — ${o.score} pts`;
    });
}

// End-of-war summary for the overlay.
export function summarizeGameOver(view, myTeam, postgameSeconds = 30) {
  if (!view || view.phase !== 1) return null;
  const title = view.winner === -1 ? "DRAW"
    : view.winner === myTeam ? "VICTORY" : "DEFEAT";
  return {
    title,
    reason: describeWinReason(view.winReason ?? 0),
    scores: view.teamScores ?? [0, 0],
    myTeam,
    nextWarText: `Next war begins in ~${postgameSeconds}s — stay in your seat.`,
  };
}
