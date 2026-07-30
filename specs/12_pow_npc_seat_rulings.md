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

## NPC ambient bank (designer-ranked)

Ship order: 1. FARMHANDS (flee combat, reveal movement to both teams —
very low cost, high ambience) → 2. ROAD WORKERS (slow-repair shelled
relays; "protect the workers") → 3. NEUTRAL TRADER CONVOY (cross-map
escortable packet — after the scientist proves escortable NPCs).
Also banked: refugee column (recognition morality), forward observer
(one-time arty marker on relay defence), black-market trader (race
objective). **STRAY DOG: banked as the cosmetic Easter egg — "will be
the most-remembered feature in every playtest."**

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
