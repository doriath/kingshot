# Vikings Event Documentation

## Overview
The Vikings Event management system helps alliances optimize their reinforcement strategies. It automates the assignment of players to reinforce each other based on their activity status, power, and reliability.

## Confidence Level
The **Confidence Level** is a metric used to gauge how reliable a player is in fulfilling their reinforcement duties. It helps the algorithm prioritize reliable players for critical reinforcements.

### Calculation Rules
- **Range**: `0.0` (0%) to `1.0` (100%).
- **Default**: New players start with a probability of `0.5` (50%).
- **Scope**: Only events with the status **'FINISHED'** are considered. 'VOTING' or 'FINALIZED' events do not affect the score.
- **History**: The calculation considers the last **5** finished events.

### Scoring Logic
For each finished event, a player receives a score based on the accuracy of their declared status versus their actual contribution:

1.  **Implicit Match (High Score)**:
    - If the admin has **not** set an "Actual Status" for the player, it is assumed the player performed as expected.
    - Score: **1.0** (100%)

2.  **Explicit Match (High Score)**:
    - If "Actual Status" IS set and **matches** the declared status.
    - Score: **1.0** (100%)

3.  **Mismatch (Low Score)**:
    - If "Actual Status" IS set and **does not match** the declared status.
    - Score: **0.0** (0%)

**Note**: Events where the player declared themselves as `offline_not_empty` (Busy) or `unknown` (did not register) are **ignored** and do not affect the average score, as these statuses do not promise active participation.

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
    - **Confidence Matching**: High Confidence sources (>= 0.8) are prioritized to reinforce High Confidence targets.
    - **Priority**: Online targets are preferred over Offline Empty targets in tie-breaks.

### Phase 4: Offline Not Empty Cleanup
*   **Goal**: Use any remaining marches to top off busy players.
*   **Sources**: Offline Empty & Offline Not Empty (Online players are excluded from reinforcing 'Offline Not Empty' targets).
*   **Targets**: Offline Not Empty players.
*   **Logic**: fills targets with the lowest counts first.
