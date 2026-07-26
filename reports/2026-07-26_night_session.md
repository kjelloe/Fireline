# Night Session Report — 2026-07-26 (branch `dev_night`)

*Living document — updated after each slice. Suite counts are double-run
verified. Every completed slice is git-tagged.*

**Session outcome: 6 of 7 Wave-1 slices shipped and tagged (9A, 9F, 9B,
9D, 9E, 9G) — the seventh (9C cargo) is deliberately parked on a design
question — plus the first two Wave-2 slices (10B takeover confirmations, 10C context
pings). Suite 306 → 340 tests, fixture v14 → v21, every slice double-run
green with simwar + replay verification.**

## Session opening state

- Playtest 3 PASSED → Wave 0 closed → **tagged `v1.0`** (the Command
  Standard war, LAN-confirmed).
- All Q1–Q12 design rulings in hand; follow-ups 1–3 confirmed on defaults.
- Plan of record: `plan-implementation-order.md` Wave 1 (Rescue Update),
  slices numbered as phase 9.

## Completed slices

### ✅ slice-9a — Command Carrier + Carrier-exclusive carrying (297 tests → 291 at tag)

- `UNIT_CARRIER` (Q1: hp 120, speed 24, dmg 5, reload 25, capacity 2) —
  the **only** chassis with `canCarryStandard`. Explicit
  `canCarryStandard`/`capacity` contract on every chassis (test-enforced).
- Fielding: explicit 12-slot reserve mix; each team: 5 tanks / 3 scouts /
  3 artillery / 3 trucks / 2 carriers. AI-crewed slots now include a carrier
  AND a truck per team (assets 8+9 / 20+21).
- Anti-deadlock (Q2): `droppedTimer` in hashed state; a standard DROPPED for
  600 ticks auto-returns home (`standard_returned {auto:true}`); timer
  clears on pickup/manual return.
- AI raider role reassigned: first controlled operable **carrier** raids
  (scouts no longer raid — they cannot carry).
- Client: hint + briefing teach the carrier requirement; carrier procedural
  model; manifest/anchors/icons; asset strip now 15 tiles.
- 1A fixture → v15.

### ✅ slice-9f — Authoritative heading + turn-rate movement (297 tests)

- Q11 delivered: headings as brads (u8) in hashed state; per-chassis
  turnRate (tank 8 / scout 14 / artillery 5 / truck 10 / carrier 6).
- Movement rewritten: pivot-then-drive (drive only within 45° of bearing),
  integer bearing16 with rational tan boundaries, 16-direction fixed-point
  velocity table, snap-arrival prevents orbiting. Aligned straight-line
  motion bit-identical to before → all historical movement pins survive.
- Views expose heading for friend AND foe (facing is externally
  observable); renderer converts brads→radians, keeps smoothing as a final
  visual filter. **Playtest-3 wiggle now fixed at the source.**
- 1A fixture → v16.

### ✅ slice-9b — Downed operators, full operator_foot (306 tests)

- The Rescue Update's heart (Q3: full walking entities). Crews BAIL OUT of
  disabled assets: seat → OP_DOWN, wreck becomes crewless (wrecks now repair
  to UNCREWED), downed entities walk the field in hashed state.
- Lifecycle: crawl (3-cell radius, 6 units/tick), fast redeploy (100-tick
  gate, "still recovering nerve"), Command Carrier rescue (capacity-2 bunks,
  adjacent auto-board, idle-in-base delivery frees the seat), auto-return at
  600 ticks. Enemies can neither see nor target downed operators.
- **AI down-management doctrine** (found by the v1 soak, which bled to 24/32
  active seats without it): regents redeploy when the gate opens, then
  re-crew — fixed agents retake their paired asset; regented seats take the
  lowest free operable asset.
- Client: downed figures + "YOU ARE DOWN — R TO REDEPLOY" labels, clicks
  crawl while down, R redeploys. Asset strip → 16 tiles. 1A fixture → v17.

## Wave-1 status at session end

| Slice | Status |
|---|---|
| 9A Command Carrier | ✅ tagged `slice-9a` |
| 9B Downed operators | ✅ tagged `slice-9b` |
| 9F Turn-rate movement | ✅ tagged `slice-9f` |
| 9C Cargo/materiel economy | ⬜ deferred — needs the damaged-sites design round (question 9) |
| 9D Minimum Playability Guarantee | ✅ tagged `slice-9d` (Slow Manufacture wreck-rebuild) |
| 9E Mines | ✅ tagged `slice-9e` (deploy/arm/detonate, scout-mark, truck-clear) |
| 9G Drone | ✅ tagged `slice-9g` (anti-camping drone, first flying entity) |

Six of seven Wave-1 slices landed, fully tested and tagged, suite at
**329/329** (every count double-run verified). The only remaining Wave-1
item is 9C cargo/materiel, deliberately parked on question 9 (it needs the
damaged-sites design round before an economy earns its place). The three shipped slices are
the load-bearing ones: the carrier changes the objective game, the movement
model changes feel everywhere, and downed operators are the largest new
entity system since standards.

## Backend sim findings (feed these to the balance discussion)

1. **Mutual-carry standoff is real**: with carrier-exclusive carrying, seed
   2026 reaches tick 9000 with each AI carrier holding the other team's
   standard — neither can score (own standard not AT_BASE), auto-return
   doesn't apply to CARRIED. War resolves only at the 18000-tick points
   horn. → Question 2 below.
2. **Single-carrier raid fragility (pinned in tests)**: when a team's lone
   AI-crewed carrier dies, no replacement raid happens — the second carrier
   sits uncrewed in the garage (AI pairings are fixed). Auto-return
   prevents a stuck standard, but the team stops threatening to win.
   → Question 1 below.
3. Earlier findings still open: contested relays churn ownership
   tick-to-tick; lazy AI role re-tasking (idle-only) slows objective play.
4. **Rescue-era sim (seed 777, 9000 ticks)**: team B's carrier steals A's
   standard and the war again waits on the points horn — the standoff
   pattern persists across seeds, strengthening question 2. Downed AI crews
   redeploy and re-crew correctly (no more seat bleed-out).

## Bonus: first Wave-2 slices landed

**slice-10b — Takeover confirmations** (plan 2.2, spec 02 §9): claiming an
uncrewed asset that carries the standard, tows a wreck, or has passengers
aboard now requires an explicit confirm (Enter in the client, Esc cancels);
plain assets keep the single-click flow; AI regents always confirm. Chosen
as the only Wave-2 item with zero open design questions. Suite **334/334**.

**slice-10c — Context pings** (plan 2.3, spec 02 §14): keys 1/2/3 send
context-sensitive team signals (carrier: ESCORT THE STANDARD; towing truck:
RECOVERY IN PROGRESS; scout: MINES DETECTED; downed: NEED RESCUE), 3 s
deterministic per-seat cooldown, 5 s world labels. Structurally new:
**toTeam-scoped events** — the first per-team event channel, fog-safe by
construction (enemy views never receive them). Suite **340/340**.

## Wave-1 close-out sim campaign (5 seeds × 12000 ticks, AI-only)

- Seeds 2026 / 777 / 31337 / 4242 / 9001: **no war reached a decisive
  winner by tick 12000** — every one settles into the mutual-carry standoff
  or a points grind (team B ahead in 5/5, worth a look at spawn/relay
  symmetry). This is now a 5-seed pattern: question 2 (standoff release
  valve) is the highest-value balance decision on the table.
- New-system exposure in AI wars: downed operators cycle healthily
  (8–10 downs, every one redeployed — no seat leaks). **Drones never
  launch** — regents rarely idle off-supply (patrols keep them moving,
  garage assets sit in base), so the anti-camping system is, correctly, a
  human-behavior tax. **Mines and Slow Manufacture never fire** in AI wars
  (no AI mine doctrine yet; teams never drop below 6 operable). All three
  are pinned by unit/component tests instead — but none of the three has
  AI-vs-AI battlefield mileage yet; first human playtest will be their
  real exposure.

## Questions accumulated for your return

1. **AI garage crewing**: when an AI team's raider carrier dies, should the
   regency dynamically crew the spare garage carrier (breaking the
   fixed-pairing doctrine) so the team can keep threatening? My lean: yes,
   as a general "AI may crew free assets when a ROLE is unfilled" rule.
2. **Mutual-carry standoff rule**: accept points-horn resolution, or add a
   release valve? Options: (a) accept; (b) holding the enemy standard bleeds
   points per second (pressure to finish); (c) allow a carrier to DEPOSIT
   the enemy standard at an owned relay (guardable, re-stealable);
   (d) AI doctrine: prioritize firing at enemy standard-carriers. My lean:
   (d) now + (b) later if humans standoff too.
3. **Contested relay churn**: should a relay flip only when exactly one
   team's operable assets stand on it (contested = no flip)? My lean: yes.
4. **Turn-rate feel**: artillery at 3.6°/tick is VERY deliberate (50s for a
   half-turn). Needs your in-game verdict; numbers are one-line tunes.
5. **AI rescue doctrine**: should AI carriers also pick up downed operators
   and AI trucks tow wrecks (full AI rescue play), or stay human-only
   rescue for now? (AI towing has been pinned OFF so far.)
6. **Carrier "defensive burst"** (spec flavor): current armament is a plain
   light gun; is a special defensive weapon wanted later?
7. **Crew semantics for repaired wrecks** (9B consequence): wrecks now repair
   to UNCREWED (the crew bailed out and moved on). AI re-crews them; garage
   UI shows them as free assets. Confirm this is the wanted feel vs "crew
   waits inside the wreck".
8. **Human rescue UX**: carrier boarding/delivery is automatic on adjacency/
   base-idle. Good enough, or should players get explicit board/unload
   commands (with pings)?
9. **Cargo/materiel design round needed (old 9C)**: a materiel resource only
   earns its place once sites can be DAMAGED and repaired — which nothing can
   do yet. Proposal to react to: relays/depots get hp, artillery can shell
   them, trucks haul materiel to repair them. Until then MPG covers the
   losing-team guarantee without an economy.
10. **MPG numbers**: threshold 6 operable / 900-tick cadence / half-hull
    rebuild — sanity-check in play.
11. **AI mine doctrine**: regents neither lay nor clear mines yet. Minimal
    doctrine idea: tanks mine chokepoints near owned relays; the recoverer
    truck clears marked mines on its route. Worth a slice, or leave mines
    human-only until the next playtest?
12. **Mine numbers**: 2 per tank / 30-tick arm / 60 damage / scout-mark at
    3 cells / truck-clear adjacent — sanity-check in play (Q6 defaults).
13. **Drone numbers** (Q7 defaults): 30 s unsupplied idling draws one; speed
    72; 4 hp sting per second on station; 60 s endurance; one-shot to down;
    artillery can't target it. A stubborn camper draws drone after drone —
    intended. Sanity-check the pressure level in play.
14. **AI vs drones**: regents currently ignore drones (they rarely camp —
    their duty cycle keeps them moving — but a stranded/unsupplied AI unit
    will eat stings without shooting back). Add "shoot the drone stinging
    me" to the fire doctrine?
15. **Ping vocabulary** (10C): shipped subset is attack/defend/rally/
    need_escort/recovery_in_progress/mines_detected/need_rescue on keys
    1/2/3. Additions from spec 02 §14 (Carrier under attack, Road blocked,
    Safe route marked) can be one-liners — which do you want in v2.0? And
    should AI regents ping (e.g., their raider calling need_escort)?

## How to review this session

```bash
git log --oneline v1.0..dev_night     # every commit since your last look
git tag                               # slice tags
npm test                              # full suite
npm run simwar                        # AI-only standard war
npm run strip                         # asset strip incl. carrier
```
