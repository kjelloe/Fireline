# Fireline Command: Naming & Brand Language Brief

**Status:** Approved naming direction  
**Audience:** Local coding ally, technical artist, UI/UX contributor, documentation maintainer  
**Scope:** Naming, tone, terminology, and implementation guidance. This document does not change gameplay logic.

## 1. Approved Game Name

| Brand element | Approved text |
|---|---|
| Short name | **Fireline** |
| Full game title | **Fireline Command** |
| Primary catchphrase | **Join the battle. Turn the front.** |

Use the full title on:

- Title screen and browser title.
- Landing page / README heading.
- Storefront or project description.
- Major promotional images.
- First-launch/tutorial title card.

Use the short name, **Fireline**, in compact contexts:

- HUD headers.
- Internal non-technical UI copy.
- Social or community shorthand.
- Filename prefixes for new brand assets where appropriate.

Do **not** rename existing technical code identifiers, test names, command names, state keys, import paths, or persisted data merely for branding. Treat branding changes as a presentation/documentation pass unless an explicit migration plan has been approved.

## 2. Brand Meaning

**Fireline** means both the active line of combat and the moving edge of a contested war. It supports the game's main promise:

> A player joins an active conflict already in motion and can materially change its direction.

**Command** communicates tactical agency, server-authoritative orders, multi-role participation, and deliberate battlefield decisions.

The catchphrase has two parts:

| Phrase | Intended meaning |
|---|---|
| **Join the battle.** | No-lobby design: players enter wars already underway instead of waiting for a new match. |
| **Turn the front.** | Player agency: tactical decisions, objective play, recovery, and coordinated pressure can change the war's momentum. |

## 3. Product Vision in Brand Language

Fireline Command is a deterministic, server-authoritative tactical game set on a living miniature battlefield.

Players enter active wars, take useful battlefield roles, defend their side's Command Standard, seize the enemy objective, recover disabled allies, and help shift a contested front.

The intended tone is:

- Immediate, not bureaucratic.
- Tactical, not militarily realistic.
- Confident, not grimdark.
- Clear, not jargon-heavy.
- Toy-diorama expressive, not childish.
- New IP: inspired by classic tactical action and agent-command games in broad spirit, never presented as a clone or continuation of another property.

## 4. Canonical Gameplay Terms

Use the following player-facing terminology consistently. The local coding ally should use it in new UI, tutorial, art labels, and documentation unless a later design decision replaces it.

| Concept | Canonical player-facing term | Notes |
|---|---|---|
| A running match/world | **Battle** or **War** | Prefer “battle” for a single playable session; “war” for the persistent/living-front framing. |
| Contested area/momentum | **Front** | Central brand word; use in summaries and status language. |
| Main carry-and-capture objective | **Command Standard** | Do not call it a “flag” in prominent UI. “Standard” is acceptable after first introduction. |
| Friendly starting/scoring area | **Command Zone** | Avoid generic “base” when writing branded UI. |
| AI taking over a disconnected player | **Regent** or **AI Regent** | Explain once in tutorial text, then use “Regent.” |
| Disabled but recoverable unit | **Wreck** | The state remains recoverable; do not imply permanent destruction unless gameplay says so. |
| Tow/rescue activity | **Recovery** / **Tow-back Recovery** | “Recover ally” is preferred short UI copy. |
| Player-controlled unit group | **Command** or **Unit** | Use “unit” for individual object feedback, “command” for player agency. |
| An order sent by player | **Order** | E.g. “Order accepted,” “Order rejected.” |
| A player entering an active war | **Join the battle** | Prefer over “queue,” “lobby,” or “match found.” |

## 5. Voice & Tone Rules

### Use

- Short active sentences.
- Clear verbs.
- Battlefield language that is readable to a new player.
- Direct feedback about cause and effect.
- “Front” and “command” when appropriate.

Examples:

- “Join the battle.”
- “The front is contested.”
- “Standard secured.”
- “Recovery team assigned.”
- “Order accepted.”
- “Weapon reloading.”
- “Regent has taken command.”

### Avoid

- Overly realistic military jargon.
- Corporate/administrative terms such as “resource assignment” when “command assigned” is clearer.
- Copy that implies client-side authority.
- Generic lobby language.
- Direct references to other games, franchises, or their specific terminology.
- Needlessly grim or violent language.

Avoid examples:

- “Queue for matchmaking.”
- “Matchmaking complete.”
- “Respawn now.” (Use recovery framing if the unit is recoverable.)
- “Flag captured.” (Use “Command Standard secured” or “Standard captured.”)
- “You calculated a hit.” (The player issued an order; the authoritative simulation resolved it.)

## 6. Recommended UI Copy

### Entry / No-Lobby Flow

| Context | Recommended copy |
|---|---|
| Primary title screen action | **JOIN THE BATTLE** |
| Joining status | **Joining an active front…** |
| Successful join | **Command assigned. You are on the fireline.** |
| Empty/starting world | **The next battle is forming. Stand by.** |
| Post-war carryover | **The front resets soon. Hold your command.** |

### Command Standard Objective

| Event | Recommended copy |
|---|---|
| First tutorial reference | **The Command Standard decides the battle. Secure theirs. Protect ours.** |
| Enemy standard picked up | **Enemy Standard seized. Escort the carrier.** |
| Friendly standard picked up by enemy | **Our Standard is in enemy hands. Intercept the carrier.** |
| Standard dropped | **Standard down. Recover it.** |
| Friendly standard returned | **Our Standard returned.** |
| Enemy standard brought home | **Enemy Standard secured. Front turned.** |
| Cannot score while own standard is missing | **Your Standard must be secure before capture can be confirmed.** |

### Recovery and Wrecks

| Event | Recommended copy |
|---|---|
| Unit disabled | **Unit disabled. Recovery possible.** |
| Recovery order accepted | **Recovery order accepted.** |
| Tow in progress | **Towing wreck to Command Zone.** |
| Recovery complete | **Unit restored to the fireline.** |
| Cannot recover | **No recovery unit in range.** |

### Orders and Combat

| Event | Recommended copy |
|---|---|
| Move accepted | **Move order accepted.** |
| Attack accepted | **Fire order accepted.** |
| Fire cooldown | **Weapon reloading.** |
| Out of range | **Target out of range.** |
| Blocked move | **Route blocked.** |
| Fog-hidden target | **Target not confirmed.** |
| AI handoff | **Regent has taken command.** |

### End of Battle

| Outcome | Recommended copy |
|---|---|
| Victory | **FRONT TURNED** |
| Defeat | **FRONT LOST** |
| Victory detail | **The enemy Command Standard was secured.** |
| Defeat detail | **Our Command Standard was secured by the enemy.** |
| Next battle | **A new battle begins shortly. Stay on the fireline.** |

## 7. Visual Brand Application

The visual direction is **Painted Low-Poly Hybrid**:

- Low-poly geometry.
- Hand-painted, matte textures.
- Chunky readable silhouettes.
- Warm diorama/tabletop battlefield feel.
- Mobile-safe WebGL presentation with 2D sprite fallback.
- Future-friendly for Roblox adaptation.

The title treatment should feel robust, tactical, and painted rather than sleek sci-fi or photoreal military.

### Logo Guidance

For early prototypes, use a text-first title treatment:

```text
FIRELINE
COMMAND
Join the battle. Turn the front.
```

Suggested visual motifs:

- A horizontal fireline / terrain horizon.
- A stylized command chevron or directional marker.
- A Command Standard silhouette used sparingly.
- Painted edge highlights and matte block forms.

Avoid relying on flames, skulls, realistic weapons, or direct visual echoes of existing game brands.

## 8. Implementation Guidance for the Local Coding Ally

### Documentation and Metadata

When updating player-facing documentation or metadata, use:

```text
Title: Fireline Command
Tagline: Join the battle. Turn the front.
```

Good candidate locations, subject to existing file structure:

- `README.md` project title and description.
- Browser document title in the client HTML entry point.
- `package.json` display metadata/description, if appropriate.
- Loading screen and title-screen text.
- Tutorial title card.
- Retrospective and roadmap documents as an editorial update, not a technical rewrite.

### Preserve Technical Stability

Do not perform broad renames without an explicit approved migration plan.

In particular, do not automatically rename:

- package names;
- repository directory;
- engine exports;
- server routes;
- test file names;
- state schema keys;
- replay formats;
- persisted records;
- protocol messages.

Brand text is presentation data. Gameplay state and protocol naming must remain stable unless there is a tested reason to change them.

### Localization

Store player-facing brand copy in the localization layer once i18n is active. The canonical English source strings are:

```text
Fireline Command
Join the battle. Turn the front.
JOIN THE BATTLE
Joining an active front…
Command assigned. You are on the fireline.
FRONT TURNED
FRONT LOST
```

Do not force literal word-for-word translation of the catchphrase when it loses its meaning. Preserve its two-part intent: join an ongoing battle, then change the direction of the front.

## 9. Acceptance Checklist

A branding pass is complete when:

- [ ] Primary title text reads `Fireline Command`.
- [ ] Primary catchphrase reads `Join the battle. Turn the front.`
- [ ] New UI avoids lobby/queue-first wording.
- [ ] Command Standard terminology is used consistently.
- [ ] Recovery terminology is used instead of menu-respawn wording where appropriate.
- [ ] The brand copy is separated from authoritative gameplay logic.
- [ ] No existing technical identifiers are renamed accidentally.
- [ ] New player-facing strings are localization-ready.
- [ ] Documentation clearly frames the game as original IP.

## 10. Brand Summary

> **Fireline Command** is a living tactical battlefield where players join an active war, issue decisive orders, protect their Command Standard, recover their forces, and turn the front.

> **Join the battle. Turn the front.**
