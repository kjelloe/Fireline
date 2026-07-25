# Dev Prompts Log

User prompts driving development, recorded verbatim in order. New prompts are appended per session.

## Session 1 — 2026-07-25

### Prompt 1 — Project kickoff

> Good evening! We'll be making a remake of classic 1987 Firepower game, from wiki "Fire Power (also Firepower) is a military-themed multidirectional shooter developed by Silent Software for the Amiga. It was published in 1987 by MicroIllusions. An MS-DOS port was released in 1988, followed by versions for the Apple IIGS and Commodore 64 in 1989. The player drives a tank through a large, scrolling landscape containing enemy bases. The goal is to capture the flag from inside each while rescuing prisoners of war and destroying the enemy's structures.
>
> Two sequels were released: Return Fire and Return Fire 2.
> Gameplay
>
> Fire Power can be played alone, against a human opponent on a split screen, or over a modem, which lets players to chat with each other while playing. A map editor allows creation of custom multiplayer experiences.
>
> The player controls a tank through an expansive, outdoor landscape. Each map has at least two bases: one for the green team, and one for the yellow (red in the PC version) team. Initially, the base locations are hidden from the players, so an extensive search of the landscape had to be conducted first. Obstacles include enemy turrets, various fortifications, and destructible buildings. If the player stands still for too long (to set up an ambush, for instance), a series of enemy helicopters appear from off screen and attack. The helicopters can be shot down with the tank's main weapon.
> Bases and tanks
>
> Each base has several different types of buildings, such as armories, barracks, and bio-domes. The objective is to capture the flag from inside the enemy base by blasting through walls and destroying any defenses. The player can also rescue prisoners of war by destroying POW camps and allowing the captives to ride in the tank back to base. An extra tank life is rewarded for each fifteen POWs rescued.[1]
>
> Three different tanks are available: one is fast and fragile, one is slow but strong, and the third is rated in between the two. Each tank can carry a different amount of POWs. Capturing the enemy flag requires maneuvering the tank into the flag building and driving over the enemy flag to pick it up. Weapons cannot destroy garages.
>
> The player's tank can run over enemy soldiers, crushing them with an accompanying "squish" sound effect and a bloody "splat" that remains on the battlefield for several minutes.
> " , a designer ally has made a prototype which is in ./ please read initial prompt to understand the project, in @initial-prompt.md Then we can discuss how to implement and you can ask me questions for clarification. Sound ok?

### Prompt 2 — Clarification on repo state

> Too be clear the code in ./ is incomplete, the prototype is documented in phases/slices in @phases/ part 1 through 7 and then the final should be documented @phases/final/ Use these to understand the code and tests before running any incomplete code in ./

### Prompt 3 — Direction decisions

> 1. Rebuild into a working ./ slice by slice, you review and add unit, component and integration self tests. 2. Rewrite old tests to match source. 3 The game is not literal remake,inspired. 4. First delivery should be what is at be a playable full game with up to 32 players, humans and AI controlled, what seems to be end of slice 5A really, before 5B,6 and 7 expand the game concepts. Any other clarifications. Also please save all prompts in dev-prompts.md

**Decisions captured:**
1. Rebuild `./` slice by slice from `phases/`; Claude reviews each slice and adds unit, component, and integration self-tests.
2. Where old tests and source disagree, rewrite the tests to match the source.
3. The game is inspired by 1987 Firepower, not a literal remake (new IP per specs).
4. First delivery target: a playable full game, up to 32 participants (humans + AI), corresponding to end of slice 5A — before 5B/6/7 expand the game concepts.
5. All user prompts are saved to `dev-prompts.md` (this file).

### Prompt 4 — Workflow and scope

> 1. Run as far as you can until you need clarification from me, and log changes on your way 2. only removezones.sh is used by me 3. Also second-human check over LAN. Please also check phases 5,6 and 7 for any features you think are important to include in version 1. Anything else before you start? Please commit locally in git and use marker-NNNN for your commits, so you can connect them to your reports.

**Decisions captured:**
1. Run autonomously until clarification is genuinely needed; log changes along the way (see `dev-log.md`).
2. Of the root helper scripts, only `removezones.sh` is used by the user; the rest are designer leftovers.
3. Acceptance for the 5A delivery includes a second-human check over LAN, in addition to headless soak + browser play vs AI.
4. Claude reviews phase 5/6/7 plans and proposes any features worth pulling into v1.
5. Claude commits locally in git (local only, no push — explicit override of the global no-commit rule for this project), using `marker-NNNN` in commit messages to link commits to reports.
