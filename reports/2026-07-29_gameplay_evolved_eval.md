# Gameplay-Evolved Evaluation — fit, cost, value for Fireline Command

*(Response to specs/gameplay-evolved.md, prompt 57. Each mechanic
adapted to OUR systems; cost assumes the existing machinery — much of
it is closer than it looks.)*

## 1. Meta-resource economy (salvage) — FIT: EXCELLENT · COST: M · VALUE: HIGH

We already run the deepest version of this fantasy: tow-back recovery,
materiel, cargo, tickets. The adaptation is nearly writing itself:
**towed wrecks yield team SALVAGE** (hashed pool, like tickets); spend
it to accelerate MPG rebuild waves or refit a garage slot. Logistics
players get a strategic scoreboard ("your tows bought this wave"), and
"resource raiding" already exists — kill the enemy's trucks. Reuses:
tickets plumbing (13H), MPG waves, Recognition. New: one hashed pool +
a spend rule + AI valuation. **Recommend: YES, near-term** — it deepens
our core identity (rescue economy) rather than adding a parallel game.

## 2. Base building / FOB — FIT: PARTIAL · COST: M-H · VALUE: MEDIUM

The FOB half is essentially DONE: carrier field-respawn (15F) is our
mobile rally point, and hunting enemy carriers is already search-and-
destroy. Dynamic cover (sandbags/wire at relays) means hashed map
mutations + route-graph interplay + art; our mines and the Sentinel
hardpoint already occupy the "shape the ground" niche. **Recommend:
DEFER the building half**; consider a single engineer-truck "barricade"
deployable (blocking cell, destructible, 13D re-costs around it) after
the NPC wave if playtests want more fortification.

## 3. Asymmetric objective phases — FIT: WEAK · COST: HIGH · VALUE: MEDIUM

Enemy-Territory-style staged stories fight our identity: we chose
non-linear conquest deliberately (BF2 study), our wars are deterministic
sandboxes, and the ticket arc already produces escalation and finales.
Phases would need per-phase victory logic AND per-phase AI doctrine —
the most expensive item on this list. **Recommend: NO for the core
mode.** If we ever want it: a special riverline scenario ("hold the
bridges / breach / escort") as a session-rules mode, not a rework.

## 4. Hero rewards + mid-game mutators — SPLIT VERDICT

- **Killstreak hero asset: NO.** It concentrates power in the leading
  player — anti-comeback, and it breaks the fairness doctrine we
  sweep-gate everything against. A soft version that fits: the top
  Recognition earner gets FIRST CLAIM on the faction unique after an
  MPG wave (prestige, not power). Cheap if wanted.
- **Mid-game weather events: YES — FIT: EXCELLENT · COST: L-M ·
  VALUE: HIGH.** Deterministic, seed-scheduled weather (sandstorm /
  nightfall) that halves sensor radii for ~90 s flips the meta
  mid-war: scouts and pings become king, standard runs find their
  window, snipe-lines break. Reuses: LOS system (one multiplier),
  events, presentation tint. This is the cleanest "mid-game slump"
  killer on the list and it is fog-native — OUR kind of mechanic.

## 5. Multi-crew social vehicle — FIT: GOOD (HUMANS) · COST: HIGH · VALUE: HIGH-LATER

The Landship is a real flagship idea and Tribes is the right ancestor —
but it needs a seat-model rework (multiple operators per asset with
stations, input routing, per-station views) and it conflicts with the
"no 17th asset" roster ruling. AI wars get little from it. **Recommend:
POST-V1 FLAGSHIP** — design doc when the designer wants it; the carrier
(driver + bunks + field-respawn) is the interim social vehicle.

## 6. Environmental destruction — FIT: EXCELLENT (RIVERLINE) · COST: M · VALUE: HIGH

**Bridge demolition is riverline's missing signature.** Everything it
needs already exists: sites have hp + artillery siege (only artillery
breaches — the flag is literally there), trucks repair via materiel,
and 13D dynamic edges already models "blocked" — a downed bridge is a
blocked graph edge + impassable cells until repaired. The losing team
gains the exact momentum-breaker the note describes. Power-grid-lite
also already exists (relays project supply/sensors). **Recommend: YES —
next riverline slice** ("13E-bridges"): bridge hp, breach, repair,
graph re-cost, AI siege/repair doctrine.

## 7. Dead Man's Hand / extraction finale — FIT: GOOD · COST: M · VALUE: MEDIUM-HIGH

Adapted to us: when a team's tickets fall below ~10%, their war-goal
flips to **THE LAST CONVOY** — evacuate N operable hulls to the base
(or the map-edge road) before the pool empties; each escapee pays
Recognition (and salvage, if #1 lands). No cross-war currency yet (wars
rotate stateless), so the reward is honors-now. Turns blowouts into
drama and gives the tow trucks one final heroic job. **Recommend: YES,
after weather + bridges** — it completes the ticket arc's story.

## Suggested order (if ruled)

1. Weather events (#4b) — small, meta-refreshing, fog-native.
2. Bridge demolition (#6) — riverline's identity slice.
3. Salvage economy (#1) — deepens the rescue fantasy strategically.
4. Last Convoy finale (#7) — completes the ticket arc.
5. Recognition first-claim (#4a soft version) — cheap prestige, optional.
6. Barricade deployable (#2 lite) — post-NPC, playtest-driven.
7. Landship (#5) — post-v1 flagship; Objective phases (#3) — special
   mode someday or never.
