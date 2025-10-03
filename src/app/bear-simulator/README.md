# Bear Simulator Component

This component provides a rally timing visualization for the in-game Bear Event.

## Calculation Logic

The rally timeline is calculated based on the following parameters:

- **Event Duration**: The total time for the event, fixed at **1800 seconds** (30 minutes).
- **Wait Time**: The time a rally must wait before marching, fixed at **300 seconds** (5 minutes).
- **Attack Time**: The duration of the attack on the Bear, fixed at **10 seconds**.

### Formula

The start and end times for each rally are determined by these key formulas:

1.  **Rally Hit Time**: This is when the rally arrives at the bear.
    `RallyHitTime = RallyStartTime + WaitTime + MarchTime`

2.  **Rally End Time**: The end of the attack window.
    `RallyEndTime = RallyHitTime + AttackTime`

3.  **Next Rally Start Time**: The start of the subsequent rally for the same player.
    `NextRallyStartTime = CurrentRallyStartTime + WaitTime + (2 * MarchTime)`

## How to Adjust Fixed Parameters

To modify the fixed `Wait Time` or `Attack Time`, change the corresponding readonly properties in the `bear-simulator.ts` file:

```typescript
export class BearSimulatorComponent {
  readonly WAIT_TIME = 300; // Change this value
  readonly ATTACK_TIME = 10;  // Change this value
  // ...
}
```
