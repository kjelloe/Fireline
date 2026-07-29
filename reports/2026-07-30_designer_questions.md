# Fireline Command — four design decisions

*Written for a designer who does not need to know the codebase. Everything
here is measured, not guessed: each war below is a full AI-vs-AI match,
and the numbers come from batches of 300–600 of them.*

---

## How the game currently ends

A war can finish four ways. Knowing the mix matters for every question
below:

- **Tickets** — each team has a pool (currently 300). You drain the
  enemy's by holding a majority of the relay points, and since recently
  also by destroying their vehicles. Empty pool = defeat. This is the
  "attritional" ending.
- **Command Standard** — steal the enemy's standard and carry it home.
  This is the headline objective, the one that makes stories.
- **Points horn** — nobody achieved anything decisive and a 30-minute
  timer expires; highest score wins. This is the *anticlimax* we have
  been trying to design away.
- **Domination** — one side holds every point for 30 seconds. Rare.

We have three maps: **frontier** (the default: open corridor, eight
relays), **blackwood** (dense woodland, fighting off the roads), and
**sawtooth** (open lanes divided by impassable rock, crossed through
narrow gaps).

Two factions share one roster except for a unique vehicle each:
**Directorate** field the *Sentinel*, which deploys into a static
hardpoint — strong when anchoring a chokepoint. **Outliers** field the
*Skimmer*, which crosses water and moves fast on trails.

---

## Question 1 — The factions are out of balance again. What is the target, and which lever?

**Context.** We tune faction balance by simulating hundreds of wars and
measuring the win split. We had it at roughly 51/49 — as even as this
kind of game gets.

Then we fixed a long-standing bug in how the world's geometry was
represented. Every vehicle in the game effectively shifted half a tile.
That sounds tiny; it changed enough that all our old balance
measurements became meaningless and had to be re-run.

**The new measurement (1,800 wars):** the Outliers now win about **57–62%**
on the default map, and slightly more than half on the other two. We
confirmed this is a *faction* advantage rather than a map-side advantage
by re-running every match with the world mirrored — the Outliers keep
winning either way, which means the advantage travels with the vehicles,
not with the terrain.

**What we need from you:**

- **The target.** Return to ~52/48, or is a wider spread acceptable
  given the factions are meant to feel different?
- **Which lever.** Last time we tuned two numbers: the Skimmer's speed on
  trails, and the Sentinel's hull strength. That worked, but we learned
  it *saturates* — each further adjustment bought less and less, because
  the Sentinel's real strength is its ROLE (anchoring a point) rather
  than its statistics. The alternative we filed at the time was a
  structural change: give the Skimmer a *capture-speed* advantage, so
  the Outliers' edge is "we take ground faster" instead of "we are
  quicker". That is a bigger design statement.

Statistics are the cheap fix; the structural change is the interesting
one. Your call.

---

## Question 2 — Wars are getting shorter. Is that good?

**Context.** The design target has always been a 20–30 minute session.
Each pacing improvement we have made has also shortened wars, because
each one makes the war *decide* sooner:

| Build | Typical war length |
|---|---|
| Before "meaningful deaths" | ~24 minutes |
| After deaths cost tickets | ~22 minutes |
| After trucks repair damaged vehicles | ~21 minutes |
| After the mercy rule | **~17½ minutes** |

None of these was aimed at length — they were aimed at making wars
*end decisively instead of timing out*, and they succeeded: the
anticlimactic horn ending fell from 27% of wars to 5–13%.

**The trade.** A shorter war is denser and more decisive; a longer one
gives comeback stories room to happen and suits a drop-in session where
players arrive mid-match. The lever is a single number — the ticket pool
— so this is genuinely a preference, not an engineering constraint.

**What we need from you:** raise the pool to restore ~25 minutes, or
keep the tighter 17–18 minute war?

---

## Question 3 — Is blackwood's character right, or is it a fault?

**Context.** Blackwood is the dense woodland map. Playtest verdict was
"more difficult, which was good", so its *difficulty* is settled. But it
behaves differently from the others in two measurable ways:

- **A third of its wars still end on the timer** (the default map: 13%).
- **Two to four vehicles get towed to safety per war**, against about
  twenty on the other maps.

The second is a direct consequence of the terrain: in dense woodland,
wrecks are hard to reach, so the recovery-and-rescue loop — which is the
emotional core of this game — barely runs there.

**What we need from you:** is that the map's identity (a grim, attritional
forest where the wounded are left behind), or a fault to fix by opening
routes so recovery teams can work?

---

## Question 4 — Should the two newer maps go into rotation?

**Context.** Both were built recently and marked experimental. They are
now measurably *as fair as, or fairer than*, the default map, and
sawtooth in particular has the best pacing of anything we have: 96% of
its wars end decisively on tickets, only 3% time out, and one war in six
hundred was left undecided.

Blackwood has had a human playtest. Sawtooth has not.

**What we need from you:** promote both once the faction balance is
retuned, or hold sawtooth back for a human playtest first? (A playtest is
scheduled, so this may answer itself.)

---

## One thing you may find interesting

The bug behind all of this is a good cautionary tale. We had a
measurement showing one of our maps favoured a particular faction. A
larger, more careful measurement contradicted it, so we withdrew the
finding. Later we discovered the *measuring instrument itself* was
subtly wrong — it had never been producing a true mirror image of the
world — and once fixed, the original finding turned out to be correct
after all.

The lesson we have written into our engineering doctrine: **when an
instrument and a hypothesis disagree, suspect the instrument first.**
