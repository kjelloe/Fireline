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

### Prompt 5 — Consolidation: docs, test gaps, v1 plan

> Thanks. Does any docs, MD files or memories need updates with the latest discoveries? And please add unit, component and integration tests that are missing or needed. And can you write up a ./plan-version1.md on what is missing for a fully playable game? And then we should afterwards look at art asset building

**Decisions captured:**
1. Refresh docs/memories with the rebuild's discoveries (root README.md and project CLAUDE.md created; historical note prefixed to specs/PROJECT_RETROSPECTIVE.md).
2. Add missing unit/component/integration tests (test/unit_gaps, component_gaps, integration_gaps — 199/199).
3. `plan-version1.md` written: P0 = Command Standard flag mechanic, war rotation, wreck recovery, fire cooldown; P1 = legibility kit, order feedback, balance pass, session robustness.
4. Next major topic after this: art asset building.

### Prompt 6 — Designer ally's Phase 8 plan (Core Fantasy Retrofit)

> Thanks, before art, your questions on game design, from designer ally: [full designer response — archived verbatim in `specs/phase8_core_fantasy_retrofit.md`]

**Decisions captured (designer-confirmed):**
1. Phase 8 "Core Fantasy Retrofit" before any art/content: P0 slices 8A–8E, P1 slices 8F–8I, milestone test files per slice.
2. Command Standard is a PHYSICAL deterministic state object (position, carrier, dropped state, home zone), not a score variable.
3. Scoring rule: enemy standard into friendly command zone AND own standard AT_BASE → first successful capture wins the war (sudden-capture mode for v1).
4. War lifecycle: active → game_over → postgame → resetting → active; connected players persist across wars; no server restart.
5. Wreck recovery = tow-back rescue (no menu respawns): wreck → towed by friendly → repair at depot/base → returns to service.
6. Fire cooldowns enforced by the reducer (never the client), with visible reload feedback.
7. P1 legibility (minimap, free camera, click-select, order feedback, end screen, heartbeats, balance instrumentation) is gameplay, not polish.
8. Updated vision: "...players drop into active miniature wars and fight over physical Command Standards."

### Prompt 7 — Post-Phase-8 consolidation while user playtests

> Thanks. Does any docs, MD files or memories need updates with the latest discoveries? And any skills needing to be created? Any any more unit, component and integration tests needed while I test?

**Decisions captured:**
1. Doc/memory refresh after Phase 8 (RUNNING.md controls, CLAUDE.md layer map, memories).
2. Project skills created in `.claude/skills/`: fixture-repin, slice-workflow, playtest-report (+ `tools/repin_1a.mjs` as a real script).
3. Phase-8 gap tests added while the user runs browser/LAN acceptance.

### Prompt 8 — Art asset pipeline (designer spec)

> Thanks. While I playtest, can you look at the suggested specification for the art assets in @assets/asset-spec.md And see how we can set up at asset building pipeline for all the assets we need

**Decisions captured:**
1. Art direction confirmed: **Painted Low-Poly Hybrid** (designer spec in `assets/asset-spec.md`).
2. Art Slice A implemented: style tokens, asset manifest, anchor points, procedural stand-ins with budget tests, SVG icon/sprite generation from tokens (`tools/build_assets.mjs`), manifest-driven renderer (GLB → procedural → sprite resolution).
3. Deviation flagged: spec's infantry carrier / recovery vehicle are reserved manifest slots — engine roster is tank/scout/artillery and every chassis tows/carries.
4. Pipeline doc: `assets/PIPELINE.md`; painted GLBs drop in later without code changes.

### Prompt 9 — Playtest 2 verdict + roster question

> From playtest 2: does the objective strip's hint actually lead you somewhere useful YES and ×2 pace felt right. Mind you, please note that, we might have to have a direct tank control mode option as well, for some tanks, to pay homage to the original Firepower easy action, fire control, but that is for later. Currently it feels more like a low poly version of Syndicate with tanks, due to perspective
> (also asked: list the vehicles that are in the specs)

**Decisions captured:**
1. Playtest 2 PASSED on legibility and pacing (hint useful; ×2 pace right).
2. Backlog: optional direct tank control mode (Firepower homage) — later, client-input-mode design.
3. Identity note: perspective currently reads "low-poly Syndicate with tanks"; revisit camera in art pass.

### Prompt 10 — Roster middle path + plan refresh

> go c middle path. Then update plan-version1.md and make a .html as well please
> (mid-run: Ok do note, write scripts in /tmp or in ./debugging rather than inline python script)

**Decisions captured:**
1. Roster option (c): Logistics Truck fielded now (tow becomes its exclusive role); Command Carrier / Sentinel / Infiltrator deferred; standard carrying stays any-chassis until the Carrier exists.
2. `plan-version1.md` rewritten to current status; `plan-version1.html` styled twin created.
3. Process: helper scripts as files in /tmp or ./debugging, never inline heredocs (memory saved).

### Prompt 11 — plan-version2

> Thanks can you also in same format write up plan-version2.md and .html with the rest of the features that you know of and/or have read in the game design @specs/ or in the md files in @phases/

**Decisions captured:**
1. `plan-version2.md` + `plan-version2.html` written: five tracks (roster/roles, battlefield depth, coordination, presentation/platforms, meta/live-ops) compiled from specs 01-06, phase 5-7 plans, future roadmap, asset spec, and user requests.
2. Suggested V2.0 cut named "The Rescue Update" (Carrier, downed operators, cargo economy, mines, pings/tasks, art pass, spectator/replay viewer, profiles, direct-control mode).
3. Four designer tensions flagged (5E lobbies vs no-lobby, artillery's roster status, carrier-exclusive standard carrying, helicopter-pressure equivalent).
