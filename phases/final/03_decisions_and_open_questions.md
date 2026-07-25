# Recovery Front — Decisions and Open Questions

## Confirmed design decisions

| Area | Decision |
|---|---|
| Core identity | New-IP spiritual successor: stylised retro-futurist tactical team operation. |
| Emotional centre | Joining a pressured side and visibly helping it recover. |
| Session | Active operations last about 20–30 minutes; useful participation can be much shorter. |
| Population | 2–16 humans, with AI maintaining at least 32 meaningful active entities. |
| Player ownership | One active asset per player; free switching at friendly operational sites. |
| Main assets | Assault Vehicle, Scout Buggy, Command Carrier, Logistics Truck, plus one unique asset per faction. |
| Combat | Emphasises disablement, terrain, and area-directed fire over precision unit targeting. |
| Wrecks | Persistent until repaired, towed, salvaged, or validly cleared aside. |
| Recovery | Logistics tows/repairs/salvages; Carriers rescue downed operators. |
| Downed state | Player chooses short fast redeploy or waits for recovery/longer auto-return. |
| Economy | Team-owned fuel, materiel, munitions; no personal currency. |
| Playability guarantee | Home Base slow manufacture always supplies basic assets. |
| Win condition | Team score threshold; Command Standard capture/return is largest score event. |
| Rewards | Contribution Bar and non-mechanical Battle Honors. |
| Join flow | Optional drone view with a Spawn Now button; no forced wait. |
| DIDO | Join/leave/rejoin is protected by conservative AI regency. |
| Communication | Public tasks, small pings, response indicators, AI labels, radio/captions; no required voice/text. |
| Art | Tactical-diorama readability; stylised retro-futurist baseline. |
| Audio | Tactile mechanical feedback and recovery-focused dramatic payoff. |
| Technical core | Deterministic reducer, fog-filtered authoritative views, future Lua/Luau parity. |
| V1 mode | One accessible Operation Mode. |
| Roblox | Later port, after the browser/mobile loop proves itself. |

## Recommended provisional choices

These are strong baseline choices but should be validated in prototype playtests.

| Topic | Provisional choice |
|---|---|
| Faction unique assets | Wardens use Sentinel; Freeholds use Infiltrator. |
| Map scale | One fixed logical map size with a small set of seeded topology templates. |
| Input | Tap/click destination and tap/click target area; double-tap indicates priority. |
| Heavy assets | Scarce, recoverable, and slower to replace than basic assets. |
| AI difficulty | Scale decision quality, not hidden stat advantages. |
| New-player task | Bias first operation toward a short, low-risk but real contribution. |

## Questions for the technical workthrough

### Simulation and rules

1. What fixed simulation tick rate gives stable mobile/browser performance and practical replay size?
2. What is the exact coordinate system, movement model, collision/blocking model, and path representation?
3. Which combat outcomes are deterministic hit checks, area effects, suppression states, or damage-over-time effects?
4. What exact state machine applies to each asset, wreck, operator, site, and mission?
5. Which area-fire rules permit speculative fire into fog, and what prevents abusive blind firing?
6. How are mines represented, detected, cleared, and made fair?

### State, networking, and visibility

1. What compact schema keeps full authoritative state below the target size?
2. What data is reconstructed from seed versus stored dynamically?
3. What is the exact fog-filtering protocol for discovered terrain, contacts, ghosts, and shared intelligence?
4. What snapshot/delta cadence and acknowledgement strategy suit browser, LAN, and later Roblox adapters?
5. How does client prediction remain visual-only while preserving server authority?

### Map and content

1. What grid/node resolution is sufficient for route choices without excessive state or CPU cost?
2. What concrete topology templates exist in V1?
3. What seed-validation tests reject unfair maps?
4. What are the first site budgets and placement distance rules?
5. How are wreck-clearance routes guaranteed around key sites and crossings?

### Balance and gameplay

1. What exact score values and score caps prevent one objective type from dominating?
2. What defines a meaningful contribution event and avoids action spam farming?
3. What service levels do Operational, Damaged, Supplied, Cut Off, and Sabotaged sites provide?
4. What quantities/capacities make fuel, materiel, and munitions readable but not tedious?
5. What are unique-asset unlock/rebuild conditions and counters?
6. What hard limits prevent wreck piles, missions, pings, and AI tasks from cluttering the map?

### Production and validation

1. What is the smallest vertical slice: likely one map template, two teams, basic movement, area fire, disablement, one recovery loop, and AI regency?
2. What replay/soak-test harness is needed before live networking?
3. Which telemetry events must be first-class in the reducer log?
4. What mobile screen-size and touch-target baselines determine UI layout?
5. When should art/audio replacement begin relative to simulation proof?
