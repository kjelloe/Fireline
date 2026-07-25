# Running Milestone 1F

## Test (single file, no shared export dependencies)

```bash
npm test
```

Runs only `test/milestone1f.test.js` — 5 subtests covering terrain speed multipliers,
movement differential, blocking tile immobility, view mapCells, and reducer immutability.

## Headless simulation

```bash
npm run sim1f
```

Runs the 11-tick demo showing asset movement across the generated map with terrain
speed applied per cell.

## Integration with your existing 1E baseline

If you have an existing 1E codebase with your own `shared/canonical.js`, `shared/prng.js`,
etc., you can merge this package selectively:

1. **New file:** `engine/terrain.js` ↔ drop in as-is
2. **Modified file:** `engine/reducer.js` ↔ add `import { speedMultiplier } from './terrain.js';`
   and apply `speedMultiplier` during movement tick (see the `apply` function in this package)
3. **Modified file:** `engine/view.js` ↔ add `mapCells: state.map.cells` to the returned view
4. **New test:** `test/milestone1f.test.js` ↔ drop in as-is
5. Update your `package.json` test script to include `test/milestone1f.test.js`
