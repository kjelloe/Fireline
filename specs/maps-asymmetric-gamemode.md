# Fireline Command: Asymmetric Map & Mode Design Guide

This document outlines the criteria, mechanics, and design philosophies for implementing asymmetric attack/defense and convoy modes in a 32–64 player combined-arms environment.

---

## 1. The Golden Rule of Asymmetry
> **Attackers should have the Initiative. Defenders should have the Position.**

If one side holds both, the game becomes unbalanced. If both sides have the same strengths, the asymmetry is purely cosmetic. Use the following trade-offs as a baseline:

| Side | Typical Strength | Typical Weakness |
| :--- | :--- | :--- |
| **Attackers** | Mobility, choice of timing, surprise, reinforcement volume | Exposed, must take territory, high-risk movement |
| **Defenders** | Cover, fortified positions, shorter fallback routes | Reactive, susceptible to flanking, permanent loss of ground |

---

## 2. Core Design Criteria for Asymmetric Maps

### A. Progression via Phase-Based Storytelling
Asymmetric maps work best when they move through distinct chapters. For a 20–30 minute session, aim for **3 major phases** or **2 phases plus a climax**.

*   **Example (Beach Assault):**
    1.  **Landing:** Secure the beachhead (unlocks forward spawn).
    2.  **Breach:** Sabotage radar/artillery (disrupts defender vision/fire).
    3.  **Inland Push:** Capture the central depot.
    4.  **Extraction/Finale:** Steal the Command Standard and reach the evac vehicle.

### B. Defender Agency: Layered Defense vs. One Fortress
Avoid "The Unbreakable Bunker." If defenders have one perfect spot, the game either results in a stalemate or a total collapse once lost. Use **Layered Defense**:
*   Defenders should expect to lose outer lines.
*   Their fun comes from "making the enemy pay dearly for every meter."
*   **Counterattack Windows:** Defenders must be able to retake forward relays, repair sabotaged gates, or recover stolen assets.

### C. Attacker Logistics: Forward Spawn Progression
The "walking simulator" effect kills attacker momentum.
*   Each phase completion must unlock a **Forward Spawn**.
*   In *Fireline Command*, use deployable spawn trucks or captured relays to move the frontline.
*   Balance this by making these forward spawns vulnerable to defender raids.

---

## 3. Mode Specifics: Convoy, Extraction, and Sabotage

### Convoy Escort (The "Tow & Recovery" Special)
Since *Fireline Command* emphasizes vehicle rescue, Convoys are a natural fit.
*   **Escort Gameplay:** Escort team makes route decisions (e.g., Fast/Exposed road vs. Slow/Covered trail).
*   **Ambush Gameplay:** Defenders set roadblocks, mine trails, and disable the lead vehicle to stall the timer.
*   **Recovery Loop:** The convoy vehicle should be repairable and towable. The match doesn't end if it stops; it ends if it cannot be restarted before the timer expires.

### Standard Heist / Extraction
A focused version of the Command Standard objective.
*   Attackers must reach a secure vault, take the "Asset" (Standard/VIP/Data), and return to an extraction point.
*   **The Asset:** Should be visible on the map sporadically (radio pings) to create a "hide and seek" dynamic during extraction.

### Sabotage / Raid
Attackers must destroy 2 out of 3 key targets (e.g., Fuel Dumps, Relay Towers).
*   Allows the attacking team to split their forces.
*   Encourages small-scale squad tactics over massive "meat-grinder" chokepoints.

---

## 4. Balancing Asymmetric Mechanics

### Weaponizing the Timer
Avoid pure "wait to win" timers. 
*   **Time Extensions:** Attackers earn +5 minutes for every phase completed.
*   **Overtime:** If the final objective is being actively contested, the match continues until a clear break in combat occurs.

### Faction Roles in Asymmetry
*   **The Sentinel (Directorate):** The ultimate defensive anchor. Use it to block narrow gaps or protect final objectives.
*   **The Skimmer (Outliers):** The ultimate raider. Use it to bypass frontlines via water or trails to sabotage rear relays.
*   *Warning:* Ensure maps have enough "Skimmer-proof" sectors to prevent skipping phases, and enough "Sentinel-blind" spots to prevent total map lock.

---

## 5. Success Metrics (Beyond Win Rates)
A "fair" asymmetric map can still be "unfun." Track these metrics in your AI simulations:
*   **Phase Depth:** Do attackers reach at least Phase 2 in 80% of matches? (If they fail at the beach every time, the map is broken).
*   **Context for Defeat:** Did the defenders lose because they were steamrolled, or because they were outmaneuvered at the final gate?
*   **Recovery Events:** Are vehicles being towed and repaired? If not, the map is likely too dense or too open.

---

## 6. Implementation Summary
For *Fireline Command*, prototype these in order:
1.  **Convoy Raid:** Leverages your existing towing/repair mechanics.
2.  **Standard Heist:** Makes the "headline" objective the center of a directed map.
3.  **Breakthrough:** A sequence of 3-4 relays in a one-way corridor to test pure pacing.

---
*Created for the More Firepower project — Retro game re-imagining.*

