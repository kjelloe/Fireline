Excellent. **The Directorate vs. The Outliers** is strong, clear, and very usable.

It sharpens the setting without becoming cartoonish:

| Axis | The Directorate | The Outliers |
|---|---|---|
| Ideology | Order through control | Freedom through decentralization |
| Tone | Cold, professional, uncompromising | Rag-tag, inventive, hard to pin down |
| Battlefield fantasy | Lock down the front | Break through the edges |
| Visual language | Heavy plating, stencils, grids | Exposed wiring, repairs, markings |
| Palette | Slate gray + police blue | Terracotta + sun-bleached tan |
| Tactical identity | Fortify, calculate, contain | Bypass, improvise, disrupt |

### Recommended Lock-In

For **Wave 3 / Phase 12**, I would approve:

```markdown
Faction names approved:

1. The Directorate
   - Authoritarian law/order faction.
   - Cold, professional, uncompromising.
   - Views the frontier as a territory/data system to be managed.
   - Visuals: heavy plating, geometric stencils, slate gray, police blue.
   - Tactical identity: fortify, contain, stabilize, enforce.
   - Unique unit: Sentinel.

2. The Outliers
   - Decentralized insurgent/frontier faction.
   - Rag-tag but high-tech.
   - Live outside Directorate control and formal infrastructure.
   - Visuals: exposed wiring, weathered paint, terracotta, sun-bleached tan.
   - Tactical identity: bypass, improvise, exploit weak points, move through neglected routes.
   - Unique unit: Pathfinder, River Runner, Skimmer, or Infiltrator pending final name.
```

### Backstory Framing

I’d frame them as **asymmetrically sympathetic**, not simple good/evil.

#### The Directorate

The Directorate emerged from the old emergency command systems after the frontier fractured. Its officers believe the region only survives if roads, relays, depots, and settlements are brought back under one accountable command structure.

They do not see themselves as tyrants. They see themselves as the last adults in the room.

Their flaw is that they reduce people and places into managed zones, compliance scores, supply corridors, and acceptable losses.

Short version:

> **The Directorate brings order to the frontier, whether the frontier wants it or not.**

#### The Outliers

The Outliers are not one army. They are crews, technicians, settlement militias, smugglers, scouts, defectors, and local defenders who operate outside Directorate jurisdiction.

They distrust centralized control because they have seen what “stability” costs at ground level.

Their flaw is that decentralization creates inconsistency, infighting, black-market logistics, and tactical chaos.

Short version:

> **The Outliers survive outside the lines — and fight to keep it that way.**

### Color / Insignia Recommendation

| Faction | Primary | Secondary | Accent | Symbol |
|---|---|---|---|---|
| The Directorate | Slate gray | Police blue | White / pale cyan | Grid shield, vertical bar, or angular eye |
| The Outliers | Terracotta | Sun-bleached tan | Teal or warm yellow | Broken circle, split arrow, or offset chevron |

My recommendation:

| Faction | Symbol |
|---|---|
| **Directorate** | **Grid Shield** — order, surveillance, territory control |
| **Outliers** | **Broken Circle / Offset Arrow** — outside the system, movement, decentralization |

### Unique Unit Names

For this faction pair, the old names become even clearer.

#### Directorate Unique

Keep:

## **Sentinel**

It fits perfectly.

Alternatives are less good:

| Name | Verdict |
|---|---|
| Sentinel | Best |
| Bastion | Good, but more medieval/static |
| Enforcer | Too police-state literal |
| Bulwark | Strong, but less unit-like |
| Lockpoint | Interesting, but abstract |

Use **Directorate Sentinel**.

#### Outlier Unique

Now that the faction is **The Outliers**, I would slightly revise the recommendation.

Top candidates:

| Name | Fit |
|---|---|
| **Skimmer** | Best if amphibious/light vehicle identity is primary |
| **Pathfinder** | Best if scouting/routefinding identity is primary |
| **Runner** | Best if fast, rag-tag courier/raider identity is primary |
| **Infiltrator** | Best only if stealth/ECM becomes central later |
| **Slipstream** | Stylish, but less grounded |

My recommendation for v1:

## **Outlier Skimmer**

Why:

- Sounds like something light, fast, and amphibious.
- Does not overpromise stealth or ECM.
- Reads well in UI.
- Pairs well against **Sentinel**:
  - Sentinel = hold ground.
  - Skimmer = bypass ground.

Suggested pair:

| Faction | Unique |
|---|---|
| The Directorate | **Sentinel** |
| The Outliers | **Skimmer** |

That is very clean.

### Ability Framing

#### Directorate Sentinel

Player-facing ability name:

> **Deploy Hardpoint**

Short UI copy:

- **Deploying hardpoint…**
- **Hardpoint active.**
- **Undeploying.**
- **Sentinel cannot move while deployed.**

#### Outlier Skimmer

Player-facing ability/passive name:

> **Riverline Drive**

Short UI copy:

- **Riverline route available.**
- **Skimmer can cross water.**
- **Water route plotted.**
- **Terrain blocked for this unit.**

This reinforces the game title too: Outliers turn the front by using route geometry other units cannot.

### Suggested Final Faction Snippet for Ally

You can give the local coding ally this:

```markdown
Wave 3 faction decision:

Approved factions:

1. The Directorate
   - Authoritarian law/order faction.
   - Cold, professional, uncompromising.
   - Views the frontier as a managed territory/data system.
   - Visuals: heavy plating, geometric stencils, slate gray and police blue.
   - Symbol direction: grid shield / vertical authority mark.
   - Tactical identity: fortify, contain, stabilize.
   - Unique unit: Sentinel.
   - Unique ability: Deploy Hardpoint.

2. The Outliers
   - Decentralized insurgent/frontier faction.
   - Rag-tag but high-tech.
   - Live outside the lines of Directorate control.
   - Visuals: exposed wiring, weathered paint, terracotta and sun-bleached tan.
   - Symbol direction: broken circle / offset arrow.
   - Tactical identity: bypass, improvise, exploit neglected routes.
   - Unique unit: Skimmer.
   - Unique ability/passive: Riverline Drive.

Faction tone:
- Directorate should feel necessary but cold.
- Outliers should feel free but volatile.
- Neither side should be pure good or pure evil.

Implementation:
- 12A is identity/plumbing only.
- No gameplay changes in 12A.
- 12B implements Directorate Sentinel.
- 12C implements Outlier Skimmer.
- Unique units replace one garage slot each.
- Do not add a 17th roster asset.
```

### My Recommendation

Lock the faction names:

- **The Directorate**
- **The Outliers**

Lock the unique pair:

- **Directorate Sentinel**
- **Outlier Skimmer**

And use these ability names:

- **Deploy Hardpoint**
- **Riverline Drive**
