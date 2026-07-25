// client/js/vfx_cues.js — server events → visual effect cues (slice 4C).
// Pure mapping with lifetimes in ms; the renderer animates them.

const CELL = 256;

export const VFX_TTL_MS = Object.freeze({
  muzzle_flash: 120,
  explosion: 700,
  capture_pulse: 900,
});

function assetPosition(view, assetId) {
  const all = [...(view.friendlyAssets ?? []), ...(view.visibleEnemies ?? [])];
  const found = all.find((a) => a.id === assetId);
  return found ? { x: found.x / CELL + 0.5, y: found.y / CELL + 0.5 } : null;
}

export function mapEventsToVfx(events, view, nowMs) {
  const fx = [];
  for (const e of events ?? []) {
    if (e.type === "fire_resolved") {
      const at = assetPosition(view, e.attackerId);
      if (at) fx.push({ kind: "muzzle_flash", at, bornMs: nowMs, ttlMs: VFX_TTL_MS.muzzle_flash });
      const impact = assetPosition(view, e.targetId);
      if (impact) fx.push({ kind: "explosion", at: impact, bornMs: nowMs, ttlMs: VFX_TTL_MS.explosion * 0.4 });
    }
    if (e.type === "asset_disabled") {
      const at = assetPosition(view, e.assetId);
      if (at) fx.push({ kind: "explosion", at, bornMs: nowMs, ttlMs: VFX_TTL_MS.explosion });
    }
    if (e.type === "site_captured") {
      const site = (view.sites ?? []).find((s) => s.id === e.siteId);
      if (site) {
        fx.push({
          kind: "capture_pulse",
          at: { x: site.cellX + 0.5, y: site.cellY + 0.5 },
          bornMs: nowMs, ttlMs: VFX_TTL_MS.capture_pulse,
        });
      }
    }
  }
  return fx;
}

// Age 0..1 (1 = expired); renderer drops effects at 1.
export function vfxAge(effect, nowMs) {
  if (effect.ttlMs <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - effect.bornMs) / effect.ttlMs));
}

export function pruneVfx(effects, nowMs) {
  return effects.filter((e) => vfxAge(e, nowMs) < 1);
}
