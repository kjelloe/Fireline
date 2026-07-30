# Fireline Command — the People Update: NPCs, POWs, and crew seats

*For the designer ally. Product owner's direction is already given
(quoted below); we need the design detail before building. Companion
piece to the node-classes brief (answered) — these systems all extend
the same site machinery, so they should be designed together.*

## Where the game is (one paragraph)

Typed relays just landed (RADAR / DEPOT / FACTORY — held sites now DO
things). The salvage economy pays recoveries into rebuild waves. The
Last Convoy gives losing teams a final act. Every human so far drives
one vehicle; crews bail out as downed operators who crawl, get rescued
by carriers, or redeploy. There are no people in the world except
crews.

## The owner's direction (verbatim intent)

- POWs are held in the MAIN BASE in a prison — fenced camp or building
  — and possibly at special sites outside main bases on some maps.
- A prison can START with a number of POWs, so freeing them is a
  day-one objective worth points and "applicable resources".
- POW capture works like towing a wreck: some vehicles, on reaching a
  downed enemy operator, can take them into captivity.
- Other NPCs: guards in the main base and around special buildings —
  prisons, laboratories (scientists), vaults (gold), weapons caches,
  special alloys.

## Questions we need answered

**Q35 — What is a POW worth, and to whom?** Options: (a) tickets (the
war currency — a freed POW refunds tickets, like a recovery); (b)
salvage (feeds the rebuild economy); (c) recognition only (honors).
Our lean: captured enemy operator = the CAPTOR's team denies a
respawn seat while held (the prisoner's seat stays locked!) + freeing
your own returns the seat and pays recognition. That makes POWs a
seat-economy object — the strongest mechanic we have, and no new
currency.

**Q36 — Who can capture?** "Tow-like" suggests the logistics truck
(canTow). But trucks are already the busiest chassis (tow, mine-clear,
repair, resupply, rebuild). Options: (a) trucks; (b) the carrier (it
already handles people — but it is the rescue hero, and jailing is a
dark turn for it); (c) a dedicated flag on 2-3 chassis. Our lean: the
SCOUT (fast, light, underused after its marking role) — capture as
the scout's dark specialty.

**Q37 — How is rescue performed?** Symmetric raid: drive into the
enemy base (through the new gates!), reach the prison, hold beside it
N seconds (satchel the fence?), freed POWs walk out as downed
operators who must still be CARRIED home (the whole rescue loop
reused). Confirm, and rule whether guards respawn.

**Q38 — What do guards DO?** Static NPC infantry with a short-range
gun that suppresses/damages raiders near the protected building? Or
alarm-only (reveal raiders through fog, no damage)? Alarm-only is
cheaper, non-lethal, and preserves vehicle combat as the core. Our
lean: alarm-first, guns later.

**Q39 — Labs / vaults / caches: what is inside?** Proposal mapping to
existing currencies: vault = tickets, weapons cache = ammo/materiel,
alloys = salvage, laboratory + scientists = a per-war tech nudge
(e.g. +1 sensor cell while your scientist lives — an ESCORTABLE NPC).
Which of these ship first, and are they per-map specials (like
bridges on riverline) rather than universal?

**Q40 — Prison placement doctrine.** Main-base prisons make base
raids matter (gates + walls just landed, so bases are finally
raidable theatre). Outside-base prison sites suit particular maps
(blackwood ranger station is BANKED already). Confirm: main-base
first, map-specials later?

## Crew seats (already ruled GO — design detail wanted)

Prototype order: MG station on the Command Carrier, then an AT seat
on the scout (TOW-II feel: slow reload, few missiles, real punch —
balanced by reload and shot count, per the owner). Questions:

**Q41 — Seat discovery UX.** The owner proposes BOTH: the driver can
broadcast a "gunner seat open" call (a ping kind), AND vacant seats
show on friendly hulls (icon + hover "JOIN AS GUNNER (B)"). We agree
— they serve different moments (asking vs offering). Anything to add
on etiquette: can the driver EJECT a station crew? Does a station
crew's recognition share with the driver?

**Q42 — Landship as a neutral capturable.** One per map, crewed by
whoever reaches it; if destroyed it respawns at a neutral location
after a cooldown. Questions: crew minimum to move it (driver alone,
or driver + one station)? Should its respawn location rotate
(mirror-safe pair) to prevent camping? And is it disabled-then-
towable like everything else, or does it wreck permanently until the
respawn?

*Owner's own question passed through: any other NPC actions that
would make the world feel alive and FUN without stealing the show
from vehicle combat? (Our bank: road workers who repair shelled
relays slowly over time; a neutral trader convoy crossing the map
that either side can escort for a packet; farmhands who flee combat
and reveal movement to both teams.)*
