// client/js/status_model.js — Slice 14I: the "why am I not firing?"
// panel (playtest 6, item 3). Pure: takes YOUR asset from the view and
// answers the questions a confused commander actually asks, worst first.
// Levels: "bad" (blocking), "warn" (about to block), "info" (state).

import { UNIT_STATS } from "../../engine/units.js";

export function statusFor(asset, { inSupplyNow = true } = {}) {
  if (!asset) return null;
  const stats = UNIT_STATS[asset.type] ?? UNIT_STATS[0];
  const reasons = [];
  const add = (key, params, level) => reasons.push({ key, params: params ?? null, level });

  if (asset.fuel <= 0) add("status.no_fuel", null, "bad");
  else if (asset.fuel <= 800) add("status.low_fuel", { n: asset.fuel }, "warn");
  if (asset.ammo <= 0) add("status.no_ammo", null, "bad");
  else if (asset.ammo <= 3) add("status.low_ammo", { n: asset.ammo }, "warn");
  if (!inSupplyNow) add("status.no_supply", null, "bad");
  if (asset.reloadTimer > 0) add("status.reloading", { s: Math.ceil(asset.reloadTimer / 10) }, "info");
  if (asset.suppressedTimer > 0) add("status.suppressed", { s: Math.ceil(asset.suppressedTimer / 10) }, "warn");
  if (asset.deployTimer > 0) {
    add(asset.deployed === 1 ? "status.deploying" : "status.undeploying",
      { s: Math.ceil(asset.deployTimer / 10) }, "info");
  } else if (asset.deployed === 1) {
    add("status.deployed", null, "info");
  }

  return {
    name: `${(UNIT_STATS[asset.type]?.name ?? "unit").toUpperCase()} ${asset.id}`,
    hp: asset.hp,
    hpMax: stats.hp,
    ammo: asset.ammo,
    ammoMax: 12,
    fuel: asset.fuel,
    fuelMax: 4000,
    cargo: stats.canTow ? { fuel: asset.cargoFuel ?? 0, ammo: asset.cargoAmmo ?? 0 } : null,
    reasons,
    // The fuel-mission button: meaningfully low, and not already at home.
    canRequestSupplies: asset.ammo <= 3 || asset.fuel <= 800,
  };
}
