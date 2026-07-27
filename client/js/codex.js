// client/js/codex.js — Slice 14I: the seed of the game encyclopedia
// (playtest 6, item 1). Pure: chassis facts derived straight from the
// engine's UNIT_STATS contract plus a role blurb — the hover stats panel
// reads this, and a future "encyclopedia" option button gets it free.

import { UNIT_STATS } from "../../engine/units.js";
import { chassisName } from "./asset_resolver.js";

const ROLES = {
  tank: "Direct combat and route pressure. Lays mines near owned relays.",
  scout: "Reconnaissance: reveals contacts, marks mines, rides the trails.",
  artillery: "Indirect siege fire — the ONLY gun that can breach relays. Needs a spotter.",
  logistics: "The war's busiest hull: tows wrecks, clears mines, repairs relays, hauls fuel and shells.",
  carrier: "Rescue and the standard run: the ONLY chassis that can take the enemy standard.",
  bike: "Courier: fastest thing on wheels; cannot capture or contest relays.",
  mortar: "Mobile indirect fire that keeps up with a push. No siege, no anti-air.",
  sentinel: "Directorate hardpoint: deploy to trade mobility for artillery-class direct reach.",
  skimmer: "Outlier airboat: Riverline Drive — crosses water at trail speed.",
};

export function codexFor(type) {
  const stats = UNIT_STATS[type];
  if (!stats) return null;
  const name = chassisName(type);
  const lines = [
    ["speed", stats.speed],
    ["hp", stats.hp],
    ["damage", stats.deployable ? `${stats.damage} / ${stats.deployedDamage} deployed` : stats.damage],
    ["range", stats.deployable
      ? `${stats.range / 256} / ${stats.deployedRange / 256} cells deployed`
      : `${stats.range / 256} cells${stats.minRange ? ` (dead zone ${stats.minRange / 256})` : ""}`],
    ["reload", `${stats.reloadTicks / 10}s`],
  ];
  const traits = [];
  if (stats.indirect) traits.push("indirect fire");
  if (stats.siege) traits.push("breaches relays");
  if (stats.canTow) traits.push("tows wrecks");
  if (stats.canCarryStandard) traits.push("carries the standard");
  if (stats.capacity > 0) traits.push(`${stats.capacity} rescue bunks`);
  if (stats.canMine) traits.push("lays mines");
  if (stats.canClearMines) traits.push("clears mines");
  if (stats.canCapture === false) traits.push("cannot capture relays");
  if (stats.heavy) traits.push("no trail bonus (heavy)");
  if (stats.amphibious) traits.push("crosses water (Riverline Drive)");
  if (stats.deployable) traits.push("Deploy Hardpoint");
  return { type, name, role: ROLES[name] ?? "", lines, traits };
}
