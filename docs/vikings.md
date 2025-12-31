# Vikings Event Documentation

## Overview
The Vikings Event management system helps alliances optimize their reinforcement strategies. It automates the assignment of players to reinforce each other based on their activity status, power, and reliability.

## Confidence Level
The **Confidence Level** is a metric used to gauge how reliable a player is in fulfilling their reinforcement duties. It helps the algorithm prioritize reliable players for critical reinforcements.

### Calculation Rules
The confidence calculation uses **Weighted History** (Time Decay) and **Bayesian Smoothing**.

1.  **Time Decay**: Recent events are weighted more heavily than older events.
    - Decay Factor $\lambda = 0.9$
    - Weights for last 5 events (newest to oldest): `1.0, 0.9, 0.81, 0.73, 0.66`

2.  **Bayesian Smoothing**: To prevent extreme scores from sparse data (e.g., a new player with 1 event getting 100%), we use a **Uniform Prior** ($\alpha=1, \beta=1$).
    - This effectively adds 1 "Virtual Success" and 1 "Virtual Failure" to the weighted average.
    - Formula:
      $$ P = \frac{\text{WeightedScore} + 1}{\text{TotalWeight} + 2} $$
    - **Result**: A new player with 1 perfect event gets a score of $\approx 0.66$ (Neutral), requiring consistent performance to reach High Confidence.

### Scoring Logic
For each event, we calculate a raw score (1.0 for Match, 0.0 for Mismatch). This raw score is then weighted and smoothed.

- **Match (1.0)**: Actual Status matches Declared Status (or Implicit Match).
- **Mismatch (0.0)**: Actual Status differs from Declared Status.

**Note**: Events where the player declared themselves as `offline_not_empty` (Busy) or `unknown` (did not register) are **ignored**.

### Thresholds
- **High Confidence**: Score **>= 0.7** (70%)
- **Low Confidence**: Score **< 0.5** (50%)
- **Neutral**: Between 0.5 and 0.7.

---

## Assignment Algorithm
The assignment logic runs in **4 Phases** to ensure optimal distribution of reinforcements.

### Core Concepts
- **Sources**: Players sending reinforcements.
- **Targets**: Players receiving reinforcements.
- **Marches**: Each player has 1-6 marches available to send (default 6).
- **Capacity**: Maximum number of reinforcements a target can receive (default derived from max capacity / 150k).
- **Farms**: Passive accounts linked to a Main account. They do not send reinforcements to general targets.

### Phase 1: Farm Priorities
*   **Goal**: Ensure farms reinforce their owners first.
*   **Action**: If a player has linked farms, those farms use their marches to reinforce the main account immediately.

### Phase 2: Offline Sources
*   **Goal**: Utilize marches from Offline (Empty) players who cannot react dynamically.
*   **Sources**: Offline Empty players.
*   **Targets**: Offline Empty & Offline Not Empty players.
*   **Logic**:
    - Prioritizes filling targets with the lowest current reinforcement count.
    - **Restriction**: Offline Not Empty sources cannot reinforce Offline Empty targets.

### Phase 3: Online Sources
*   **Goal**: Assign active players to critical targets.
*   **Sources**: Online players.
*   **Targets**: Online & Offline Empty players.
*   **Logic**:
    - **Confidence Matching**: High Confidence sources (>= 0.7) are prioritized to reinforce High Confidence targets.
    - **Priority**: Online targets are preferred over Offline Empty targets in tie-breaks.

### Phase 4: Offline Not Empty Cleanup
*   **Goal**: Use any remaining marches to top off busy players.
*   **Sources**: Offline Empty & Offline Not Empty (Online players are excluded from reinforcing 'Offline Not Empty' targets).
*   **Targets**: Offline Not Empty players.
*   **Logic**: fills targets with the lowest counts first.
