# 13E — Bridge demolition (riverline's signature slice)

*Design of record, written 2026-07-29 before implementation. Ruled in
the gameplay-evolved eval (#6, FIT: EXCELLENT) and queued ever since.
Read with specs/10 (map roster) and specs/07 (rulings).*

## The fantasy

Riverline's three bridges are the map's whole story: everything crosses
there. Today they are permanent, so the map has a chokepoint with no
counterplay-to-the-counterplay. After 13E, the losing team can DROP a
bridge to break the winning team's momentum, and the winning team must
either bring a truck and rebuild it under fire, take a longer crossing,
or send Skimmers. That is the exact "environmental destruction" beat the
designer asked for, and every mechanism it needs already exists.

## Why bridges are NOT sites (the key design decision)

Reusing `state.sites` looked attractive — sites already carry hp, the
artillery siege flag, and the truck materiel repair loop. It was
REJECTED: 24 call sites across 21 files iterate `.sites`, including
supply projection (`engine/supply.js`), relay sensor fog
(`engine/los.js`), capture, ticket majority, AI capture-seek, the
objective strip, minimap icons and task cards. A bridge that silently
projected supply or sensor coverage — or that counted toward the ticket
majority denominator — would be a real bug, and every one of those 24
sites would need an exclusion. One concept, twenty-one chances to miss.

Bridges therefore get their own hashed array. They are not captured, own
nothing, project nothing, and score nothing. They are terrain with hit
points.

## State

```js
state.bridges = [{ id, hp }]   // HASHED — new field, fixture repin to v41
```

Geometry is a per-profile CONSTANT, never hashed and never mutated:
`RIVERLINE.bridgeRows = [[20,23],[62,65],[104,107]]` crossed with
`riverCols 60..67`. Bridge id = index. Profiles without bridges get `[]`,
so every other map is inert (the 18B/18E pattern).

- `BRIDGE_HP_MAX = 120` — twice a relay's 60. A bridge should take a
  committed artillery effort, not a lucky shell.
- Mirror invariant: the bridge spans are already mirror-symmetric in x
  (the river band is), and the row spans are shared by both sides, so
  bridges need no mirror pairing of their own — but the TEST asserts it
  anyway, because specs/08 says tables get asserted, not assumed.

## Terrain effect (the mechanism, and why it is free)

On breach (`hp` reaches 0) the bridge's cells become **`T_WATER`**; on
repair they become `T_ROAD` again. This deliberately reuses the existing
terrain vocabulary instead of inventing a "broken bridge" cell:

- Heavy hulls: water is speed 64 — fording is misery, exactly as
  intended, and they will look for another crossing.
- The **Skimmer crosses a breached bridge at speed** (amphibious,
  `WATER_SPEED_AMPHIBIOUS`). The Outlier unique gains a real doctrinal
  answer to a Directorate demolition, on the map built for it.
- Nothing in movement, LOS or routing needs a new concept.

The mutation is a pure function of hashed state (`bridges[i].hp`), so
replays stay honest even though `map.cells` itself is not hashed — the
same commands produce the same terrain.

## Commands and events

| Direction | Shape |
|---|---|
| Siege | `fire_order { targetBridgeId }` — SIEGE chassis only (artillery), same rejection vocabulary as `cannot breach sites` |
| Repair | the existing truck materiel loop, extended to an adjacent damaged bridge |
| Events | `bridge_shelled`, `bridge_breached`, `bridge_repaired` (each carries `bridgeId`) |

Every new rejection reason needs its human text in
`client/js/feedback_model.js` AND both string catalogs (the source-sweep
test and the locale-parity test both enforce this).

## Route graph (13D reuse)

A breached bridge must make the graph route around it, or the AI will
drive into the water. The riverline graph already has the bridge nodes
(6/7 central, 10-13 outer ends). On breach, the edges crossing that
bridge are re-costed as BLOCKED using the same overlay machinery 13D
built for marked minefields — `routeWaypoints` already takes a per-query
overlay, so this is a parameter, not a new system. Amphibious hulls skip
the graph entirely, so the Skimmer keeps its shortcut.

## AI doctrine

1. **Siege**: an artillery regent whose team is LOSING the crossing (the
   enemy holds the far bank / the bridge relay) may target a bridge
   instead of a relay. Must be rate-limited by the existing capture-seek
   style designation (ONE besieger per bridge) or every tube in the war
   shells the same span.
2. **Repair**: the truck ladder (`roleTruck`) gains a bridge-repair
   errand, ranked with the existing rebuild-a-ruin errand.
3. Both are doctrine changes, so they carry the 5-seed gate AND a
   sweep — per specs/09, doctrine tuned on one map is not validated for
   another.

## Acceptance

- Riverline wars show bridges being dropped and rebuilt (event census).
- Breached bridges measurably reroute traffic (the 13D probe pattern).
- Skimmers cross breached spans; heavy hulls do not.
- Frontier / blackwood / sawtooth are byte-identical (empty bridge list).
- Suite green double-run, fixture repinned to v41 with provenance,
  5-seed gate, then a riverline battery on the PC.

## Repair rights: EITHER TEAM (ruled, prompt 70)

Any team's truck may rebuild any breached span. No new ownership concept
is needed, and the tug-of-war over a contested crossing — one side
dropping it, the other rebuilding it under fire — is the version worth
having. A consequence to watch in the sweep: with no ownership gate, a
bridge next to a winning team's front may simply be rebuilt instantly
every time; if that shows up, the lever is repair TIME, not rights.
