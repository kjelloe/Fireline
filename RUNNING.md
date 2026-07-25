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

- Pick a team on the join screen; "Next asset" cycles you through free assets.
- Your browser keeps a persistent player id: closing the tab hands your asset
  to AI regency, reopening reattaches you to the same operator slot.
- Difficulty: `AI_DIFFICULTY=0|1|2 npm start` (easy/normal/hard).
- Match history: `GET /replays`, `GET /replay/:id`. Health: `GET /health`.
- Ctrl-C shuts down gracefully (clients warned, war archived).

## Docker

```bash
docker build -t more-firepower .
docker run -p 8080:8080 -e MAP_SEED=2026 more-firepower
```
