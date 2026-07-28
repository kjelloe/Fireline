# Session Report — 2026-07-29 (branch `dev_night`)

Suite **547/547**, fixture v40 (no repin this session — every change was
map-local, client-side, or inert on existing maps). Six commits since the
last push point. Two new maps, one measured tuning pass, ten playtest
items, and the batch worker taught to unblock itself.

## Slices

| Slice | What landed |
|---|---|
| 18A | `blackwood` — the dense woodland map; specs/10 map roster (audit + designs + 6-map bank) |
| 18B | `sawtooth` — canyon lanes, first use of T_BLOCKING; the WALL rule; generic `map` battery job |
| — | Review round: map roster across CLAUDE/README/specs index/skill/ledger; per-map faction doctrine |
| 18C | Sawtooth tuning — the capture famine found and fixed |
| — | Batch worker autostash (prompt 66) |
| 18D | Playtest 8, ten items |
| 18E | Wall sliding (found by this round's own gap analysis) |

## Three findings worth your attention

**1. Sawtooth was not stalemated — it was starving.** The map ran to the
horn in 87% of wars, which looked like a pacing problem. It was not: the
four lane relays were never captured ONCE in any seed. The AI designates
a capturer only from assets already within `CAPTURE_SEEK_CELLS` (16,
Manhattan); nothing pulls a unit toward a relay from further out. My
relays sat ~39 cells from the nearest patrol waypoint, and the heavy
patrols stood off the enemy HEART relay at 18 cells — two past the
radius. So max holding was 2 of 6, the majority of 4 was mathematically
unreachable, and the pools never lost a single ticket.

Moving the relays to the gap exits took ticket endings from **0% to 36%**
and the horn from **87% to 60%**. This is now a general law in the
rulings register and the map constraints: *an objective outside capture
reach of real traffic is a dead objective.*

**2. The same fix dissolved the faction lean, so a planned change was
cancelled.** 18B convicted the Sentinel of a 62-67% anchor advantage
(the edge followed a faction swap). After 18C it no longer follows the
swap — moving the objectives removed the anchor value without touching a
single stat. The planned gap-doubling was therefore NOT built; sawtooth
keeps its narrow chokes. This is the structural-lever-over-stat-lever
principle from specs/08 §3.7 actually paying off.

**3. The wall rule had a silent cost, found by asking what it touches.**
Refusing entry to rock keeps units out of mesas — and the invariant test
proves that — but a unit whose target lay across a mesa pressed its face
against the rock for up to **4681 ticks (~8 minutes)**, effectively out
of the war, while still reporting itself as MOVING. Now: a glancing
approach slides along the face (fallbacks ordered by AXIS, so slides
commute with the mirror), and a head-on approach stops the unit so the
planner re-engages. Measured wall stalls: **4/9/6 assets per war → 0/0/0**.

## Playtest 8 — what each item turned out to be

Three of the ten were one bug: the follow camera resolved "me" as
`friendlyAssets.find(mine) ?? friendlyAssets[0]`, and that fallback
centred on a random teammate whenever you had no asset — downed,
respawning, or riding a carrier. That is items 25, 29 and half of 30.
Selection while downed was engine-refused with the reason landing as raw
English in the corner feed, which is the other half of 30.

Item 23 (marker 180° out) was real and I had wrongly cleared it once
before: the rotation MATH was correct, but the chevron's two blades
splayed to meet at the back while the small tip cone pointed forward, so
the dominant shape read backwards. **Lesson recorded: for a visual bug,
reason about the rendered shape, not only the transform.**

The rest landed as asked: crawl affordance named in the banner (24), fog
announcement (26), war clock at half/quarter/final/last-30s (27),
right-drag panning (28), stats on a key (31), Next-asset greying (22).

## Numbered questions for you

1. **Sawtooth still ends 60% on the horn** (frontier: 22%). Is a grinding
   armor map allowed its own slower identity, or do you want a second
   pacing pull? The candidate is cross-lane light patrols so enemy lane
   relays get raided and possession swings more.
2. **A mild east-side lean remains on sawtooth** (~55-60%, reverses under
   the mirror, so geometry-class). At n=30 it is not significant. It
   needs the 300-war PC battery to confirm or dismiss — no local sweep
   can settle it.
3. **Base-area seat swapping (item 22)** — you expected "Next asset" to
   work only inside a base. The engine has no such rule today and the AI
   crewing ladder depends on field swaps, so I did NOT add it. Do you
   want it as a real rule? It needs a reducer gate, an AI answer for
   field re-crewing, and a sweep.
4. **Stats key is I, not S** — s is a WASD pan key, so binding stats to it
   would drag the camera while you read. Happy to switch if you would
   rather lose pan-down.
5. **Blackwood has had no playtest yet.** It measured a genuinely
   different identity (quiet, positional: 12 downs/war vs frontier's 70).
   Worth knowing whether that reads as tense or as dull before it earns
   promotion.

## Still blocked on you

The PC worker is idle on an old commit with a diverged checkout, so no
map battery has run. It needs one manual fix (`git status`, then either
`git stash` or `git reset --hard origin/dev_night`, then `git pull
--ff-only && bash tools/batch_worker.sh`). After that it self-heals: the
`update` job now autostashes, and reports divergence by naming the local
commits instead of guessing.
