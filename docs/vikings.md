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

### Core Concepts
- **Sources**: Players sending reinforcements.
- **Targets**: Players receiving reinforcements.
- **Marches**: Each player has 1-6 marches available to send (default 6).
- **Capacity**: Maximum number of reinforcements a target can receive (default derived from max capacity / 150k).
- **Farms**: Passive accounts linked to a Main account. They do not send reinforcements to general targets.

### Scoring

- `expected_reinforcement`: sum of confidence levels of all sources that reinforce the target.
- score for reinforcing `online` player: `1.5 / (expected_reinforcement)`
- score for reinforcing `offline_empty` player: `1 / (expected_reinforcement)`
- score for reinforcing `offline_not_empty` player: `1 / (2 + expected_reinforcement)`

To take confidence into account, the score is modified as follows:
- `online`: `score * confidence + (1-confidence) * offline_not_empty_score` 
- `offline_empty`: `score * confidence + (1 - confidence) * offline_not_empty_score`
- `offline_not_empty`: `score`

### Surivival

If player is `online` or `offline_empty`, they will require some amount of reinforcements to survive (this should be input parameter to the algoritm, controlled by the user).

### Goals

- **Farm Priorities**: Ensure farms are reinforced by their owners first.
- We want to make sure that as many `online` and `offline_empty` players are reinforced to survive.
- Maximize the score of `online` and `offline_empty` players (targetting ~1.5 more points for `online` player  vs `offline_empty` player)
- If possible, we want to `online` players to reinforce `online` and `offline_empty` players, and we want `offline_empty` players to reinforce `offline_empty` and `offline_not_empty` players. 
- We should take confidence into account. The player with lower confidence should get less points (it is also ok to reinforce it with players with lower confidence).
- Perform the assignments of `online` and `offline_empty` players first. The assignment of reinforcements for `offline_not_empty` emptys should be done last, just to have some assignment, but we do not expect them to actually be done.

### Algorithm

#### Phase 1 - offline_empty players

1. Take the `offline_empty` player that has the least amount of reinforcements assigned to it. In case of tie, take the one with highest confidence level.
2. Take all `offline_empty` players and `offline_not_empty` players - compute the score that we would get for reinforcing the selected player. Assign the reinforcement to the player with the highest score.

#### Phase 2 - online players

1. Take the `online` player that has the least amount of reinforcements assigned to it. In case of tie, take the one with highest confidence level.
2. Take all `online` players and `offline_empty` players - compute the score that we would get for reinforcing the selected player. Assign the reinforcement to the player with the highest score.
