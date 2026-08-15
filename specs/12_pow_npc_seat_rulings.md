# POWs, NPCs, and crew seats — designer rulings (2026-08-01)

*Verbatim-in-substance record of the designer ally's answers to the
Q35-Q42 brief (reports/2026-08-01_designer_brief_npc_pow_seats.md),
plus the owner's Q45 additions. This is the design of record for the
People Update arc.*

## Q35 — POW worth: SEAT-ECONOMY ONLY, no new currency

| State | Effect |
|---|---|
| Enemy operator captured & held | Their respawn seat is LOCKED for the captor's team |
| Own POW freed | Seat unlocked, operator returns to respawn queue, +recognition to rescuer |
| POW dies in captivity | Seat PERMANENTLY lost for the war (treat as a kill) |
| POW escapes (future) | Seat unlocked, no recognition |

Recognition: capture +15 · hold +5/min · free own +20 · escort freed +10.

## Q36 — The SCOUT captures (its dark specialty)

Truck refused (overloaded), carrier refused (rescue identity). Scout:
reach a downed enemy (tow proximity), HOLD 3 s (no drive-bys), the
operator becomes cargo (like a tow, but a person), deliver to OWN BASE
PRISON to complete. Scout destroyed in transit → operator released as
downed (needs rescue or recapture). The scout giving up marking to run
a capture is the intended opportunity cost.

## Q37 — Rescue: SYMMETRIC RAID; guards do NOT respawn (v1)

Reach the enemy prison → hold beside it 8-12 s (tunable per map) →
freed POWs exit as DOWNED operators → must be CARRIED home by a
carrier → delivery unlocks the seat + pays recognition. The whole
rescue loop reused. Guard respawn on a long timer BANKED for later.
The prison raid is the primary reason gates matter: breach/bypass the
gate, handle guards, hold, extract — a full multi-vehicle operation.

## Q38 — Guards: ALARM-ONLY v1

Detection 2-3 cells; on detection reveal the raider through fog to ALL
enemies while in proximity; no damage; cannot be suppressed or
destroyed (v1 — they are sensors, not combatants). V2 banked:
short-range SUPPRESSION (slows, never kills). V3 banked: light
anti-infantry damage, only if infantry deepens.

## Q39 — Labs/vaults/caches: PER-MAP SPECIALS, vault first

| Site | Contents | Ships |
|---|---|---|
| Vault | +N tickets/tick to controller | FIRST (zero new systems) |
| Weapons cache | reload/ammo boon | second |
| Special alloys | +salvage/tick | third |
| Laboratory | escortable SCIENTIST NPC → per-war passive while alive at your base; recapturable; killed = gone for the war | fourth (needs escortable NPC) |

## Q40 — Prison: MAIN-BASE FIRST

Inside the perimeter behind the gate; visually a fenced compound;
N pre-placed POWs as a day-one objective (map config); capacity 4-6
(prevents seat-economy collapse). Outside-base prisons (blackwood
ranger station) banked for the map-special era.

## Q40 amendment (owner ruling, prompt 106)

powPreplaced stays DEFAULT 0 until the AI raid party (slices 2-3) can
actually spring a defended prison — then adjust toward the designed
2. POWS=2 on the server serves the day-one objective to human
sessions meanwhile.

## Q41 — Seat UX: BOTH mechanisms; eject; SHARED recognition

- Driver CAN eject station crew — with a 2-3 s hold + a visible
  warning to the crew (no accidental combat ejections). Ejected crew
  exits as a DOWNED operator at the vehicle (no damage).
- Recognition on station kills is SHARED: 60/40 when the driver is
  the shooter; EQUAL SPLIT when the driver is not (station kills =
  equal split, since the gunner shoots).
- Station crew taking the wheel when the driver goes down: BANKED.
- Destruction: station crew bails out downed, same as the driver
  (already landed).

## Q42 — Landship: neutral capturable

Driver ALONE moves it (capturable solo, no spawn camping); stations
make it strong — crewing up is the incentive. Respawn location
ROTATES among a mirror-safe pair/triple, 90-120 s after destruction.
Destruction = disabled-then-towable like every hull; EITHER team may
tow it (salvage it home, or deny it at a neutral point); the wreck
clears when the respawn fires. Feel: high HP, strong station guns,
slow — a mobile fortress that rewards coordination both ways.

## Owner's Q45 additions (2026-08-01, banked for design)

- **Sandbags**: some unit builds a limited number of DESTROYABLE
  barriers — block travel like a wall (18B rule), grant a defensive
  bonus to units behind/adjacent. Design questions: which chassis
  (truck? Sentinel?), build time, hp, count, does pathfinding treat
  them as walls (yes — item-39 A* handles it free), mirror discipline
  (player-built = inherently asymmetric, like mines — fine).
- **Caltrops** (CORRECTED, prompt 105): droppable by a LIGHT unit
  (scout bike or scout) — a TEMPORARY SLOW zone against pursuers,
  NOT primarily damaging. Design questions:
  counters (trucks clear like mines?), stacking with mines, visibility
  rules (own team always, enemy scouts mark?).
  Both fit the existing deployable vocabulary (mines/hardpoint) and
  the wall/terrain machinery. PROPOSAL owed to the owner.

## Figure kit (owner question, prompt 108 — PROPOSAL)

What exists: ONE human figure — the prone downed-operator (box body +
head sphere + faction panel, 9B art pass). Guards, POWs, freed POWs,
and the prison compound have NO visual design yet.

Proposal: a shared LOW-POLY FIGURE KIT from the same procedural
factory (one builder, ~30 tris, faction-tinted), with POSE as the
identity: DOWNED = prone (exists); POW IN CUSTODY/PRISON = kneeling,
hands high (rotate torso upright, arms as two thin boxes raised —
instantly readable); FREED POW WALKING = upright + walk bob (reuse the
standard-carrier bob); GUARD = upright + slow head sweep (rotation
oscillation — reads as scanning) + neutral grey tint (guards belong to
the BASE, not a faction palette); SCIENTIST (later) = upright + white
coat tint. PRISON COMPOUND = fence posts + crossbars from the props
pipeline (14G pattern) around the prison cell, gate on the base-gate
side, POW figures kneeling inside (count = pows.length — the headcount
IS the render). One art slice covers all of it; pairs naturally with
the alarm-guard slice so guards ship visible.

## NPC ambient bank (designer-ranked)

Ship order: 1. FARMHANDS (flee combat, reveal movement to both teams —
very low cost, high ambience) → 2. ROAD WORKERS (slow-repair shelled
relays; "protect the workers") → 3. NEUTRAL TRADER CONVOY (cross-map
escortable packet — after the scientist proves escortable NPCs).
Also banked: refugee column (recognition morality), forward observer
(one-time arty marker on relay defence), black-market trader (race
objective). **STRAY DOG: banked as the cosmetic Easter egg — "will be
the most-remembered feature in every playtest."**

## Designer review round 2 (prompt 110) — deltas adopted

HEEDED (landed same day): capture hold PAUSES while the scout is
suppressed (damage counterplay); automatic team ping at the capture
site (the chase begins — the victim's team is told where); freed POWs
left within 3 cells of the enemy prison for 60 s are RE-SECURED (the
cleanest anti-spiral rule; scout recapture still works everywhere
else); eject only while STATIONARY (the anti-grief clean rule);
driver kills with a gunner aboard split 60/40 (the platform team
shares glory both directions); POW telemetry columns in the sweep
instrument (captures / deliveries / raids per war).

RECORDED FOR THEIR SLICES: sandbag v1 parameter table (TRUCK builds,
4-6 s, 2/truck, 6-8/team, decay 3-5 min, NEVER placeable on spawn
exits/gates/prison points/convoy ends — "player walls may shape
routes, never invalidate the map"); caltrop v1 table (scout/bike
drops, 30-60 s slow zone 25-40%, no damage, truck clears, no
stacking, own-team always visible / enemy close-or-scouted;
DISTINCT from mines: delay pursuit, never punish); vault placement
rules (side objective, 2+ approaches, small income, announced);
landship monitoring list (snowball/spawn-pressure/choke-lock);
figure-kit pose extensions (farmhand civilian tint fleeing, road
worker repair pose, trader cart marker); guard VISUAL rule (no
weapon silhouette, alarm icon when detecting — must not read as a
killable soldier); POW-death v1 = COLLATERAL ONLY, no execute button
(we are currently safer still: no death mechanism exists at all).

WHERE OUR REASONING STANDS (with data): build order keeps the
formation primitive before alarm guards — our measured bottleneck is
MOVEMENT (raiders die crossing solo; 2,478 dive ticks, zero holds),
not detection; guards only make raids harder, so testing without them
is the conservative case and we still fail. This matches their own
Order A ("AI raid minimal -> guards -> retune with guards"). Prison
placement (base.y+15) keeps ~4+ cells from the spawn rows within an
18x20 base — their spawn-separation concern is noted and becomes a
hard constraint when bigger bases or outside-base prisons arrive.

## Build order (the People Update)

1. ✅ Prison + seat-lock core — slice-pow1 (fixture v54; raid included).
2. ✅ Scout capture — slice-pow2 (fixture v55; custody, delivery,
   hold-pay, wreck spill, escape window).
3. AI RAID PARTY — coordinated spring (escort assembly + sneak window)
   so a prison raid can actually succeed; SUCCESS FLIPS powPreplaced
   to the designed default (prompt-106 ruling).
4. Alarm guards (fog reveal nodes).
5. Vault (first map-special, on a map that earns it).
6. Farmhands + road workers (ambience pass).
7. Scientist/lab + trader convoy (escortable NPC era).

> Build-order update (2026-08-01): formation/group-movement primitive LANDED (slice-formation); the AI raid party rides it — raids complete for BOTH teams (5-seed probe). powPreplaced default flip awaits a 300-war POWS=2 battery.

> Owner rulings 2026-08-01 (prompt 115): CALTROPS BUILT (slice-
> caltrops — table above, middles chosen: 30% slow, 45 s, rack 2).
> SANDBAGS next, with a cap: limited per building unit and a build
> may never block more than TWO LANES — implementation reading: max
> contiguous sandbag run 4 cells, placement refused if it would seal
> a gate cell or a road's full width (extends the "shape routes,
> never invalidate the map" law). Landship AFTER alarm guards/vault.
> Heist/Extraction mode GO after convoy tunes.

> Owner rulings 2026-08-15 (prompts 232-233): SANDBAG PERSONAL CAP —
> max 5 STANDING bags per operator (hashed byOperator, fixture v73;
> a destroyed bag frees the slot; the cap sits in buildRejection so
> the placement ghost shows it). Bags render 2x wide, oriented along
> the run — the wall reads as a wall. STANDARD LOCATED (fixture v72):
> touching the enemy standard AT ITS BASE pays +1 recognition once
> per war — the sneak's reward, deliberately a footnote next to the
> 25-point theft. INTRUDER ALARM grew its theatre: spinning red
> beacons on towers + HQ, per-viewer fog-honest, 30 s decay after the
> intruder dies or leaves.
