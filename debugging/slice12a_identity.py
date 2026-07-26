import json
def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

# ── style tokens: faction colors + symbols replace green/red ─────────────────
p = "client/assets/metadata/style_tokens.json"
t = json.load(open(p))
t["teams"] = [
    {"id": 0, "name": "directorate", "color": "#4a7dc9", "symbol": "shield"},
    {"id": 1, "name": "outliers", "color": "#c96a4a", "symbol": "arrow"},
]
json.dump(t, open(p, "w"), indent=2); open(p, "a").write("\n")

# ── build tool: the two faction symbols (grid shield, offset arrow) ─────────
patch("tools/build_assets.mjs",
"""for (const team of tokens.teams) {
  const shape = team.symbol === "triangle"
    ? `<path d="M32 12 L54 50 H10 Z" fill="${team.color}"/>`
    : team.symbol === "circle"
      ? `<circle cx="32" cy="32" r="20" fill="${team.color}"/>`
      : `<rect x="14" y="14" width="36" height="36" rx="4" fill="${team.color}"/>`;
  ICONS[`team_${team.symbol}.svg`] = svg(shape);
}""",
"""for (const team of tokens.teams) {
  // 12A faction symbols (designer ruling): grid shield = order and
  // territory control; offset arrow through a broken circle = movement
  // outside the system. Legacy shapes kept for any older token sets.
  const shape = team.symbol === "shield"
    ? `<path d="M32 8 L52 16 V34 C52 46 42 54 32 58 C22 54 12 46 12 34 V16 Z" fill="${team.color}"/>` +
      `<path d="M22 20 H42 M22 30 H42 M22 40 H42 M27 15 V47 M37 15 V47" stroke="rgba(255,255,255,0.55)" stroke-width="2.5"/>`
    : team.symbol === "arrow"
      ? `<path d="M32 10 A22 22 0 1 0 54 32" fill="none" stroke="${team.color}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M34 30 L56 8 M56 8 H42 M56 8 V22" stroke="${team.color}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : team.symbol === "triangle"
        ? `<path d="M32 12 L54 50 H10 Z" fill="${team.color}"/>`
        : team.symbol === "circle"
          ? `<circle cx="32" cy="32" r="20" fill="${team.color}"/>`
          : `<rect x="14" y="14" width="36" height="36" rx="4" fill="${team.color}"/>`;
  ICONS[`team_${team.symbol}.svg`] = svg(shape);
}""")

# ── art test pins: names, symbol whitelist ───────────────────────────────────
patch("test/art_pipeline.test.js",
"""    assert.ok(["square", "triangle", "circle", "diamond"].includes(team.symbol));""",
"""    assert.ok(["shield", "arrow", "square", "triangle", "circle", "diamond"].includes(team.symbol));""")
patch("test/art_pipeline.test.js",
"""  assert.equal(teamToken(tokens, 1).name, "red");
  assert.equal(teamToken(tokens, 99).name, "green", "unknown team falls back safely");""",
"""  assert.equal(teamToken(tokens, 1).name, "outliers"); // 12A faction ruling
  assert.equal(teamToken(tokens, 99).name, "directorate", "unknown team falls back safely");""")

# ── client identity: join screen, briefing, op info speak faction ───────────
patch("client/index.html",
"""            <button class="btn team-a" id="btn-join-a">Join Team A (green, west)</button>
            <button class="btn team-b" id="btn-join-b">Join Team B (red, east)</button>""",
"""            <button class="btn team-a" id="btn-join-a">Join THE DIRECTORATE (west) — fortify · contain · stabilize</button>
            <button class="btn team-b" id="btn-join-b">Join THE OUTLIERS (east) — bypass · improvise · disrupt</button>""")
src = open("client/index.html").read()
src = src.replace(".team-a { background: #2c4f2c; }", ".team-a { background: #2a3a52; }") \
         .replace(".team-b { background: #5a2622; }", ".team-b { background: #5a3626; }")
open("client/index.html", "w").write(src)

p = "client/js/client.js"
patch(p,
"""import { t, setLocale, getLocale } from "./strings.js";""",
"""import { t, setLocale, getLocale } from "./strings.js";
import { factionFor } from "../../shared/factions.js";""")
patch(p,
"""  const teamName = joined.team === 0 ? "A" : "B";
  info.innerText = `Op ${joined.operatorId} | Team ${teamName} | Tick ${tick}`;""",
"""  info.innerText = `Op ${joined.operatorId} | ${factionFor(joined.team).short} | Tick ${tick}`;""")
print("12A patched")
