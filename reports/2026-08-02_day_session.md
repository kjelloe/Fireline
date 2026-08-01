# Session report — 2026-08-02 (prompts 126-132, the 7-hour window)

*Branch `dev_night`, suite **735/735**, fixture **v65**, all pushed.
The battery appendix at the bottom carries the freshest n=300 reads.*

## The equivariance ladder — CLOSED, and it paid

Eight rungs, each found by instrument: prison mirror → A* origin-side
ties → boundary-parity law (+78-site sweep, lint-enforced) →
park-east chirality → segmentBlocked floors → baseCentreCol (the
prison bug's twin ×5 sites) → centre-facing rebuilds → probe
centre-anchor exceptions. First-divergence horizon **tick 2 → 6280**;
what remains is the designed half-cell of centre-anchored objectives.
**The payoff: POWS fairness moved from 24% to 47.1% A in band** —
which unlocked your Q46 ruling, then Q59's refinement to
`powPreplaced: 1`. Doctrine now lives in specs/08 §7/§7b (the three
tie laws) + two lint tests.

## Your rulings, shipped

- **Q46 → Q59**: powPreplaced 2 shipped, then refined to **1** on the
  pacing read. Verification battery: fairness 46.5/43.7% A
  (band-edge — see the flag below), pacing 28.5 min / 46% horn.
- **Q53/Q56/Q47**: recorded (roads stay wall-free; landship stays
  human-only pending your feel; convoy tuning waits on your playtest).
- **Q57 queue executed**: caldera fix → heist → figure-kit r2 +
  ambients. Riverline pacing remains (see below).
- **Q58**: the cache brief is owed — it rides on the vault re-test,
  which now rides on the caldera/uniques verdicts.

## Slices landed this window

| Slice | Verdict |
|---|---|
| `slice-caldera-fix` | Hypothesis CONFIRMED by discriminator (the raider's clause was the stomp factory); clause now OFF by map law. But the n=600 battery flipped the lean the OTHER way — see the red flag. |
| `slice-heist` | Mode #2 engine-complete: one-sided standard grab, heist canScore exception, defender radio, vote/env/strings, +4 latent `standards.length===2` gates purged. AI attacker LAUNCHES but doesn't survive (1/300) — the convoy maturation path, tuning owed. |
| `slice-ambients` | Figure-kit r2: farmhands flee your tanks, road workers kneel at the verges, one trader cart shuttles the road — pure f(seed, tick, terrain) on the weather precedent, viewer-local reactions, zero engine surface. Left undocumented in RUNNING on purpose: ambient life should be discovered. |
| Doctrine gates | Mission-war attackers designate no capturers + fight on the move; heist vault guard capped at 3. Benefits convoy too (re-battery queued). |

## RED FLAGS for your review (the honest section)

1. **Caldera traded pathologies**: clause-off, the n=600 battery reads
   **66/70% A in both worlds** (was 31.7% the other way), with 37%
   ELIMINATION endings — a death circle. The n=30 landing gate (60/50)
   could not see it. Discriminators queued (factionswap + UNIQUES=0):
   if the lean tracks the unique pair, it's the Sentinel's ring
   (sawtooth's lesson mirrored). Caldera stays EXPERIMENTAL/RED.
2. **Q59's lever underdelivered on pacing**: 28.5 min / 46% horn vs
   the 30/51 it replaced — the slow-war driver is the POW-era
   doctrine itself (parties, defenders, capture churn), not just
   locked seats. Fairness also sits at band-edge (45.1 aggregate).
   Options when you're back: a pool/bleed ladder for the era, or
   accepting the slower identity, or powPreplaced 0 for the classic
   tempo with POWs as human-session flavour (POWS=2 env).
3. **Heist needs its tuning round** — engine sound, regents can't
   crack a defended vault yet. Playtest will say whether humans can.

---

## Battery appendix (n=300 per row, collected end of window)

| Battery | Result | Verdict |
|---|---|---|
| Q59 default (powPreplaced 1) | 46.5% / 43.7% A | band-edge fairness + pacing lever underdelivered (28.5 min / 46% horn) — Q59-followup below |
| heist att0 / att1 | attackers 0.3% / 0.3% | AI attacker can't crack a vault (known; engine sound; playtest will judge the human game) |
| convoy att0 / att1 (re-run under the new gates) | attackers 9.7% / 10.3% | **REGRESSION from 27/19%** — the mission-attacker gates cost convoy. Working hypothesis: zero capturers = zero forward SUPPLY (halved speed, no fire off the web). The refinement is route-spine capturing, not none. Banked, not applied. |
| caldera factionswap | 68% A (lean did NOT flip) | not the specific unique |
| **caldera UNIQUES=0** | **146/149 — DEAD FAIR** | **the lean is the unique PAIR, team-A-keyed regardless of arrangement** — this is the old 16B "unknown A-keyed residual" from the crewing era, amplified by the ring. Caldera stays RED with the mechanism finally named. |

## New questions from the data

| # | Question | Owner |
|---|---|---|
| Q60 | Caldera lever: UNIQUES OFF by map law (measured fair, but kills faction identity there), or hold RED until the A-keyed pair mechanism is hunted (it's the last 16B ghost)? | you |
| Q61 | Q59 follow-up: the POW-era tempo driver is doctrine, not locked seats. Pool/bleed ladder for the era, accept the slower identity, or powPreplaced 0 with POWS=2 as the human-session flavour? | you |
| Q62 | Convoy gates: apply the route-spine capturer refinement (attackers capture along the push corridor only), then re-battery? | you (recommend YES) |

---

## Morning-after addendum (prompt 133): all three rulings resolved

- **Q61 shipped**: powPreplaced 0, classic tempo default, POWS=2 as
  the human-session flavour (fixture v66).
- **Q62 shipped + VERIFIED**: route-spine corridor capturing took
  convoy attackers to **32%/34% at n=600** — the best config measured,
  side gap closed.
- **Q60 DISSOLVED before it was hunted**: the caldera A-lean existed
  only under powPreplaced 1 — on the classic default the ring reads
  **54.3/51.7% A, in band both worlds**. The "16B ghost" on caldera
  was a POW×unique×ring coupling; your Q61 ruling removed it from the
  live game. No uniques-off law needed.
- **New: Q63** — caldera's identity: fair now, but a death circle
  (13.1-min medians, 63% elimination endings). Bless the brawl-map
  identity, or tune MPG/pool for the ring? Your playtest decides.

---

## Afternoon addendum (prompts 134-137)

| Work | Verdict |
|---|---|
| Review round | CLAUDE/skill/RUNNING synced to the settled state (ladder closed, powPreplaced arc, era table); Q62 corridor pin test |
| Composer brief | `specs/game-soundtrack-design.md` + a shareable **.html** twin — 12 prioritized tracks, Fireline motif, OGG intro+loop delivery rules. Music on/off toggle already ships in options (`opt-music`) |
| `slice-riverline-pacing` | Q57 queue COMPLETE. Stalemate attrition (both pools grind when the war is joined but nobody holds majority) + B3 overtime cap (600 ticks, fixture v67) + heart-relay rule. **Horn 34% → 0%** local 32+32 both worlds, median ~18.5 min, 51.6% A agg / 47% flip (fair chaos). Suite 746/746 |
| Batch-lane hygiene | A void riverline battery (74.7% "A-lean" = stale worker build + the map job's uniques:0 default) exposed two config-drift rungs — both now in the skill. Lane rebuilt update-first: **1,800-war post-ladder era-table refresh queued** (riverline/sawtooth/blackwood mirrored pairs, uniques-on). Ignore the two stale done-mails (map_sawtooth/map_blackwood on 4b3b053) |
| Q58 delivered | `specs/13_weapons_cache_brief.md` — site.kind 4 reload-tempo aura (R5, -25%), vault-pull lessons as design constraints, CACHE=0 kill-switch, sawtooth-first proposal |

### New questions (Q64-Q67, detail in specs/13)

- **Q64**: cache ship map — sawtooth first (recommended), or hold until your sawtooth playtest?
- **Q65**: cache aura while the site is suppressed — recommend: radiates while owned, full stop.
- **Q66**: AI doctrine weight for the cache — recommend: plain capture-seek v1, measure first.
- **Q67**: run the pulled vault's VAULTS=2 re-test before the cache lands, or let the cache leapfrog?

Your playtest, whenever you have time: riverline pacing (`MAP=riverline npm start` — a stalled war now grinds), the heist mode (`MODE=heist`), and sawtooth-with-premium are the three most verdict-hungry.

---

## Evening addendum: the era-table refresh came back — and opened a hunt

The 1,800-war refresh (all on the right build this time, verified by
done-mail hash):

| map (n=600, uniques-on, mirrored pairs) | A-rate | verdict |
|---|---|---|
| riverline (post-pacing) | 53.0 / 60.7% | **tempo VERIFIED**: horn 0/600, undecided ~0, median ~19 min — the pacing slice holds at scale. But an A-keyed lean (56.9% agg) is now visible |
| sawtooth | 56.3 / 54.7% | the held lean persists unchanged — premium stays, no news |
| blackwood | **62.0 / 59.7%** | **REGRESSED** from the 49.2% promoted read; POWS=2 amplifies it to 94% A (local n=32) |

**THE A-KEYED HUNT (top open item)**: endpoint verified — blackwood at
`d37e979` (the old baseline commit) reads 43.8% A on the same seeds
that read ~62% on HEAD. The regression lives in `d37e979..937b1af`,
a span containing the whole equivariance ladder. Both worlds lean A on
both maps, so it's team-keyed, not geometry. Frontier post-Q61 pair is
queued on the PC — if the default map also drifted, the prime suspect
is the old Q18 execution-order first-strike bias (~6 pts A, fix
proposed but never applied) unmasked by the ladder removing geometric
compensators. Bisection next.

**Q68**: blackwood is PROMOTED and in the vote pool — keep serving it
while the hunt runs, or pull it back to EXPERIMENTAL until fair again?
(Riverline/sawtooth were already EXPERIMENTAL/HELD, no status change.)

Also this evening: your mobile-connectivity writeup (prompt 139) is
recorded and adopted as the next slice — grace window, token identity,
persist-on-hide, reconnect-on-visible.

---

## Night addendum: the farm, the fix, and the clean verdicts

**Blackwood is RESTORED**: post-fix battery pair 51.0 / 48.3% A
(n=600, edge flips = fair chaos). The landship farm was the entire
regression — promotion stands, **Q68 dissolved**. The mechanism, for
the record: the anti-camping pass drafted the neutral landship as a
camper, and the foe computation on team -1 minted its punishment
drone for team A — a free scored kill on a 1000-tick respawn loop,
every map, all war. The 5-seed gate showed A's scores drop by exactly
the farm's take (20-30/war) with B's identical.

**Riverline's lean is its OWN**: 54.5 / 59.3% A post-fix — the 56.9%
aggregate survived the farm fix unchanged. **Q69 filed**: hunt it now
or after your playtest? Prime suspect: the old Q18 execution-order
first-strike bias (~6 pts A, fix proposed but never applied) being
CONVERTED into ticket wins by the new stalemate attrition (score-
decided endings were always A-tinted; attrition-decided endings may
inherit the same tint through wreck-count differences). A pacing-off
A/B rung (STALEMATE=0 env, to be added) would separate the two in one
battery.

**Mobile resilience** (prompt 139) landed: token takeover (a resumed
phone evicts its own stale socket — the iOS-resume killer), client
auto-rejoin, reconnect-on-visible, no-briefing-replay on resume.

Suite 750/750. Fixture v67. All pushed to dev_night.

---

## Late-night addendum: mode batteries + the residue's new instruments

CORRECTION first: my turn summary earlier misread the heist mail as
"96% westbound attacker" — "A wins" in a done-mail is TEAM A, who is
the DEFENDER in att=1. The corrected, probe-consistent verdicts:

| battery (n=600/mode, 849fb27) | read | meaning |
|---|---|---|
| Convoy attackers | **41.3% east / 64.7% west** (was 32/34) | escort-wall fix raised BOTH sides; a 23-pt DIRECTIONAL gap surfaced |
| Heist attackers | **8.0% east / 3.7% west** (was ~0.3) | alive, far under bar — Q70 getaway levers with you |
| Riverline uniques-off | **47.2 / 34.7%** (vs 54.5/59.3 on) | Q69 ANSWERED: the unique pair swings ~16 pts toward A on the water map; beneath it, an east-side curse ~9 pts both worlds |

**The through-line**: eastbound convoys -23, east-side riverline -9,
eastbound POWS deaths 3x, the 16d step drift — one signature. THE
DIRECTIONAL RESIDUE (already top of the KNOWN OPEN queue) now has
macro instruments: a convoy A/B pair reads a 23-pt signal for ~6 min
of PC time. When you green-light the residue hunt, that's the probe.

**Your queue**: Q63 caldera identity · Q64-Q67 cache/specials · Q69
riverline unique-pair lean (accept with disclosure, premium-style, or
tune?) · Q47b convoy bar + side gap · Q70 heist getaway levers.
