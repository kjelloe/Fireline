# Local Coding Ally Brief — Milestone 0 Deterministic Parity Spike

## Purpose

Build the **Milestone 0 determinism/parity foundation** for the LAN-first tactical game. This is not gameplay work. Do not add combat, fog of war, networking, three.js rendering, user-interface code, pathfinding, or Roblox gameplay yet.

The goal is a small, exact contract that can later be implemented identically in JavaScript and Luau:

```text
canonical values -> canonical bytes -> FNV-1a 64-bit hash
root seed -> mix32 expansion -> state-held sfc32 outputs
fixed-point values -> identical integer helper results
```

A later reviewer will assess the implementation from test output, source excerpts, generated fixtures, and a concise implementation report.

## Non-negotiable architecture

- The authoritative simulation will be a pure reducer:

  ```text
  apply(state, command) -> state
  ```

  It has no I/O, no clocks, no hidden state, and no calls to `Math.random()`.

- The browser, Node host, test runner, and eventual Roblox version are adapters around that deterministic core.
- Server-to-client traffic must later be fog-filtered **views**, not full authoritative state. Do not implement this in Milestone 0.
- The logical map/grid convention is **0-based** in JavaScript. Use named helpers later; do not let raw indexing conventions leak widely.
- Authoritative state is numeric-first and integer-only. No float values in state or canonical hashes.
- Ruleset numbers belong in versioned JSON under `data/`, not inside engine/reducer code.
- JS must remain readily translatable to Luau: plain functions, plain objects and arrays, explicit `for` loops, no classes/`this`, no `Map`/`Set`, no exceptions as normal control flow, no async in engine/shared primitives, and no `null`.

## Scope: required directory structure

Create only the following initial tree. Add a file only when it has a defined task below.

```text
/
├── data/
│   └── rules.json
├── shared/
│   ├── canonical.js
│   ├── prng.js
│   └── fixedmath.js
├── test/
│   ├── fixtures/
│   │   ├── 0A_byte_writer_primitives.json
│   │   ├── 0B_fnv1a64_vectors.json
│   │   ├── 0C_mix32_vectors.json
│   │   ├── 0D_sfc32_vectors.json
│   │   └── 0E_fixedmath_vectors.json
│   └── milestone0.test.js
├── engine/                 # directory only; no game modules in this milestone
├── server/                 # directory only; no implementation in this milestone
├── client/                 # directory only; no implementation in this milestone
├── luau/                   # directory only; reserved for byte-shaped twins
└── LOCAL_CODING_ALLY_MILESTONE_0.md
```

Do **not** create `engine/core.js`, map generation, entities, combat, transport, renderer, or UI modules yet. Those are later milestones after this handshake is proven.

## Ruleset file: `data/rules.json`

Create a deliberately small, valid, versioned draft. Use standard JSON and integer values where values are authoritative. The immediate parity work does not require a complete combat balance table.

It must include:

```text
protocolVersion: 1
rulesetVersion: 1
constants:
  tickRateHz: 10
  gridCellUnits: 256
  mapSizeDefault: 128
terrain registry:
  numeric terrain IDs
  IDs/names suitable for open, road, forest, rough, blocking terrain
asset template registry:
  scout_buggy as first archetype
```

Do not use JSON `null`. Do not encode current game state in the ruleset. If a movement multiplier must be represented now, use an integer fixed-point ratio or defer it rather than putting a float into data accidentally.

## Canonical encoding contract: `shared/canonical.js`

### Fixed decisions

| Subject | Required contract |
|---|---|
| Byte order | Little-endian for all multi-byte values |
| Authoritative number kinds | `u8`, `u16`, `u32`, `i32` |
| Boolean | exactly one byte: `0` false, `1` true |
| Optional value | one presence byte (`0` absent, `1` then value) |
| Array | explicit count prefix, followed by prescribed stable-order entries |
| UTF-8 text | exceptional only; `u16` byte count then raw UTF-8 bytes |
| Integer checks | reject non-integers and out-of-range inputs in test/development execution |
| Ordering | authoritative collections must be in explicitly defined order before writing |
| Hash display | fixed 16 lowercase hexadecimal characters: `hhhhhhhhllllllll` |

Implement, test, and export these functions (or exact equivalent names documented in the report):

```javascript
createByteWriter(capacity)
writer.writeU8(value)
writer.writeU16LE(value)
writer.writeU32LE(value)
writer.writeI32LE(value)
writer.writeBool(value)
writer.writeOptionalU32(isPresent, value)
writer.writeBytes(bytes)
writer.writeUtf8U16(text)
writer.toBytes()
computeFnv1a64(bytes) // returns { hashHi, hashLo }
hashToHex64(hashHi, hashLo)
```

### Required implementation discipline

- Do not silently mask invalid inputs such as `300` passed to `writeU8`; reject them before writing.
- Do not rely on typed-array platform endianness. Pack every byte explicitly.
- For signed `i32`, validate range `-2147483648..2147483647`, then encode its two's-complement `u32` form explicitly.
- Validate writer capacity. Either use a defined growable implementation or a fixed capacity that reports overflow; document the choice. Do not silently truncate.
- UTF-8 must be encoded deterministically. If using a platform UTF-8 primitive in the adapter-level test code, prove its output in fixtures; do not make strings a broad state feature.
- Avoid `BigInt` in the canonical algorithm unless the design is paired with a Luau-equivalent limb implementation. Preferred implementation: exact unsigned 64-bit FNV state expressed as two unsigned 32-bit limbs.

### FNV-1a requirement

Implement the **standard FNV-1a 64-bit** algorithm exactly:

```text
offset basis: 0xcbf29ce484222325
prime:        0x00000100000001b3
for each byte: hash = (hash XOR byte) * prime mod 2^64
```

The two-limb multiplication must be mathematically exact modulo `2^64`. Do not submit an approximation. Independently verify known standard vectors before pinning local fixtures.

At minimum, verify these known FNV-1a 64-bit values:

| UTF-8 input | Expected lower-case hash |
|---|---|
| empty byte sequence | `cbf29ce484222325` |
| `a` | `af63dc4c8601ec8c` |
| `foobar` | `85944171f73967e8` |

Fixture data must ultimately be generated/checked by an implementation independently reviewed against the standard, not manually guessed.

## PRNG contract: `shared/prng.js`

Use `mix32` for deterministic root-seed expansion and **sfc32** as the simulation PRNG. PRNG state must later live inside game state; no global or hidden generator state.

### Required exported operations

```javascript
mix32(seedU32)
seedSfc32(rootSeedU32) // returns exactly four u32 state words
sfc32Next(prngState)  // returns { value, nextState }
```

Preferred functional state shape:

```javascript
{ a: u32, b: u32, c: u32, d: u32 }
```

Do not conceal mutable closure state in the authoritative form. A convenience wrapper, if any, must be separate from the core function and must be derived from this explicit state transition.

### Required semantics

- Every addition/multiplication/shift with wrap semantics must explicitly normalise to unsigned 32-bit.
- In JavaScript, use `Math.imul` where 32-bit multiplication is needed; do not depend on floating-point multiplication for bit-exact 32-bit results.
- Document the exact `mix32` algorithm and exact root-seed-to-four-word expansion sequence.
- Pin the first several outputs **and state-after-output** for multiple root seeds, including `0`, `1`, and one non-trivial unsigned seed.
- Generate vectors only after cross-checking against a small independent reference implementation or a clearly cited algorithm transcription in the implementation report.

## Fixed-point contract: `shared/fixedmath.js`

Use only integer maths. One logical grid cell equals:

```text
GRID_CELL_UNITS = 256
```

Implement only the small set needed for the first contract:

```javascript
clampI32(value, minValue, maxValue)
floorDivI32(numerator, denominator)
cellToWorld(cell)             // cell * 256, with validation/overflow policy
worldToCellFloor(worldUnits)  // correct for negative values as well as positive
absI32(value)                 // define i32-min behaviour explicitly
manhattanDistanceI32(ax, ay, bx, by)
```

Do not choose or implement Euclidean distance, facing, combat range, interpolation, or movement rules in this milestone. These will be selected in the engine design stage.

For all helpers, specify edge behaviour and reject invalid denominators/ranges. In particular, JavaScript's truncating division must not accidentally stand in for mathematical floor division on negative values.

## Required fixtures

Fixture files must be code-free JSON, deterministic, versioned, and human-readable. They are long-lived contracts shared by JavaScript and future Luau test runners.

Each fixture must include this metadata:

```json
{
  "fixtureVersion": 1,
  "id": "...",
  "purpose": "..."
}
```

### 0A — byte primitives

Pin expected byte arrays for:

- `u8`: minimum, middle, and maximum values;
- `u16 LE`: values showing byte order;
- `u32 LE`: values showing all four bytes;
- signed `i32` values including `-1`, minimum, zero, maximum;
- booleans;
- optional absent/present values;
- a small byte-array append;
- a short ASCII UTF-8 example, only if `writeUtf8U16` is implemented in this slice.

### 0B — FNV-1a 64-bit

Pin expected `hashHi`, `hashLo`, and hexadecimal form for at least the standard vectors listed above plus several byte-writer outputs from 0A.

### 0C — mix32

Pin exact expected unsigned 32-bit outputs for at least seeds `0`, `1`, and one non-trivial value. State the algorithm provenance in the report.

### 0D — sfc32

For at least three root seeds (`0`, `1`, and a non-trivial `u32`), pin:

- expanded initial four-word state;
- at least the first eight generated values;
- the four-word state after each output, or at a minimum after each pinned sequence with enough intermediate checks to detect transition-order errors.

### 0E — fixed math

Pin normal, boundary, and negative-coordinate cases for every implemented function, including examples where floor division differs from truncation.

## Test runner: `test/milestone0.test.js`

Use the repository's existing test convention if one exists. If none exists, use Node's built-in test runner—no new runtime dependency is needed for this milestone.

The runner must:

1. Load each fixture file.
2. Execute the named primitive operation(s).
3. Compare exact bytes, unsigned 32-bit values, limbs, hex strings, and structured states.
4. Exercise invalid inputs and assert that they are rejected.
5. Print failures that identify fixture ID, case ID, expected value, and actual value.

The expected command should be documented, preferably:

```text
node --test test/milestone0.test.js
```

## Explicit non-goals

Do not implement any of the following yet:

- map generation or the 8×8 map microscope;
- state serializer beyond primitive writer functions;
- gameplay state/reducer;
- movement, collision, route finding, combat, suppression, disablement, repair, salvage, medic interaction, objectives, scoring, or AI;
- WebSocket/LAN operation lifecycle, QR joins, player roles, reconnect, AI regency, or no-lobby overlay;
- fog filtering;
- three.js scene, camera, touch input, or HUD;
- Roblox Studio code.

The immediate objective is proof that both languages can later agree at the byte level.

## Required report back to reviewer

When implementation is complete, return a concise report containing:

1. Exact created/modified file list.
2. Exact test command(s) run and complete pass/fail output.
3. Node.js version used.
4. FNV implementation explanation: specifically how two-limb multiplication is exact modulo `2^64`.
5. PRNG provenance and the exact root-seed expansion rule.
6. Fixture IDs/case counts and representative outputs.
7. Any deliberate deviations from this brief, with reason.
8. Full source contents or a patch/diff for all changed implementation and fixture files.
9. A statement confirming no out-of-scope gameplay/network/rendering modules were added.

Do not advance to 0F–0I or broader skeleton work until the reviewer accepts the report.
