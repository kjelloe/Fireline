p = "reports/2026-07-26_night_session.md"
src = open(p).read()
src = src.replace("""### ⏳ In progress at report time

See dev-log tail and git log for anything after this line — each slice
updates this file when it lands.""",
"""### ✅ slice-9b — Downed operators, full operator_foot (306 tests)

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
| 9C Cargo/materiel economy | ⬜ not started (next up; couples with 9D) |
| 9D Depots + Minimum Playability Guarantee | ⬜ not started |
| 9E Mines | ⬜ not started |
| 9G Drone | ⬜ not started |

Three of seven Wave-1 slices landed, fully tested and tagged, suite at
**306/306** (every count double-run verified). The three shipped slices are
the load-bearing ones: the carrier changes the objective game, the movement
model changes feel everywhere, and downed operators are the largest new
entity system since standards.""")
src = src.replace("""3. Earlier findings still open: contested relays churn ownership
   tick-to-tick; lazy AI role re-tasking (idle-only) slows objective play.""",
"""3. Earlier findings still open: contested relays churn ownership
   tick-to-tick; lazy AI role re-tasking (idle-only) slows objective play.
4. **Rescue-era sim (seed 777, 9000 ticks)**: team B's carrier steals A's
   standard and the war again waits on the points horn — the standoff
   pattern persists across seeds, strengthening question 2. Downed AI crews
   redeploy and re-crew correctly (no more seat bleed-out).""")
src = src.replace("""6. **Carrier "defensive burst"** (spec flavor): current armament is a plain
   light gun; is a special defensive weapon wanted later?""",
"""6. **Carrier "defensive burst"** (spec flavor): current armament is a plain
   light gun; is a special defensive weapon wanted later?
7. **Crew semantics for repaired wrecks** (9B consequence): wrecks now repair
   to UNCREWED (the crew bailed out and moved on). AI re-crews them; garage
   UI shows them as free assets. Confirm this is the wanted feel vs "crew
   waits inside the wreck".
8. **Human rescue UX**: carrier boarding/delivery is automatic on adjacency/
   base-idle. Good enough, or should players get explicit board/unload
   commands (with pings)?""")
open(p, "w").write(src)
print("report finalized")
