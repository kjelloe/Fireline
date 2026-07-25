# Phase 5: Campaign & Persistence

This phase transforms the "More Firepower" engine from a single-match simulator into a persistent, evolving war machine. We introduce long-term progression, map rotation, and player identity.

## Milestone 5A: Match History & Replay Indexing
- **Replay Store**: A server-side `replay_store.js` that saves state snapshots and command logs to disk.
- **Indexing**: A `replay_index.json` that allows players to browse past wars by date, map, and winner.
- **Replay API**: A `GET /replay/:id` endpoint to stream historical matches back to the client.

## Milestone 5B: Player Identity & Persistence
- **Player Profiles**: A `player_store.js` to track wins, losses, and preferred unit types.
- **Session Management**: Persistent `playerId` via local storage or cookies to track progress across browser refreshes.
- **Leaderboard**: A simple in-memory or file-based leaderboard for "Most Victories."

## Milestone 5C: Map Rotation & Biomes
- **Biome Logic**: Extending `mapgen.js` to support different terrain palettes (e.g., "Arctic" with ice, "Desert" with sand).
- **Rotation Schedule**: A server-side `map_rotator.js` that cycles through different map seeds every 30 minutes.
- **Map Voting**: A client-side UI overlay allowing players to vote for the next map before a match starts.

## Milestone 5D: Campaign Mode (Single Player)
- **Campaign State**: A `campaign_progress.json` tracking which "missions" (pre-set maps) are unlocked.
- **Mission Logic**: Special win conditions (e.g., "Survive 50 ticks" or "Capture the Capital").
- **Difficulty Scaling**: AI Regent logic that adjusts aggression based on the selected difficulty.

## Milestone 5E: Matchmaking & Lobbies
- **Lobby System**: A `lobby_manager.js` to group players into specific "rooms" or "wars."
- **Matchmaking Queue**: A simple queue that pairs players of similar win/loss ratios.
- **Ready-Up Logic**: A state where the game doesn't start until all players in the lobby confirm they are ready.
