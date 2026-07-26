def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

patch("client/index.html",
"""            <button class="btn team-b" id="btn-join-b">Join Team B (red, east)</button>""",
"""            <button class="btn team-b" id="btn-join-b">Join Team B (red, east)</button>
            <button class="btn" id="btn-spectate">Spectate (watch the whole war)</button>""")

p = "client/js/client.js"
patch(p,
"""  document.getElementById("btn-join-b").onclick = () => joinTeam(1);""",
"""  document.getElementById("btn-join-b").onclick = () => joinTeam(1);
  document.getElementById("btn-spectate").onclick = spectate; // 10A""")
patch(p,
"""    } else if (msg.type === "s_joined") {""",
"""    } else if (msg.type === "s_spectating") { // 10A: omniscient read-only seat
      joined = { operatorId: -1, team: -1, spectator: true };
      autoSelectSent = true; // nothing to crew
      document.getElementById("join-overlay").style.display = "none";
      pushEvent("Spectating — you see everything, you touch nothing.");
    } else if (msg.type === "s_joined") {""")
patch(p,
"""function joinTeam(team) {
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "c_join", team, playerId: myPlayerId() }));
}""",
"""function joinTeam(team) {
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "c_join", team, playerId: myPlayerId() }));
}

function spectate() { // 10A
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "c_spectate" }));
}""")
print("10A client patched")
