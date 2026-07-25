---
name: playtest-report
description: Summarize a More Firepower playtest session (browser or LAN) into a balance report with tuning proposals. Use after the user has played — pulls /metrics, /replays, and archived logs into the P1-G balance-pass format.
---

# Playtest → balance report

The designer's P1-G balance pass runs on real session data. After the user
plays (`npm start`, then browser/LAN), produce a report:

## 1. Collect
- `curl -s localhost:8080/metrics` while the server still runs (counters are
  in-memory, per-process) — or ask the user to paste it if they already
  stopped the server.
- `curl -s localhost:8080/replays` + `data/replays/` for archived wars
  (war durations, winners, reasons are in `replay_index.json`).
- Optionally replay-verify an archived war:
  `replayLog(createInitialState(meta.mapSeed, "frontier_corridor"), record.commandLog)`
  and compare against `meta.finalHash`.
- Ask the user for feel notes: pace, readability, frustration moments.

## 2. Evaluate against the designer's measurables
| Metric | Healthy signal | Tuning lever |
|---|---|---|
| avgWarTicks | 12000-18000 (20-30 min) | standard placement, speeds, DOMINATION_HOLD_TICKS |
| standardsTaken vs standardsScored | attempts > scores; scores > 0 | carrier speed penalty, zone sizes |
| firstContactTick | < ~1200 (2 min) | spawn/patrol positions, speeds |
| towsStarted vs recoveries | recoveries/tows > 0.5 | tow speed, REPAIR_TICKS |
| rejectionsByReason.reloading | high = spam or unclear UI | reload UI feedback, reloadTicks |
| rejectionsByReason["out of supply"] | high = supply too harsh/unclear | SUPPLY_RADIUS_CELLS, RELAY_SUPPLY_CELLS |
| relayCaptures | steady flow, not zero, not churn | RELAY_FOG/SUPPLY radii |

## 3. Propose, don't just apply
Tuning constants live in: `engine/units.js` (speed/range/damage/reload/hp),
`engine/supply.js` (radii, AMMO/FUEL_MAX), `engine/standards.js` (carrier
penalty, homes), `engine/recovery.js` (tow speed, REPAIR_TICKS),
`engine/victory.js` (hold/time limits), `engine/los.js` (sensor radii).
Present a table: metric → observation → proposed constant change → risk.
Wait for the user's picks; then apply as a normal slice (tests +
`fixture-repin` if hashed values shift + marker commit).
