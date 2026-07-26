p = "plan-implementation-order.md"
src = open(p).read()
src = src.replace("""## Questionnaire — rulings needed from you/designer""",
"""## Questionnaire — ANSWERED 2026-07-26 (dev-prompts prompt 14)

All twelve ruled. Deviations from defaults: **Q3** full walking
`operator_foot` entities (not the slim marker — slice 1.2 grows); **Q9** (b)
upgraded procedural models PLUS a committed demo asset-strip PNG for human
assessment (`npm run strip` → `client/assets/preview/asset_strip.png`);
**Q10** chase cam for direct control (not tactical), gamepad later, and
mobile gets on-screen steering arrows (tank drives off in arrow direction,
tap the unit to stop). Everything else: defaults confirmed.

### Original questionnaire (for the record)""")
open(p, "w").write(src)

p = "plan-version2.md"
src = open(p).read()
src = src.replace("| **Direct tank control mode** | V2.0 | User-requested Firepower homage: optional client input mode — held keys stream short move orders, aim-to-fire — no engine change. Feel/command-rate design pass required. |",
"| **Direct tank control mode** | V2.0 | Firepower homage (ruled Q10): WASD + mouse aim with CHASE CAM; gamepad later; mobile variant uses on-screen steering arrows (tank sets off in arrow direction, tap the unit to stop). Client input mode over the command stream; engine turn-rate model (Wave 1) feeds the feel. |")
src = src.replace("| **Downed operators** | V2.0 | Disabled asset may produce a downed operator (`operator_foot`): fast redeploy (~10 s), Command Carrier rescue, or auto-return (~60 s); can call for help and crawl to cover. The heart of the spec's recovery fantasy. |",
"| **Downed operators** | V2.0 | RULED (Q3): FULL walking `operator_foot` entities — disabled asset may produce a downed operator that can move short distances to cover, call for help; fast redeploy (~10 s), Command Carrier rescue, or auto-return (~60 s). POW capture arrives with the NPC layer (Q4). |")
open(p, "w").write(src)
print("rulings applied to plans")
