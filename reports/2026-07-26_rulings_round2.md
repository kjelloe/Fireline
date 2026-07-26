# Rulings Round 2 — implementation report (2026-07-26, branch `dev_night`)

*Prompt 16 rulings (Q1–Q16) recorded in dev-prompts.md; forward plan in
`plan-implementation-order.md` → "Phase 11 — the Living World round".*

> **⚠ Restart your server to pick up these changes** — the MAP changed
> (four relays now, mirrored spawns) and artillery turns slower. A running
> playtest server keeps the old world until restarted.

## Landed so far

| Slice | What |
|---|---|
| `slice-11a` | Q4: artillery turnRate 5 → 2 (~6.4 s half turn). |
| `slice-11b` | Q3: BF2 capture countdown — lone team drains a relay to neutral (~3 s) then captures (~3 s), both constants configurable; CONTESTED ground freezes the clock (relay churn is gone). Flip telemetry is public in views for a capture bar. |
| `slice-11c` | Q1 role-based garage crewing + Q2d anti-standard-carrier fire doctrine + Q14 drone swatting — plus everything the sims dragged out (below). |
| `slice-11d` | Q11+Q16 alive world: tanks mine ground near owned relays, trucks clear marked mines en route, regents PING (raider need_escort, recoverer recovery_in_progress, scout mines_detected; 30 s per-seat throttle), vocabulary + client options grow (carrier_under_attack, road_blocked, safe_route). Mines now fire in AI-only wars. |
| `slice-11e` | Q5 full AI rescue play, **sim gate PASSED**: trucks tow wrecks home every seed (up to 6 hulls restored), carriers deliver passengers and fetch walking downed teammates (that path mostly serves HUMAN downed players — AI seats redeploy in 10 s). The "AI never tows" pin is overruled. |
| `slice-11f` | Q9 damaged sites + materiel: artillery shells relays (2 shells → dark flattened ruin — no supply, no fog, unflippable, keeps owner); trucks silently load one materiel crate in base and rebuild adjacent own/neutral ruins; AI trucks run repair errands. Bases stay sacred (Q19 default). |

## What the backend sims found (and forced)

Implementing Q3 broke the AI's drive-by captures and exposed deeper
problems. Each fix is 5-seed verified:

1. **Capturer roles**: one designated agent per (team, nearby unowned
   relay) diverts and STANDS on the flag until it flips. (Naive
   "everyone capture" froze wars at 0-0 — both teams piled onto one flag,
   contested + out of supply = nobody can shoot or flip.)
2. **The map was never mirror-symmetric** — this was the root of the
   "team B ahead in 5/5 seeds" pattern flagged in the night report:
   B spawned 3 cells closer to the centre (117 vs mirror 120), and the
   single centre relay at x=63 is un-mirrorable on a 128-wide map (B's
   patrol waypoint sat ON it, A's mirror sat beside it). Now: mirrored
   spawns, **four relays in exact mirror pairs (32↔95, 58↔69)**, mirrored
   patrols. Every seed becomes a two-sided war.
3. **FUEL_MAX 2400 → 4000**: fuel bills per tick, so the slow, laden
   Command Carrier pays ~3200 for a standard round trip — seed 777's
   winning carrier stranded bone-dry mid-map with the flag aboard. 4000
   makes deep raids feasible until 11F brings real fuel logistics.

**Headline: with Q2d + the symmetric map + the fuel fix, all five sim
seeds now end DECISIVELY by standard capture around tick 3400–4000 —
~6-minute wars.** Before tonight, zero of five ever resolved.

**And after 11D mines entered the doctrine, the winner column finally
mixed: team A takes seeds 777/31337, B takes 2026/4242/9001-ish, with two
close horn-bound wars.** The "team B wins everything" era is over; question
18's residual-bias study is now about a much smaller effect.

## New questions (17+)

17. **FUEL_MAX 4000** — ratify or tune? (A tank now gets ~4 map crossings;
    a laden carrier ~1.25 standard round trips.)
18. **Residual bias** (mostly resolved by 11D — winners now mix across
    seeds): the cell-floor hypothesis below is retained for the record.
    Hypothesis: cell-floor arithmetic gives
    west-movers a one-edge-per-leg advantage (entering a cell from the
    east happens 255 world-units earlier than from the west). Proposal: a
    mirrored-teams sim harness (swap team sides, same seed) to isolate
    geometry from doctrine before touching fixedmath.
19. **11F damaged sites**: can HOME BASES be shelled, or only
    relays/depots? (Sketch in plan assumes bases stay sacred.)
20. **War pace**: ~6-minute AI wars — right ballpark for humans, or should
    standard scoring be harder (e.g. require the carrier to IDLE at home
    briefly, interruptible)?

## Prompt-19 window (the 2-hour run) — six more slices

| Slice | What |
|---|---|
| `slice-11g` | Q8 rescue autopilot option: auto-boarding by default, ⚙ settings toggle, B board / U unboard, per-seat hashed flag. |
| `slice-11i` | War-rotation regression: a rotated war is spotless and byte-identical to a cold start — every phase-9/10/11 system checked. |
| `slice-11h` | Q15 replay viewer: /replay.html re-simulates archived wars LOCALLY (deterministic engine) — byte-exact scrubbing, top-down tactical canvas, play/pause/×1/×4/×16, war picker. |
| `slice-11k` | Recognition scoring (confirmed table): tow 8 / delivery 10 / return 10 / standard 25 / relay 10 / kill 5; rescue > kill; public scoreboard + end-screen HONORS. Mine/drone kills and auto-returns award nobody. |
| `slice-11l` | Q10 direct control, ALL chassis: G toggles WASD tank controls — authoritative intent physics (turn at chassis rate, half-speed reverse, all multipliers apply). Chase-cam rotation deferred (ortho camera stays fixed — question below). |
| `slice-11m` | Second map prep: `MAP=riverline npm start` — river + three bridges, relays in mirrored pairs N/S, terrain mirror-symmetric BY CONSTRUCTION; the mirror invariant is now a TEST across all registered layouts; profile survives rotation and rides replay meta. |

Suite 362 → **390/390**, fixture v26 → v28. Art pass NOT started —
deliberately left for a fresh session (visual work, wants your strip
feedback loop). Q2b point-bleed still armed-but-deferred.

## Prompt-20 rulings (Q21-23) — landed

| Slice | What |
|---|---|
| — | Q21 chase cam: (a) fixed tactical camera for direct drive NOW (already true), (b) rotating chase cam scheduled with the art/perspective pass. |
| `slice-11n` | Q22 PATH terrain: dirt roads / woodland trails at ~1.2x for every chassis EXCEPT the heavy tank (rough speed on trails — explicit `heavy` contract flag). Mirrored trails on BOTH maps (frontier flanking loops, riverline relay trails); mirror invariant tested. A scout does 67 units/tick on a trail where a tank does 16 — light chassis now genuinely flank. |
| `slice-11o` | Q23 direct-drive targeting: red range circle rides your unit; clicks become weapons-only with 3-cell aim assist (drones included); empty ground does nothing — a stray click can never drive you off your line. |

Suite at **394/394**, 0I map fixture v2 (paths), 1A still v28 (no drift).

## Continuation window (after /add-dir of agent-mail)

| Slice | What |
|---|---|
| `slice-11p` | BATCH_PC agent-mail lane, **round-trip verified locally**: `tools/agent-mail.py` deployed (single file), `batch_send.sh` queues sweep/mirror/matrix/perf jobs + collects results, `batch_worker.sh` is the batch-pc lane (refuses red suites, blocking flag-wait, auto-shards across cores, mails one-line summaries). MIRROR mode rebuilt as a TRUE world reflection (terrain + entities + headings mirrored, AI patrols swapped) — the naive team-swap made dead wars. **First 2-seed probe shows directional residue** (normal: A standard-captures ~tick 3500; mirrored same-seeds: undecided at 6000) — the 600-war census will quantify it. |
| `slice-11q` | Art pass round 1 (Q9b): all five chassis rebuilt with real character (tank tracks/glacis/muzzle brake, scout roll-cage buggy, artillery split trails + two-stage tube, logistics crane + laden bed, carrier with white RESCUE cross + beacons); mine + drone join the factory and the client now uses them. **`client/assets/preview/asset_strip.png` (18 tiles) is the review artifact — open it and judge; round 2 follows your verdict.** ✅ **APPROVED** (prompt 21: "look good for current pass"). |

**Old note, superseded:** Semantics
scoped from ../agent-mail/: the dev session posts jobs with `queue add
--for batch-pc`, the worker lane on the gaming PC runs `flag wait`, takes
the job, executes (sim sweep / perf run), and reports results back as
mail with the CSV path; ack settles it. Will wire when you set the PC up.

## Newer questions (21+)

21. **Chase cam** (from 11L): true rotating chase-cam in the orthographic
    top-down reads disorienting; current direct drive keeps the fixed
    tactical camera. Options: (a) keep fixed cam for direct drive,
    (b) rotate the world under the tank (real chase), (c) build chase cam
    later with the perspective/art pass. My lean: (a) now, (c) later.
22. **Riverline pace**: AI wars on riverline reach the horn undecided
    (relays sit off the standard route, bridges slow raids). Tune after
    your first playtest — or should relays move closer to the road?
23. **Direct-drive fire**: while in direct mode, clicking enemies still
    fires (unchanged). Original Firepower had a fire key — want SPACE to
    fire at the nearest spotted enemy in range as the homage completion?
