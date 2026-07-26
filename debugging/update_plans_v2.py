# Apply the three design rulings + V3 section + turning model to both plan files.
md = "plan-version2.md"
src = open(md).read()

src = src.replace("""## Known tensions to resolve with the designer

1. **Lobbies (phase plan 5E) vs the no-lobby philosophy** (spec 01 §7 and the
   shipped join flow) — recommend dropping 5E in favor of the balance-aware
   battle picker in Track C.
2. **Artillery** exists in-engine but not in the spec roster — keep, rename,
   or fold into the Assault Vehicle family when factions land?
3. **Standard carrying**: exclusive to the Command Carrier when it ships, or
   any-chassis-with-penalty as today? (Spec leans Carrier-exclusive escort
   gameplay; today's rule is friendlier to small player counts.)
4. **Helicopters** from the original Firepower (anti-camping pressure) have no
   spec equivalent — worth a designer call whether some QRF/harassment event
   fills that emotional slot.""",
"""## Design rulings (2026-07-26, dev-prompts prompt 12)

1. **No-lobby stays THE entry point.** Lobbies/matchmaking move to
   **Version 3**, to be revisited only after real play experience (see below).
2. **Artillery is confirmed** as a permanent roster member.
3. **Standard carrying goes Command-Carrier-exclusive when the Carrier
   ships** — validated FIRST by AI-only backend simulations. The harness now
   exists: `npm run simwar` runs full AI-vs-AI standard wars (objective
   doctrine: designated raiders, carriers escorting home, per-team
   recoverers, lazy role reassignment). Early sim findings already logged:
   mutual-steal standoffs are possible, relay ownership can churn tick-to-
   tick when contested, and raider death without reassignment stalls the
   war — all inputs to the Carrier-exclusive evaluation.
4. **Anti-camping role: modern DRONE recommended** (pending veto) over a
   literal Firepower helicopter — fits the new-IP rule, the toy-diorama
   aesthetic (rotor toy on a stick), the Infiltrator/EW systems track, and a
   cheap unmistakable silhouette; the helicopter can return later as a skin
   or faction variant. Mechanic sketch: idle too long outside your supply
   umbrella → an autonomous harassment drone spawns from the nearest enemy
   relay, pesters (light damage, breaks suppression camping), expires or is
   shot down. Deterministic, seeded, engine-side.

## Also queued from playtests (engine feel)

- **Vehicle heading & turn-rate model (V2.x)** — playtest 3: axis-major
  movement makes units wiggle at near-diagonals. Client-side gradual-turn
  smoothing shipped as mitigation (marker-0039); the real fix is authoritative
  heading state with per-chassis turn rates (also unlocks the direct-control
  homage mode's feel).

## Version 3 (parking lot — needs play experience first)

- Lobbies/matchmaking (old 5E) as an OPTIONAL entry beside the no-lobby flow.
- Whatever the LAN/balance sessions prove the game still needs.""")
open(md, "w").write(src)

ht = "plan-version2.html"
src = open(ht).read()
src = src.replace("""  <h2>Known tensions for the designer</h2>
  <ol>
    <li><strong>Lobbies (phase plan 5E) vs the no-lobby philosophy</strong> — recommend dropping 5E
        for the balance-aware battle picker.</li>
    <li><strong>Artillery</strong> is in-engine but not in the spec roster — keep, rename, or fold
        into the Assault Vehicle family when factions land?</li>
    <li><strong>Standard carrying</strong> — Carrier-exclusive (spec leaning) or any-chassis-with-penalty
        (today's small-player-count-friendly rule)?</li>
    <li><strong>Helicopters</strong> (original Firepower's anti-camping pressure) have no spec
        equivalent — does a QRF/harassment event fill that emotional slot?</li>
  </ol>""",
"""  <h2>Design rulings — 2026-07-26</h2>
  <ol>
    <li><strong>No-lobby stays the entry point.</strong> Lobbies/matchmaking move to
        <strong>Version 3</strong>, revisited only after real play experience.</li>
    <li><strong>Artillery confirmed</strong> as a permanent roster member.</li>
    <li><strong>Standard carrying goes Carrier-exclusive when the Carrier ships</strong> —
        validated first by AI-only backend sims. Harness shipped: <code>npm run simwar</code>
        (raider/carrier/recoverer doctrine). Early findings: mutual-steal standoffs, contested-relay
        churn, raider-death stalls — all inputs to the evaluation.</li>
    <li><strong>Anti-camping: modern DRONE recommended</strong> (pending veto) — new-IP safe,
        toy-diorama silhouette, EW-track synergy; the helicopter can return as a skin/variant.
        Sketch: camp outside your supply umbrella → a seeded harassment drone spawns from the
        nearest enemy relay.</li>
  </ol>

  <h2>Queued from playtests</h2>
  <ul>
    <li><strong>Vehicle heading &amp; turn-rate model</strong> <span class="pill v2x">V2.x</span> —
        playtest 3 wiggle; client gradual-turn smoothing shipped as mitigation, authoritative
        heading + per-chassis turn rates is the real fix (also feeds direct-control mode).</li>
  </ul>

  <h2>Version 3 (parking lot)</h2>
  <ul>
    <li>Lobbies/matchmaking (old 5E) as an <em>optional</em> entry beside the no-lobby flow.</li>
    <li>Whatever the LAN/balance sessions prove the game still needs.</li>
  </ul>""")
open(ht, "w").write(src)
print("plans updated")
