// THE LINE INSTRUMENT (prompt 169/170). The reframe says every hunt
// signature is one fact: the front line sits west of centre. This probe
// watches the line FORM: per 250-tick bucket, each team's mean advance
// from its own spawn edge (advA = meanCellX - 7, advB = 120 - meanCellX),
// the forwardmost hull (fwdA = maxCellX - 7, fwdB = 120 - minCellX), the
// mean x of fire contacts (midpoint attacker/target, in cells), and
// per-team disables + manufactures. Averaged over 5 seeds, POWS=0 and
// POWS=2. The first bucket where advB pulls away from advA names the
// EPOCH of the mover (pre-contact pacing / first-contact resolution /
// MPG rebuild geometry); the per-chassis forward census names the WHO.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";

const SEEDS = [2026, 777, 31337, 4242, 9001];
const TICKS = 12000;
const BUCKET = 250;
const NB = TICKS / BUCKET;

for (const pows of [0, 2]) {
  // agg[b] = {advA, advB, fwdA, fwdB, n, cx, cn, disA, disB, mfgA, mfgB}
  const agg = Array.from({ length: NB }, () => ({
    advA: 0, advB: 0, fwdA: 0, fwdB: 0, n: 0, cx: 0, cn: 0,
    disA: 0, disB: 0, mfgA: 0, mfgB: 0,
  }));
  // Forward census: which chassis is the team's forwardmost hull, by bucket third.
  const fwdWho = { 0: {}, 1: {} };
  let firstContact = 0, firstDisable = 0, fc = 0, fd = 0;
  for (const seed of SEEDS) {
    const server = new GameServer({
      mapSeed: seed, enableAi: true, uniqueCrewing: true,
      rules: pows ? { powPreplaced: pows } : {},
    });
    let seenContact = false, seenDisable = false;
    for (let t = 0; t < TICKS; t++) {
      server.step();
      const s = server.state;
      const b = agg[Math.min(NB - 1, Math.floor(s.tick / BUCKET))];
      let sumA = 0, nA = 0, maxA = -1, sumB = 0, nB = 0, minB = 999;
      let fwdTypeA = -1, fwdTypeB = -1;
      for (const a of s.assets) {
        if (a.state !== 0 && a.state !== 1) continue; // IDLE/MOVING hulls only
        const cx = a.x >> 8;
        if (a.team === 0) { sumA += cx; nA++; if (cx > maxA) { maxA = cx; fwdTypeA = a.type; } }
        else if (a.team === 1) { sumB += cx; nB++; if (cx < minB) { minB = cx; fwdTypeB = a.type; } }
      }
      if (nA && nB) {
        b.advA += sumA / nA - 7; b.advB += 120 - sumB / nB;
        b.fwdA += maxA - 7; b.fwdB += 120 - minB; b.n++;
        if (fwdTypeA >= 0) fwdWho[0][fwdTypeA] = (fwdWho[0][fwdTypeA] ?? 0) + 1;
        if (fwdTypeB >= 0) fwdWho[1][fwdTypeB] = (fwdWho[1][fwdTypeB] ?? 0) + 1;
      }
      for (const e of s.events) {
        if (e.type === "fire_resolved") {
          const atk = s.assets[e.attackerId], tgt = s.assets[e.targetId];
          if (atk && tgt && atk.team !== tgt.team && atk.team >= 0 && tgt.team >= 0) {
            b.cx += ((atk.x + tgt.x) / 2) / 256; b.cn++;
            if (!seenContact) { seenContact = true; firstContact += s.tick; fc++; }
          }
        } else if (e.type === "asset_disabled") {
          const v = s.assets[e.assetId];
          if (v?.team === 0) b.disA++; else if (v?.team === 1) b.disB++;
          if (!seenDisable && (v?.team === 0 || v?.team === 1)) {
            seenDisable = true; firstDisable += s.tick; fd++;
          }
        } else if (e.type === "asset_manufactured") {
          const v = s.assets[e.assetId];
          if (v?.team === 0) b.mfgA++; else if (v?.team === 1) b.mfgB++;
        }
      }
      if (s.phase === 1) break;
    }
  }
  console.log(`\n=== POWS=${pows} — mean over ${SEEDS.length} seeds ===`);
  console.log(`first contact ~t=${Math.round(firstContact / Math.max(1, fc))}, first disable ~t=${Math.round(firstDisable / Math.max(1, fd))}`);
  console.log("bucket  advA  advB  dAdv  fwdA  fwdB  contact-x  disA/disB  mfgA/mfgB");
  for (let i = 0; i < NB; i++) {
    const b = agg[i];
    if (!b.n) continue;
    const advA = b.advA / b.n, advB = b.advB / b.n;
    const fwdA = b.fwdA / b.n, fwdB = b.fwdB / b.n;
    const cx = b.cn ? (b.cx / b.cn).toFixed(1) : "  -  ";
    console.log(
      `${String(i * BUCKET).padStart(6)}  ${advA.toFixed(1).padStart(4)}  ${advB.toFixed(1).padStart(4)}  ` +
      `${(advB - advA).toFixed(1).padStart(4)}  ${fwdA.toFixed(1).padStart(4)}  ${fwdB.toFixed(1).padStart(4)}  ` +
      `${String(cx).padStart(9)}  ${String(b.disA).padStart(4)}/${b.disB}  ${String(b.mfgA).padStart(4)}/${b.mfgB}`
    );
  }
  for (const team of [0, 1]) {
    const rows = Object.entries(fwdWho[team]).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([t, n]) => `${getUnitStats(Number(t))?.name ?? t}:${n}`);
    console.log(`forwardmost hull census team ${team === 0 ? "A" : "B"}: ${rows.join("  ")}`);
  }
}
