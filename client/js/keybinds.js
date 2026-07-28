// client/js/keybinds.js — Slice 15C: remappable action keys. Pure table +
// lookup; the ⚙ panel writes overrides to localStorage. Camera keys
// (WASD-pan/arrows/F/Home/X) and mode keys stay fixed — these are the
// ACTION keys a player might need on a different layout.

export const DEFAULT_BINDS = Object.freeze({
  redeploy: "r",
  tow: "t",
  board: "b",
  unboard: "u",
  mine: "m",
  clearMine: "c",
  transfer: "v",
  hardpoint: "h",
  directDrive: "g",
  // Playtest-8 item 31: the hover tip's "stats" link is unclickable in
  // practice — reaching for it moves the pointer off the unit and the
  // tip vanishes. So: a key. NOT "s" as suggested, because s is a WASD
  // pan key (holding s while reading stats would drag the camera); "i"
  // for info is free, and this is remappable like every other bind.
  stats: "i",
});

export function loadBinds(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem("mf_binds");
    if (!raw) return { ...DEFAULT_BINDS };
    const saved = JSON.parse(raw);
    const binds = { ...DEFAULT_BINDS };
    for (const k of Object.keys(binds)) {
      if (typeof saved[k] === "string" && saved[k].length === 1) binds[k] = saved[k];
    }
    return binds;
  } catch {
    return { ...DEFAULT_BINDS };
  }
}

export function saveBinds(binds, storage = globalThis.localStorage) {
  storage?.setItem("mf_binds", JSON.stringify(binds));
}

// True when `key` (already lowercased) triggers `action` under `binds` —
// and never lets one key serve two actions (first declaration wins).
export function matches(binds, action, key) {
  return binds[action] === key;
}
