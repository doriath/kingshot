# Project Overview

This project is an Angular application designed to help players of a strategy game optimize their hero gear. The main feature is to calculate the most effective distribution of enhancement levels across different pieces of gear for multiple heroes, based on their stats and user-provided resources.

# Implemented Features

*   **Hero and Gear Management:** Users can define multiple heroes, each with four pieces of gear (helmet, gloves, breastplate, boots). For each gear, they can set mastery and current enhancement levels.
*   **Stat Weights:** Users can specify weights for `lethality` and `health` for each hero, indicating which stat is more important for them.
*   **Resource Input:** Users can input the amount of extra experience (`exp`) they have available for upgrades.

# Current Plan: Implement a Greedy Algorithm for Gear Optimization

## Phase 1: Refactor the `optimize` method in `hero-gear.ts`

1.  **Extract Cost Data:** Move the enhancement experience cost array from the `expCost` method to a private readonly class member for better access and to determine the maximum enhancement level.
2.  **Calculate Total Experience:** Implement logic to calculate the total experience pool. This includes the experience from deconstructing all current gear (based on their enhancement levels) plus any extra experience provided by the user.
3.  **Implement Greedy Algorithm:**
    *   Initialize all hero gear to enhancement level 0.
    *   Iteratively find the single most "score-efficient" enhancement upgrade across all gear pieces for all heroes. Efficiency is measured as `(score increase) / (experience cost)`.
    *   Apply the best upgrade found.
    *   Subtract the cost from the total experience pool.
    *   Repeat this process until no more upgrades can be afforded.
4.  **Update Results:** Once the algorithm is complete, update the `optimizationResult` signal with the `before` and `after` stats, and the recommended enhancement levels for each piece of gear.
