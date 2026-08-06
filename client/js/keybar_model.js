// client/js/keybar_model.js — prompt 211: the on-screen KEY BAR, pure.
// Mobile has no keyboard, and the game keeps saying "press J". This
// model answers, from the fog-filtered view alone, WHICH action keys
// this player's current embodiment can use right now:
//
//   ready — tap does the thing now
//   gray  — the chassis carries the action but it is momentarily
//           unavailable (no adjacent wreck, rack empty, countdown)
//
// Keys the chassis can NEVER use are absent (context-curated, cap 8,
// stable order). blinkKey (the action banner's or tutorial's current
// suggestion) marks its entry blink:true — only when ready: a blinking
// gray button would be a lie. The DOM taps synthesize real keydown
// events, so keyboard and bar share ONE dispatch contract; "sandbag"
// rides the fixed N key (not a bind), resolved DOM-side.

import { UNIT_STATS } from "../../engine/units.js";

const CELL = 256;
const DISABLED = 2, SALVAGED = 3;

const cellOf = (w) => Math.floor(w / CELL);
const adjacent = (a, b, cells = 1) =>
  Math.max(Math.abs(cellOf(a.x) - cellOf(b.x)), Math.abs(cellOf(a.y) - cellOf(b.y))) <= cells;

// Stable presentation order (the hint-bar's narrative order).
const ORDER = ["redeploy", "board", "unboard", "station", "tow", "transfer",
  "mine", "clearMine", "sandbag", "hardpoint", "directDrive"];

export function keyBarFor(view, operatorId, { blinkKey = null } = {}) {
  if (!view || operatorId === null || operatorId === undefined) return [];
  const entries = [];
  const add = (action, ready) => entries.push({ action, ready: ready === true });

  const down = view.downedOperators?.find((d) => d.operatorId === operatorId);
  const mine = view.friendlyAssets?.find((a) => a.operatorId === operatorId);
  const operable = (a) => a.state !== DISABLED && a.state !== SALVAGED;
  const aboard = view.friendlyAssets?.find((a) =>
    (a.aboard1 === operatorId || a.aboard2 === operatorId) && operable(a));
  const stationed = view.friendlyAssets?.find((a) =>
    a.stationOp === operatorId && operable(a));

  if (down) {
    // R unlocks after the crawl-first window (REDEPLOY_TICKS = 100).
    add("redeploy", (down.downTicks ?? 0) >= 100);
  } else if (stationed) {
    add("station", true); // J leaves the mount
  } else if (aboard) {
    add("unboard", true);
    if (UNIT_STATS[aboard.type]?.station && aboard.stationOp === -1) {
      add("station", true); // J mans the ring from the bunk
    }
  } else if (mine && operable(mine)) {
    const stats = UNIT_STATS[mine.type] ?? {};
    const wreckAdj = view.friendlyAssets?.some((a) =>
      a.id !== mine.id && a.state === DISABLED && a.towedBy === -1 && adjacent(a, mine));
    const carrierAdj = view.friendlyAssets?.some((a) =>
      a.id !== mine.id && operable(a) && (UNIT_STATS[a.type]?.capacity ?? 0) > 0 &&
      (a.aboard1 === -1 || a.aboard2 === -1) && adjacent(a, mine));
    const needyAdj = view.friendlyAssets?.some((a) =>
      a.id !== mine.id && operable(a) && (a.ammo < 12 || a.fuel < 2400) && adjacent(a, mine));
    add("redeploy", true);
    if (carrierAdj) add("board", true);
    if (stats.canTow) {
      add("tow", wreckAdj);
      add("transfer", ((mine.cargoFuel ?? 0) > 0 || (mine.cargoAmmo ?? 0) > 0) && needyAdj);
      add("clearMine", true);
    }
    if (stats.canMine) add("mine", (mine.minesLeft ?? 0) > 0);
    else if ((mine.caltropsLeft ?? 0) > 0) add("mine", true); // M strews caltrops on light hulls
    if ((mine.sandbagsLeft ?? 0) > 0) add("sandbag", true);
    if (stats.deployable) add("hardpoint", mine.deployTimer === 0);
    if (stats.station && mine.stationOp !== -1) {
      add("station", true); // J starts the gunner eject (Q41)
    }
    add("directDrive", true);
  } else {
    return []; // bodiless: the status panel narrates; no keys apply
  }

  entries.sort((a, b) => ORDER.indexOf(a.action) - ORDER.indexOf(b.action));
  const capped = entries.slice(0, 8);
  for (const e of capped) e.blink = e.action === blinkKey && e.ready;
  return capped;
}
