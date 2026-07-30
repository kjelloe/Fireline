// engine/pings.js — Slice 10C (plan 2.3): context pings, spec 02 §14.
// Bounded team signals: a seat pings a kind + place, the TEAM sees it in
// the feed/world for a few seconds, the enemy never does (toTeam-scoped
// events). Anti-spam is deterministic: a per-operator cooldown in hashed
// state. The v2.0 kind subset is deliberately small; context menus grow later.

export const PING_COOLDOWN_TICKS = 30; // one ping per seat per 3 s
export const PING_TTL_TICKS = 50;      // client display lifetime (5 s)

// v2.0 vocabulary subset (spec 02 §14 examples, trimmed to what the war
// already has systems for).
export const PING_KINDS = Object.freeze([
  "attack",               // hit this place
  "defend",               // hold this place
  "rally",                // form up here
  "need_escort",          // standard runs / rescue tows want cover
  "recovery_in_progress", // truck calling its tow
  "mines_detected",       // scout marking danger ground
  "carrier_under_attack", // the standard run is in trouble (Q16)
  "road_blocked",         // route intel (Q16)
  "safe_route",           // scout-marked clean path (Q16)
  "need_supplies",        // 14I: the fuel/ammo mission request
  "need_rescue",          // downed operator calling the carrier (OP_DOWN only)
  "thanks",               // B5: social glue — acknowledge the rescue/escort
  "need_gunner",          // prompt-100: my hull has an open crew station
]);

// Downed seats may only cry for rescue; driving seats say anything BUT that
// (their rescue calls are the carrier-facing escort/recovery kinds).
export function pingRejection(operatorState, OP_ACTIVE, OP_DOWN, kind) {
  if (operatorState === OP_DOWN) {
    return kind === "need_rescue" ? null : "only rescue pings while down";
  }
  if (operatorState !== OP_ACTIVE) return "operator not active";
  return kind === "need_rescue" ? "not downed" : null;
}

// Which pings are still alive for display at `tick`.
export function activePings(pings, tick) {
  return pings.filter((p) => tick - p.tick < PING_TTL_TICKS);
}
