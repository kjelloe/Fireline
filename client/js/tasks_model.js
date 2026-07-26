// client/js/tasks_model.js — public tasks (plan 2.4, spec 02 §15) as a
// PURE view-model. Tasks derive from the team's fog-filtered view, so
// they can never leak what the team doesn't legitimately know — the
// mission cards are a reading of the war, not new state. Clicking a card
// jumps the camera and sends the matching context ping (10C), which is
// how "responding" reads on the team channel for v2.0.

const CELL = 256;

function cellOf(worldX) {
  return Math.floor(worldX / CELL);
}

// Priority: what loses the war fastest comes first (spec 02 §15 urgency).
export function tasksFor(view, myOperatorId = null) {
  const tasks = [];
  const myTeam = view?.team;
  const std = (view?.standards ?? []);
  const own = std.find((s) => s.team === myTeam);
  const enemy = std.find((s) => s.team !== myTeam);

  if (own && own.status === 1) { // STD_CARRIED — by the enemy
    tasks.push({
      kind: "stop_thief", priority: 0,
      label: "STOP THE THIEF — our standard is moving",
      cellX: cellOf(own.x), cellY: cellOf(own.y), ping: "attack",
    });
  }
  if (own && own.status === 2) { // STD_DROPPED
    tasks.push({
      kind: "secure_standard", priority: 1,
      label: "Secure our standard — it lies in the open",
      cellX: cellOf(own.x), cellY: cellOf(own.y), ping: "recovery_in_progress",
    });
  }
  if (enemy && enemy.status === 1 && enemy.carrierAssetId !== -1) {
    const carrier = (view?.friendlyAssets ?? []).find((a) => a.id === enemy.carrierAssetId);
    if (carrier) {
      tasks.push({
        kind: "escort_carrier", priority: 2,
        label: "Escort the standard run home",
        cellX: cellOf(carrier.x), cellY: cellOf(carrier.y), ping: "need_escort",
      });
    }
  }
  for (const d of (view?.downedOperators ?? [])) {
    if (d.operatorId === myOperatorId) continue; // your card is the R prompt
    tasks.push({
      kind: "rescue", priority: 3,
      label: `Rescue operator ${d.operatorId} — a carrier can pick them up`,
      // need_rescue is downed-seats-only (10C); a standing responder RALLIES.
      cellX: cellOf(d.x), cellY: cellOf(d.y), ping: "rally",
    });
  }
  // Own relays being flipped by the enemy: defend.
  for (const s of (view?.sites ?? [])) {
    if (s.owner === myTeam && s.capturingTeam !== -1 && s.capturingTeam !== myTeam) {
      tasks.push({
        kind: "defend_relay", priority: 4,
        label: `Defend relay ${s.id} — the flag is dropping`,
        cellX: s.cellX, cellY: s.cellY, ping: "defend",
      });
    }
    if (s.hp === 0 && s.owner !== (myTeam === 0 ? 1 : 0)) {
      tasks.push({
        kind: "repair_site", priority: 6,
        label: `Rebuild relay ${s.id} — a truck with materiel can fix it`,
        cellX: s.cellX, cellY: s.cellY, ping: "road_blocked",
      });
    }
  }
  // Claimable friendly wrecks: the rescue fantasy's bread and butter.
  const myAsset = (view?.friendlyAssets ?? []).find((a) => a.operatorId === myOperatorId);
  for (const a of (view?.friendlyAssets ?? [])) {
    if (a.state !== 2 && a.state !== 3) continue;
    if (a.recoverTimer > 0) continue;
    if (myAsset && a.towedBy === myAsset.id) {
      // 11U: you're on it — the card flips to in-progress.
      tasks.push({
        kind: "towing_now", priority: 2, mine: true,
        label: `Towing asset ${a.id} — head home`,
        cellX: cellOf(a.x), cellY: cellOf(a.y), ping: "recovery_in_progress",
      });
    } else if (a.towedBy === -1) {
      tasks.push({
        kind: "recover", priority: 5,
        label: `Recover asset ${a.id} — tow it home`,
        cellX: cellOf(a.x), cellY: cellOf(a.y), ping: "recovery_in_progress",
      });
    }
  }
  tasks.sort((x, y) => x.priority - y.priority ||
    x.cellX - y.cellX || x.cellY - y.cellY);
  return tasks.map((t, i) => ({ ...t, id: `${t.kind}:${t.cellX},${t.cellY}`, rank: i }));
}
