# Running Milestone 0

## Requirements

- Node.js 20 LTS or newer
- No npm install needed — zero runtime dependencies

## Run the parity test suite

```bash
node --test test/milestone0.test.js
```

All tests in fixtures 0A, 0B, 0C, 0D, and 0E must pass.

## Generate and pin sfc32 vectors

Run the headless reporter to produce pinnable sfc32 output:

```bash
node test/headless/runner.js
```

Copy the printed values into `test/fixtures/0D_sfc32_vectors.json`
replacing the `"run_to_verify"` placeholders, then re-run the test suite.

## Report back to reviewer

After a green test run, provide:

1. Full console output of `node --test test/milestone0.test.js`
2. Full console output of `node test/headless/runner.js`
3. Node.js version (`node --version`)
4. Any deviations from the brief with reasons

Do not proceed to Milestone 0F (map generation) until the reviewer confirms.

## Directory structure

```text
data/           Versioned ruleset JSON
shared/         Deterministic primitives (canonical, prng, fixedmath)
test/fixtures/  Code-free JSON parity contracts
test/           Test runner
test/headless/  Soak and seed-batch reporter
engine/         Reserved — no implementation yet
server/         Reserved — no implementation yet
client/         Reserved — no implementation yet
luau/           Reserved — Roblox twin (later)
```
