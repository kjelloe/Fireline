# Running Fireline Command (dev name: More Firepower)

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

### Choosing the map (prompt 76)

```bash
npm run pick                     # interactive: lists the maps, pick a number
npm run start:blackwood          # or straight to one
npm run start:frontier | start:riverline | start:sawtooth
npm start -- --map blackwood     # the general form
npm run maps                     # what is registered
npm start -- --help              # every option
```

CLI beats env beats default, so `MAP=riverline npm start -- --map sawtooth`
starts sawtooth. A mistyped map refuses to start and suggests the closest
real one (`--map blackwod` -> "did you mean: blackwood?") rather than
quietly serving the default. The startup banner always names the map you
actually got.

Environment (still honoured): `PORT` (default 8080), `MAP_SEED` (default
2026), `MAP`, `RULES`, `AI_DIFFICULTY`.
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
- Field Encyclopedia (14K): the 📖 button — every chassis card (stats +
  traits, straight from the engine contract) and seven "how the war
  works" chapters (standard, supply, rescue, mines, drone, relays,
  factions). Full English and Norsk.
- Mobile touch (15A, ruling Q10): on touch devices an 8-direction
  steering pad appears bottom-left — tap an arrow and your unit sets off
  that way (steering itself at its chassis' turn rate); tap YOUR OWN
  unit (or the red ■) to stop. Tap anywhere = the normal order click;
  one-finger drag pans; pinch zooms. Feel verdict needs a real device.
- Mission UX (14J): completing recognized work toasts MISSION COMPLETE
  +N pts center screen; the collapsible TEAM TOP 5 board sits on the
  left; mission cards now FIT your asset (a tank never sees tow
  missions), show one per kind (nearest first) with up to five visible;
  golden pulsing rings mark applicable mission targets within 15 cells;
  the status panel gained ⌖ center-on-me. Base buildings and relay
  clutter never cover roads or trails.
- Command UX (14I): hover any vacant friendly for its name tag + ⓘ stats
  (the seed of the encyclopedia); every click-order drops a low-poly
  ground marker that shrinks into place and fades — gold travel chevron
  (pointing your direction of travel), red four-wedge attack reticle,
  cyan recovery clamp, green take-diamond; the lower-center STATUS PANEL
  answers "why am I not firing" — HP/ammo/fuel bars plus the exact
  blocker (out of ammo/fuel/supply, reload countdown, suppressed,
  deployed) and a REQUEST SUPPLIES ping when you run dry. Every unit
  carries a gold facing chevron at its nose.
- Map detailing (14G): bases are real compounds now — faction-tinted HQ
  with an identity roof, garages, fuel tanks, mast, landing pad, corner
  posts (both HQs face the front). Roads carry worn center-line dashes,
  forests grew undergrowth. Pure presentation — replays and determinism
  untouched.
- Mission cards (11T): the right-hand strip shows the team's top three
  public tasks, derived only from what your team legitimately knows —
  STOP THE THIEF, secure/escort the standard, rescue a walker, defend a
  dropping flag, tow a wreck, rebuild a ruin. Click a card to jump the
  camera there and ping the team about it.
- New garage chassis (11R/11S): press Next-asset to find the SCOUT BIKE
  (fastest thing in the war, dies to anything, can't capture or even
  contest relays — courier, spotter, standard-recovery sprinter) and the
  MORTAR CARRIER (mobile indirect fire: 7-cell reach, 2-cell dead zone,
  needs a team spotter, cannot breach relays — that stays artillery's
  job). The AI never crews them — they are yours.
- Second map (11M): `MAP=riverline npm start` — a rough-water river splits
  the field, three road bridges cross it, relays sit in mirrored pairs
  north and south. Terrain is mirror-symmetric BY CONSTRUCTION (west half
  generated, east half mirrored). Wars there run slower — tuning follows
  your first playtest.
- Bridges (13E, riverline): the three crossings can be DROPPED. Artillery
  (only artillery) shells a span until it collapses; the cells become open
  water, so heavy hulls must ford in misery or go the long way round —
  while a Skimmer crosses it at speed. Any team's logistics truck carrying
  materiel can rebuild a dropped span by parking beside it, so a contested
  crossing can change hands repeatedly. AI regents do not yet drop or
  rebuild bridges on their own; that is the next slice.
- Third map (18A): `MAP=blackwood npm start` — the DENSE woodland map.
  Forest dominates; the central corridor is the only road, a trail ring
  plus twin center alleys carry the light chassis, and the contested
  relays sit in clearings OFF the road. Mines, scouts, satchels, and the
  Sentinel shine here; a mid-war weather front is genuinely scary.
  Design of record: specs/10_map_roster.md.
- Fourth map (18B): `MAP=sawtooth npm start` — the ARMOR map. Two
  impassable mesa bands split the field into three open lanes, pierced
  by narrow trail gaps (the saw teeth). Tank duels in the lanes; mines,
  Sentinels, and mortars own the gaps; long exposed edge corridors go
  around. Impassable terrain is a WALL — you never drive into rock. A
  glancing approach SLIDES along the face; a dead-on approach stops the
  unit (so you, or the AI planner, can pick a way around) rather than
  grinding in place. Design of record: specs/10_map_roster.md.
- Waypoints (item 34): SHIFT-click queues up to 8 legs; a plain click
  replaces the whole route. On touch, long-press queues. The unit walks
  the route unattended.
- Death recap (B7): when your vehicle is destroyed, the down banner
  names the killer — "DISABLED — artillery from the north-west", a mine
  under your tracks, the drone, or a satchel charge — so a new player
  learns WHAT to avoid, not just that they died.
- Field repair (item 32, ruled): a logistics truck carrying materiel
  patches an adjacent damaged friendly UP TO HALF hull — a wreck still
  needs the tow home. Dry or badly damaged teammates raise RESUPPLY /
  PATCH mission cards automatically, ranked below every rescue and tow.
- War endings (B1/B3): every vehicle loss now costs your team a ticket,
  refunded if the wreck is recovered — so towing visibly saves the war.
  A decided war ends faster (mercy), and an empty pool waits for a live
  capture or standard run to resolve (overtime) — no more photo finishes
  stolen by the clock.
- Camera (playtest 8): hold the RIGHT mouse button and drag to pan, the
  same as the arrow keys but continuous. **Center** and **center on me**
  both find YOU — including while you are on foot or riding someone
  else's carrier, which previously centred on a random teammate.
- Unit stats (playtest 8): press **I** for the stats panel of whatever
  you are hovering, or of your own hull if you are not hovering
  anything. (The hover tip's ⓘ link still works, but reaching for it
  moves the pointer off the unit — hence the key. Not S: that is a WASD
  pan key. Remappable in ⚙ like every other action.)
- Announcements (playtest 8): the war clock calls half time, quarter
  time, the final push and the last thirty seconds; a weather front
  announces itself ("SUDDEN ONSET OF FOG — sensors halved") when it
  rolls in and again when it lifts. Refused orders now say why, in your
  language, in the middle of the screen instead of scrolling past in the
  corner feed.
- When you are DOWN: the banner names both options — REDEPLOY NOW (R),
  or CLICK THE GROUND to crawl toward a carrier. "Next asset" greys out
  whenever it cannot do anything (on foot, respawning, riding, or
  nothing free) and its tooltip says which.
- Direct drive (11L+11O, the Firepower homage): press G — WASD becomes
  tank controls (W/S throttle with half-speed reverse, A/D steer at your
  chassis' turn rate; all chassis supported). A red targeting circle
  rides your unit showing true gun reach, and clicks become WEAPONS ONLY
  with aim assist — anything visible within 3 cells of the cursor snaps
  as the target (drones included); empty ground does nothing, so a stray
  click never drives you off. G again hands the wheel back. Fully
  server-authoritative: terrain, supply, carrying, and towing multipliers
  all still apply.
- Replay viewer (11H): the join screen links to /replay.html — every
  finished war is archived and re-simulated LOCALLY in your browser
  (deterministic engine), so you can scrub anywhere instantly. Top-down
  tactical view, play/pause (space), ×1/×4/×16, arrow keys jump ±100
  ticks. Human-crewed units get a white box.
- Field logistics (13A): trucks carry a full asset's worth of fuel+ammo,
  reloaded silently at base — pull alongside a thirsty teammate and press
  V (or click the banner) to transfer. AI trucks run resupply errands to
  dry artillery on their own.
- Accessibility (15C): the ⚙ panel has high contrast, text size
  (100/125/150%), remappable action keys (click an action, press a key),
  and the language switch. All persisted per browser.
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

## Server environment (current)

```bash
PORT=8080 MAP_SEED=2026 AI_DIFFICULTY=1 npm start   # defaults shown
MAP=riverline npm start                              # second profile (experimental)
npm run start:blackwood                              # third profile (18A, PROMOTED 2026-07-31)
npm run start:sawtooth                               # fourth profile (18B, experimental)
RULES=easy|normal|hard npm start                     # 13G difficulty presets
# Global discovery (colocation: run tools/master.js on the same VM):
node tools/master.js --port 8972 &
MASTER_URL=http://localhost:8972 PUBLIC_ADDR=your.host:8080 \
  PUBLIC_NAME="My war" npm start
# The server echoes the master's verdict ("master says: listed" or the
# port-forwarding reason). The join screen lists reachable servers.
```
