# Fireline Command — typed relay classes (B2): context and questions

*For the designer ally and the product owner. Everything measured below
comes from 300-war batteries per configuration; the game currently runs
a 315-ticket pool, ~21-minute wars, 9% timer endings.*

## Where the game is

A war is decided by holding a **majority of 8 identical relays**, which
drains the enemy's ticket pool; losses cost tickets too, and recovering
a wreck refunds one. The maps are strictly mirror-symmetric, and we
keep them that way with enumeration tests — fairness is a construction
constraint, not a tuning outcome.

The next ruled gameplay slice gives relays **personalities**. Instead
of 8 interchangeable flags, a map's sites get TYPES:

- **RADAR** — extends the team's sensor web while held (fog is a core
  mechanic here; weather fronts already halve sensors on a schedule).
- **DEPOT** — faster resupply for nearby friendlies, and the natural
  home for salvage income later.
- **FACTORY** — accelerates the "Slow Manufacture" rebuild wave that
  keeps a gutted team in the war.

The pitch: captures start answering *"what do we NEED right now?"* —
blind team → take RADAR; starved → take DEPOT; gutted → take FACTORY.

## What we need from you

**Question 1 — the majority denominator.** Today every relay counts
toward the bleed majority (5 of 8). Options:

- **(a) Typed sites still count.** Simplest; a RADAR is a relay that
  also sees. Capture priorities stay unified, and the pacing we just
  tuned (the 315-pool numbers above) survives untouched.
- **(b) Typed sites are separate objectives** — only plain relays
  bleed. Sharper identity ("utility" vs "territory"), but it shrinks
  the bleed web and would force a full pacing re-measure. We JUST
  landed that tuning on 1,500 wars of ladder data.

Our engineering lean is (a), at least for the first landing — identity
through effects, not through exclusion from the win condition.

**Question 2 — which maps, which sites, how many.** Constraints you
should know: types must come in MIRRORED PAIRS (one per side), or sit
alone on the map's centre line — anything else breaks the fairness
construction. Our proposal for the first landing:

- **frontier** (8 relays): the lateral pair (rows 40/86 mid-map)
  becomes RADAR; the two road relays nearest each base become DEPOT;
  the rest stay plain. No FACTORY on the default map at first.
- **blackwood** (freshly promoted): the two deep-woods pairs are the
  contested heart — one pair RADAR (fog is this map's soul), one pair
  DEPOT (the recovery corridors now feed them).
- **riverline/sawtooth**: untouched until their own verdicts settle.

**Question 3 — effect magnitudes.** We would propose and sweep-gate
these (our instrument now measures pacing AND story effects), unless
you want to set them: RADAR +6 cells sensor radius while held; DEPOT
doubles adjacent resupply rate; FACTORY -20% rebuild-wave time.

## Two ratifications while you are here

- **Salvage stacking** (building now, per ruling, MPG-acceleration sink
  first, garage refit banked): a recovered wreck already REFUNDS a
  ticket (that landed with "meaningful deaths"). We are building
  salvage to ALSO pay on recovery — the refund is the defensive payoff
  (undo the loss), salvage is the offensive one (fund the next wave).
  A tow therefore pays twice, which makes logistics the strongest
  support role in the game. That is intentional — rescue is the
  emotional core and it now has a strategic scoreboard. Confirm, or cap
  it.
- **Last Convoy N** (building now, per ruling — the finale suspends the
  mercy bleed): our proposal is **N = ceil(operable hulls / 3), clamped
  to 3..5**. Reasoning: at the trigger the losing pool is ~78 tickets ≈
  2.6 minutes of normal bleed; a hull crosses half the map in ~1.5-2
  minutes; so 3 is achievable from a bad position, 5 only from a
  half-organised one — "a challenge, but doable", scaling with what the
  loser has left rather than punishing a gutted team with an impossible
  quota.

## What does NOT need an answer

Pool size (315, landed on data), the faction band (measured fair at
current values — the old Outlier lean dissolved when the pacing rules
landed), mercy trigger (deliberately unchanged pending more data),
blackwood promotion (done, per your standing ruling).
