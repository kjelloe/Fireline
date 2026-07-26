p = "client/js/objective_model.js"
src = open(p).read()
src = src.replace("""// One hint, highest-priority first. This is presentation guidance only.
export function currentHint(view, myTeam) {
  const own = (view?.standards ?? []).find((s) => s.team === myTeam);
  const enemy = (view?.standards ?? []).find((s) => s.team !== myTeam);
  if (enemy?.status === STD_CARRIED) {
    return own?.status === STD_AT_BASE
      ? "ESCORT the carrier into your command zone to WIN"
      : "You hold their standard — but RECOVER YOURS or you cannot score";
  }
  if (own?.status === STD_CARRIED) return "STOP the enemy carrier before they score";
  if (own?.status === STD_DROPPED) return "Touch your dropped standard to send it home";
  const relays = relayTally(view, myTeam);
  if (relays.yours < relays.total) {
    return "Capture RELAY masts — they project the supply you need to fight forward";
  }
  return "Push for their Command Standard";
}""",
"""// One hint, highest-priority first. This is presentation guidance only.
// opts.canCarry: whether the player's current chassis can take the enemy
// standard (9A: Command Carriers only).
export function currentHint(view, myTeam, opts = {}) {
  const own = (view?.standards ?? []).find((s) => s.team === myTeam);
  const enemy = (view?.standards ?? []).find((s) => s.team !== myTeam);
  if (enemy?.status === STD_CARRIED) {
    return own?.status === STD_AT_BASE
      ? "ESCORT the carrier into your command zone to WIN"
      : "You hold their standard — but RECOVER YOURS or you cannot score";
  }
  if (own?.status === STD_CARRIED) return "STOP the enemy carrier before they score";
  if (own?.status === STD_DROPPED) return "Touch your dropped standard to send it home";
  if (opts.canCarry === false &&
      (enemy?.status === STD_AT_BASE || enemy?.status === STD_DROPPED)) {
    return "Only a COMMAND CARRIER can take their standard — crew one or escort it";
  }
  const relays = relayTally(view, myTeam);
  if (relays.yours < relays.total) {
    return "Capture RELAY masts — they project the supply you need to fight forward";
  }
  return "Push for their Command Standard";
}""")
open(p, "w").write(src)

p = "client/js/client.js"
src = open(p).read()
src = src.replace("""function updateObjectiveStrip(view) {
  if (!joined) return;
  document.getElementById("obj-hint").innerText = currentHint(view, joined.team);""",
"""function updateObjectiveStrip(view) {
  if (!joined) return;
  const own = view.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  document.getElementById("obj-hint").innerText =
    currentHint(view, joined.team, { canCarry: own ? own.type === 4 : false });""")
open(p, "w").write(src)

# briefing text: mention carrier role
p = "client/js/objective_model.js"
src = open(p).read()
src = src.replace('"WIN: steal the enemy Command Standard (tall banner) and carry it into your base zone while your own standard is home.",',
'"WIN: a COMMAND CARRIER must take the enemy standard (tall banner) home while your own standard is safe. Trucks tow wrecks; everyone escorts.",')
open(p, "w").write(src)
print("hint wired")
