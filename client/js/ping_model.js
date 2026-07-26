// client/js/ping_model.js — pure context-ping option model (10C, spec 02 §14).
// "Context replaces irrelevant options": what the 1/2/3 keys offer depends on
// what your seat is doing right now. Pure data in, data out — testable.

import { t } from "./strings.js";

const DEFAULTS = () => [
  { kind: "attack", label: t("ping.attack") },
  { kind: "defend", label: t("ping.defend") },
  { kind: "rally", label: t("ping.rally") },
];

export function pingOptionsFor(view, operatorId) {
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
  for (const d of DEFAULTS()) {
    if (options.length >= 3) break;
    if (!options.some((o) => o.kind === d.kind)) options.push(d);
  }
  return options.slice(0, 3);
}
