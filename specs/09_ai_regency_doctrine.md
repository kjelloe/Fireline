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
6. **roleUnique** (16B, DORMANT flag) — no crewed faction unique →
   grab it.
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
- **Escort doctrine (ruled, to build)**: the raid launches only with
  ≥2 combat escorts moving alongside (~6 cells) OR through a sneak
  window (enemy strength near the route under threshold); aborts if
  the escorts die.
- Patrols: per-profile mirrored tables; light chassis ride the trails;
  hard difficulty pushes relays instead.
- Pings: sparing (30 s/seat) — escort calls, recovery announcements,
  mine warnings from scouts.

## Movement

All long hauls route via the 13C graph (roads/trails/bridges,
per-chassis costs, equivariant tie-breaks); short hops (<14 cells) and
amphibious hulls go direct. Waypoints recompute statelessly from the
current cell each plan cycle.

## Post-mortems worth remembering

- **Everyone-diverts capture** froze wars at 0-0 → one capturer per
  (team, relay).
- **Global recoverer pick** left one team unable to recover → per-team.
- **Rearguard stationing** (trucks hold behind the front) looked
  sensible and carried a ~25-point side chirality — REMOVED; truck
  survival (roleTruck) alone restored the tow economy. Doctrine that
  parks units at asymmetrically-derived anchors is a chirality risk.
- **Standing-fortress Sentinel** swept 78/19 → deploy is threat-
  reactive only (and still dormant pending 16B's residue).
