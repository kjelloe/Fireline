# Gameplay-Evolved EXTENSIVE Evaluation — 67 mechanics vs Fireline Command

*(Response to specs/gameplay-evolved-extensive.md, prompt 57-ext. Rule:
full fit/cost/value for GOOD-or-better fits; everything below Good goes
to the IDEA BANK as considered. Context that filters heavily: we are an
order/drive tactical game (no aiming FPS layer), 32 seats, AI regents in
every empty seat, deterministic sandbox — FPS-mechanical items (TTK,
suppression sway, breaching, leaning) mostly translate poorly or are
already abstracted by our combat model.)*

## A. Already embodied — the audit (no new work; cited for the record)

| # | Mechanic | Where it lives in Fireline Command |
|---|---|---|
| 1 | Multiple useful contributions | THE design spine: contract-flag roster + Recognition (rescue outranks kills) |
| 7 | Good respawn design | Base redeploy, carrier field-respawn (15F), MPG WAVES = reinforcement-wave spawning, forced respawn |
| 8 | Transport as gameplay | Carriers (rescue/standard/spawn) and trucks (tow/fuel/ammo/repair) ARE the game |
| 11 | Information warfare | Fog, owned-relay sensors, scout mine-marking, pings, drones; "powerful but interruptible" = relay capture kills sensor web |
| 16 | Local superiority | Escort raids, capturer roles, satchel ambushes — emergent by design |
| 22 | Hero moments, no hero class | Satchel, standard runs, tow-under-fire, Recognition honors |
| 26 | Vehicle logistics limits | Fuel/ammo/supply web/repair-bay — core loop since phase 3 |
| 27/28 | AT tools / fair vehicle power | Mines, satchel, artillery, collision body-blocks; counters table largely maps |
| 34 | Small competitive loops | Mission cards + role doctrine generate them |
| 37 | Asymmetry | The factions + unique pair, swap-gate governed |
| 41 | Losing is fun | Last Convoy finale RULED (prior eval) |
| 45 | Custom rules | Session rules 13F/13G/13H (hashed, replay-honest) |
| 46 | Bot fill | AI regents are our SIGNATURE — a full war with 1 human |
| 63-67 | Principles ("no dead time", triangle, fun rules) | Adopted as audit checklist in this doc's margin — periodically re-walk |

## B. Full treatment — GOOD+ fits worth building

### B1. Meaningful deaths in the ticket economy (#35) — FIT: EXCELLENT · COST: M · VALUE: HIGH
Today tickets only bleed via relay majority; deaths are free. Adaptation:
**a disable costs the owner's team 1 ticket — unless the wreck is
recovered** (towed home/repaired refunds it; rescue of the crew refunds
a fraction). This FUSES our two identities: the rescue economy becomes
ticket-relevant — every tow visibly saves the war. Reuses tickets +
recovery events. Balance risk: sweep-gate tempo. **Recommend: next
economy slice, before salvage** (it may make salvage redundant or
sharper — evaluate after).

### B2. Differentiated node classes (#19/#24) — FIT: EXCELLENT · COST: M · VALUE: HIGH
All 8 frontier relays are identical. Adaptation: keep relays, add TYPED
sites per map — RADAR (wider sensor web), DEPOT (faster resupply +
future salvage income), FACTORY (MPG wave speed). The backlog already
holds "depots as distinct site class." Each objective gets a
personality; captures answer "what do we NEED?" Reuses sites/supply/MPG.
**Recommend: with-or-after B1; pairs with bridge demolition on riverline.**

### B3. Mercy + overtime rules (#47/#48) — FIT: GOOD · COST: LOW-M · VALUE: M-H
Two endgame rules: **mercy bleed** (full-cap held 3 min → enemy bleed
accelerates until they begin a capture) kills spawn-trap drag; **overtime**
(pool empty while the losing team is actively CAPTURING or their standard
run is live → bleed pauses until resolved) makes photo finishes. Pure
victory-logic + tests. **Recommend: YES, small slice.**

### B4. End-of-round awards (#31/#42) — FIT: GOOD · COST: LOW · VALUE: MEDIUM
Recognition already tracks the deeds; the end screen shows top-3 total.
Add CATEGORY honors: Best Recovery, Best Capturer, Best Escort, Best
Raider, Hero of the Convoy — pure feedback_model + strings. Support
players get seen. **Recommend: YES, nightly-safe filler slice.**

### B5. Quick-command wheel + auto-callouts (#30) — FIT: GOOD · COST: L-M · VALUE: M-H (humans)
Ping vocab growth was already ruled (Q16). Adaptation: a radial quick-
command (need-supplies/attack-here/defend-here/thanks) issuing pings +
AUTO-CALLOUTS from events ("enemy armor spotted" when a scout reveals).
Client-only atop the ping system. **Recommend: YES when a client
rotation comes up; mobile benefits doubly.**

### B6. Neutral timed objective (#20/#21) — FIT: GOOD · COST: M · VALUE: MEDIUM
Deterministic timing is native to us. Adaptation: a SUPPLY DROP site
activates mid-war on a seed-scheduled tick at a mirrored-neutral cell —
first team to hold it 10 s gains a salvage/ticket packet + a mission
card for both sides. One new site kind + scheduler + AI divert logic.
**Recommend: after B1/B2 land (it pays in their currencies).**

### B7. Death recap (#32/#64) — FIT: GOOD · COST: LOW · VALUE: MEDIUM
"DISABLED — artillery from the north-west" on the down banner: we have
the events and positions; it's a feedback_model line. New-player mercy.
**Recommend: YES, filler slice with B4.**

## C. Idea bank — considered, below Good fit today (one line each)

- (2) Layered secondary objectives — largely arrives via bridges/B2/B6.
- (3) Dynamic map state beyond bridges/weather (doors, water levels,
  route-unlock captures) — map-tech later.
- (4) Opening rush design — our joins are mid-war by identity; n/a.
- (5) Extra anti-snowball levers — measure after B1/B3; MPG waves +
  underdog premium (prompt-58) already lean here.
- (6) Squad mini-missions/squad bonuses — no squad layer; directives
  revisit post-NPC.
- (9) Multi-crew seats / (5-ext) Landship — post-v1 flagship (prior eval).
- (10) Soft roles/loadouts — chassis IS the role; designer topic.
- (12) Extra area-control tools (wire, sandbags, shields) — barricade-
  lite already banked; counters table kept as reference.
- (13) Suppression tuning — we have suppression timers; FPS sway n/a.
- (14) TTK tuning — abstracted by hp/reload; revisit only on playtest pain.
- (15) Quiet/hot pacing director — emergent already; weather adds contrast.
- (17) Commander abilities / (39) commander role — deferred with the
  commander layer itself.
- (18) Broader destructibles (radar/AA/generators) — after bridges prove
  the pattern.
- (23/50/51) Map-shape rules (lanes, three distances, density) — adopted
  as MAP-DESIGN checklist for the next profile, not a feature.
- (25) Role rotation pressure — partially emergent via crewing ladder.
- (29) Sound as gameplay — arrives with 14F synth manifest (ruled).
- (33) Skill ceiling/floor — principle; direct-drive + orders already
  two-tier.
- (36) Escalation phases — tickets arc suffices; unlock timers rejected
  with #3 (prior eval).
- (38) Attack/defense hybrid — B2 node typing delivers the useful half.
- (40) Defense fun — defend cards + Sentinel + mines cover; revisit
  with NPC guards.
- (43) Mischief/anti-grief — no FF and confirm-gated takeovers cover
  v1; admin tools with server-community wave.
- (44) Server community (vote map, favorites, shuffle) — with the
  discovery/community wave; favorites partly in the global list.
- (49) Weather VARIANTS as session rules — the EVENT version is already
  green-lit; whole-war variants join session rules later.
- (52) Capture depth extras — countdown + presence suffice today.
- (53) Momentum announcements — cheap; fold into B5 auto-callouts.
- (54) Localized spawn pressure — carrier cooldown covers v1.
- (57-62) Genre-borrow lists — mined for the items above; movement-feel
  polish (60) sits in the presentation backlog.

## Suggested build order for the B-list

B1 meaningful deaths → B3 mercy/overtime → B2 node classes →
B4+B7 awards & recap (filler) → B5 comm wheel → B6 neutral drop.
(Interleaves with the already-ruled weather → bridges → salvage →
Last Convoy sequence; B1 may reshape salvage's design before it lands.)
