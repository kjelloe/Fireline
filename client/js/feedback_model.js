// client/js/feedback_model.js — order feedback + war resolution text (slice 8H).
// Pure mapping from reducer events to human-readable, team-perspective text.
// Every rejection reason the reducer can emit has a line here (pinned by test).

export const REJECTION_TEXT = Object.freeze({
  "operator already active": "That command seat is taken.",
  "operator not active": "Join the war first.",
  "no such asset": "No such asset.",
  "asset belongs to other team": "That asset fights for the enemy.",
  "asset already operated": "A teammate is driving that one.",
  "no asset selected": "Take an asset first (click one or press Next asset).",
  "asset not operable": "Your asset is out of action.",
  "no such target": "No such target.",
  "friendly target": "Hold fire — that one is ours.",
  "target not operable": "Target is already a wreck.",
  "reloading": "Weapon reloading.",
  "out of ammo": "Out of ammo — resupply at base.",
  "out of supply": "Out of supply — hold a relay or fall back.",
  "target out of range": "Target out of range.",
  "target not spotted": "No spotter on that target.",
  "no line of sight": "No line of sight.",
  "no such wreck": "Nothing to tow there.",
  "not a wreck": "That unit doesn't need a tow.",
  "enemy wreck": "We don't tow enemy scrap.",
  "already under tow": "Someone already has that wreck in tow.",
  "already recovering": "That wreck is already in the repair bay.",
  "already towing": "You're already towing a wreck.",
  "wreck out of reach": "Get adjacent to the wreck to hook it up.",
  "needs a logistics truck": "Only a logistics truck can tow — switch to one.",
  "not downed": "You are not on foot.",
  "too far to crawl": "Too far — downed operators can only crawl a short way.",
  "still recovering nerve": "Hold on — redeploy unlocks a few seconds after going down.",
  "cannot deploy mines": "Only an assault tank carries mines.",
  "no mines left": "Mine rack empty.",
  "mine already here": "A mine already sits on this ground.",
  "cannot mine a base zone": "Base zones are protected — no mining here.",
  "cannot mine a site": "Sites are protected — no mining here.",
  "cannot clear mines": "Only a logistics truck can clear mines.",
  "no such mine": "No mine there.",
  "too far to clear": "Get adjacent to the mine to clear it.",
  "mine not marked": "Unknown minefield — a scout must mark it first.",
  "unknown ping kind": "That signal is not in the book.",
  "ping cooling down": "Signal lamp recharging — a moment.",
  "only rescue pings while down": "On foot you can only call for rescue.",
  "ping needs a target cell": "Pick a spot on the map to signal about.",
  "takeover needs confirmation":
    "That asset carries real responsibility — press ENTER to confirm the takeover, ESC to cancel.",
  "no such drone": "That drone is already gone.",
  "cannot track aircraft": "Artillery cannot track aircraft — use a direct gun.",
  "war is over": "The war is over — next one starts shortly.",
});

export function describeRejection(reason) {
  return REJECTION_TEXT[reason] ?? `Order rejected: ${reason}`;
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
