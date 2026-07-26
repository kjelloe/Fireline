# Slice 11F: damaged sites + materiel (prompt 16 Q9, design sketch in
# plan-implementation-order.md). Relays get hp; artillery shells them
# (siege role); a DAMAGED site keeps its owner but stops projecting
# supply/fog and cannot flip; trucks auto-load one materiel slot in base
# and repair a damaged own/neutral site on adjacency. Bases stay sacred
# (Q19 default). AI trucks run repair errands.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── sites.js: hp contract ────────────────────────────────────────────────────
patch("engine/sites.js",
"""export const SITE_NEUTRALIZE_TICKS = 30; // ~3 s enemy -> neutral
export const SITE_CAPTURE_TICKS = 30;    // ~3 s neutral -> yours""",
"""export const SITE_NEUTRALIZE_TICKS = 30; // ~3 s enemy -> neutral
export const SITE_CAPTURE_TICKS = 30;    // ~3 s neutral -> yours

// 11F (Q9): sites are infrastructure with hit points. Two artillery
// shells (damage 30) knock a relay out; a DAMAGED site keeps its owner
// but projects nothing and cannot flip until a truck repairs it.
export const SITE_HP_MAX = 60;

export function siteOperational(site) {
  return (site.hp ?? SITE_HP_MAX) > 0;
}""")

# ── state.js: site hp + truck materiel slot ──────────────────────────────────
patch("engine/state.js",
"""    id, type: 1 /* SITE_RELAY */, owner: -1 /* SITE_NEUTRAL */,
    captureProgress: 0, capturingTeam: -1, // 11B countdown
    cellX: pos.cellX, cellY: pos.cellY,
  }));""",
"""    id, type: 1 /* SITE_RELAY */, owner: -1 /* SITE_NEUTRAL */,
    captureProgress: 0, capturingTeam: -1, // 11B countdown
    hp: 60, // 11F: SITE_HP_MAX (import cycle keeps this a literal)
    cellX: pos.cellX, cellY: pos.cellY,
  }));""")
patch("engine/state.js",
"""    minesLeft: getUnitStats(type).canMine ? MINES_PER_TANK : 0, // 9E mine rack
    campTicks: 0, // 9G: unsupplied-idle counter that draws a drone
  };""",
"""    minesLeft: getUnitStats(type).canMine ? MINES_PER_TANK : 0, // 9E mine rack
    campTicks: 0, // 9G: unsupplied-idle counter that draws a drone
    materiel: 0, // 11F: one repair-cargo slot (trucks load it in base)
  };""")

# ── supply/fog: damaged sites project nothing ────────────────────────────────
patch("engine/supply.js",
"""  return state.sites.some((s) => {
    if (s.owner !== asset.team) return false;""",
"""  return state.sites.some((s) => {
    if (s.owner !== asset.team || (s.hp ?? 1) <= 0) return false; // 11F""")
patch("engine/los.js",
"""  const siteSensors = state.sites.filter((s) => s.owner === team);""",
"""  const siteSensors = state.sites.filter((s) => s.owner === team && (s.hp ?? 1) > 0); // 11F""")

# ── reducer ──────────────────────────────────────────────────────────────────
patch("engine/reducer.js",
"""import { captureCheck, SITE_NEUTRALIZE_TICKS, SITE_CAPTURE_TICKS } from "./sites.js";""",
"""import {
  captureCheck, SITE_NEUTRALIZE_TICKS, SITE_CAPTURE_TICKS,
  SITE_HP_MAX, siteOperational,
} from "./sites.js";""")

# fire_order: artillery may shell a site (public infrastructure, no fog gates).
patch("engine/reducer.js",
"""  // 9G: shooting at a drone. Drones are public and airborne: no spotting or""",
"""  // 11F (Q9): shelling infrastructure. Sites are public; only the indirect
  // siege tube can breach them; normal ammo/reload/supply/range discipline.
  if (command.targetSiteId !== undefined) {
    const site = next.sites.find((s) => s.id === command.targetSiteId);
    if (!site) return reject(next, command, "no such site");
    if (!getUnitStats(attacker.type).indirect) {
      return reject(next, command, "cannot breach sites");
    }
    if (!siteOperational(site)) return reject(next, command, "site already damaged");
    if (attacker.reloadTimer > 0) return reject(next, command, "reloading");
    if (attacker.ammo < SUPPLY_FIRE_COST) return reject(next, command, "out of ammo");
    if (!inSupply(next, attacker)) return reject(next, command, "out of supply");
    const sitePos = { x: cellToWorld(site.cellX), y: cellToWorld(site.cellY) };
    if (!inFireRange(attacker, sitePos)) return reject(next, command, "target out of range");
    attacker.ammo -= SUPPLY_FIRE_COST;
    attacker.reloadTimer = getUnitStats(attacker.type).reloadTicks;
    site.hp = Math.max(0, site.hp - getUnitStats(attacker.type).damage);
    next.events.push({
      type: "site_shelled", siteId: site.id, byAssetId: attacker.id, siteHp: site.hp,
    });
    if (site.hp === 0) {
      site.captureProgress = 0;
      site.capturingTeam = -1;
      next.events.push({ type: "site_damaged", siteId: site.id });
    }
    return next;
  }
  // 9G: shooting at a drone. Drones are public and airborne: no spotting or""")

# capture pass: damaged sites are dead ground — no flips.
patch("engine/reducer.js",
"""    for (const site of next.sites) {
      const mask = present.get(site.id) ?? 0;""",
"""    for (const site of next.sites) {
      if (!siteOperational(site)) continue; // 11F: dead ground cannot flip
      const mask = present.get(site.id) ?? 0;""")

# materiel pass: trucks auto-load in base, auto-repair adjacent damaged
# own/neutral sites. Runs beside the resupply pass.
patch("engine/reducer.js",
"""  // Resupply pass: standing in your own base restores ammo and fuel.""",
"""  // 11F materiel pass: an idle truck in its own base takes on one repair
  // load; a truck carrying materiel next to a damaged own/neutral site
  // spends it — the site comes back at full strength.
  for (const asset of next.assets) {
    if (!getUnitStats(asset.type).canTow) continue;
    if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) continue;
    if (asset.materiel === 0 && asset.state === ASSET_IDLE && inOwnBase(next, asset)) {
      asset.materiel = 1;
      next.events.push({ type: "materiel_loaded", assetId: asset.id });
      continue;
    }
    if (asset.materiel !== 1) continue;
    const cx = worldToCellFloor(asset.x);
    const cy = worldToCellFloor(asset.y);
    const site = next.sites.find((s) =>
      !siteOperational(s) && s.owner !== (asset.team === 0 ? 1 : 0) &&
      Math.max(Math.abs(s.cellX - cx), Math.abs(s.cellY - cy)) <= 1);
    if (site) {
      site.hp = SITE_HP_MAX;
      asset.materiel = 0;
      next.events.push({ type: "site_repaired", siteId: site.id, byAssetId: asset.id });
    }
  }

  // Resupply pass: standing in your own base restores ammo and fuel.""")

# ── commands: fire_order accepts targetSiteId ────────────────────────────────
patch("engine/commands.js",
"""    case CMD_FIRE_ORDER:
      if (!isUint(cmd.operatorId, 31))     return { ok: false, reason: "invalid operatorId" };
      if (cmd.targetDroneId !== undefined) { // 9G: air target instead
        if (!isUint(cmd.targetDroneId, 0xffff)) return { ok: false, reason: "invalid targetDroneId" };
        return { ok: true };
      }""",
"""    case CMD_FIRE_ORDER:
      if (!isUint(cmd.operatorId, 31))     return { ok: false, reason: "invalid operatorId" };
      if (cmd.targetSiteId !== undefined) { // 11F: infrastructure target
        if (!isUint(cmd.targetSiteId, 0xffff)) return { ok: false, reason: "invalid targetSiteId" };
        return { ok: true };
      }
      if (cmd.targetDroneId !== undefined) { // 9G: air target instead
        if (!isUint(cmd.targetDroneId, 0xffff)) return { ok: false, reason: "invalid targetDroneId" };
        return { ok: true };
      }""")

# ── view: site hp public; friendly trucks expose materiel ────────────────────
patch("engine/view.js",
"""  const sites = state.sites.map((s) => ({
    id: s.id, type: s.type, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
    captureProgress: s.captureProgress, capturingTeam: s.capturingTeam, // 11B
  }));""",
"""  const sites = state.sites.map((s) => ({
    id: s.id, type: s.type, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
    captureProgress: s.captureProgress, capturingTeam: s.capturingTeam, // 11B
    hp: s.hp, // 11F: infrastructure state is public, like ownership
  }));""")
patch("engine/view.js",
"""      heading: a.heading, minesLeft: a.minesLeft,
      aboard1: a.aboard1, aboard2: a.aboard2, // 10B: takeover context""",
"""      heading: a.heading, minesLeft: a.minesLeft,
      aboard1: a.aboard1, aboard2: a.aboard2, // 10B: takeover context
      materiel: a.materiel, // 11F""")

# ── hashing (snapshot + 1A twin) ─────────────────────────────────────────────
for p in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    src = open(p).read()
    var = "s" if "w.writeI32LE(s.cellX); w.writeI32LE(s.cellY);" in src else "site"
    old = f"    w.writeI32LE({var}.captureProgress); w.writeI32LE({var}.capturingTeam); // added 11B"
    new = old + f"\n    w.writeI32LE({var}.hp ?? 60); // added 11F"
    assert src.count(old) == 1, p
    src = src.replace(old, new)
    old2 = "    w.writeI32LE(a.campTicks); // added 9G"
    new2 = old2 + "\n    w.writeU8(a.materiel ?? 0); // added 11F"
    assert src.count(old2) == 1, p
    open(p, "w").write(src.replace(old2, new2))

# ── helpers: sandbox sites/assets carry the new fields ───────────────────────
patch("test/helpers.js",
"""    captureProgress: spec.captureProgress ?? 0, capturingTeam: spec.capturingTeam ?? -1, // 11B
  }));""",
"""    captureProgress: spec.captureProgress ?? 0, capturingTeam: spec.capturingTeam ?? -1, // 11B
    hp: spec.hp ?? 60, // 11F
  }));""")
patch("test/helpers.js",
"""    campTicks: spec.campTicks ?? 0, // 9G""",
"""    campTicks: spec.campTicks ?? 0, // 9G
    materiel: spec.materiel ?? 0, // 11F""")

# ── AI: trucks run repair errands (alive world) ──────────────────────────────
patch("engine/ai_regency.js",
"""      // 11E full AI rescue play (Q5). Trucks: hook the nearest claimable""",
"""      // 11F repair errands (Q9): a truck carrying materiel heads for a
      // damaged own/neutral site nearby; adjacency auto-repairs it.
      if (!target && stats.canTow && asset.materiel === 1) {
        let hurt = null;
        let bestDist = Infinity;
        for (const site of state.sites) {
          if ((site.hp ?? 1) > 0) continue;
          if (site.owner === (asset.team === 0 ? 1 : 0)) continue;
          const d = Math.max(Math.abs(site.cellX - cellX0), Math.abs(site.cellY - cellY0));
          if (d < bestDist) { bestDist = d; hurt = site; }
        }
        if (hurt && bestDist > 1 && bestDist <= RESCUE_SEEK_CELLS) {
          target = [hurt.cellX, hurt.cellY + 1]; // park beside, not on it
        }
      }

      // 11E full AI rescue play (Q5). Trucks: hook the nearest claimable""")

# ── feedback ─────────────────────────────────────────────────────────────────
patch("client/js/feedback_model.js",
"""  "no such drone": "That drone is already gone.",""",
"""  "no such site": "No such site.",
  "cannot breach sites": "Only artillery can breach infrastructure.",
  "site already damaged": "That site is already in ruins.",
  "no such drone": "That drone is already gone.",""")
patch("client/js/feedback_model.js",
"""    case "site_neutralized":""",
"""    case "site_shelled": return `Relay ${e.siteId} under artillery fire!`;
    case "site_damaged":
      return `Relay ${e.siteId} is DOWN — a truck with materiel can rebuild it.`;
    case "site_repaired": return `Relay ${e.siteId} rebuilt and humming.`;
    case "materiel_loaded": return null;
    case "site_neutralized":""")
print("11F patched")
