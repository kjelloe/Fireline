# Map Roster — audit, adjustments, and the next maps

*(Response to prompt 60: review the current maps against
specs/gameplay-map-design.md, decide adjustments, design 2 more maps
now, bank up to 6 more. This is the living map-design document; new
profiles land here BEFORE they land in code.)*

## 0. What the checklist means for OUR engine

The design doc assumes a 64-player FPS. Translated to Fireline Command
(32 seats, order/drive tactics, fog + sensor webs, no verticality, no
aiming layer):

- "Infantry" = downed operators + light chassis (scout/bike); "engineers"
  = trucks; "air" does not exist; "snipers" = artillery/mortar arcs.
- Sightlines = sensor radii; verticality (§9) has no engine analog today —
  a sensor-boosting HIGHLAND terrain is banked as future map-tech, not
  retrofitted.
- Squad stories = escort doctrine + mission cards + Recognition.
- HARD CONSTRAINTS every profile must satisfy:
  1. 128×128, mirror invariant x' = 127-x (tested; auto-enumerated by
     the layout/graph mirror suites).
  2. Shared base rects (6,54,18,20)/(104,54,18,20), spawn columns 7/120,
     road rows 62-65 with base approaches, standard homes (14,59)/(113,59)
     — the spawn/supply machinery assumes them.
  3. Terrain vocabulary: OPEN/ROAD/FOREST/ROUGH/BLOCKING/PATH/WATER only.
  4. Random terrain generated west-half then mirrored (fairness by
     construction — riverline's lesson).
  5. `mapHasRunway` (water OR trails) must hold or faction uniques stop
     crewing (16B gate) — every map needs trails or water somewhere.
  6. EVERY objective must sit within `CAPTURE_SEEK_CELLS` (16,
     Manhattan) of a place units actually go — a patrol waypoint, a
     road, a gap. The AI only designates a capturer from assets already
     inside that radius, so a relay outside it is never captured by
     anyone and silently removes itself from the ticket math (the 18C
     lesson; asserted by test for sawtooth).
  7. Integration cost per map (all six or the map doesn't exist):
     mapgen module, MAP_PROFILES + MAP_LAYOUTS, route-graph table
     (+BARRIERS if water), PATROLS (heavy+light, exact mirrors),
     profile test file, sim battery before promotion.

## 1. Audit: frontier_corridor vs the checklist

| # | Checklist item | Verdict |
|---|---|---|
| 1 | Objective network | GOOD — lane + side layout (4 road relays + 4 lateral, prompt 51); choices, flanks, back-caps all real |
| 2 | Objective identity | GAP — all 8 relays identical. Fix is B2 typed node classes (already ruled), NOT geometry |
| 3 | Spawn quality | GOOD — base + carrier field-respawn + MPG waves; spawn-to-first-decision ≈ 20-40 s |
| 4 | Infantry-vehicle balance | PARTIAL — open+scatter suits hulls; light chassis got trails (11N); no dense zone (see roster answer below) |
| 5 | Chokepoint counterplay | N/A by design — the corridor is open; riverline owns chokes |
| 6 | Comeback design | GOOD — laterals to back-cap, tickets arc, MPG waves, mercy/overtime queued (B3) |
| 7 | Route variety | GOOD — road (fast), trails (flank light), open (direct), all costed in the route graph |
| 8 | Sightline fairness | GOOD — radius-based sensors are readable; weather fronts add scheduled contrast |
| 9 | Match pacing | GOOD — rush→front→adaptation→ticket climax measured in sweeps (~54/24/22 endings) |
| 10 | Memorable stories | GOOD — standard runs, tow-under-fire, satchel ambushes |

**DECISION: no geometry changes to frontier.** It is the band-tuned
baseline (normal-world 51.3%, fixture v40); every terrain edit reopens
the balance ledger for zero identified need. Its two gaps (#2 identity,
#4 dense zone) are answered by B2 typing and by ROSTER DIVERSITY — maps
get identities, one map does not get all terrains.

## 2. Audit: riverline vs the checklist

- Signature choke (3 bridges) matches §6 exactly — and §6's demanded
  counterplay already exists: fording (misery but possible), Skimmer
  amphibious crossing, and 3 separate crossings. The ruled 13E bridge
  demolition (hp, artillery-only breach, materiel repair, 13D blocked
  edges) completes the §6 "destructible + repairable" pattern.
- Layout is diamond (outer pairs N/S + bridge pair center) — good per §1.
- Known lean: west residue collapsed to ~58/42 under the tickets meta;
  still EXPERIMENTAL pending fine-tuning (backlog).

**DECISION: no geometry changes to riverline now.** 13E bridges is the
next riverline slice and may shift its balance anyway — tune once, after.

## 3. Map 3 — `blackwood` (dense woodland; the close-quarters answer)

Identity: the DENSE map (§5) frontier deliberately isn't. Forest
dominates; heavies are road-bound and mineable; scouts, bikes, mines,
satchels, and the Sentinel own the woods. Weather fronts here are
terrifying. The village/ambush fantasy in our vocabulary.

- **Terrain**: west-half gen mirrored east (constraint 4). Heavy forest
  walk budget (~50% coverage target), light rough scatter. Central road
  rows 62-65 + base approaches only — NO other roads. Clearings (open
  discs, radius 4) carved at every relay.
- **Trail ring**: vertical columns x=36 and x=91, y 28..99; horizontal
  rows y=28 and y=99, x 36..91 (mirror-closed span). Plus twin CENTER
  ALLEYS: trail columns x=58 and x=69, y 45..82, crossing the road —
  the ambush alleys through the deep woods.
- **Relays (8, majority 5)**: ring corners (36,28)/(91,28), (36,99)/(91,99);
  deep-woods pairs (58,45)/(69,45) and (58,82)/(69,82). The contested
  heart is OFF the road — tanks must leave the pavement or stand off.
- **Route graph**: exits (24,63)/(103,63); road junctions (36,63),(58,63),
  (69,63),(91,63); ring corners; deep relays. Road chain + ring trails +
  alley trails + open connectors. No BARRIERS (no water).
- **Runway check**: trails everywhere — uniques crew (constraint 5). No
  water: Skimmer rides trail affinity (416) instead of a river highway.
- **Patrols**: heavy 0: [[36,56],[52,63],[58,70],[44,63]] mirrored for 1;
  light runs the ring: [[36,28],[91,28],[91,99],[36,99]] (side-split at
  implementation; exact mirrors, 11C law).

## 4. Map 4 — `sawtooth` (canyon lanes; T_BLOCKING debut)

Identity: the ARMOR map. Three open lanes separated by impassable mesa
bands, pierced by narrow gaps — chokes with §6-compliant bypasses (the
other lane, and long exposed edge corridors). Open lanes give tank duels
and artillery arcs; the gaps give mines, Sentinels, and mortars their
stage. First map to use T_BLOCKING at scale.

- **Terrain**: mostly OPEN with mirrored rough scatter (west-half gen).
  Two BLOCKING mesa bands: rows 40-52 and rows 76-88, spanning x 20..107
  (mirror-closed; edge corridors x<20 and x>107 stay open — the risky
  back routes, §3). Each band pierced by two mirrored gaps at x 40..44
  and x 83..87; gap cells are T_PATH (lights sprint the pass, heavies
  crawl it, runway constraint satisfied).
- **Lanes**: north rows 0-39, central canyon rows 53-75 (road + bases),
  south rows 89-127.
- **Relays (6, majority 4)**: canyon heart (58,63)/(69,63); north lane
  (44,20)/(83,20); south lane (44,107)/(83,107). Gaps stay relay-free —
  pure chokes, held by presence not capture.
- **Route graph**: exits; heart pair; gap centers (42,46)/(85,46),
  (42,82)/(85,82); lane relays; lane-travel junctions above/below each
  gap. Road chain through the canyon; gap verticals tagged trail; lane
  horizontals open; edge corridors open (long — priced honestly so the
  graph only takes them when gaps are hazard-marked, which makes 13D
  shine here).
- **Patrols**: heavy patrols the canyon + near gap mouths; light loops
  its lane pair through the gaps. Exact mirrors.
- **Watch item**: BLOCKING at scale meets body-collision (17) and
  direct-drive for the first time — the slice must add a "no unit ever
  occupies/paths through T_BLOCKING" invariant probe to the battery.
- **MEASURED at landing (18B, 30+30+30+30 local)**: wall rule holds
  (probe clean), wars active and deterministic — but TWO gate failures,
  both real map findings:
  1. **Sentinel-anchor lean**: Sentinel-side wins 62-67% and the edge
     SURVIVES mirroring but FOLLOWS a faction swap; with UNIQUES=0 the
     map is dead even (14/16). The mesa gaps are ideal hardpoint
     anchors, and the Skimmer's water surface doesn't exist here — the
     map is structurally Directorate-leaning as drawn.
  2. **Horn-bound pacing**: ~87% of wars reach the 18000-tick horn;
     tickets NEVER end a war (each side holds its lane pair, contests
     the heart, 3-3 splits below the majority of 4) — riverline's
     first-landing pattern.
  **18C tuning pass planned**: wider or doubled gaps per band (less
  anchorable, more flanks), cross-lane capture pressure in doctrine,
  re-measure; promotion gate stays closed until both findings clear.

**18C, what the measurement actually found.** The horn-bound pacing was
NOT a stalemate — it was a CAPTURE FAMINE. `dbg_18c_probe.mjs` showed
the four lane relays at the lane ends (y 20/107) were never captured
once in any seed: owner stayed neutral for the whole war, every one of
the ~23 captures/war was the two heart relays trading. Max holding was
therefore 2 of 6 and the majority of 4 was mathematically unreachable,
so the pools never bled a single ticket (300,300 at the horn).

Root cause is a general map-design law, now recorded: **an objective
nothing passes within `CAPTURE_SEEK_CELLS` (16, Manhattan) of is a dead
objective.** The AI designates one capturer per (team, relay) from
assets already within that radius; nothing pulls a unit toward a relay
from further away. The lane-end relays sat ~39 cells from any patrol
waypoint, and the heavy patrols stood off the ENEMY heart relay at 18
cells — two past the radius — so neither side ever contested it either.

Fix (measured, not guessed): lane relays moved to the GAP EXITS
(y 34/93, within 14 of the gap centers every crossing unit uses) and
heavy patrols pulled in to reach the enemy heart. Result: tickets went
from ending 0% of wars to 36%, the horn from 87% to 60%, wars from
uniformly 18000 ticks to ~15.9k, and every relay now changes hands.
The gap-doubling idea was NOT needed for pacing and is held pending the
faction verdict — narrow chokes are the map's identity and should only
be widened if the anchor lean survives.

**18C battery verdict (4 × 30 wars).**

| run | A | B | und | tickets | horn |
|---|---|---|---|---|---|
| normal | 11 | 18 | 1 | 11 | 18 |
| mirror | 19 | 11 | 0 | 8 | 21 |
| UNIQUES=0 | 13 | 16 | 1 | 6 | 20 |
| FACTIONSWAP | 12 | 18 | 0 | 6 | 23 |

1. **The Sentinel-anchor lean is GONE.** The 18B conviction rested on
   the edge FOLLOWING the faction swap; it no longer does (swap leaves
   B ahead, exactly as the normal run). Relocating the objectives away
   from the lane ends dissolved the anchor advantage without touching a
   single stat — the structural fix specs/08 §3.7 asks for. **Gap
   doubling is therefore NOT built**; the narrow chokes stay.
2. **Pacing is much better but not finished**: tickets 0% → 36% of
   endings, horn 87% → 60% (frontier sits at 22%). A 6-relay map makes
   the majority harder to sustain than frontier's 8-relay web, since
   only the two heart relays swing freely.
3. **A mild side lean remains** (~55-60% to whoever holds the EAST) —
   it reverses under the mirror, so by specs/08 it is the
   geometry/arithmetic class, not doctrine. At n=30 none of these
   splits is individually significant; the direction is consistent
   across all three uniques configurations, which is what makes it
   worth chasing. **This is a job for the 300-war PC battery, not more
   local sweeps.**

Promotion gate stays CLOSED. Remaining before sawtooth leaves
experimental: the east-lean question at scale, and a decision on
whether 60% horn is acceptable identity for a grinding armor map or
wants a second pacing pull (candidate: cross-lane light patrols so
enemy lane relays get raided and possession swings more).

**18E — wall sliding changed this map's character completely, and the
verdict above with it.** Units were pressing their faces against mesas
for up to 4681 ticks (dbg_wall_stall.mjs); once they could slide along
the rock and stop when truly blocked, they started REACHING things:

| | horn | tickets | avg ticks | A / B |
|---|---|---|---|---|
| 18C (stalling) | 60% | 36% | 15876 | 11 / 18 |
| 18E normal | 13% | 83% | 12627 | 22 / 8 |
| 18E mirrored | 7% | 93% | 13104 | 24 / 6 |

Pacing is now BETTER than frontier (13% horn vs 22%). But the same
change re-opened the faction lean, and this time it is unambiguous: A
wins in BOTH worlds (73% normal, 80% mirrored), i.e. TEAM-linked, and
team A is the Directorate. The mechanism is the one 16B documented — the
Sentinel is a super-anchor in the TICKETS meta — and sawtooth just moved
from being points-decided to being ticket-decided. My 18C conclusion
("the lean is gone") was true of the map as it then played; it did not
survive making the map play properly.

**18F, therefore, is owed.** The gap-doubling cancelled in 18C is back on
the table on its merits (more crossings = less anchorable), as is a
cross-lane pull. And per the prompt-68 ruling, sawtooth is now a
candidate to ship EXPERIMENTAL-WITH-PREMIUM: a measured lean no longer
disqualifies a map outright if it is disclosed and the disadvantaged
side still plays well.

> **⚠ EVERY BATTERY VERDICT BELOW IS VOID (2026-07-30).** All of them
> were measured on the old cell-left-edge geometry, through a mirror
> transform that was not a true reflection (specs/08 §4). The coordinate
> convention has since changed, which moved every entity 128 units and
> changed the game as well as the measurement. Re-measured at n=40, BOTH
> maps flipped from side-linked to TEAM-linked leans — blackwood
> favouring the Outliers (a trail map: the Skimmer's affinity), sawtooth
> the Directorate (gap chokes: the Sentinel's anchors), which is the
> §3.7 per-map faction doctrine. Battery-scale re-measurement is queued.
> Read the sections below as HISTORY, not as current fact.

## 4b. Blackwood — the 600-war battery verdict (2026-07-29, VOID)

The first promotion battery to actually run. 300 normal + 300 mirrored,
on the PC, at the pre-18E commit (valid: blackwood has no blocking
terrain, so wall sliding is inert there).

| run | A | B | undecided | A-rate of decided |
|---|---|---|---|---|
| normal | 171 | 117 | 12 | **59.4%** |
| mirrored | 125 | 162 | 13 | 43.6% |

The edge FLIPS with the mirror, so by specs/08 this is the
GEOMETRY/side class, not team or faction: whoever holds the WEST wins
~59/41. Aggregate across both worlds is 51.5% — i.e. the engine is
equivariant (the mirror maps the outcome onto its reflection almost
exactly), but the MAP hands the west side a real advantage that a
player, who is side-bound in the normal world, will feel every war.
Undecided 4% is inside the bar; pacing is fine.

This is the same category as riverline's documented lean —
engine-fair, map-unfair — and it cannot come from terrain, which is
mirror-symmetric by construction and asserted cell-by-cell. The
suspects are the non-terrain asymmetries: relay id order in tie-breaks,
patrol phase offsets keyed to assetId, and spawn-row chassis order.

DECISION: blackwood does NOT pass the 45-55 band, so it stays
EXPERIMENTAL. Per the prompt-68 ruling it is now a candidate to ship
experimental-WITH-PREMIUM (the east side earns the underdog bonus)
while the west-lean cause is chased — the lean is disclosed, the map is
otherwise healthy, and the disadvantaged side is far from hopeless.

## 4c. Sawtooth — the 600-war battery OVERTURNS the 18E verdict (VOID)

| run | A | B | undecided | A-rate | tickets | horn |
|---|---|---|---|---|---|---|
| normal | 136 | 162 | 2 | 45.6% | 90% | 9% |
| mirrored | 189 | 111 | 0 | 63.0% | 90% | 8% |

**The lean is GEOMETRY, not faction.** The east side wins in BOTH mirror
worlds (team B when normal, team A once reflected). The 18E write-up,
based on 30 wars, called it team-linked and blamed the Sentinel anchor;
that does not survive scale. The faction conviction is withdrawn.

Pacing, by contrast, is now excellent and confirmed: 90% ticket endings,
~8-9% horn, **2 undecided in 600 wars**. 18C's relay relocation and 18E's
wall sliding did their job completely.

Note both new maps now carry side leans in OPPOSITE directions —
blackwood favours west (~59/41), sawtooth east. That argues against a
single global engine chirality and for per-map table geometry: relay id
order in tie-breaks, patrol phase offsets keyed to assetId, and
spawn-row chassis order are the suspects for both.

**18F is therefore a SIDE-lean hunt, not a faction retune** — and per
prompt-68 both maps are candidates to ship experimental-with-premium
while that hunt runs.

## 5. The bank — up to 6 later (one line each, in likely order)

1. **archipelago** — island chain, causeways + water highways; the
   Skimmer/logistics map; pairs with B2 PORT typing. (Watch faction
   fairness: leans Outliers; swap-gate before promotion.)
2. **rail_junction** — economy map around typed DEPOT/FACTORY nodes;
   build after B2 + salvage land so the types mean something.
3. **urban_grid** — BLOCKING city maze, close-quarters extreme; needs
   the sawtooth blocking-invariant groundwork first.
4. **salt_flat** — pure open + doubled weather cadence; the artillery
   duel map; cheapest of the bank.
5. **highland_ridge** — needs new map-tech: a terrain that BOOSTS sensor
   radius (our verticality analog, §9). Design doc first.
6. **fortress_breach** — attack/defense session-rules scenario (the
   objective-phases idea from the evolved eval, special mode not core).

## 6. Build order (decided)

1. **18A blackwood** — now (no new engine tech; pure profile slice).
2. **18B sawtooth** — next (adds the blocking-invariant probe).
3. **18C sawtooth tuning** — the two landing findings (Sentinel-anchor
   lean, horn-bound pacing); before or alongside 13E.
4. **13E bridges** — riverline's signature, unchanged in the queue;
   after it, riverline gets its tuning pass.
4. B-list interleaves as before (B1 → B3 → B2 typing, which then
   retro-types relays on ALL FOUR maps).

Promotion gate per map (same as riverline's): suite green, 5-seed local
gate, 300-war batch on the PC (A-rate 45-55, undecided <5%), mirror
probe clean, THEN default rotation eligibility — until then MAP= opt-in.
