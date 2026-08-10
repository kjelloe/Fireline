// engine/vote.js — Q49/Q54: the vote-rotation POOL and candidate
// builder, extracted pure so servers configure it and tests pin it.
//
// Q54 (prompt 116): all COMPLETED maps are vote-able by default, the
// pool is configurable at server start (VOTE_MAPS / VOTE_MODES env),
// changeable at runtime (/rotation), and modes default to ALL ON.

// Maps that have earned promotion (specs/10 gate). Experimental and
// held profiles join when they pass — server owners may still opt
// them in explicitly via VOTE_MAPS.
// riverline PROMOTED 2026-08-10: c54e00a battery 50.6% agg / 46% flip
// rate (better than blackwood's passing read); owner opened rotation
// for group playtesting (prompt 227). sawtooth PROMOTED same day:
// n=600 pooled 54.3% = its a81477c passing read (the 8-pt scare was
// block-1 mirror seed luck); low flip rate is the map's character
// (chokes make wars seed-determined), the ~2.7-pt A-lean is the
// KNOWN global watch-item, not sawtooth's.
export const COMPLETED_MAPS = ["frontier_corridor", "blackwood", "riverline", "sawtooth"];
// "night" is a VARIANT, not a mode — it rides whatever war is running.
export const ALL_MODES = ["standard", "convoy", "heist", "night"];

export function normalizePool(pool = {}, validMaps = null) {
  let maps = Array.isArray(pool.maps) && pool.maps.length ? [...pool.maps] : [...COMPLETED_MAPS];
  if (validMaps) maps = maps.filter((m) => validMaps.includes(m));
  if (!maps.length) maps = [...COMPLETED_MAPS];
  let modes = Array.isArray(pool.modes) && pool.modes.length
    ? pool.modes.filter((m) => ALL_MODES.includes(m)) : [...ALL_MODES];
  if (!modes.length) modes = ["standard"];
  return { maps, modes };
}

// Up to three candidates: the status quo FIRST (silence changes
// nothing — a dedicated mode server keeps its mode), then a map
// rotation, then a mode flip on the current map (attacker side
// alternates by war count). A pool without "convoy" never offers the
// flip; a one-map pool never offers rotation.
export function voteCandidates(state, warsStarted, pool) {
  const { maps, modes } = normalizePool(pool);
  const cur = state.mapProfile;
  const curMode = state.rules?.mode ?? 0;
  const out = [
    { map: cur, mode: curMode, modeAttacker: state.rules?.modeAttacker ?? 0 },
  ];
  const idx = maps.indexOf(cur);
  const other = maps[(Math.max(idx, 0) + 1) % maps.length];
  if (other && other !== cur) out.push({ map: other, mode: 0 });
  // The mode-flip candidate: a running mode offers the way back to
  // standard; a standard war offers the next enabled mode, cycling by
  // war count so convoy and heist share the slot fairly.
  if (curMode !== 0) {
    out.push({ map: cur, mode: 0 });
  } else {
    // W4-10 (Q80): NIGHT shares this third slot rather than adding a
    // fourth. It is a VARIANT — same map, same mode, lights out — so
    // it belongs beside the mode flips in the "something different"
    // position, and the ballot stays the three choices the UI and the
    // Q54 law were built around. Never offered while already at night.
    const flips = [];
    if (modes.includes("convoy")) flips.push({ mode: 1 });
    if (modes.includes("heist")) flips.push({ mode: 2 });
    if (modes.includes("night") && state.rules?.nightWar !== true) flips.push({ night: true });
    if (flips.length) {
      const pick = flips[warsStarted % flips.length];
      out.push(pick.night
        ? { map: cur, mode: 0, modeAttacker: 0, night: true }
        : { map: cur, mode: pick.mode, modeAttacker: warsStarted & 1 });
    }
  }
  return out;
}
