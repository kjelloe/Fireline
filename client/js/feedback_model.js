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

// B7 death recap: one line naming what killed you and from where —
// "DISABLED — artillery from the north-west". Self-contained from the
// event payload (the killer may be in fog; the reducer tells anyway,
// deliberately — new-player mercy is the point of the recap).
export function deathRecapLine(e) {
  const dir = e.dir >= 0 ? t(`dir.${e.dir}`) : null;
  switch (e.by) {
    case "asset": {
      const chassis = t(`chassis.${e.byType}`);
      return dir ? t("recap.asset", { chassis, dir }) : t("recap.asset_nodir", { chassis });
    }
    case "mine": return t("recap.mine");
    case "drone": return t("recap.drone");
    case "satchel": return dir ? t("recap.satchel", { dir }) : t("recap.satchel_nodir");
    default: return t("recap.unknown");
  }
}


const WIN_REASON_TEXT = Object.freeze({
  0: "war interrupted",
  1: "enemy force eliminated",
  2: "all relays dominated",
  3: "time limit — points decide",
  4: "Command Standard captured",
});

export function describeWinReason(reason) {
  const keys = {
    0: "win.interrupted", 1: "win.elimination", 2: "win.domination",
    3: "win.points", 4: "win.standard", 5: "win.tickets",
  };
  return t(keys[reason] ?? "win.unknown");
}

// Feed line for an event, from `myTeam`'s perspective; null = not feed-worthy.
export function describeEvent(e, myTeam) {
  switch (e?.type) {
    case "rejected": return describeRejection(e.reason);
    case "operator_unboarded": return t("ev.operator_unboarded", { id: e.operatorId });
    case "option_set": return null;
    case "cargo_transferred":
      return t("ev.cargo_transferred", { by: e.byAssetId, id: e.assetId, fuel: e.fuel, ammo: e.ammo });
    case "hardpoint_deploying": return t("ev.hardpoint_deploying");
    case "hardpoint_active": return t("ev.hardpoint_active");
    case "hardpoint_undeploying": return t("ev.hardpoint_undeploying");
    case "hardpoint_stowed": return t("ev.hardpoint_stowed");
    case "site_shelled": return t("ev.site_shelled", { id: e.siteId });
    case "site_damaged": return t("ev.site_damaged", { id: e.siteId });
    case "site_repaired": return t("ev.site_repaired", { id: e.siteId });
    case "bridge_shelled": return t("ev.bridge_shelled", { id: e.bridgeId });
    case "bridge_breached": return t("ev.bridge_breached", { id: e.bridgeId });
    case "bridge_repaired": return t("ev.bridge_repaired", { id: e.bridgeId });
    case "asset_field_repaired":
      return t("ev.asset_field_repaired", { id: e.assetId, by: e.byAssetId, hp: e.hp });
    case "site_neutralized":
      return t(e.byTeam === myTeam ? "ev.site_neutralized_us" : "ev.site_neutralized_them", { id: e.siteId });
    case "site_captured":
      return t(e.team === myTeam ? "ev.site_captured_us" : "ev.site_captured_them", { id: e.siteId });
    case "asset_disabled": return t("ev.asset_disabled", { id: e.assetId });
    case "supply_drop_incoming": return t("ev.drop_incoming");
    case "supply_drop_secured":
      return t(e.byTeam === myTeam ? "ev.drop_secured_us" : "ev.drop_secured_them");
    case "station_boarded":
      return t("ev.station_boarded", { id: e.operatorId, kind: e.kind, aid: e.assetId });
    case "station_left": return t("ev.station_left", { id: e.operatorId });
    case "last_convoy_called":
      return t(e.team === myTeam ? "ev.convoy_called_us" : "ev.convoy_called_them", { n: e.need });
    case "last_convoy_complete":
      return t(e.team === myTeam ? "ev.convoy_complete_us" : "ev.convoy_complete_them", { n: e.evacuated });
    case "mine_deployed":
      return e.team === myTeam ? t("ev.mine_deployed", { n: e.minesLeft }) : null;
    case "mine_marked": return t("ev.mine_marked");
    case "mine_detonated": return t("ev.mine_detonated", { id: e.assetId });
    case "satchel_detonated": return t("ev.satchel", { op: e.operatorId, id: e.assetId });
    case "weather_front":
      return t(e.phase === "in" ? "ev.weather_in" : "ev.weather_out");
    case "mine_cleared": return t("ev.mine_cleared", { id: e.assetId });
    case "ping": {
      const label = (e.kind ?? "").replace(/_/g, " ").toUpperCase();
      return t("ev.ping", { label, x: e.cellX, y: e.cellY });
    }
    case "drone_launched": return t("ev.drone_launched");
    case "drone_hit": return t("ev.drone_hit", { id: e.assetId });
    case "drone_downed": return t("ev.drone_downed", { id: e.byAssetId });
    case "drone_recalled": return t("ev.drone_recalled");
    case "resupplied": return t("ev.resupplied", { id: e.assetId });
    case "standard_taken":
      return t(e.byTeam === myTeam ? "ev.standard_taken_us" : "ev.standard_taken_them");
    case "standard_dropped": return t("ev.standard_dropped");
    case "standard_returned":
      return t(e.team === myTeam ? "ev.standard_returned_us" : "ev.standard_returned_them");
    case "standard_scored":
      return t(e.byTeam === myTeam ? "ev.standard_scored_us" : "ev.standard_scored_them");
    case "operator_downed": return t("ev.operator_downed", { id: e.operatorId });
    case "operator_rescued": return t("ev.operator_rescued", { by: e.byAssetId, id: e.operatorId });
    case "operator_delivered": return t("ev.operator_delivered", { id: e.operatorId });
    case "operator_redeployed": return t("ev.operator_redeployed", { id: e.operatorId });
    case "operator_returned": return t("ev.operator_returned", { id: e.operatorId });
    case "crawl_ordered": return null;
    case "tow_started": return t("ev.tow_started", { by: e.by, id: e.assetId });
    case "recovery_started": return t("ev.recovery_started", { id: e.assetId });
    case "asset_restored": return t("ev.asset_restored", { id: e.assetId });
    case "asset_manufactured": return t("ev.asset_manufactured", { id: e.assetId });
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

// B4 category honors: one award per category, to the operator with the
// most deeds of that kind (count > 0; ties break to the lower id — the
// deterministic convention everywhere else). Deed indices mirror the
// reducer's DEED_* order.
const HONORS = [
  { key: "honor.raider", deeds: [0] },            // kills
  { key: "honor.recovery", deeds: [1, 2] },       // tows + rescues
  { key: "honor.capturer", deeds: [3] },          // relays
  { key: "honor.convoy", deeds: [4, 5] },         // standard return + capture
  { key: "honor.mechanic", deeds: [6] },          // field repairs
  { key: "honor.escort", deeds: [7] },            // escorts (Q26 ruling)
];

export function categoryHonors(view) {
  const out = [];
  for (const h of HONORS) {
    let best = null;
    let bestN = 0;
    // Operators arrive id-ascending, so strict > IS the lowest-id tie-break.
    for (const o of view?.operators ?? []) {
      const n = h.deeds.reduce((s, i) => s + (o.deeds?.[i] ?? 0), 0);
      if (n > bestN) { best = o; bestN = n; }
    }
    if (best && bestN > 0) {
      const who = best.id < 16 ? `Operator ${best.id}` : `Regent ${best.id}`;
      const side = best.team === 0 ? "A" : "B";
      out.push(t(h.key, { who: `${who} (${side})`, n: bestN }));
    }
  }
  return out;
}

// End-of-war summary for the overlay.
export function summarizeGameOver(view, myTeam, postgameSeconds = 30) {
  if (!view || view.phase !== 1) return null;
  const title = view.winner === -1 ? t("end.draw")
    : view.winner === myTeam ? t("end.victory") : t("end.defeat");
  return {
    title,
    reason: describeWinReason(view.winReason ?? 0),
    scores: view.teamScores ?? [0, 0],
    myTeam,
    nextWarText: t("end.next_war", { s: postgameSeconds }),
  };
}
