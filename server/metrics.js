// server/metrics.js — LAN balance instrumentation (slice 8I).
// Counts what the designer's balance pass needs: war durations, standard
// activity, captures, kills, recoveries, and rejection frequencies. Pure
// accumulator fed from broadcast events; no game logic.

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
