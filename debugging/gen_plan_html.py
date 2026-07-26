# Regenerate plan-version1.html / plan-version2.html twins (prompt 25
# window). Same visual language as the originals; content mirrors the MDs.

STYLE = """
  :root {
    --bg: #101018; --panel: #181824; --ink: #e8e8e2; --dim: #9a9aa8;
    --green: #4f8f4f; --red: #c7443e; --gold: #f5e96b; --blue: #3d6fb6;
    --ok: #6bd17b; --line: #2c2c3a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.55; padding: 2rem 1rem 4rem; }
  main { max-width: 900px; margin: 0 auto; }
  h1 { letter-spacing: 2px; margin-bottom: 0.2rem; }
  h1 span { color: var(--gold); }
  .sub { color: var(--dim); margin-top: 0; font-size: 0.95rem; }
  h2 { margin-top: 2.4rem; padding-bottom: 0.3rem;
    border-bottom: 2px solid var(--line); letter-spacing: 1px; }
  .card { background: var(--panel); border: 1px solid var(--line);
    border-radius: 10px; padding: 1rem 1.2rem; margin: 1rem 0; }
  table { width: 100%; border-collapse: collapse; margin: 0.8rem 0; font-size: 0.92rem; }
  th, td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--dim); font-weight: 600; }
  code { background: #22222e; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.88em; }
  .ok { color: var(--ok); font-weight: 700; }
  .next { color: var(--gold); font-weight: 700; }
  .later { color: var(--dim); }
  .hold { color: #8fd4ff; }
  .banner { background: linear-gradient(90deg, #1c2a1c, #181824);
    border: 1px solid var(--green); border-radius: 10px;
    padding: 1rem 1.2rem; margin: 1.2rem 0; }
  ul { padding-left: 1.2rem; }
  li { margin: 0.3rem 0; }
"""

def page(title, body):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>{STYLE}</style>
</head>
<body><main>
{body}
</main></body>
</html>
"""

V1 = """
<h1>MORE <span>FIREPOWER</span> — Version 1</h1>
<p class="sub">Updated 2026-07-26 · branch dev_night · suite 416/416 · fixture v30 · twin of plan-version1.md</p>

<div class="banner"><strong class="ok">VERSION 1 SHIPPED — and overtaken the same day.</strong>
A playable 32-participant war for humans and AI, over LAN, no lobbies — met at tag <code>v1.0</code>
after playtest 3; the Rescue Update and the living-world round then shipped most of what used to be "later".
The living roadmap is <a href="plan-version2.html" style="color:#f5e96b">plan-version2.html</a>.</div>

<h2>Acceptance record</h2>
<table>
<tr><th>Check</th><th>Result</th></tr>
<tr><td>Headless 32-participant war, byte-exact replay</td><td class="ok">PASS (npm run simv1)</td></tr>
<tr><td>LAN playtest 1</td><td>technical PASS, experience FAIL ("made little sense")</td></tr>
<tr><td>Pace ×2 + legibility kit</td><td class="ok">shipped</td></tr>
<tr><td>LAN playtest 2</td><td class="ok">PASS — "hint leads somewhere useful; pace felt right"</td></tr>
<tr><td>LAN playtest 3</td><td class="ok">PASS → tagged <code>v1.0</code></td></tr>
<tr><td>Playtest 4 (post-Rescue-Update)</td><td class="ok">"Starting to get more fun" — 4 UX fixes shipped same day</td></tr>
<tr><td>AI-vs-AI wars end decisively</td><td class="ok">PASS — standard captures ≈ 6 min, 5-seed verified</td></tr>
</table>

<h2>What v1 contains today</h2>
<div class="card"><ul>
<li><strong>Core fantasy</strong>: physical Command Standards (steal → escort → drop → rescue → score),
war rotation, BF2-style capture countdowns with contested-freeze, relay supply, fog.</li>
<li><strong>The Rescue Update</strong>: carrier-exclusive carrying, full walking downed operators,
truck-only tow-back, Minimum Playability Guarantee, mines, the anti-camping drone, per-chassis turn-rate movement.</li>
<li><strong>Roster of seven</strong> with explicit contract flags: tank, scout, artillery (only siege gun),
logistics, command carrier, scout bike (courier — cannot capture), mortar carrier (mobile indirect).</li>
<li><strong>Living world</strong>: AI roles (raider, courier, capturers, fire support), AI mining/clearing/
towing/rescuing/repairing/pinging, trail patrols for light chassis.</li>
<li><strong>Coordination</strong>: context pings, fog-safe mission cards, takeover confirmations,
rescue-autopilot option, Recognition scoring with honors.</li>
<li><strong>Modes & tooling</strong>: direct control with aim assist, spectator, local-resim replay viewer,
two mirror-fair maps, path terrain, ops hardening, batch-PC sim lane.</li>
</ul></div>

<h2>The invariants that made it work</h2>
<div class="card"><ul>
<li>Deterministic pure reducer, integer math, hashed state pinned by the 1A fixture (v30) with an event-drift guard.</li>
<li><strong>Mirror symmetry is a tested balance invariant</strong> — the "one team wins 5/5 seeds" era
traced to a 3-cell spawn asymmetry and an un-mirrorable center relay.</li>
<li>Every gameplay slice ends with the AI-only sim gate; every product decision is the user's,
recorded verbatim before implementation.</li>
</ul></div>
"""

ROWS_V2 = [
    ("A — Roster & roles", [
        ("Command Carrier", "ok", "slice-9a — exclusive carrying, rescue bunks"),
        ("Downed operators (full walking)", "ok", "slice-9b + AI down-management"),
        ("Scout Bike (courier)", "ok", "slice-11r — cannot capture/contest; AI courier 11v"),
        ("Mortar Carrier (mobile indirect)", "ok", "slice-11s — pinned junior to artillery; AI fire support 11v"),
        ("Sentinel (Warden unique)", "next", "NEXT CAMPAIGN — breaks mirror symmetry by design; mirror-sweep gated"),
        ("Infiltrator (Freehold unique)", "next", "NEXT CAMPAIGN — amphibious; likely the riverline fix"),
        ("Factions + NPC/POW layer", "later", "V2.x"),
    ]),
    ("B — Battlefield systems", [
        ("Mines + AI doctrine", "ok", "slice-9e / 11d"),
        ("Anti-camping drone", "ok", "slice-9g"),
        ("Minimum Playability Guarantee", "ok", "slice-9d"),
        ("Damaged sites + materiel", "ok", "slice-11f — artillery-only siege; depots as distinct sites still open"),
        ("Path terrain + trail patrols", "ok", "slice-11n / 11v — heavy tanks excluded"),
        ("Riverline map + bridge relays", "ok", "slice-11m / 11w — OPEN: standard-run viability (horn-bound wars)"),
        ("Full cargo (fuel/munitions), route graph, fog ghosts, convoys", "later", "V2.x"),
        ("Q2b held-standard point bleed", "hold", "armed; waits for HUMAN standoffs"),
    ]),
    ("C — Coordination & social", [
        ("Context pings + AI pings", "ok", "slice-10c / 11d"),
        ("Public task cards (fog-safe)", "ok", "slice-11t — responder counts remain V2.x"),
        ("Takeover confirmations", "ok", "slice-10b"),
        ("Rescue autopilot option", "ok", "slice-11g"),
        ("Recognition scoring + honors", "ok", "slice-11k — persistent profiles remain V2.x"),
        ("Join flow / lobbies", "later", "VERSION 3 by ruling"),
    ]),
    ("D — Presentation & platforms", [
        ("Direct control, all chassis + aim assist", "ok", "slice-11l / 11o"),
        ("Chase cam", "hold", "ruled: fixed cam now, rotating chase cam with the perspective pass"),
        ("Art round 1 (procedural upgrade)", "ok", "slice-11q — APPROVED"),
        ("Art round 2c: battlefield props", "next", "IN QUEUE (ruled first)"),
        ("Art round 2a: faction palette", "next", "IN QUEUE (ruled second)"),
        ("Art 2b motion / 2d baked sprites", "hold", "NOTED for later (prompt 25)"),
        ("Spectator + replay viewer", "ok", "slice-10a / 11h — local re-simulation, byte-exact"),
        ("Camera pass, audio identity, mobile, i18n/a11y", "later", "V2.x"),
    ]),
    ("E — Meta & live ops", [
        ("Ops hardening", "ok", "slice-11j — rate limits, /version"),
        ("Batch-PC lane + sim harnesses", "ok", "slice-11p — agent-mail jobs, TRUE mirror mode, analyzer"),
        ("Telemetry, profiles, achievements, modding, campaign", "later", "V2.x / Horizon"),
    ]),
]

badge = {"ok": ("✅", "ok"), "next": ("🔜", "next"), "later": ("⬜", "later"), "hold": ("⏸", "hold")}
tracks = ""
for name, rows in ROWS_V2:
    body = "".join(
        f'<tr><td>{feat}</td><td class="{badge[s][1]}">{badge[s][0]}</td><td>{note}</td></tr>'
        for feat, s, note in rows)
    tracks += f"<h2>Track {name}</h2><table><tr><th>Feature</th><th></th><th>Status</th></tr>{body}</table>"

V2 = f"""
<h1>MORE <span>FIREPOWER</span> — Version 2</h1>
<p class="sub">Updated 2026-07-26 · suite 416/416 · fixture v30 · twin of plan-version2.md · v1: SHIPPED</p>

<div class="banner"><strong class="ok">The proposed V2.0 cut — "The Rescue Update" — is essentially shipped.</strong>
This page marks what landed, what changed shape, and what genuinely remains.
Slice detail: <code>plan-implementation-order.md</code> + <code>reports/</code>.</div>

{tracks}

<h2>Open balance & design questions</h2>
<div class="card">Live list in <code>reports/2026-07-26_rulings_round2.md</code> (Q17+).
Highest value: <strong>question 18</strong> (directional arithmetic residue — the batch-PC
mirror census gives the verdict), riverline standard-run viability, AI artillery siege
doctrine, depots as a damaged-site class.</div>

<h2>Version 3 parking lot</h2>
<div class="card">Lobbies/matchmaking as an OPTIONAL entry beside the no-lobby flow;
whatever sustained multi-human sessions prove the game still needs.</div>
"""

open("plan-version1.html", "w").write(page("More Firepower — Version 1 Plan & Status", V1))
open("plan-version2.html", "w").write(page("More Firepower — Version 2 Plan", V2))
print("twins regenerated")
