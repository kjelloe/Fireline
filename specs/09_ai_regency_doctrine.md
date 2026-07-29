# Fireline Command — AI Regency Doctrine Compendium

**Status:** Living reference for `engine/ai_regency.js` — what the
regents do and WHY each rule exists (most were forced by a sim-observed
failure; the failure is the documentation). The regency is pure: it
emits ordinary reducer commands, no randomness, no wall-clock.

## Seats

16 fixed agents pair operators 16–31 with assets (0–7 originals,
8–11/20–23 first reserves); pairings never reorder (1D-pinned).
Disconnected humans fall to regency takeover (3C) and get their seat
back on return. Emission order alternates lead team by tick parity
(16A — the first-strike fix).

## The crewing ladder (a freed or fresh seat picks, in order)

1. **roleCarrier** — team has no crewed operable carrier → grab one
   (the standard run must always be possible).
2. **roleBike** — own standard dropped and nobody fast is on recovery →
   grab the garage bike (fastest return in the war).
3. **roleTube** — no crewed indirect gun → grab mortar/artillery
   (replacement fire support).
4. **roleTruck** — no crewed tower → grab a truck (13C lesson: a dead
   truck used to zero team tows for a whole war; 85→0 in one sweep).
5. **Fixed agent's own paired asset**, when operable and free.
6. **roleUnique** (16B, LIVE — default ON since prompt-54) — no crewed
   faction unique and the map gives Riverline Drive a surface (water OR
   trails) → grab it. The Sentinel never takes capture errands (it
   defends via reactive deploys); the Skimmer races trails at 384.
7. Regented seats fall back to lowest free operable asset.

## Errand priority (per idle asset, roughly in order)

- Fire doctrine: engage nearest visible enemy in range while in supply;
  standard-carriers are priority targets (the mutual-carry standoff
  counter); swat drones pestering you (direct guns only).
- Down management: redeploy when the timer allows; re-crew per ladder.
- Trucks: clear adjacent marked mines; resupply the thirstiest nearby
  teammate (tubes first); haul materiel to damaged sites; hook nearest
  claimable wreck / haul home.
- Carriers: deliver passengers; fetch walking downed teammates
  (unless raiding).
- Tanks: fortify — mine near owned relays (off the flag cell).
- Capture-seek: ONE designated capturer per (team, unowned relay) —
  nearest eligible; capturer stands ON the flag (the dwell is the
  capture); won't stare down a flag it cannot shoot at (supply).
  Equivariant tie-break ladder on relay choice.
- Standard play: carrier raider goes for the grounded enemy standard;
  carriers head home to score; the fastest controlled seat recovers a
  dropped own standard.
- **Escort doctrine (LANDED, slice-11x)**: escort ASSEMBLY — when the
  raider wants to launch, the two nearest idle-line combat seats (not
  capturers/train/tubes) are designated and CONVERGE on the carrier;
  the window opens at ≥2 escorts within 6 cells OR a sneak gap (fewer
  than 2 enemies near the track); escorts FOLLOW pre-gate (re-target
  the moment the carrier drifts >2 cells from their destination); a
  raider whose window closes HOLDS if ≥2 escorts are inbound within 12
  cells, else retreats home. Three probe-forced iterations — passive
  windows never fire; stale-position followers get raiders killed.
- Patrols: per-profile mirrored tables; light chassis ride the trails;
  hard difficulty pushes relays instead.
- Pings: sparing (30 s/seat) — escort calls, recovery announcements,
  mine warnings from scouts.

## Movement

All long hauls route via the 13C graph (roads/trails/bridges,
per-chassis costs, equivariant tie-breaks); short hops (<14 cells) and
amphibious hulls go direct. Waypoints recompute statelessly from the
current cell each plan cycle. Impassable cells are walls, not slow
ground (18B) — doctrine never needs to steer around them explicitly,
but a patrol table that points THROUGH one would stall units at its
face, so per-map tables are drawn on the map's real lanes.

Every profile owns three mirror-closed tables, added together or not at
all: `MAP_LAYOUTS` (relays, standard homes), `route_graph.js` GRAPHS
(nodes/edges), and PATROLS here (heavy + light variants). Light patrols
ride the flanking surfaces (trails, ring, gaps); heavy patrols work the
road and the objective mouths.

## Bridges (13E-2)

- **Siege**: a siege tube with nothing better to shoot may drop a span,
  but ONLY when its side is losing that crossing (the enemy holds more
  relays on the far bank). A winning team leaves the road open because
  it wants to drive on it — demolition is a momentum-breaker, not an
  opening move.
- **One besieger per span**, lowest operator id in range (the
  capture-seek designation pattern). Without it every tube in the war
  shells the same crossing and nothing else gets done.
- **Rebuild**: the truck materiel errand also considers a dropped span,
  ranked after damaged relays. Either team may rebuild any bridge
  (prompt-70), so the only question is distance.
- Probed before being trusted (`dbg_13e2_doctrine.mjs`): 3/3 wars saw a
  span dropped, 29 shells / 6 breaches / 5 rebuilds, spans down 2-49% of
  a war. A doctrine that never fires looks exactly like one that works.

## Post-mortems worth remembering

- **Everyone-diverts capture** froze wars at 0-0 → one capturer per
  (team, relay).
- **Global recoverer pick** left one team unable to recover → per-team.
- **Rearguard stationing** (trucks hold behind the front) looked
  sensible and carried a ~25-point side chirality — REMOVED; truck
  survival (roleTruck) alone restored the tow economy. Doctrine that
  parks units at asymmetrically-derived anchors is a chirality risk.
- **Standing-fortress Sentinel** swept 78/19 → deploy is threat-
  reactive only. (Uniques crew by default since prompt-54; the residue
  was decomposed and band-tuned rather than switched off.)
- **Patrol tables are objective plumbing, not scenery** (18C): capture
  pressure exists only where a patrol brings a unit within
  `CAPTURE_SEEK_CELLS` of a contested relay. Sawtooth's first tables
  stood off the enemy heart at 18 cells and never visited the lane
  relays at all — so those relays were NEVER captured in any seed and
  the map could not bleed a single ticket. When adding a map, check
  every relay against every patrol waypoint before trusting a sweep.
- **Threat-reactive is still terrain-sensitive** (18B): the same
  reactive Sentinel is worth ~51/49 on frontier and 62-67% on sawtooth,
  because mesa gaps are perfect anchors. Doctrine tuned on one map is
  not validated for the next — see specs/08 §3.7.
