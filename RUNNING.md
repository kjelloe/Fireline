# Running More Firepower

Rebuilt baseline (see `dev-log.md` for the slice-by-slice history).

## Tests

```bash
npm test              # full suite, all milestones + baseline self-tests
node --test test/milestone2f.test.js   # single milestone
```

## Play in a browser

```bash
npm install
npm start             # http://localhost:8080 — join an active war
```

Environment: `PORT` (default 8080), `MAP_SEED` (default 2026).
Open two browser windows and join opposite teams for a local skirmish.
Controls: pick team → "Next asset" to take an asset → click ground to move,
click a visible enemy to fire. Return to base to resupply.

## Headless sims

```bash
npm run sim1f         # terrain speed demo
npm run sim1g         # combat duel demo
npm run sim2a         # full integration soak (scripted operators + replay check)
npm run simv1         # 32-participant war: 16 scripted humans + 16 AI regents
```

## LAN play (2+ humans)

```bash
npm start                              # host machine
# other players browse to http://<host-lan-ip>:8080
```

- Pick a team on the join screen; "Next asset" cycles free assets, or click
  a free friendly unit to take it.
- **The objective**: steal the enemy Command Standard (cone marker in their
  base) and carry it into your command zone while your own standard sits at
  home. First capture wins; the war then rotates automatically (~30s
  scoreboard, fresh map seed, everyone keeps their seat).
- Click semantics: free friendly unit = select · visible enemy = fire ·
  friendly wreck = tow (get adjacent first) · ground = move.
- Camera: WASD/arrows pan, wheel zooms, F re-follows your unit, Home jumps
  to your zone, X jumps to the enemy standard, minimap click jumps anywhere.
- Supply: relays project supply — out-of-supply units crawl at half speed
  and cannot fire. Idle in your base to resupply ammo/fuel; guns have per-
  chassis reload (tank 15 / scout 8 / artillery 40 ticks).
- Wrecks are rescueable: tow them to your base, 10s repair, back at half hull.
- Mines (9E): tanks carry 2 — press M to lay one on your own cell (arms in
  3s, protected base/site cells refuse). It detonates on enemy entry (60
  damage + suppression). Your team always sees its own mines; enemy scouts
  within 3 cells auto-MARK them for their team, and a truck adjacent to a
  marked (or own) mine clears it with C.
- Anti-camping drone (9G): idle outside your supply umbrella for 30s and the
  enemy's nearest owned relay launches a drone at you — fast, terrain-blind,
  visible to everyone. It stings for light damage until you MOVE (or get back
  in supply); any direct-fire gun downs it with one shot (click it) —
  artillery cannot track aircraft.
- Spectator mode (10A): the join screen's third button seats you in the
  booth — you see BOTH teams, every mine, all pings, full telemetry, and
  can touch nothing. Perfect for watching AI-vs-AI wars (start the server
  with AI enabled and just spectate).
- Rescue autopilot (11G): carriers auto-scoop adjacent downed teammates by
  default. The ⚙ options panel can turn that off per player — then crawl
  beside a carrier and press B to board; U hops you out anywhere.
- Siege & repair (11F): artillery can SHELL relays (two shells knock one
  out — dark, flattened, projecting nothing, unflippable). Trucks silently
  pick up one materiel crate when idle in base and rebuild any adjacent
  damaged own/neutral relay. AI trucks run repair errands on their own.
- Context pings (10C): keys 1/2/3 send team signals whose meaning follows
  your seat (a standard carrier offers ESCORT THE STANDARD, a towing truck
  RECOVERY IN PROGRESS, a scout MINES DETECTED, downed operators NEED
  RESCUE). Own team only — the enemy never sees them; 3 s cooldown per seat.
- Your browser keeps a persistent player id: closing the tab hands your asset
  to AI regency, reopening reattaches you to the same operator slot.
- Difficulty: `AI_DIFFICULTY=0|1|2 npm start` (easy/normal/hard).
- Ops endpoints: `GET /health`, `GET /metrics` (balance instrumentation),
  `GET /replays`, `GET /replay/:id`.
- Ctrl-C shuts down gracefully (clients warned, war archived).

## Docker

```bash
docker build -t more-firepower .
docker run -p 8080:8080 -e MAP_SEED=2026 more-firepower
```
