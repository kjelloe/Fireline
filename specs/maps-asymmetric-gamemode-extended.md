# Fireline Command: Asymmetric Game Modes Bible

This guide defines the mechanics, design factors, and win/loss conditions for nine asymmetric game modes designed for 32–64 player combined-arms gameplay.

---

## 1. Convoy Escort (The "Lifeline")
One team protects a mobile asset; the other seeks to disable or destroy it.
*   **Description:** A high-value vehicle (AI or player-driven) travels a set path. It moves only when allies are nearby and stops when damaged or blocked.
*   **Key Factors:** Route branching (safe/slow vs. fast/exposed), repair mechanics, and roadblock placement.
*   **Win/Loss Triggers:**
    *   **Attackers Win:** Convoy reaches the extraction gate before the timer expires.
    *   **Defenders Win:** Convoy is destroyed OR the timer expires before it reaches the end.

## 2. Heist / Extraction (The "Grab & Go")
A high-stakes "Capture the Flag" variant where the "Flag" is deep inside enemy territory.
*   **Description:** Attackers must penetrate a base, secure an asset (Gold, Data, or VIP), and carry it back to their own extraction zone.
*   **Key Factors:** Asset visibility (radio pings), carrying penalties (slower movement), and "tug-of-war" moments if the asset is dropped.
*   **Win/Loss Triggers:**
    *   **Attackers Win:** Asset successfully delivered to the extraction point.
    *   **Defenders Win:** Timer expires while the asset is still in the base or un-extracted.

## 3. Breakthrough / Sequential Rush (The "Steamroller")
A linear push through a map divided into sectors.
*   **Description:** Attackers must capture/destroy two objectives in Sector A to unlock Sector B. Defenders have infinite tickets; Attackers have a limited pool.
*   **Key Factors:** Map flow, defender fallback timing, and forward-spawn locks.
*   **Win/Loss Triggers:**
    *   **Attackers Win:** All sectors cleared (final objective destroyed).
    *   **Defenders Win:** Attacker ticket pool hits zero.

## 4. Sabotage & Reconstruction (The "Engineering" Mode)
A mode focused on changing the map geometry to progress.
*   **Description:** Attackers must build a bridge or repair a generator to progress to the next area. Defenders must actively sabotage these repairs.
*   **Key Factors:** Class-based importance (Engineers/Support), interactable map objects, and defensive "choke-points" that can be bypassed if a secondary objective is met.
*   **Win/Loss Triggers:**
    *   **Attackers Win:** Final objective destroyed/completed.
    *   **Defenders Win:** Timer expires before the final reconstruction/destruction is complete.

## 5. VIP / HVT Protection (The "Bodyguard")
Protection of a single, fragile, player-controlled unit.
*   **Description:** One player is designated the VIP with unique support abilities but limited health. They must reach a distant evac point.
*   **Key Factors:** VIP "Nearness" bonuses to teammates, dedicated escort vehicles, and high-stakes "Last Stand" extraction.
*   **Win/Loss Triggers:**
    *   **Attackers Win:** VIP reaches the extraction zone alive.
    *   **Defenders Win:** VIP is killed (or captured for 30s).

## 6. Siege / Fortress (The "Grand Assault")
A non-linear assault on a central hub from multiple directions.
*   **Description:** A massive central base is surrounded by several outer "gate" objectives. Capturing any two gates allows entry into the inner sanctum.
*   **Key Factors:** Macro-strategy (which gate to hit), vehicle-to-infantry density, and flanking routes.
*   **Win/Loss Triggers:**
    *   **Attackers Win:** Central core standard is captured or core is destroyed.
    *   **Defenders Win:** Attacker tickets reach zero OR 20-30m timer expires.

## 7. Last Stand / Survival (The "Alamo")
A match focusing on attrition and time-delay.
*   **Description:** Defenders have zero respawns (or a very small pool) but heavy fortifications. Attackers have infinite respawns but a very short timer.
*   **Key Factors:** Defensive fortification building, medic importance, and "wave-based" attacker timing.
*   **Win/Loss Triggers:**
    *   **Attackers Win:** All defenders eliminated OR the command post captured.
    *   **Defenders Win:** Timer expires with at least one defender alive.

## 8. Uplink / Encryption (The "Signal Hold")
A progress-bar-based tug-of-war.
*   **Description:** A central relay must be "hacked." Progress only moves while the attackers hold the point. Defenders can "re-encrypt" (reverse the bar) if they retake it.
*   **Key Factors:** Area control, smoke/suppression utility, and escalating intensity as progress reaches 90%.
*   **Win/Loss Triggers:**
    *   **Attackers Win:** Uplink reaches 100%.
    *   **Defenders Win:** Timer expires before 100% completion.

## 9. Scavenge / Pile (The "Resource War")
A multi-objective, high-mobility chaos mode.
*   **Description:** 10-15 "Resource Crates" are dropped in the center. Both teams must find them and return them to their respective bases.
*   **Key Factors:** Small-unit skirmishes, vehicle transport (Skimmer utility), and intercepting enemy carriers.
*   **Win/Loss Triggers:**
    *   **Attackers Win:** Majority of crates (e.g., 8 out of 15) successfully stockpiled.
    *   **Defenders Win:** Majority of crates stockpiled at the opposing base when the timer hits zero.

---
*Created for the More Firepower project — Retro game re-imagining.*
