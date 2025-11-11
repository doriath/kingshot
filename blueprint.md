### Project Blueprint: Hero Gear Optimizer

#### Overview
This application helps gamers optimize their hero's gear. Users input their current gear levels, available resources (like experience points), and how much they value different stats. The tool then calculates the most effective way to upgrade their gear to maximize their hero's power.

#### Implemented Features
*   **Hero Configuration:** Users can define multiple heroes (e.g., Infantry, Cavalry, Archers).
*   **Gear State:** For each hero, users can input the current `enhancement` and `mastery` level for four pieces of gear: helmet, gloves, breastplate, and boots.
*   **Stat Weights:** Users can specify custom weights for `lethality` and `health` for each hero, defining what stats are most important to them.
*   **Resource Input:** Users can enter the amount of `experience` and `hammers` they have available for upgrades.
*   **Data Persistence:** All hero configurations and resource amounts are saved to the browser's local storage, so the data is not lost on refresh.
*   **Optimization Calculation:** A button triggers an algorithm to find the best way to spend experience points on gear enhancements.
*   **Results Display:** The application shows a detailed comparison of the gear "before" and "after" the optimization, including the change in stats and the overall weighted score.

---

### Current Task: Upgrade to Dynamic Programming Algorithm

**Goal:** Replace the existing greedy optimization algorithm with a more sophisticated dynamic programming (DP) approach. The greedy method is fast but can lead to suboptimal results; the DP method will guarantee the mathematically best gear configuration.

**Execution Plan:**

1.  **Restructure the `optimize` Method:** The core logic within the `optimize()` function in `hero-gear.ts` will be entirely replaced to accommodate the new algorithm.

2.  **Implement the DP Solver:**
    *   A new recursive solver function, `findOptimalGear(itemIndex, remainingExp)`, will be the heart of the new algorithm.
    *   This function will intelligently explore every possible enhancement level for each piece of gear.
    *   To ensure performance, it will use **memoization**, storing the results of already-solved subproblems in a `Map`. This avoids re-calculating the same thing over and over.

3.  **Define the DP State:** The "state" for each subproblem will be a combination of the gear item being considered and the amount of experience left (`(itemIndex, remainingExp)`). The solver will find the best score possible from that state onwards.

4.  **Reconstruct the Solution:** After the DP solver finds the maximum possible score, it will trace back through its decisions to build the exact list of recommended enhancement levels for each piece of gear.

5.  **Update the UI:** The main "Optimize" button will now trigger the new DP calculation. The results will be formatted and displayed to the user in the same "before and after" comparison table.
