def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

patch("client/index.html",
"""            <button class="btn" id="btn-next-asset">Next asset</button>
            <button class="btn" id="btn-recenter">Center</button>""",
"""            <button class="btn" id="btn-next-asset">Next asset</button>
            <button class="btn" id="btn-recenter">Center</button>
            <button class="btn" id="btn-settings" title="Options">⚙</button>""")
patch("client/index.html",
"""    <div id="end-overlay" """,
"""    <div id="settings-overlay" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.75); z-index:9; flex-direction:column; align-items:center; justify-content:center; gap:12px;">
        <h2 style="margin:0; letter-spacing:2px;">OPTIONS</h2>
        <label style="color:#cdc; font-family:sans-serif; font-size:15px; cursor:pointer;">
            <input type="checkbox" id="opt-auto-rescue" checked>
            Automatic rescue pickup (carriers scoop you up when adjacent)
        </label>
        <p style="color:#887; font-family:sans-serif; font-size:12px; max-width:460px; text-align:center;">
            When off: while down, crawl next to a friendly carrier and press
            <b>B</b> to board. Press <b>U</b> to hop out of a carrier anywhere.
        </p>
        <button class="btn" id="btn-settings-close">Close (Esc)</button>
    </div>
    <div id="end-overlay" """)

p = "client/js/client.js"
patch(p,
"""  document.getElementById("btn-spectate").onclick = spectate; // 10A""",
"""  document.getElementById("btn-spectate").onclick = spectate; // 10A
  // 11G: settings panel.
  const settingsOverlay = document.getElementById("settings-overlay");
  document.getElementById("btn-settings").onclick = () => {
    settingsOverlay.style.display = settingsOverlay.style.display === "flex" ? "none" : "flex";
  };
  document.getElementById("btn-settings-close").onclick = () => {
    settingsOverlay.style.display = "none";
  };
  document.getElementById("opt-auto-rescue").onchange = (e) => {
    send({ type: "set_option", option: "auto_rescue", value: e.target.checked ? 1 : 0 });
  };""")
patch(p,
"""    if (e.key === "r" || e.key === "R") send({ type: "redeploy" }); // 9B""",
"""    if (e.key === "r" || e.key === "R") send({ type: "redeploy" }); // 9B
    // 11G manual rescue: B boards the adjacent carrier, U hops out.
    if (e.key === "b" || e.key === "B") {
      const carrier = adjacentBoardableCarrier(interpolator.latest());
      if (carrier) send({ type: "board_carrier", carrierAssetId: carrier.id });
    }
    if (e.key === "u" || e.key === "U") send({ type: "unboard" });""")
patch(p,
"""function nearestAdjacentMine(view) {""",
"""// 11G: the friendly carrier (free bunk) next to MY downed body, if any.
function adjacentBoardableCarrier(view) {
  const me = view?.downedOperators?.find((d) => d.operatorId === joined?.operatorId);
  if (!me) return null;
  return (view?.friendlyAssets ?? []).find((a) =>
    a.type === 4 && a.state !== STATE_DISABLED &&
    (a.aboard1 === -1 || a.aboard2 === -1) &&
    Math.max(Math.abs(Math.floor(a.x / CELL) - Math.floor(me.x / CELL)),
             Math.abs(Math.floor(a.y / CELL) - Math.floor(me.y / CELL))) <= 1) ?? null;
}

function nearestAdjacentMine(view) {""")
patch(p,
"""    upsertWorldLabel(`down${d.operatorId}`,
      d.operatorId === joined?.operatorId ? "YOU ARE DOWN — R TO REDEPLOY" : "OPERATOR DOWN",
      "#ffd75e", d.x / CELL + 0.5, 1.2, d.y / CELL + 0.5);""",
"""    const mine = d.operatorId === joined?.operatorId;
    const canBoard = mine && adjacentBoardableCarrier(view);
    upsertWorldLabel(`down${d.operatorId}`,
      mine
        ? (canBoard ? "CARRIER HERE — B TO BOARD" : "YOU ARE DOWN — R TO REDEPLOY")
        : "OPERATOR DOWN",
      "#ffd75e", d.x / CELL + 0.5, 1.2, d.y / CELL + 0.5);""")
patch("client/index.html",
"1/2/3 context pings",
"1/2/3 context pings · B board / U unboard")
print("11G client patched")
