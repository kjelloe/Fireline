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
npm start -- --mode heist        # asymmetric modes (146): standard|convoy|heist
npm start -- --mode convoy --attacker 1   # team B escorts instead
# Convoy runs a SHORTENED route by default (measured: attackers 38% vs 19% on the full run).
# --rules or RULES with convoyRouteScale:100 restores the classic full-map run.
npm start -- --difficulty hard   # O4: easy|normal|hard (or 0|1|2); shown on the join screen
npm start -- --teambalance   # W4-1: competitive gate (default OFF — friends stack a team vs the AI)
npm start -- --night         # W4-10: a war fought in the dark — every sensor halves
# Public hosting: see DEPLOYING.md (allowlist ssh-deploy, systemd unit, nginx/TLS, health guards)
npm run start:convoy | start:heist        # same, less typing
npm run maps                     # what is registered
npm start -- --help              # every option
```

CLI beats env beats default, so `MAP=riverline npm start -- --map sawtooth`
starts sawtooth. A mistyped map refuses to start and suggests the closest
real one (`--map blackwod` -> "did you mean: blackwood?") rather than
quietly serving the default. The startup banner always names the map you
actually got.

Environment (still honoured, CLI wins): `PORT` (default 8080), `MAP_SEED`
(default 2026), `MAP`, `MODE`, `MODEATTACKER`, `RULES`, `AI_DIFFICULTY`.
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
- **UAV SWEEP (W4-7)**: bank 25 Recognition and the UAV SWEEP special
  lights up an 8-cell patch of the map for your whole team for 10
  seconds — it sees through smoke, because you paid for it. Spending
  never touches your medals: honours judge what you EARNED, the sweep
  draws from a separate wallet that earning also fills.
- **SMOKE SCREENS (W4-6)**: supply trucks and mortar carriers carry two
  smoke pots — the SMOKE special in direct mode lays a 3x3 cloud on your
  cell for 30 seconds. A hull inside smoke can only be seen from one cell
  away, which is the answer to being shelled in the open: cover a rescue,
  a convoy restart, or a POW walked home. It is BLIND TO TEAM — it hides
  whoever stands in it, including you, and you cannot see out of it
  either. Six clouds per team at once.
- **Gun feel (W4-5)**: your own shot kicks the camera and every visible
  shot draws a tracer. Turn Visuals to Low in ⚙ if you would rather not
  have the shake.
- **Build feedback (W4-4)**: a refused sandbag/mine now says WHY — a
  green or red ring lands on the target cell and the reason appears
  ("the road must keep two open lanes"). Nothing doomed is sent, so
  the 5-second build channel is never wasted. (This also revived the
  sandbag button and its keybind, dead since the feature shipped.)
- **Two more mission cards (W4-3)**: "RAID THEIR PRISON — N of ours
  are held there" when the enemy holds your people, and "THE LANDSHIP
  STANDS UNCLAIMED" when the neutral fortress is sitting free. Both
  click-to-jump and ping the team like every other card.
- **Your FIRST war draws no drone (W4-2)**: the anti-camping rule is
  waived for a brand-new player, so you can read the UI in peace.
  From war two on it applies — and everyone now gets a 20-second
  "a drone is coming, MOVE" warning before one launches.
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
  generated, east half mirrored). PACING (prompt 136): a joined war where
  neither side holds the relay majority grinds BOTH ticket pools slowly —
  sitting on your own bank is not a plan; cross or bleed. Holding both
  bridge relays counts as bleed majority (the crossing is the supply line).
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
- Comm wheel (B5): HOLD Q for the full ping wheel — release over an
  option to send it at your cursor; centre = cancel. The 1/2/3 keys
  keep their quick top-three. The feed also calls out fresh contacts:
  "CONTACT — artillery to the north-west".
- Supply drop (B6): mid-war a neutral supply drop lands dead-centre —
  first team to hold its ring alone for 10 s recovers 15 tickets.
  Everyone gets the mission card; expect a fight.
- Salvage: every wreck your trucks bring home banks a salvage point —
  each point shaves 10 s off your team's next rebuild wave. Your tows
  literally buy the counterattack.
- THE LAST CONVOY: when your team is nearly out, the war's end flips
  to one last mission — get the quota of hulls HOME before the pool
  empties. The bleed slows while the convoy runs; drivers who make it
  earn honors. (The enemy is told to hunt you.)
- End-screen honors: BEST RAIDER / RECOVERY / CAPTURER / ESCORT /
  HERO OF THE CONVOY / FIELD MECHANIC — category awards from what you
  actually did, beside the top-3 total.
- Crew stations (prompt 100): the Command Carrier has an MG ring and
  the scout an AT launcher — hover a friendly with a vacant seat and
  press J to jump on; drivers can call for a gunner (comm wheel) and
  eject crew (J, with a 2.5 s warning). Station kills split the credit.
- Typed relays (B2): RADAR relays widen your team's sensors (even
  through weather), DEPOT relays are forward resupply points — idle
  beside one to rearm. Captures now answer "what do we need?".
- POW prisons: every base has a prison compound. Start the server with
  POWS=2 and each side holds two enemy crew — raid the enemy compound
  (hold beside it 10 s), then CARRY the freed crew home by carrier to
  unlock their seats. Freed prisoners cannot redeploy on their own —
  and if nobody comes for them within a minute, the compound takes
  them back.
- Scout capture: a scout holding over a downed ENEMY for 3 s takes
  them prisoner — deliver to your prison to lock their seat. Shooting
  the scout pauses the kidnapping; your team is pinged the moment
  someone is taken. Eject (J, drivers) only works while parked.
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
- Phones & tabs (prompt 139): backgrounding the game is SAFE — your
  seat is held (AI drives your hull meanwhile), and coming back
  reclaims it automatically, even from a new tab or after the screen
  locks. The reconnect fires the moment the tab becomes visible.
- Road walls (Q53/145): trucks can now sandbag ON roads — the build
  refuses only when it would leave fewer than two open lanes in that
  road's cross-section. Caltrops remain the only full-road denial.
- Heist getaway car (Q70/145): in heist wars the ATTACKING team's
  scouts can carry the Asset — grab it with the fast hull and run.
  (Carriers still work; every other war keeps carrier-only carrying.)
- Join screen (149): two BIG team buttons; a side is greyed (with a
  tooltip) while it has 2+ more humans than the other — counts update
  live, so you can wait for room on your favourite team. Spectate and
  the replay viewer sit on the line below; `SPECTATE=0` / `REPLAYS=0`
  hide + disable them server-side.
- DIRECT CONTROL (149, the Firepower homage): the 🕹 button lower-left
  (or G) drops the camera low and turns WASD into tank controls —
  W/S throttle, A/D steer, click an enemy to fire; your chassis'
  specials (mine, caltrops, sandbag, hardpoint) appear as buttons;
  on touch the compass pad steers. ✕ EXIT (or G, or Esc habits) leaves.
- Measured ticket offsets (154): on maps where the unique pair
  measurably leans the war (sawtooth, riverline), the disadvantaged
  team STARTS with extra tickets — the briefing discloses it to both
  sides. Outcome fairness; the +25% underdog premium stays for reward.
- The battlefield LOOKS like a place now (157, art phases 1-3):
  blended terrain with sand-banked water and semantic relief, per-map
  tree species with forest verges and field patches, typed relay
  dressing (radar dish, depot crates, factory stack), filled-in base
  compounds. `?lowdetail=1` (automatic on touch) thins the dressing
  for weaker devices.
- Playtest-11 batch (160): a green YOU-diamond over your hull; cyan
  SEAT PIPS over hulls with a free bunk or station (carriers + the
  landship — board with B, man the ring with J); enemy hulls are
  obstacles you FLOW AROUND now; your compound always sees intruders
  (watchtower searchlights sweep the corners); movement no longer
  wobbles; war-clock announcements land big; centre always has
  somewhere to take you; ⚙ Visuals Low/Medium/High; and the result
  screen got real sections + map-tile voting with LIVE tallies.
- The O-batch (164-166): enter a NAME on the join screen (blank =
  Operator N) — honors celebrate people now; the battlefield has
  SOUND (synthesized — ⚙ toggle, separate from Music); a first-war
  COACH walks brand-new players through move/fire/supply/rescue once;
  the server autosaves the live war and RESUMES it after a crash
  (RESUME=0 skips); join buttons are square faction FLAGS; and if 3D
  graphics fail (driver WebGL errors), the game tells you and drops
  into a playable 2D fallback instead of a black screen.
- Fog of war SHEEN (147): unseen ground darkens under a translucent
  overlay whose edge IS the spotting edge (squares, honestly — sensors
  are chebyshev). Storms shrink your lit area; an owned RADAR widens
  it. Spectators see everything, no sheen.
- Mission banner (147): mode wars show a persistent gold banner top-
  centre — your orders and the clock; it burns red in the last minute.
  Mission cards + golden rings mark the convoy truck, the delivery
  gate, and the heist Asset.
- Accessibility (15C): the ⚙ panel has high contrast, text size
  (100/125/150%), remappable action keys (click an action, press a key),
  the language switch, and a Music on/off toggle (ready for the
  composer's tracks — nothing plays yet). All persisted per browser.
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

- Convoy Escort mode (asymmetric): start the server with MODE=convoy
  (MODEATTACKER=1 flips sides). The attacking team escorts one convoy
  truck to the enemy compound gate before the 15-minute clock dies —
  it only rolls with armour alongside, and a friendly truck parked
  beside its wreck restarts it. Defenders get its position by radio
  ping every 30 s. No standards, no ticket bleed: the mission is the
  whole war.

- Vote rotation (server operators): VOTE_MAPS="frontier_corridor,blackwood"
  and VOTE_MODES="standard,convoy" at start pick what the end-screen
  vote can offer (default: every completed map, every mode). At
  runtime: GET /rotation shows the pool; POST /rotation from the
  server's own machine changes it live —
  curl -X POST localhost:8080/rotation -d '{"maps":["blackwood"],"modes":["standard"]}'
- Caltrops (scout/bike, M key): strew the road behind you — enemies
  crossing run 30% slower for 45 s. No damage; trucks rake them up.
- Sandbags (truck, N key): park beside a spot and build — 5 s later
  it is a wall any gun can tear down. Roads can never be walled, and
  a wall run stops at 4 cells: routes get shaped, never sealed.
- Prison compounds have a watchman: enemies near the wire trip an
  alarm ping for the owners. He cannot be killed — he is a shout,
  not a soldier.

- The LANDSHIP: one neutral fortress spawns mid-map every war. Walk
  up and click it — the select is the capture, for either team. The
  driver alone moves it; the heavy MG station (J to board) is why you
  bring a friend. Wreck it and ANY team can tow the hulk home for
  salvage — but a respawn clock is running, and when it fires the
  wreck vanishes and a fresh neutral hull appears at the other berth.

- POWs are the HUMAN-SESSION flavour (the arc settled at prompt 133):
  start the server with POWS=2 and each side holds two enemy crews —
  the designed day-one objective. The default war keeps the classic
  census; organic scout captures still fill compounds either way.
- HEIST mode: MODE=heist — only the defenders keep a standard (the
  Asset); the attackers' carrier must steal it home before the clock.
  The radio pings the Asset's position to the defenders while it
  moves. MODEATTACKER=1 flips sides.
