// client/js/ping_model.js — pure context-ping option model (10C, spec 02 §14).
// "Context replaces irrelevant options": what the 1/2/3 keys offer depends on
// what your seat is doing right now. Pure data in, data out — testable.

const DEFAULTS = [
  { kind: "attack", label: "ATTACK HERE" },
  { kind: "defend", label: "DEFEND HERE" },
  { kind: "rally", label: "RALLY ON ME" },
];

export function pingOptionsFor(view, operatorId) {
  if ((view?.downedOperators ?? []).some((d) => d.operatorId === operatorId)) {
    return [{ kind: "need_rescue", label: "NEED RESCUE" }];
  }
  const me = (view?.friendlyAssets ?? []).find((a) => a.operatorId === operatorId);
  if (!me) return DEFAULTS;

  const options = [];
  if ((view?.standards ?? []).some((st) => st.carrierAssetId === me.id)) {
    options.push(
      { kind: "need_escort", label: "ESCORT THE STANDARD" },
      { kind: "carrier_under_attack", label: "CARRIER UNDER ATTACK" }
    );
  } else if (me.type === 4) {
    options.push({ kind: "carrier_under_attack", label: "CARRIER UNDER ATTACK" });
  }
  const towing = (view?.friendlyAssets ?? []).some((a) => a.towedBy === me.id);
  if (towing) {
    options.push(
      { kind: "recovery_in_progress", label: "RECOVERY IN PROGRESS" },
      { kind: "need_escort", label: "NEED ESCORT" },
      { kind: "road_blocked", label: "ROAD BLOCKED" }
    );
  }
  if (me.type === 1) {
    options.push(
      { kind: "mines_detected", label: "MINES DETECTED" },
      { kind: "safe_route", label: "SAFE ROUTE MARKED" }
    );
  }
  if (me.type === 3 && !towing) {
    options.push({ kind: "road_blocked", label: "ROAD BLOCKED" });
  }
  for (const d of DEFAULTS) {
    if (options.length >= 3) break;
    if (!options.some((o) => o.kind === d.kind)) options.push(d);
  }
  return options.slice(0, 3);
}
