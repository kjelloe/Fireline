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
// Value of each card in Recognition points — the same table the reducer
// awards from (tow 8, rescue 10, standard return 10, capture 25, relay
// 10, kill 5). Cards that are not themselves a scored deed are placed by
// what they PROTECT: stopping a thief denies a 25-point capture, so it
// leads.
const TASK_VALUE = Object.freeze({
  mission_convoy_deliver: 40, // mode wars: the mission IS the war
  mission_convoy_escort: 40,
  mission_convoy_stop: 40,
  mission_heist_seize: 40,
  mission_heist_guard: 40,
  stop_thief: 25,       // denies the enemy the biggest score in the game
  intruder: 18,         // prompt 221: someone in the wire outranks routine work
  secure_standard: 25,  // our own standard run, same stake
  join_convoy: 20,      // the team's remaining story — above everything but the standard
  secure_drop: 15,      // B6: a one-shot ticket packet with a shared clock
  towing_now: 12,       // a tow already under way beats starting another
  escort_carrier: 11,   // protects the 25-point run without scoring itself
  rescue: 10,           // RECOG_RESCUE
  defend_relay: 10,     // RECOG_RELAY
  recover: 8,           // RECOG_TOW
  repair_site: 8,       // rebuilding infrastructure, tow-class effort
  resupply: 4,          // keeps someone else scoring; below every rescue
  repair_hull: 4,       // RECOG_FIELD_REPAIR - same support tier
  locate_standard: 1,   // prompt 232: the sneak's +1 — always last
});
function taskValue(task) {
  return TASK_VALUE[task.kind] ?? 0;
}

export function tasksFor(view, myOperatorId = null) {
  const tasks = [];
  const myTeam = view?.team;
  const std = (view?.standards ?? []);
  const own = std.find((s) => s.team === myTeam);
  const enemy = std.find((s) => s.team !== myTeam);

  // Prompt 147 (playtest verdict: "I saw no sign of any convoy"): MODE
  // wars carry FIRST-CLASS cards. The mission is the whole war — it
  // outranks every other card and its destination ring shows at any
  // distance (dropoff semantics).
  const m = view?.mission;
  if (m && (m.kind === 1 || m.kind === 2)) {
    if (m.kind === 1) {
      const truck =
        (view?.friendlyAssets ?? []).find((a) => a.id === m.convoyId) ??
        (view?.visibleEnemies ?? []).find((a) => a.id === m.convoyId);
      if (myTeam === m.attacker) {
        tasks.push({
          kind: "mission_convoy_deliver", priority: 0, dropoff: true,
          label: t("task.mission_convoy_deliver"),
          cellX: m.gateCellX, cellY: m.gateCellY, ping: "rally",
        });
        if (truck) tasks.push({
          kind: "mission_convoy_escort", priority: 0,
          label: t("task.mission_convoy_escort"),
          cellX: cellOf(truck.x), cellY: cellOf(truck.y), ping: "rally",
        });
      } else {
        tasks.push({
          kind: "mission_convoy_stop", priority: 0, dropoff: !truck,
          label: t("task.mission_convoy_stop"),
          cellX: truck ? cellOf(truck.x) : m.gateCellX,
          cellY: truck ? cellOf(truck.y) : m.gateCellY, ping: "attack",
        });
      }
    } else {
      const asset = std.find((s) => s.team !== m.attacker);
      if (asset) {
        tasks.push({
          kind: myTeam === m.attacker ? "mission_heist_seize" : "mission_heist_guard",
          priority: 0, dropoff: true,
          label: t(myTeam === m.attacker ? "task.mission_heist_seize" : "task.mission_heist_guard"),
          cellX: cellOf(asset.x), cellY: cellOf(asset.y),
          ping: myTeam === m.attacker ? "attack" : "defend",
        });
      }
    }
  }

  // Prompt 232: the SECONDARY mission — touch their standard at its
  // base for +1, once per war. Standard positions are public (8A), and
  // the once-flag rides the own-team seat projection.
  const mySeat = (view?.operators ?? []).find((o) => o.id === myOperatorId);
  if (enemy && enemy.status === 0 && mySeat && mySeat.stdLocated !== 1) {
    tasks.push({
      kind: "locate_standard", priority: 8,
      label: t("task.locate_standard"),
      cellX: cellOf(enemy.x), cellY: cellOf(enemy.y), ping: "rally",
    });
  }
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
  // LAST CONVOY: my team's emergency card — home is the mission.
  const cv = view?.convoy?.[myTeam];
  if (cv?.active && cv.done < cv.need) {
    const home = (view?.bases ?? []).find((b) => b.team === myTeam);
    if (home) {
      tasks.push({
        kind: "join_convoy", priority: 0,
        label: t("task.join_convoy"),
        cellX: home.x + Math.floor(home.width / 2),
        cellY: home.y + Math.floor(home.height / 2),
        ping: "rally",
      });
    }
  }
  // B6: a live supply drop is EVERYONE's card — first team on it for
  // 10 s takes the packet; the card dies when it is secured (the view
  // stops projecting spent drops).
  for (const drop of view?.drops ?? []) {
    tasks.push({
      kind: "secure_drop", priority: 1,
      label: t("task.secure_drop"),
      cellX: drop.cellX, cellY: drop.cellY, ping: "rally",
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
  // Item 32: a teammate running dry is a JOB, not just their problem.
  // Derived from state (no ping needed), and actionable by the mechanic
  // that already exists — a truck with cargo pulling alongside (13A
  // transfer_cargo). Deliberately NOT a hull-repair card: nothing in the
  // game repairs a damaged living hull, so such a card would be an
  // instruction with no possible action (see specs/07 open questions).
  for (const a of (view?.friendlyAssets ?? [])) {
    if (a.operatorId === myOperatorId) continue; // your own dry tank is your problem
    if (a.state === 2 || a.state === 3) continue; // wrecks are a tow, not a top-up
    const dry = (a.ammo !== undefined && a.ammo <= 3) ||
                (a.fuel !== undefined && a.fuel <= 800);
    if (dry) {
      tasks.push({
        kind: "resupply", priority: 7,
        label: t("task.resupply", { id: a.id }),
        cellX: cellOf(a.x), cellY: cellOf(a.y), ping: "need_supplies",
      });
    }
    // Item 32 (ruled): badly damaged but still fighting - a truck can
    // patch it to half hull. Only worth a card while it is BELOW half,
    // which is exactly when the repair would do something.
    const maxHp = (UNIT_STATS[a.type] ?? {}).hp;
    if (maxHp && a.hp !== undefined && a.hp * 2 < maxHp) {
      tasks.push({
        kind: "repair_hull", priority: 7,
        label: t("task.repair_hull", { id: a.id }),
        cellX: cellOf(a.x), cellY: cellOf(a.y), ping: "need_supplies",
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
  // W4-3 (prompt 174): SURFACE THE HIDDEN SYSTEMS. Two of the game's
  // most dramatic systems were nearly invisible in a normal war — a
  // player could finish a hundred wars without learning either exists.
  //
  // A teammate held prisoner. Prisons are public landmarks BY DESIGN
  // (position, headcount and prisoner identities all ride the view —
  // "the day-one objective must be findable"), so this card is
  // fog-legitimate for free.
  for (const p of (view?.prisons ?? [])) {
    if (p.team === myTeam) continue; // our own compound holds THEIR people
    const mine = (p.pows ?? []).filter((pw) => {
      const seat = (view?.operators ?? []).find((o) => o.id === pw.id);
      return seat ? seat.team === myTeam : false;
    });
    if (mine.length === 0) continue;
    tasks.push({
      kind: "raid_prison", priority: 3,
      label: t("task.raid_prison", { count: mine.length }),
      cellX: p.cellX, cellY: p.cellY, ping: "attack",
    });
  }
  // The LANDSHIP standing unclaimed. Capture REASSIGNS the hull's team
  // (Q42: select is the capture), so a visible team--1 hull is by
  // definition nobody's — no extra projection and no fog cheat needed.
  for (const a of (view?.visibleEnemies ?? [])) {
    if (a.team !== -1) continue;
    if (a.state === 2 || a.state === 3) continue; // a wreck is a tow job, not a prize
    tasks.push({
      kind: "claim_landship", priority: 5,
      label: t("task.claim_landship"),
      cellX: cellOf(a.x), cellY: cellOf(a.y), ping: "rally",
    });
  }
  // Prompt 221: INTRUDER IN THE BASE — the searchlights caught someone.
  // The watch law (160.2) guarantees an enemy inside or hard against our
  // walls is always visible, so this card is fog-legitimate for free.
  // (Whole-map sandbox bases have no walls and raise no alarm.)
  const homeCompound = (view?.bases ?? []).find((b) => b.team === myTeam && b.width < 100);
  if (homeCompound) {
    for (const a of (view?.visibleEnemies ?? [])) {
      if (a.team === -1 || a.state === 2 || a.state === 3) continue;
      const cx = cellOf(a.x), cy = cellOf(a.y);
      if (cx >= homeCompound.x - 1 && cx <= homeCompound.x + homeCompound.width &&
          cy >= homeCompound.y - 1 && cy <= homeCompound.y + homeCompound.height) {
        tasks.push({
          kind: "intruder", priority: 0,
          label: t("task.intruder"),
          cellX: cx, cellY: cy, ping: "defend",
        });
      }
    }
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
      if (task.kind === "resupply" || task.kind === "repair_hull") return !!stats.canTow;
      return true; // stop_thief/secure/escort/defend/towing_now: everyone
    });
  }
  const byKind = new Map();
  for (const task of fitted) {
    const held = byKind.get(task.kind);
    if (!held || dist(task) < dist(held)) byKind.set(task.kind, task);
  }
  const out = [...byKind.values()];
  // Prompt-79 ruling: rank by VALUE TO THE TEAM first, then by locality —
  // the most important work surfaces, and among equals the nearest one
  // does. Value comes from the Recognition table, so the to-do list and
  // the scoreboard agree; a card ranked high but scored low would teach
  // the wrong lesson. Cell order breaks remaining ties so two clients can
  // never disagree about card order.
  out.sort((x, y) =>
    taskValue(y) - taskValue(x) ||
    dist(x) - dist(y) ||
    x.cellX - y.cellX || x.cellY - y.cellY);
  return out.map((t, i) => ({
    ...t, id: `${t.kind}:${t.cellX},${t.cellY}`, rank: i, distance: dist(t),
  }));
}
