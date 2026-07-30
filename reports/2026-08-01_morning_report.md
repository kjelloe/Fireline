# Morning Report — 2026-08-01 (branch `dev_night`)

*The 7-hour autonomous window, following prompts 100-102. Everything
committed and pushed; suite at 672/672, fixture v51.*

## Landed overnight

| Slice | What |
|---|---|
| B2 | **Typed node classes** — RADAR / DEPOT / FACTORY effects, mirror-paired on frontier + blackwood (fixture v50) |
| splash | **"The Front Ignites"** — the designer's concept 1+2, real load milestones, honest skip, reduced-motion form |
| Q25 | **Mercy rout condition** — leader must hold 3× the loser's pool; engagement ~90% → **73%** measured; close endgames keep their photo finish |
| stations | **The second seat** — carrier MG ring + scout AT launcher (TOW-II: 40 dmg, 60-tick reload, 4 missiles), both halves of your seat UX (vacant-seat hover + J, driver's NEED GUNNER call), step-across from a driving seat, crews bail like drivers, trigger seat gets the kill (fixture v51) |
| caldera | **Your circle map, built** — ring road out the side gates, dirt-trail centre, two mirrored mountains; the side gates assemble themselves from the roads-never-walled rule |
| Q31 verdicts | Swap conviction CONFIRMED at n=600; post-lever sawtooth 69→**58.5%** A (premium stays); frontier 55.2→**46.3%** A — **in band**. The raider's clause moved two maps ~10 points each: it is the band knob of this era |

## Caldera: built, and honestly RED at the landing gate

The 5-seed read looked dramatic (20-minute wars closing in comeback
sweeps). The 30+30 mirrored gate said otherwise: **31.7% A, 9-minute
medians, 77% domination endings — a stomp factory.** Working
hypothesis: the raider's clause on a ring map — the circle is one
long unguarded rear, so the Skimmer double-captures it endlessly.
The map stays EXPERIMENTAL with a fix-first flag (specs/10 §4g);
no battery until the hunt. A useful lesson the same night the clause
landed: **every new lever changes what a good map is.**

## Where the asymmetric arc stands

Caldera (the mode's map) is built and gated. The **mode framework**
(per-mode win triggers in victory.js, attacker/defender rotation,
phase-depth metrics) is deliberately NOT started — it is design-heavy
and deserves fresh rulings rather than 4 a.m. choices. It is the first
slice of the next session.

## Questions for the morning

- **Q43 — station balance instinct check.** MG: 4 dmg / 5-tick reload
  off the hull's ammo. AT: 40 dmg / 60-tick reload / 4 missiles,
  rearms at base or depot. Numbers are first-cut; a human feel pass
  beats a sweep here (AI doesn't man stations yet).
- **Q44 — should AI regents man stations?** Today they never do —
  stations are a human-only edge. Regents gunning would make solo wars
  richer but re-opens every balance number. My lean: keep human-only
  until the Landship, then decide once.
- **Q45 — caldera's domination signature: identity or fault?** The
  final-sweep ending is dramatic and comeback-friendly, but if every
  war ends that way it may get predictable. The battery will give the
  ending mix; the design question is yours.
- **Q35-Q42** (NPC/POW/seats brief) still await the designer ally.
- **Item 41** from playtest 10 is still cut off — what was it?

## Still open / in flight

- PC batteries queued: caldera 300+300 (after this report), sawtooth
  post-lever confirmation already in.
- Riverline pacing slice (41% horn) — next map work after the mode
  framework.
- Sawtooth playtest (yours) — now with crewed uniques, the premium
  disclosure in the briefing, and the raider's clause live.
- Uncapped perf run (yours): `bash tools/perf_native.sh` — no flag
  needed now that the display can do 144 Hz.
