# Weapons Cache — design brief (Q58, ruled GO prompt 129)

Second rung of the Q39 per-map specials ladder (specs/12 §Q39: vault →
**cache** → alloys → laboratory). Written 2026-08-02; RULED prompt 145
(Q64 sawtooth-first, Q65 aura-while-owned, Q66 plain seek) and LANDED
the same day: **kind 5** (the pulled vault keeps kind 4), the pair at
sawtooth's lane chokepoints (44,63)/(83,63), aura R5 -25% integer
((base*3)>>2) in the reducer fire path, CACHE=0 kill-switch, tests in
test/cache.test.js. Site count 6→8, ticket majority 4→5 — the battery
pair + a CACHE=0 A/B judge the map.

## What it is

A **site personality**, not a new system: `site.kind = 4` on the B2
typed-node pattern (RADAR 1 / DEPOT 2 / FACTORY 3 are precedent — kind
is already hashed, already rendered as a badge, already capture-able by
the ordinary relay rules). A captured Weapons Cache gives its owner a
**fire-tempo aura**: friendly assets within the aura reload faster.

## The effect (recommendation: reload tempo, not stock)

| Option | Effect | Verdict |
|---|---|---|
| **A. Reload aura (recommended)** | assets within R cells of an owned cache reload 25% faster | one integer site in the fire path, zero new commands, clearly distinct from DEPOT |
| B. Ammo capacity/refill pulse | more shots near the cache | overlaps DEPOT's forward-resupply identity — two nodes doing one job |
| C. Ordnance rack (mines/satchels refill) | consumable restock | niche; touches three systems for a boon most chassis never notice |

Option A mechanics: on `fire`, if the shooter stands within R of a
cache its team owns, set `reloadTimer = (stats.reloadTicks * 3) >> 2`
instead of full. Integer, deterministic, one reducer site, headlessly
testable. Distance is Chebyshev on cells via `sampleCellX` (boundary-
parity law applies — the aura EDGE is a decision keyed to continuous x).

**Numbers to start**: R = 5 cells, -25% reload. Artillery/mortar
included (siege tempo is the interesting dial); drones/sites excluded.

## The vault's lessons (why this design is shaped this way)

The vault (+tickets/tick, rung 1) shipped first and was PULLED when its
pair showed a chirality coupled to the directional residue (the
north-trail approach). The cache avoids that class by construction:

1. **No movement surface.** The aura changes reload, never speed,
   pathing, or approach — the tie-law family (specs/08 §7/§7b) is
   untouched.
2. **Mirror-paired placement is enumerable.** The pair lands in
   `MAP_LAYOUTS` relayCells with `kind: 4` and the existing
   mirror-closed enumeration tests cover it for free.
3. **Kill-switch from day one.** `rules.cacheAura = false` (env
   `CACHE=0`) on the RAIDPARTY=0/POWARC=0 precedent, so the ab lane
   can bisect it and a bad verdict never needs a revert.

## Where it ships (designer decision — Q64)

The cache wants a map where fire-tempo duels are the story:

- **Sawtooth (recommended first)**: the canyon chokes are standing
  duels; a cache pair at the mesa gaps gives the map its own
  personality lever, and sawtooth is HELD anyway — a cache trial
  rides the same re-battery it already owes.
- Frontier: works, but the default map should stay the *plain* read
  every other measurement is normalized against.
- Blackwood already has RADAR+DEPOT personalities; a third node
  crowds its quiet identity. Riverline's story is the crossing.

## Protocol (unchanged, the map-special gate)

1. Tests first: aura math, mirror-pair enumeration, kill-switch,
   kind-4 capture behaves as a plain relay otherwise.
2. 5-seed gate + local 32+32 mirrored on the target map.
3. PC battery PAIR (`map sawtooth 300 0 1` + `300 1 1`) against the
   fresh post-ladder sawtooth baseline (queued 2026-08-02), plus an
   `ab` rung with CACHE=0 for attribution.
4. Encyclopedia entry + strings (both locales) + badge art before it
   faces a human.

## Open questions for the owner

- **Q64**: ship map — sawtooth first (recommended), or hold for the
  sawtooth playtest verdict so one variable moves at a time?
- **Q65**: does suppression pause the aura (suppressed shooters
  already can't fire — the question is whether a suppressed CACHE
  still radiates)? Recommendation: the aura is the site's, not the
  garrison's — it radiates while owned, full stop. Simple to state,
  simple to test.
- **Q66**: AI capture-seek weight — does kind 4 get a doctrine
  preference (like DEPOT's resupply-runner affinity), or is plain
  nearest-relay seeking enough for v1? Recommendation: plain for v1;
  measure, then weight.
- **Q67** (sequencing): the pulled VAULT's re-test (VAULTS=2 ab rung,
  meaningful post-ladder) — run it before the cache lands so the
  specials ladder advances on data, or let the cache leapfrog?
