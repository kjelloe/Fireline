// client/js/ping_model.js — pure context-ping option model (10C, spec 02 §14).
// "Context replaces irrelevant options": what the 1/2/3 keys offer depends on
// what your seat is doing right now. Pure data in, data out — testable.

import { t } from "./strings.js";

const DEFAULTS = () => [
  { kind: "attack", label: t("ping.attack") },
  { kind: "defend", label: t("ping.defend") },
  { kind: "rally", label: t("ping.rally") },
];

// The UNSLICED context list — what this seat could meaningfully say.
// pingOptionsFor (the 1/2/3 keys) takes the top three; wheelOptionsFor
// (B5) takes all of it.
function contextOptionsFor(view, operatorId) {
  if ((view?.downedOperators ?? []).some((d) => d.operatorId === operatorId)) {
    return [{ kind: "need_rescue", label: t("ping.need_rescue") }];
  }
  const me = (view?.friendlyAssets ?? []).find((a) => a.operatorId === operatorId);
  if (!me) return DEFAULTS();

  const options = [];
  if ((view?.standards ?? []).some((st) => st.carrierAssetId === me.id)) {
    options.push(
      { kind: "need_escort", label: t("ping.escort_standard") },
      { kind: "carrier_under_attack", label: t("ping.carrier_under_attack") }
    );
  } else if (me.type === 4) {
    options.push({ kind: "carrier_under_attack", label: t("ping.carrier_under_attack") });
  }
  const towing = (view?.friendlyAssets ?? []).some((a) => a.towedBy === me.id);
  if (towing) {
    options.push(
      { kind: "recovery_in_progress", label: t("ping.recovery_in_progress") },
      { kind: "need_escort", label: t("ping.need_escort") },
      { kind: "road_blocked", label: t("ping.road_blocked") }
    );
  }
  if (me.type === 1) {
    options.push(
      { kind: "mines_detected", label: t("ping.mines_detected") },
      { kind: "safe_route", label: t("ping.safe_route") }
    );
  }
  if (me.type === 3 && !towing) {
    options.push({ kind: "road_blocked", label: t("ping.road_blocked") });
  }
  // Prompt-100: driving a station hull with the seat open — put out
  // the call (the owner's "driver alert" half of the seat UX).
  if (me.stationOp === -1 && (me.type === 4 || me.type === 1)) {
    options.push({ kind: "need_gunner", label: t("ping.need_gunner") });
  }
  return options;
}

export function pingOptionsFor(view, operatorId) {
  const options = contextOptionsFor(view, operatorId);
  if (options.length === 1 && options[0].kind === "need_rescue") return options;
  for (const d of DEFAULTS()) {
    if (options.length >= 3) break;
    if (!options.some((o) => o.kind === d.kind)) options.push(d);
  }
  return options.slice(0, 3);
}

// B5 comm wheel: the FULL context vocabulary, not the 1/2/3 top-three.
// Same context logic (the wheel of a downed seat is just NEED RESCUE),
// padded with the defaults + the always-available social kinds, capped
// at 8 sectors and deduped. Pure — the wheel renderer just draws it.
export function wheelOptionsFor(view, operatorId) {
  const out = contextOptionsFor(view, operatorId);
  if (out.length === 1 && out[0].kind === "need_rescue") return out;
  const extras = [
    ...DEFAULTS(),
    { kind: "need_supplies", label: t("ping.need_supplies") },
    { kind: "thanks", label: t("ping.thanks") },
  ];
  for (const e of extras) {
    if (out.length >= 8) break;
    if (!out.some((o) => o.kind === e.kind)) out.push(e);
  }
  return out;
}
