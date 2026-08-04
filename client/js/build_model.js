// client/js/build_model.js — W4-4 (prompt 174): the PLACEMENT GHOST.
// The status panel has answered "why am I not firing" since 14I, but a
// refused BUILD simply never happened: you held the key, nothing
// appeared, and the two-lane road law is invisible from the cockpit.
//
// DESIGN NOTE — this deliberately does NOT mirror the engine's rules
// the way fog_model mirrors LOS. fog_model has to duplicate, because
// LOS needs the full asset list and the client legitimately cannot
// have it. Placement law needs only PUBLIC geography — terrain, bases,
// sites, prisons, standard homes, the mission gate, and structures
// that are public by ruling (Q45/Q50) — every one of which already
// rides the view. So we call the REAL law with a view-shaped state and
// there is nothing to drift: one implementation, one truth. The
// parity test pins that this stays true.

import { buildRejection } from "../../engine/sandbags.js";
import { deployRejection } from "../../engine/mines.js";
import { getUnitStats } from "../../engine/units.js";

// The engine's placement predicates read a handful of PUBLIC state
// fields. Assemble exactly those from what the client legitimately
// holds: the once-delivered terrain (s_map) plus the fog-filtered view.
export function placementState(view, cachedMap) {
  return {
    map: cachedMap,
    sandbags: view?.sandbags ?? [],
    mines: view?.mines ?? [],
    bases: view?.bases ?? [],
    sites: view?.sites ?? [],
    prisons: view?.prisons ?? [],
    standards: view?.standards ?? [],
    mission: view?.mission ?? null,
  };
}

// kind: "sandbag" | "mine". Returns { ok, reason } — reason is the
// engine's own rejection string, so the ghost can never promise
// something the server will refuse (or refuse something it would
// allow).
export function placementVerdict(view, cachedMap, asset, kind, cellX, cellY) {
  if (!asset || !cachedMap) return { ok: false, reason: "no asset" };
  const state = placementState(view, cachedMap);
  const stats = getUnitStats(asset.type);
  const reason = kind === "mine"
    ? deployRejection(state, asset, stats, cellX, cellY)
    : buildRejection(state, asset, stats, cellX, cellY);
  return { ok: reason === null, reason };
}

// Ghost tint for the renderer: green = the server will accept this,
// red = it will refuse and here is why.
export const GHOST_OK = 0x4fbf5f;
export const GHOST_BAD = 0xc7443e;

export function ghostColor(verdict) {
  return verdict.ok ? GHOST_OK : GHOST_BAD;
}
