# Playtest checklist — build 7b3f935 (2026-08-10)

Ordered so early items are quick sanity checks and later ones need
friends. Each item: what to do → what MUST happen. Anything that
fails: note the item number + what you saw (a screenshot helps).

## A. Five-minute solo smoke (desktop, right after deploy)

1. **Join screen + version**: open fireline.kjell.today, check
   `/healthz` shows the new version and rssMb. Join team A.
   → You get a hull with the green diamond; coach line appears.
2. **The four-map ballot names**: play (or spectate) to any war end.
   → The vote tiles show PROPER NAMES (Frontier Corridor / Blackwood /
   Riverline / Sawtooth) with thumbnails — no lowercase code ids.
3. **End screen (223)**: on that same end screen —
   → the verdict reason ("war interrupted" etc.) is CENTRED;
   → the countdown is BIG GOLD SECONDS below the vote panel;
   → 30 s is actually enough time to read tiles and vote (judgement
   call — say if it feels rushed).

## B. The downed arc (the ghost-seat + visible-body fixes)

4. **See your body (220)**: drive toward the front, get shot down (or
   park inside enemy gun range).
   → A REAL prone figure in your team colour lies on the ground,
   with a soft green pulsing ring under it and the YOU diamond above.
   You should spot yourself instantly when you press C.
5. **Crawl (220)**: while down, click the ground a few cells away.
   → The figure FACES where it crawls and wriggles as it moves.
6. **The exact prompt-219 sequence (ghost seat)**: while down, use the
   carrier respawn option (spawn aboard a friendly carrier), then get
   that carrier destroyed (drive it into the enemy or wait).
   → You come out ON FOOT beside the wreck with a body + ring, the
   status bar counts your redeploy, and R returns you to base. THE
   FAILURE THIS REPLACES: stuck forever, "press NEXT ASSET" doing
   nothing, no presence dot.
7. **Redeploy + reseat**: after R, click a free hull (or Next asset).
   → You get a hull normally. Repeat a couple of downs to make sure
   nothing ever strands you.

## C. Combat feel (muzzle, hover truth, wiggle)

8. **Muzzle flash (221)**: watch any firefight, yours and the enemy's.
   → Every visible shot blooms a short bright flash at the gun —
   both teams. Unseen attackers must NOT flash out of the fog.
9. **The honest fire tip (221)**: hover enemies in different states:
   in range (→ green IN RANGE), far away (→ OUT OF RANGE), and the
   important one — drive DEEP into enemy ground until out of supply,
   then hover an enemy in range.
   → The tip must say OUT OF SUPPLY — CANNOT FIRE (red), matching the
   engine actually refusing your click. Empty your ammo → NO AMMO.
10. **No wiggle (222)**: order a tank on a long diagonal-ish move and
    watch its facing; also drive in direct control (G), including a
    bike if you can.
    → No back-and-forth flicker between facings on straight travel.
    WATCH-ITEM: during long CONTINUOUS turns, does the nose glide or
    step? "Steppy turning" is a known possible residue — report it,
    the fix is pre-named.
11. **No more frozen gate piles (221)**: play a longer war (or
    spectate an AI one) and look at mid-map meetings and base gates.
    → Jams may FORM but must DISSOLVE — hulls that can't shoot
    (out of supply) retreat home to rearm instead of pushing forever.
    A pile that sits >2 minutes untouched is a failure.

## D. The intruder alarm (new feature, 221)

12. **Be the intruder**: drive a scout into the ENEMY compound.
    → THEIR searchlights are 3x longer (visual check from their base).
    You should get shot at quickly — the compound always sees you.
13. **Be the defender**: let an enemy (or a friend on team B) enter
    YOUR base area.
    → Klaxon + red flash, a ping marker on the intruder, and a red
    "INTRUDER IN THE BASE — drive them out" mission card that stays
    while they're in the wire, refreshing ~every 30 s.

## E. Mobile round (phone, 214-era fixes still to verify + new items)

14. **Connection stability**: play 10+ minutes on the phone, switch
    apps briefly, let the screen dim once.
    → No CONNECTION LOST from short radio naps (30 s heartbeat). If a
    drop happens: ⚙ → Connection check → note the verdict line.
15. **Key bar + downed on mobile**: get downed on the phone.
    → Key bar shows the down-context buttons (redeploy + rescue
    ping); the body + ring are visible at phone zoom.
16. **Hold-to-waypoint**: hold a spot ~1 s while driving.
    → Waypoint queued (notice appears); a quick tap still orders a
    plain move; off-map taps do nothing (no corner runaways).

## F. Group playtest (the point of this build — 2+ humans)

17. **Vote a RIVERLINE war**: everyone votes the Elvelinja tile.
    → War runs; check the FEEL items: do the three bridges create
    moments (artillery drops a span, trucks rebuild, Skimmer crosses
    water while tanks queue at fords)? Is stalemate attrition
    readable when both sides camp their lanes?
18. **Vote a SAWTOOTH war**: the canyon map.
    → Choke fights should feel intense but FAIR from inside — the
    stats say wars are seed-shaped here; the question is whether the
    losing side can tell WHY they lost (this is the promotion's real
    test). Note any "we never had a chance" reactions.
19. **Team balance with friends**: with 3+ humans joining the same
    team, confirm joins are refused at a 2-human imbalance (or turn
    TEAMBALANCE off deliberately and stack vs the Regency — both
    should behave as configured).
20. **Second seats under fire**: one drives a carrier/scout, another
    J-joins the gun seat mid-fight; driver parks, gunner shoots.
    → Station works, eject warning reads, station kills credit the
    gunner.
21. **A convoy or heist vote**: pick a mode tile once.
    → Mission cards + banner make the objective obvious to BOTH
    sides inside 60 seconds (the design tenet).

## G. Note-and-report (no action needed, just impressions)

22. Watch-items to mention in your report if noticed: steppy turning
    (item 10), vote timer too short (item 3), convoy attacker feeling
    strong when B attacks (att1 measured 44.3%, first read), and any
    map that produced a "stuck" or "unfair" feeling with WHERE it
    happened.
