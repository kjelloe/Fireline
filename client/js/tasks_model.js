import { t } from "./strings.js";
import { UNIT_STATS } from "../../engine/units.js";
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
      label: t("task.stop_thief"),
      cellX: cellOf(own.x), cellY: cellOf(own.y), ping: "attack",
    });
  }
  if (own && own.status === 2) { // STD_DROPPED
    tasks.push({
      kind: "secure_standard", priority: 1,
      label: t("task.secure_standard"),
      cellX: cellOf(own.x), cellY: cellOf(own.y), ping: "recovery_in_progress",
    });
  }
  if (enemy && enemy.status === 1 && enemy.carrierAssetId !== -1) {
    const carrier = (view?.friendlyAssets ?? []).find((a) => a.id === enemy.carrierAssetId);
    if (carrier) {
      tasks.push({
        kind: "escort_carrier", priority: 2,
        label: t("task.escort_carrier"),
        cellX: cellOf(carrier.x), cellY: cellOf(carrier.y), ping: "need_escort",
      });
    }
  }
  for (const d of (view?.downedOperators ?? [])) {
    if (d.operatorId === myOperatorId) continue; // your card is the R prompt
    tasks.push({
      kind: "rescue", priority: 3,
      label: t("task.rescue", { id: d.operatorId }),
      // need_rescue is downed-seats-only (10C); a standing responder RALLIES.
      cellX: cellOf(d.x), cellY: cellOf(d.y), ping: "rally",
    });
  }
  // Own relays being flipped by the enemy: defend.
  for (const s of (view?.sites ?? [])) {
    if (s.owner === myTeam && s.capturingTeam !== -1 && s.capturingTeam !== myTeam) {
      tasks.push({
        kind: "defend_relay", priority: 4,
        label: t("task.defend_relay", { id: s.id }),
        cellX: s.cellX, cellY: s.cellY, ping: "defend",
      });
    }
    if (s.hp === 0 && s.owner !== (myTeam === 0 ? 1 : 0)) {
      tasks.push({
        kind: "repair_site", priority: 6,
        label: t("task.repair_site", { id: s.id }),
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
      // 11U: you're on it — the card flips to in-progress. Playtest-7
      // item 18: the card TARGETS THE DROPOFF (your base repair bay),
      // so the golden ring marks where the haul must land.
      const home = (view?.bases ?? []).find((b) => b.team === myAsset.team);
      tasks.push({
        kind: "towing_now", priority: 2, mine: true, dropoff: true,
        label: t("task.towing_now", { id: a.id }),
        cellX: home ? home.x + ((home.width / 2) | 0) : cellOf(a.x),
        cellY: home ? home.y + ((home.height / 2) | 0) : cellOf(a.y),
        ping: "recovery_in_progress",
      });
    } else if (a.towedBy === -1) {
      tasks.push({
        kind: "recover", priority: 5,
        label: t("task.recover", { id: a.id }),
        cellX: cellOf(a.x), cellY: cellOf(a.y), ping: "recovery_in_progress",
      });
    }
  }
  // 14J (playtest 6.10): missions fit the asset you are driving.
  // - capability filter: recover/repair need a truck, rescue pickup needs
  //   bunks; combat/standard cards apply to everyone.
  // - one card per KIND: the nearest instance to your asset wins.
  const my = (view?.friendlyAssets ?? []).find((a) => a.operatorId === myOperatorId);
  const dist = (task) => my
    ? Math.max(Math.abs(cellOf(my.x) - task.cellX), Math.abs(cellOf(my.y) - task.cellY))
    : 0;
  let fitted = tasks;
  if (my) {
    const stats = UNIT_STATS[my.type] ?? {};
    fitted = tasks.filter((task) => {
      if (task.kind === "recover" || task.kind === "repair_site") return !!stats.canTow;
      if (task.kind === "rescue") return (stats.capacity ?? 0) > 0;
      return true; // stop_thief/secure/escort/defend/towing_now: everyone
    });
  }
  const byKind = new Map();
  for (const task of fitted) {
    const held = byKind.get(task.kind);
    if (!held || dist(task) < dist(held)) byKind.set(task.kind, task);
  }
  const out = [...byKind.values()];
  out.sort((x, y) => x.priority - y.priority ||
    x.cellX - y.cellX || x.cellY - y.cellY);
  return out.map((t, i) => ({
    ...t, id: `${t.kind}:${t.cellX},${t.cellY}`, rank: i, distance: dist(t),
  }));
}
