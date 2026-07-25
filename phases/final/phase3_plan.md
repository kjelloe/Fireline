# Phase 3: Content & Gameplay Depth

## Overview
Phase 3 transitions "More Firepower" from a technical vertical slice into a fully playable strategy game. We will introduce distinct unit classes, advanced base mechanics, and an AI Regency system to ensure the world remains active even when players disconnect.

## Slice 3A: Unit Roster & Stats
- **Goal**: Implement distinct unit types (Tanks, Scout Cars, Artillery) with unique stats.
- **Files**: `engine/units.js`, `data/units.json`.
- **Tests**: `test/milestone3a.test.js`.
- **Details**: Define speed, range, HP, and damage for each class.

## Slice 3B: Base & Supply Logic
- **Goal**: Implement "Bases" as high-value capture points that provide supply.
- **Files**: `engine/supply.js` (update), `engine/state.js` (update).
- **Tests**: `test/milestone3b.test.js`.
- **Details**: Units out of supply move slower and cannot fire. Bases generate supply in a radius.

## Slice 3C: AI Regency (Bot Takeover)
- **Goal**: When a player disconnects, an AI "Regent" takes control of their units.
- **Files**: `server/ai_regent.js`.
- **Tests**: `test/milestone3c.test.js`.
- **Details**: Simple state-machine AI that seeks objectives or defends bases.

## Slice 3D: Advanced Combat (Artillery & Indirect Fire)
- **Goal**: Implement indirect fire mechanics for Artillery units.
- **Files**: `engine/combat.js` (update).
- **Tests**: `test/milestone3d.test.js`.
- **Details**: Artillery can fire over obstacles but requires a "spotter" or LOS from another unit.

## Slice 3E: Victory Conditions & Game End
- **Goal**: Define win/loss states (e.g., capture all bases, eliminate all enemies).
- **Files**: `engine/reducer.js` (update), `server/clock.js` (update).
- **Tests**: `test/milestone3e.test.js`.
- **Details**: Server checks for victory conditions every tick and broadcasts a `GAME_OVER` event.
