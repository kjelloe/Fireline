# Slice 15C: a11y basics (prompt 31). High-contrast mode, UI font
# scaling, and basic key remapping — all in the ⚙ panel, all persisted.
# Pure-presentation: no engine, no repin.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── keybinds: a pure, remappable action->key table ───────────────────────────
open("client/js/keybinds.js", "w").write('''// client/js/keybinds.js — Slice 15C: remappable action keys. Pure table +
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
''')

# ── client: binds replace hardcoded action keys; a11y modes ─────────────────
p = "client/js/client.js"
patch(p,
"""import { t, setLocale, getLocale } from "./strings.js";""",
"""import { t, setLocale, getLocale } from "./strings.js";
import { DEFAULT_BINDS, loadBinds, saveBinds } from "./keybinds.js";""")
patch(p,
"""const teamPings = []; // 10C: recent own-team pings for world labels""",
"""const teamPings = []; // 10C: recent own-team pings for world labels
let BINDS = loadBinds(); // 15C: remappable action keys""")
patch(p,
"""    if (e.key === "r" || e.key === "R") send({ type: "redeploy" }); // 9B""",
"""    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; // 15C binds
    if (k === BINDS.redeploy) send({ type: "redeploy" }); // 9B""")
patch(p,
"""    if (e.key === "b" || e.key === "B") {
      const carrier = adjacentBoardableCarrier(interpolator.latest());
      if (carrier) send({ type: "board_carrier", carrierAssetId: carrier.id });
    }
    if (e.key === "u" || e.key === "U") send({ type: "unboard" });""",
"""    if (k === BINDS.board) {
      const carrier = adjacentBoardableCarrier(interpolator.latest());
      if (carrier) send({ type: "board_carrier", carrierAssetId: carrier.id });
    }
    if (k === BINDS.unboard) send({ type: "unboard" });""")
patch(p,
"""    // 12B: H toggles the Sentinel's hardpoint.
    if (e.key === "h" || e.key === "H") {""",
"""    // 12B: H toggles the Sentinel's hardpoint.
    if (k === BINDS.hardpoint) {""")
patch(p,
"""    if (e.key === "t" || e.key === "T") {
      const wreck = adjacentTowableWreck(interpolator.latest());
      if (wreck) send({ type: "tow_order", wreckAssetId: wreck.id });
    }""",
"""    if (k === BINDS.tow) {
      const wreck = adjacentTowableWreck(interpolator.latest());
      if (wreck) send({ type: "tow_order", wreckAssetId: wreck.id });
    }""")
patch(p,
"""    if (e.key === "v" || e.key === "V") {
      const needy = adjacentNeedyFriendly(interpolator.latest());
      if (needy) send({ type: "transfer_cargo", targetAssetId: needy.id });
    }""",
"""    if (k === BINDS.transfer) {
      const needy = adjacentNeedyFriendly(interpolator.latest());
      if (needy) send({ type: "transfer_cargo", targetAssetId: needy.id });
    }""")
patch(p,
"""    if (e.key === "g" || e.key === "G") {
      directMode = !directMode;""",
"""    if (k === BINDS.directDrive) {
      directMode = !directMode;""")
patch(p,
"""    if (e.key === "m" || e.key === "M") send({ type: "deploy_mine" });""",
"""    if (k === BINDS.mine) send({ type: "deploy_mine" });""")
patch(p,
"""    if (e.key === "c" || e.key === "C") {
      const v = interpolator.latest();
      const mine = nearestAdjacentMine(v);
      if (mine) send({ type: "clear_mine", mineId: mine.id });
    }""",
"""    if (k === BINDS.clearMine) {
      const v = interpolator.latest();
      const mine = nearestAdjacentMine(v);
      if (mine) send({ type: "clear_mine", mineId: mine.id });
    }""")

# a11y modes: contrast + font scale, persisted, applied at boot.
patch(p,
"""  // 15B: locale — restore, and offer the switch in ⚙.""",
"""  // 15C: a11y — restore contrast/scale, wire the ⚙ controls.
  applyA11y();
  const contrastEl = document.getElementById("opt-contrast");
  if (contrastEl) {
    contrastEl.checked = localStorage.getItem("mf_contrast") === "1";
    contrastEl.onchange = (e) => {
      localStorage.setItem("mf_contrast", e.target.checked ? "1" : "0");
      applyA11y();
    };
  }
  const scaleEl = document.getElementById("opt-fontscale");
  if (scaleEl) {
    scaleEl.value = localStorage.getItem("mf_fontscale") ?? "1";
    scaleEl.onchange = (e) => {
      localStorage.setItem("mf_fontscale", e.target.value);
      applyA11y();
    };
  }
  const bindsEl = document.getElementById("opt-binds");
  if (bindsEl) {
    renderBindRows(bindsEl);
  }

  // 15B: locale — restore, and offer the switch in ⚙.""")
patch(p,
"""function joinTeam(team) {""",
"""// 15C: apply contrast + font scale via a body class and CSS variable.
function applyA11y() {
  const contrast = localStorage.getItem("mf_contrast") === "1";
  document.body.classList.toggle("high-contrast", contrast);
  const scale = Number(localStorage.getItem("mf_fontscale") ?? "1");
  document.documentElement.style.setProperty("--ui-scale", String(scale));
}

// 15C: one row per action — click, press a key, done.
function renderBindRows(container) {
  container.innerHTML = "";
  for (const action of Object.keys(DEFAULT_BINDS)) {
    const row = document.createElement("button");
    row.className = "btn";
    row.style.cssText = "font-size:12px; padding:2px 8px; margin:2px;";
    row.textContent = `${action}: ${BINDS[action].toUpperCase()}`;
    row.onclick = () => {
      row.textContent = `${action}: press a key…`;
      const grab = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.key.length === 1) {
          BINDS[action] = ev.key.toLowerCase();
          saveBinds(BINDS);
        }
        window.removeEventListener("keydown", grab, true);
        renderBindRows(container);
      };
      window.addEventListener("keydown", grab, true);
    };
    container.appendChild(row);
  }
}

function joinTeam(team) {""")

# index.html: ⚙ controls + contrast/scale CSS.
patch("client/index.html",
"""        <label style="color:#cdc; font-family:sans-serif; font-size:14px;">
            Language / Språk:""",
"""        <label style="color:#cdc; font-family:sans-serif; font-size:14px; cursor:pointer;">
            <input type="checkbox" id="opt-contrast">
            High contrast / Høy kontrast
        </label>
        <label style="color:#cdc; font-family:sans-serif; font-size:14px;">
            Text size / Tekststørrelse:
            <select id="opt-fontscale">
                <option value="1">100%</option>
                <option value="1.25">125%</option>
                <option value="1.5">150%</option>
            </select>
        </label>
        <div style="color:#887; font-family:sans-serif; font-size:12px;">Keys / Taster:</div>
        <div id="opt-binds" style="max-width:420px; text-align:center;"></div>
        <label style="color:#cdc; font-family:sans-serif; font-size:14px;">
            Language / Språk:""")
src = open("client/index.html").read()
assert "--ui-scale" not in src
patch("client/index.html",
"""</head>""",
"""<style>
  :root { --ui-scale: 1; }
  #hint-bar, #objective-strip, #event-feed, #op-info, #supply-bar,
  #task-strip, #action-banner, #status-bar {
    font-size: calc(1em * var(--ui-scale));
  }
  body.high-contrast #hint-bar, body.high-contrast #objective-strip,
  body.high-contrast #event-feed, body.high-contrast #op-info,
  body.high-contrast #supply-bar, body.high-contrast #status-bar {
    background: #000 !important; color: #fff !important;
  }
  body.high-contrast #action-banner { background: #000; border: 2px solid #fff; }
  body.high-contrast #task-strip div { background: #000 !important; color: #fff !important; }
</style>
</head>""")
print("15C patched")
