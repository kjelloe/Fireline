// client/js/motion_cues.js — 14C motion pass, batch 1 (art round 2b,
// promoted from "noted"). Pure math the renderer animates: turret recoil
// on fire_resolved, shell-arc tracers for INDIRECT fire (the mortar/
// artillery read), and dust-puff emission cadence while driving. Same
// contract as vfx_cues: cues carry bornMs/ttlMs; the renderer owns meshes.

import { UNIT_STATS } from "../../engine/units.js";

const CELL = 256;

export const MOTION_TTL_MS = Object.freeze({
  recoil: 220,
  tracer: 650,
  dust: 900,
  muzzle: 130, // prompt 221: the flash that says "that hull just FIRED"
});

function assetIn(view, assetId) {
  const all = [...(view.friendlyAssets ?? []), ...(view.visibleEnemies ?? [])];
  return all.find((a) => a.id === assetId) ?? null;
}

const cellPos = (a) => ({ x: a.x / CELL + 0.5, y: a.y / CELL + 0.5 });

// fire_resolved → recoil for every attacker we can see; a tracer arc when
// the attacker's chassis fires indirect (both ends must be on screen —
// fog draws no arcs out of nowhere).
export function mapEventsToMotion(events, view, nowMs) {
  const cues = [];
  for (const e of events ?? []) {
    if (e.type !== "fire_resolved") continue;
    const attacker = assetIn(view, e.attackerId);
    if (!attacker) continue;
    cues.push({
      kind: "recoil", assetId: attacker.id,
      bornMs: nowMs, ttlMs: MOTION_TTL_MS.recoil,
    });
    // Prompt 221 ("could we have a muzzle flare for all assets"): every
    // VISIBLE shot flashes at the gun — both teams, fog-honest by
    // construction (an unseen attacker never reaches this loop).
    cues.push({
      kind: "muzzle", at: cellPos(attacker),
      bornMs: nowMs, ttlMs: MOTION_TTL_MS.muzzle,
    });
    if (UNIT_STATS[attacker.type]?.indirect) {
      const target = e.targetId !== undefined ? assetIn(view, e.targetId) : null;
      if (target) {
        cues.push({
          kind: "tracer", from: cellPos(attacker), to: cellPos(target),
          bornMs: nowMs, ttlMs: MOTION_TTL_MS.tracer,
        });
      }
    }
  }
  return cues;
}

// Recoil kick 0..1 over age 0..1: snap back fast (20% of the life), then
// ease home. 0 at both ends so the mesh lands exactly where it started.
export function recoilKick(age) {
  if (age <= 0 || age >= 1) return 0;
  return age < 0.2 ? age / 0.2 : 1 - (age - 0.2) / 0.8;
}

// Point along the shell arc at age 0..1: linear ground track, parabolic
// height peaking at apex mid-flight. h is in world units above ground.
export function tracerPoint(from, to, age, apex = 1.6) {
  const t = Math.min(1, Math.max(0, age));
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    h: apex * 4 * t * (1 - t),
  };
}

// Dust cadence: a puff when the hull has really moved and the last puff
// is old enough. Returns the new lastEmitMs (unchanged when not emitting).
export function dustStep(lastEmitMs, nowMs, movedSq, { intervalMs = 150, minMovedSq = 0.0004 } = {}) {
  if (movedSq < minMovedSq) return { emit: false, lastEmitMs };
  if (nowMs - lastEmitMs < intervalMs) return { emit: false, lastEmitMs };
  return { emit: true, lastEmitMs: nowMs };
}

export function motionAge(cue, nowMs) {
  if (cue.ttlMs <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - cue.bornMs) / cue.ttlMs));
}

export function pruneMotion(cues, nowMs) {
  return cues.filter((c) => motionAge(c, nowMs) < 1);
}
