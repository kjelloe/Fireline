// tools/war_metrics.mjs — per-war STORY metrics for the sweep (prompt 88).
//
// The designer's question about any pacing change is not "are wars
// longer?" but "did the extra minutes create stories, or just delay the
// result?" — and the sweep CSV recorded nothing that could answer it.
// This collector watches a war tick by tick and reports the story-shaped
// numbers: lead changes, comebacks, majority swings, standard attempts,
// mercy engagements, overtime.
//
// Pure and engine-independent: it reads the state object and its event
// stream, touches nothing, and is unit-tested against synthetic wars
// (an untested instrument is how we got a false side-lean for a month).

// Events whose per-war counts are story signals.
const COUNTED_EVENTS = Object.freeze([
  "standard_taken",        // an ATTEMPT on the headline objective
  "standard_scored",
  "asset_field_repaired",
  "bridge_breached",
  "bridge_repaired",
]);

export function createWarMetrics() {
  const m = {
    leadChanges: 0,        // ticket lead flipping between teams
    majorityFlips: 0,      // relay-majority holder changing hands
    maxDeficit: [0, 0],    // worst ticket deficit each team CAME BACK from (or sat in)
    mercyBleeds: 0,        // bleed boundaries where the mercy rate applied
    overtimeTicks: 0,      // ticks survived past an empty pool (B3 overtime)
    counts: Object.fromEntries(COUNTED_EVENTS.map((e) => [e, 0])),
  };
  let prevLeader = 0;      // sign of tickets[0] - tickets[1]; 0 = level
  let prevMajorityHolder = -1;
  let prevTickets = null;

  return {
    observe(state) {
      const t = state.tickets ?? [0, 0];

      // Lead changes: the SIGN of the ticket difference flipping. Level
      // pools are not a change — the lead must actually cross.
      const sign = Math.sign(t[0] - t[1]);
      if (sign !== 0 && prevLeader !== 0 && sign !== prevLeader) m.leadChanges += 1;
      if (sign !== 0) prevLeader = sign;

      // Majority holder: who, if anyone, holds enough relays to bleed
      // the other side (the map-aware majority the reducer uses).
      const sites = state.sites ?? [];
      const mapMajority = ((sites.length / 2) | 0) + 1;
      const majority = Math.min(state.rules?.ticketMajority ?? 5, mapMajority);
      const owned = [0, 0];
      for (const s of sites) if (s.owner === 0 || s.owner === 1) owned[s.owner] += 1;
      const holder = owned[0] >= majority ? 0 : owned[1] >= majority ? 1 : -1;
      if (holder !== -1 && prevMajorityHolder !== -1 && holder !== prevMajorityHolder) {
        m.majorityFlips += 1;
      }
      if (holder !== -1) prevMajorityHolder = holder;

      // Deficits: the hole each team is in right now; the max is the
      // hole the eventual winner climbed OUT of (the comeback measure).
      m.maxDeficit[0] = Math.max(m.maxDeficit[0], t[1] - t[0]);
      m.maxDeficit[1] = Math.max(m.maxDeficit[1], t[0] - t[1]);

      // Mercy: the reducer bleeds silently (repin discipline), so this is
      // a HEURISTIC read off the pools: a per-tick drop greater than one
      // but no larger than the mercy rate. Simultaneous B1 disables can
      // also drop a pool by 2-3 in a tick, so treat this column as an
      // indicator, not a precise count — it answers "did mercy engage in
      // this war", which is what the tuning questions need.
      const mercyRate = state.rules?.mercyMultiplier ?? 3;
      if (prevTickets) {
        for (const team of [0, 1]) {
          const drop = prevTickets[team] - t[team];
          if (drop > 1 && drop <= mercyRate) m.mercyBleeds += 1;
        }
      }
      prevTickets = [t[0], t[1]];

      // Overtime: still fighting with an empty pool (B3 held the door).
      if (state.phase === 0 && (t[0] <= 0 || t[1] <= 0)) m.overtimeTicks += 1;

      for (const e of state.events ?? []) {
        if (e.type in m.counts) m.counts[e.type] += 1;
      }
    },

    finish(state) {
      const winner = state.winner ?? -1;
      return {
        leadChanges: m.leadChanges,
        majorityFlips: m.majorityFlips,
        // How deep a hole did the WINNER climb out of? 0 = never behind.
        winnerMaxDeficit: winner === 0 || winner === 1 ? m.maxDeficit[winner] : -1,
        // Margin of a ticket win: what the winner had left. -1 = n/a.
        winnerMargin: winner === 0 || winner === 1 ? (state.tickets?.[winner] ?? -1) : -1,
        stdAttempts: m.counts.standard_taken,
        stdScored: m.counts.standard_scored,
        fieldRepairs: m.counts.asset_field_repaired,
        bridgeBreaches: m.counts.bridge_breached,
        bridgeRepairs: m.counts.bridge_repaired,
        mercyBleeds: m.mercyBleeds,
        overtimeTicks: m.overtimeTicks,
      };
    },
  };
}

// The CSV column order, exported so the sweep header and any analyzer
// share one source of truth instead of two drifting lists.
export const METRIC_COLUMNS = Object.freeze([
  "leadChanges", "majorityFlips", "winnerMaxDeficit", "winnerMargin",
  "stdAttempts", "stdScored", "fieldRepairs",
  "bridgeBreaches", "bridgeRepairs", "mercyBleeds", "overtimeTicks",
]);
