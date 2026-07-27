# Slice 13A: full cargo (prompt 31). Trucks carry a field-resupply load —
# 2400 fuel + 12 ammo (one asset's worth) — reloaded SILENTLY when idle in
# their own base (the materiel pattern), and transferred to an ADJACENT
# friendly operable asset with `transfer_cargo`. The truck must drive home
# to refill, so the base-return rhythm survives field logistics.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── supply constants ─────────────────────────────────────────────────────────
patch("engine/supply.js",
"""export const SUPPLY_FIRE_COST = 1;""",
"""export const SUPPLY_FIRE_COST = 1;
// 13A: a truck's field-resupply hold — exactly one asset's worth.
export const CARGO_FUEL_MAX = 2400;
export const CARGO_AMMO_MAX = 12;""")

# ── state + helpers ──────────────────────────────────────────────────────────
patch("engine/state.js",
"""    materiel: 0, // 11F: one repair-cargo slot (trucks load it in base)""",
"""    materiel: 0, // 11F: one repair-cargo slot (trucks load it in base)
    cargoFuel: 0, cargoAmmo: 0, // 13A: field-resupply hold (trucks)""")
patch("test/helpers.js",
"""    materiel: spec.materiel ?? 0, // 11F""",
"""    materiel: spec.materiel ?? 0, // 11F
    cargoFuel: spec.cargoFuel ?? 0, cargoAmmo: spec.cargoAmmo ?? 0, // 13A""")

# ── command ──────────────────────────────────────────────────────────────────
patch("engine/commands.js",
"""export const CMD_DEPLOY_HARDPOINT = "deploy_hardpoint"; // 12B""",
"""export const CMD_TRANSFER_CARGO = "transfer_cargo";     // 13A
export const CMD_DEPLOY_HARDPOINT = "deploy_hardpoint"; // 12B""")
patch("engine/commands.js",
"""    case CMD_DEPLOY_HARDPOINT:""",
"""    case CMD_TRANSFER_CARGO:
      if (!isUint(cmd.operatorId, 31))    return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.targetAssetId, 63)) return { ok: false, reason: "invalid targetAssetId" };
      return { ok: true };

    case CMD_DEPLOY_HARDPOINT:""")

# ── reducer: handler + silent base reload ────────────────────────────────────
patch("engine/reducer.js",
"""  CMD_DEPLOY_HARDPOINT, CMD_UNDEPLOY,""",
"""  CMD_DEPLOY_HARDPOINT, CMD_UNDEPLOY, CMD_TRANSFER_CARGO,""")
patch("engine/reducer.js",
"""import { SUPPLY_FIRE_COST, SUPPLY_MOVE_COST, FUEL_MAX, resupplyAt, inSupply } from "./supply.js";""",
"""import {
  SUPPLY_FIRE_COST, SUPPLY_MOVE_COST, FUEL_MAX, AMMO_MAX,
  CARGO_FUEL_MAX, CARGO_AMMO_MAX, resupplyAt, inSupply,
} from "./supply.js";""")
patch("engine/reducer.js",
"""// 12B: Deploy Hardpoint (3 s each way, immobile and guns cold while the""",
"""// 13A: field resupply — a truck tops an adjacent friendly up from its
// cargo hold. Partial transfers are fine; an empty hold or a full target
// each have their own honest rejection.
function applyTransferCargo(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const truck = next.assets[operator.assetId];
  if (!truck || truck.operatorId !== operator.id) return reject(next, command, "no asset selected");
  if (truck.state === ASSET_DISABLED || truck.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  if (!getUnitStats(truck.type).canTow) return reject(next, command, "needs a logistics truck");
  const target = next.assets[command.targetAssetId];
  if (!target || target.id === truck.id) return reject(next, command, "no such target");
  if (target.team !== truck.team) return reject(next, command, "friendly target");
  if (target.state === ASSET_DISABLED || target.state === ASSET_SALVAGED) {
    return reject(next, command, "target not operable");
  }
  if (chebyshevCells(truck, target) > 1) return reject(next, command, "cargo out of reach");
  const fuel = Math.min(truck.cargoFuel, FUEL_MAX - target.fuel);
  const ammo = Math.min(truck.cargoAmmo, AMMO_MAX - target.ammo);
  if (fuel <= 0 && ammo <= 0) {
    return reject(next, command,
      truck.cargoFuel <= 0 && truck.cargoAmmo <= 0 ? "cargo hold empty" : "target is topped up");
  }
  truck.cargoFuel -= fuel;
  truck.cargoAmmo -= ammo;
  target.fuel += fuel;
  target.ammo += ammo;
  next.events.push({
    type: "cargo_transferred", byAssetId: truck.id, assetId: target.id, fuel, ammo,
  });
  return next;
}

// 12B: Deploy Hardpoint (3 s each way, immobile and guns cold while the""")
patch("engine/reducer.js",
"""    case CMD_DEPLOY_HARDPOINT: return applyDeployHardpoint(next, command);""",
"""    case CMD_TRANSFER_CARGO: return applyTransferCargo(next, command);
    case CMD_DEPLOY_HARDPOINT: return applyDeployHardpoint(next, command);""")
patch("engine/reducer.js",
"""    if (asset.materiel === 0 && asset.state === ASSET_IDLE && inOwnBase(next, asset)) {
      asset.materiel = 1; // silent, like breathing — the crate is just there
      continue;
    }""",
"""    if (asset.state === ASSET_IDLE && inOwnBase(next, asset)) {
      // 13A: the hold refills at home, as silently as the materiel crate.
      asset.cargoFuel = CARGO_FUEL_MAX;
      asset.cargoAmmo = CARGO_AMMO_MAX;
      if (asset.materiel === 0) {
        asset.materiel = 1; // silent, like breathing — the crate is just there
        continue;
      }
    }""")

# ── hashing (snapshot + 1A twin) ─────────────────────────────────────────────
for p in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    patch(p,
"""    w.writeU8(a.deployed ?? 0); w.writeU8(a.deployTimer ?? 0); // added 12B""",
"""    w.writeU8(a.deployed ?? 0); w.writeU8(a.deployTimer ?? 0); // added 12B
    w.writeI32LE(a.cargoFuel ?? 0); w.writeI32LE(a.cargoAmmo ?? 0); // added 13A""")

# ── view + AI errand (13B) ───────────────────────────────────────────────────
patch("engine/view.js",
"""      deployed: a.deployed, deployTimer: a.deployTimer, // 12B""",
"""      deployed: a.deployed, deployTimer: a.deployTimer, // 12B
      cargoFuel: a.cargoFuel, cargoAmmo: a.cargoAmmo, // 13A""")
patch("engine/ai_regency.js",
"""import { PING_COOLDOWN_TICKS } from "./pings.js";""",
"""import { PING_COOLDOWN_TICKS } from "./pings.js";
import { CMD_TRANSFER_CARGO } from "./commands.js"; // 13B""")
patch("engine/ai_regency.js",
"""      // 11F repair errands (Q9): a truck carrying materiel heads for a""",
"""      // 13B resupply runner (prompt 31): a truck with cargo tops up the
      // thirstiest nearby teammate — adjacent: transfer; else: drive to
      // them. Tubes first (artillery/mortar burn ammo fastest).
      if (stats.canTow && (asset.cargoFuel > 0 || asset.cargoAmmo > 0)) {
        let needy = null;
        let bestScore = 0;
        for (const a of state.assets) {
          if (a.team !== asset.team || a.id === asset.id || isWreck(a)) continue;
          const wantAmmo = 12 - a.ammo;
          const wantFuel = Math.max(0, 2400 - a.fuel);
          if (a.ammo > 6 && a.fuel > 1200) continue; // not needy
          const dist = Math.max(Math.abs(worldToCellFloor(a.x) - cellX0),
                                Math.abs(worldToCellFloor(a.y) - cellY0));
          if (dist > RESCUE_SEEK_CELLS) continue;
          const tube = getUnitStats(a.type).indirect ? 2 : 1;
          const score = tube * (wantAmmo * 200 + Math.floor(wantFuel / 12)) - dist;
          if (score > bestScore) { bestScore = score; needy = a; }
        }
        if (needy) {
          const dist = Math.max(Math.abs(worldToCellFloor(needy.x) - cellX0),
                                Math.abs(worldToCellFloor(needy.y) - cellY0));
          if (dist <= 1) {
            commands.push({ type: CMD_TRANSFER_CARGO, operatorId, targetAssetId: needy.id });
            continue;
          }
          if (!target) target = [worldToCellFloor(needy.x), worldToCellFloor(needy.y)];
        }
      }

      // 11F repair errands (Q9): a truck carrying materiel heads for a""")

# ── strings + client (F key, banner, supply bar) ─────────────────────────────
patch("client/js/strings.js",
"""    "rej.rate limited": "Slow down — command flood throttled.",""",
"""    "rej.cargo out of reach": "Pull alongside to transfer cargo.",
    "rej.cargo hold empty": "Cargo hold empty — reload at base.",
    "rej.target is topped up": "They are already topped up.",
    "ev.cargo_transferred": "Truck {by} resupplied asset {id} (+{fuel} fuel, +{ammo} ammo).",
    "banner.resupply": "RESUPPLY ASSET {id} (V)",
    "ui.cargo": "Cargo {fuel}f/{ammo}a",
    "rej.rate limited": "Slow down — command flood throttled.",""")
patch("client/js/strings.js",
"""    "rej.rate limited": "Ro ned — kommandoflommen struptes.",""",
"""    "rej.cargo out of reach": "Legg deg inntil for å overføre last.",
    "rej.cargo hold empty": "Lasterommet er tomt — fyll opp i basen.",
    "rej.target is topped up": "De er allerede fylt opp.",
    "ev.cargo_transferred": "Lastebil {by} etterforsynte enhet {id} (+{fuel} drivstoff, +{ammo} ammo).",
    "banner.resupply": "ETTERFORSYN ENHET {id} (V)",
    "ui.cargo": "Last {fuel}d/{ammo}a",
    "rej.rate limited": "Ro ned — kommandoflommen struptes.",""")
patch("client/js/feedback_model.js",
"""    case "hardpoint_deploying": return t("ev.hardpoint_deploying");""",
"""    case "cargo_transferred":
      return t("ev.cargo_transferred", { by: e.byAssetId, id: e.assetId, fuel: e.fuel, ammo: e.ammo });
    case "hardpoint_deploying": return t("ev.hardpoint_deploying");""")

p = "client/js/client.js"
patch(p,
"""    } else if (me?.type === 7 && me.deployTimer === 0) { // 12B""",
"""    } else if (me?.type === 3 && adjacentNeedyFriendly(view)) { // 13A
      const needy = adjacentNeedyFriendly(view);
      text = t("banner.resupply", { id: needy.id });
      bannerAction = () => send({ type: "transfer_cargo", targetAssetId: needy.id });
    } else if (me?.type === 7 && me.deployTimer === 0) { // 12B""")
patch(p,
"""// 11U: the claimable friendly wreck beside my truck, if I drive one.""",
"""// 13A: the neediest adjacent friendly, if I drive a stocked truck.
function adjacentNeedyFriendly(view) {
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me || me.type !== 3 || (me.cargoFuel <= 0 && me.cargoAmmo <= 0)) return null;
  return (view?.friendlyAssets ?? []).find((a) =>
    a.id !== me.id && a.state !== STATE_DISABLED && a.state !== 3 &&
    (a.ammo < 12 || a.fuel < 2400) && (a.ammo <= 6 || a.fuel <= 1200) &&
    Math.max(Math.abs(Math.floor(a.x / CELL) - Math.floor(me.x / CELL)),
             Math.abs(Math.floor(a.y / CELL) - Math.floor(me.y / CELL))) <= 1) ?? null;
}

// 11U: the claimable friendly wreck beside my truck, if I drive one.""")
patch(p,
"""    if (e.key === "t" || e.key === "T") {
      const wreck = adjacentTowableWreck(interpolator.latest());
      if (wreck) send({ type: "tow_order", wreckAssetId: wreck.id });
    }""",
"""    if (e.key === "t" || e.key === "T") {
      const wreck = adjacentTowableWreck(interpolator.latest());
      if (wreck) send({ type: "tow_order", wreckAssetId: wreck.id });
    }
    // 13A: V transfers cargo to the neediest adjacent friendly (F is
    // camera-follow — hands off).
    if (e.key === "v" || e.key === "V") {
      const needy = adjacentNeedyFriendly(interpolator.latest());
      if (needy) send({ type: "transfer_cargo", targetAssetId: needy.id });
    }""")
patch(p,
"""  el.innerText = `Asset ${own.id} | HP ${own.hp} | Ammo ${own.ammo} | Fuel ${own.fuel}`;""",
"""  el.innerText = `Asset ${own.id} | HP ${own.hp} | Ammo ${own.ammo} | Fuel ${own.fuel}` +
    (own.type === 3 ? ` | ${t("ui.cargo", { fuel: own.cargoFuel, ammo: own.cargoAmmo })}` : "");""")
patch("client/index.html",
"B board / U unboard / T tow",
"B board / U unboard / T tow · V transfer cargo")
print("13A/13B patched")
