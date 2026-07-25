# Phase 4: UX Polish & Sound Infrastructure

This phase transforms the functional engine into a satisfying game experience by adding sensory feedback, visual clarity for strategy, and deployment readiness.

## Milestone 4A: Tactical UI Overlays
- **Supply Visualization**: Draw concentric circles or tinted regions showing supply range from bases/relays.
- **Weapon Range**: Show the firing radius of the selected unit.
- **Health Bars**: Floating mini-bars for units and site capture progress.

## Milestone 4B: Sound System (Spatial Audio)
- **Audio Manager**: A Three.js `PositionalAudio` bridge.
- **Sfx Library**: Trigger-ready paths for 'engine_idle', 'fire_cannon', 'explosion', and 'capture'.
- **Event Mapping**: Client-side event listener that plays sounds based on `events` array in the state snapshot.

## Milestone 4C: Visual Effects (VFX)
- **Muzzle Flashes**: Brief light/particle burst on firing coordinates.
- **Explosions**: Temporary animated sprite or geometry scaling for unit death.
- **Terrain Impact**: Dust clouds for units moving in 'Rough' or 'Forest' tiles.

## Milestone 4D: Movement Interpolation Polish
- **Easing**: Upgrade linear interpolation to Hermite/Spline logic for smoother turns.
- **Rotation**: Ensure tanks face their move direction before translating.

## Milestone 4E: Deployment & Dockerization
- **Dockerfile**: Containerize the Node.js server.
- **Production Build**: Minification of client-side JS.
- **Health Checks**: Standardize the `/health` endpoint for load balancers.
