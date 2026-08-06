// server/metrics.js — LAN balance instrumentation (slice 8I).
// Counts what the designer's balance pass needs: war durations, standard
// activity, captures, kills, recoveries, and rejection frequencies. Pure
// accumulator fed from broadcast events; no game logic.

// Prompt 208/210: the tick-jitter digest, pure so it is testable. gaps
// = inter-pump intervals in ms (unfilled ring slots may be negative —
// they are dropped); returns null below 10 samples (meaningless).
export function jitterDigest(gaps, tickMs) {
  const g = gaps.filter((x) => x >= 0).sort((a, b) => a - b);
  if (g.length < 10) return null;
  const pick = (q) => g[Math.min(g.length - 1, Math.floor(q * g.length))];
  return {
    expectedMs: tickMs,
    p50Ms: Math.round(pick(0.5)),
    p99Ms: Math.round(pick(0.99)),
    maxMs: Math.round(g[g.length - 1]),
    // a gap over 1.5 ticks means a snapshot slipped a whole beat
    latePct: Math.round(g.filter((x) => x > tickMs * 1.5).length / g.length * 1000) / 10,
  };
}

export function createMetrics() {
  const counters = {
    warsCompleted: 0,
    warDurations: [],
    standardsTaken: 0,
    standardsDropped: 0,
    standardsReturned: 0,
    standardsScored: 0,
    relayCaptures: 0,
    disables: 0,
    towsStarted: 0,
    recoveries: 0,
    operatorsDowned: 0,
    operatorsRescued: 0,
    manufactured: 0,
    minesDeployed: 0,
    minesDetonated: 0,
    minesCleared: 0,
    dronesLaunched: 0,
    dronesDowned: 0,
    fireOrdersRejected: 0,
    rejectionsByReason: {},
    firstContactTick: null,
  };

  return {
    consumeEvents(events, tick) {
      for (const e of events ?? []) {
        switch (e.type) {
          case "standard_taken": counters.standardsTaken++; break;
          case "standard_dropped": counters.standardsDropped++; break;
          case "standard_returned": counters.standardsReturned++; break;
          case "standard_scored": counters.standardsScored++; break;
          case "site_captured": counters.relayCaptures++; break;
          case "asset_disabled":
            counters.disables++;
            if (counters.firstContactTick === null) counters.firstContactTick = tick;
            break;
          case "tow_started": counters.towsStarted++; break;
          case "operator_downed": counters.operatorsDowned++; break;
          case "operator_rescued": counters.operatorsRescued++; break;
          case "asset_manufactured": counters.manufactured++; break;
          case "mine_deployed": counters.minesDeployed++; break;
          case "mine_detonated": counters.minesDetonated++; break;
          case "mine_cleared": counters.minesCleared++; break;
          case "drone_launched": counters.dronesLaunched++; break;
          case "drone_downed": counters.dronesDowned++; break;
          case "asset_restored": counters.recoveries++; break;
          case "rejected":
            counters.rejectionsByReason[e.reason] =
              (counters.rejectionsByReason[e.reason] ?? 0) + 1;
            if (e.cmd === "fire_order") counters.fireOrdersRejected++;
            break;
          default: break;
        }
      }
    },

    warCompleted(ticks) {
      counters.warsCompleted++;
      counters.warDurations.push(ticks);
    },

    snapshot() {
      const durations = counters.warDurations;
      const avg = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;
      return { ...counters, avgWarTicks: avg };
    },
  };
}
