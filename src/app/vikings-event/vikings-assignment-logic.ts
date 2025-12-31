import { CharacterAssignment, VikingsStatus } from './vikings.types';
import { getCharacterStatus } from './vikings.helpers';

export function calculateAssignments(allCharacters: CharacterAssignment[]): CharacterAssignment[] {
    return new VikingsAssignmentSolver(allCharacters).solve();
}

class VikingsAssignmentSolver {
    private workingCharacters: CharacterAssignment[];

    // State
    private assignmentsMap = new Map<string, { characterId: string; marchType?: string }[]>(); // Source -> Targets
    private marchesRemainingMap = new Map<string, number>(); // Source -> Remaining Marches
    private incomingReinforcementMap = new Map<string, number>(); // Target -> Sum of Confidence of incoming sources
    private incomingCountMap = new Map<string, number>(); // Target -> Count of incoming sources
    private farmsMap = new Map<string, CharacterAssignment[]>(); // OwnerId -> List of Farms

    // Pools
    private onlinePlayers: CharacterAssignment[] = [];
    private offlineEmptyPlayers: CharacterAssignment[] = [];
    private offlineNotEmptyPlayers: CharacterAssignment[] = [];

    // Configuration
    private readonly SURVIVAL_THRESHOLD = 2.0; // Configurable? Default to 2.0 (approx 3-4 avg players)

    constructor(inputCharacters: CharacterAssignment[]) {
        this.workingCharacters = inputCharacters.map(c => ({ ...c }));
    }

    public solve(): CharacterAssignment[] {
        this.initialize();
        this.phase1_Farms();
        this.phase2_Survival();
        this.phase3_MaximizeUtility();
        this.phase4_OfflineNotEmptyCleanup();
        return this.finalize();
    }

    private initialize() {
        this.workingCharacters.forEach(c => {
            this.assignmentsMap.set(c.characterId, []);
            this.incomingReinforcementMap.set(c.characterId, 0);
            this.incomingCountMap.set(c.characterId, 0);

            // Normalize Status
            c.status = getCharacterStatus(c);

            // Marches
            let count = c.marchesCount;
            if (count === 0) count = 6;
            count = Math.max(1, Math.min(6, count));

            // Farms have 0 marches available for GENERAL assignment (handled specifically in Phase 1)
            // Actually, Phase 1 consumes them. So we give them their marches here, but logic restricts usage.
            // Wait, farms ONLY assign to owner. So effectively 0 for general pool.
            // Let's keep them as having marches, but filters will exclude them.

            this.marchesRemainingMap.set(c.characterId, count);

            // Identify Farms
            if (c.mainCharacterId) {
                const ownerId = c.mainCharacterId;
                const farms = this.farmsMap.get(ownerId) || [];
                farms.push(c);
                this.farmsMap.set(ownerId, farms);
            }

            // Pools
            if (c.status === 'online') this.onlinePlayers.push(c);
            else if (c.status === 'offline_empty') this.offlineEmptyPlayers.push(c);
            else this.offlineNotEmptyPlayers.push(c);
        });
    }

    // --- Helpers ---

    private isFarm(c: CharacterAssignment): boolean {
        return !!c.mainCharacterId;
    }

    private getConfidence(c: CharacterAssignment): number {
        return c.confidenceLevel ?? 0.5;
    }

    private getRemainingMarches(id: string): number {
        return this.marchesRemainingMap.get(id) || 0;
    }

    private assign(sourceId: string, targetId: string): boolean {
        if (sourceId === targetId) return false;

        // Check already assigned
        const current = this.assignmentsMap.get(sourceId) || [];
        if (current.find(a => a.characterId === targetId)) return false;

        // Check source marches
        const rem = this.getRemainingMarches(sourceId);
        if (rem <= 0) return false;

        // Check target capacity
        const target = this.workingCharacters.find(c => c.characterId === targetId);
        if (target && target.reinforcementCapacity !== undefined) {
            const maxCapacity = Math.floor(target.reinforcementCapacity / 150000); // 150k per march approx
            const currentCount = this.incomingCountMap.get(targetId) || 0;
            if (currentCount >= maxCapacity) return false;
        }

        // Additional Farm Constraint (Target side)
        // If target is a farm, it might have limits on how many non-owners can reinforce?
        // Original logic: "othersCount >= target.extraMarches".
        if (target && target.mainCharacterId && target.extraMarches !== undefined && target.extraMarches >= 0) {
            const isOwner = target.mainCharacterId === sourceId;
            const currentTotal = this.incomingCountMap.get(targetId) || 0;
            // We need to know if owner IS assigned.
            // This is complex to check efficiently every time without state.
            // Let's reconstruct on fly or track "ownerAssigned" state? 
            // Easier: Check if owner is already in the incoming list? We don't track incoming source IDs on the map directly.
            // Let's check the Owner's assignment list.
            const ownerAssignments = this.assignmentsMap.get(target.mainCharacterId) || [];
            const ownerIsAssigned = ownerAssignments.some(a => a.characterId === targetId);

            // If the current candidate IS the owner, we are adding them now.
            // If candidate is NOT owner.
            const ownerContribution = (ownerIsAssigned || isOwner) ? 1 : 0;
            const othersCount = currentTotal - (ownerIsAssigned ? 1 : 0); // Approx

            if (!isOwner && othersCount >= target.extraMarches) return false;
        }


        // Execute
        current.push({ characterId: targetId });
        this.assignmentsMap.set(sourceId, current);
        this.marchesRemainingMap.set(sourceId, rem - 1);

        const source = this.workingCharacters.find(c => c.characterId === sourceId);
        const addedConfidence = source ? this.getConfidence(source) : 0;

        this.incomingReinforcementMap.set(targetId, (this.incomingReinforcementMap.get(targetId) || 0) + addedConfidence);
        this.incomingCountMap.set(targetId, (this.incomingCountMap.get(targetId) || 0) + 1);

        return true;
    }

    // --- Phases ---

    private phase1_Farms() {
        // Goal: Farms reinforce their Owners.
        // Also Owners reinforce their Farms (if needed/configured? Previous logic had Owners -> Farms).
        // Requirement: "Farm Priorities: Ensure farms are reinforced by their owners first."
        // So: Owner -> Farm.

        // Iterate all owners who have farms
        for (const [ownerId, farms] of this.farmsMap.entries()) {
            if (this.getRemainingMarches(ownerId) <= 0) continue;

            for (const farm of farms) {
                // Try assign Owner -> Farm
                // Owner might have multiple farms.
                this.assign(ownerId, farm.characterId);
                if (this.getRemainingMarches(ownerId) <= 0) break;
            }
        }
    }

    private phase2_Survival() {
        // Target Pool: Online & OfflineEmpty
        // Goal: Bring everyone to SURVIVAL_THRESHOLD.
        // Strategy: Iterate targets sorted by "Distance to Threshold".
        // For each target, find best sources to fill the gap.

        const possibleTargets = [...this.onlinePlayers, ...this.offlineEmptyPlayers];

        // Loop until no improvements or everyone satisfied
        let improvement = true;
        while (improvement) {
            improvement = false;

            // Filter targets that need survival
            const needyTargets = possibleTargets.filter(t => {
                const current = this.incomingReinforcementMap.get(t.characterId) || 0;
                return current < this.SURVIVAL_THRESHOLD;
            });

            if (needyTargets.length === 0) break;

            // Sort by current health (lowest first) => Highest Urgency
            needyTargets.sort((a, b) => {
                const scoreA = this.incomingReinforcementMap.get(a.characterId) || 0;
                const scoreB = this.incomingReinforcementMap.get(b.characterId) || 0;
                return scoreA - scoreB;
            });

            for (const target of needyTargets) {
                // Find a source
                // Available sources: Online & OfflineEmpty (NOT Farms)
                const potentialSources = [...this.onlinePlayers, ...this.offlineEmptyPlayers]
                    .filter(s => !this.isFarm(s) && this.getRemainingMarches(s.characterId) > 0);

                if (potentialSources.length === 0) break; // Exhausted all sources

                // Sort sources:
                // 1. Preference: Online->Online, Offline->Others. (To save Online for Online)
                // 2. Confidence: High -> Low
                potentialSources.sort((a, b) => {
                    const targetIsOnline = target.status === 'online';
                    const aIsOnline = a.status === 'online';
                    const bIsOnline = b.status === 'online';

                    // Prefer if Source Status "Matches" Target Status (loosely)
                    // Online Target -> Prefer Online Source
                    // Offline Target -> Prefer Offline Source (to save Online sources)

                    const aMatches = (aIsOnline === targetIsOnline);
                    const bMatches = (bIsOnline === targetIsOnline);

                    if (aMatches && !bMatches) return -1;
                    if (!aMatches && bMatches) return 1;

                    return this.getConfidence(b) - this.getConfidence(a);
                });

                // Try assigning ONE source
                for (const source of potentialSources) {
                    if (this.assign(source.characterId, target.characterId)) {
                        improvement = true;
                        break; // Move to next needy target to spread love? Or fill this one?
                        // Spreading helps uniform survival.
                    }
                }
                // If we assigned, break inner loop to re-evaluate needy list?
                // Or continue to next target? Continue is fine (Round Robin).
            }
        }
    }

    private phase3_MaximizeUtility() {
        // Source-Centric Utility Maximization
        // We pick the best source, then find the best target for THAT source based on specific preferences.

        const sources = this.workingCharacters.filter(s =>
            !this.isFarm(s) &&
            s.status !== 'offline_not_empty' && // BANNED AS SOURCE
            this.getRemainingMarches(s.characterId) > 0
        );

        if (sources.length === 0) return;

        let activeSources = sources;

        while (activeSources.length > 0) {
            // Recalculate Active Sources
            activeSources = activeSources.filter(s => this.getRemainingMarches(s.characterId) > 0);
            if (activeSources.length === 0) break;

            // Sort Sources: Confidence Descending (Best sources move first)
            // Tie-break: Random? Or stable?
            activeSources.sort((a, b) => {
                const diff = this.getConfidence(b) - this.getConfidence(a);
                if (diff !== 0) return diff;
                return 0.5 - Math.random(); // Random tie-break
            });

            // Pick Top Source
            const source = activeSources[0];
            const sourceStatus = source.status;

            // Find Best Target for this Source
            const potentialTargets = [...this.onlinePlayers, ...this.offlineEmptyPlayers, ...this.offlineNotEmptyPlayers];

            let bestTarget: CharacterAssignment | null = null;
            let maxVal = -1;

            potentialTargets.forEach(t => {
                // Check basic constraints first to avoid calc
                if (source.characterId === t.characterId) return;
                // Already assigned? CHECKed in assign(), but better check here to skip utility calc?
                // The assign() method checks 'current' array.
                const currentAssignments = this.assignmentsMap.get(source.characterId) || [];
                if (currentAssignments.some(a => a.characterId === t.characterId)) return;

                // Calculate Utility
                const current = this.incomingReinforcementMap.get(t.characterId) || 0;
                const denom = Math.max(0.1, current);

                let weight = 1.0;
                let effectiveDenom = denom;

                // Source-Specific Preferences
                if (sourceStatus === 'online') {
                    // Online Source Preference
                    if (t.status === 'online') {
                        weight = 1.5; // Standard High Priority
                    } else if (t.status === 'offline_empty') {
                        weight = 1.2; // User: "reinforce some more offline_empty" -> Boost from 1.0 to 1.2
                    } else if (t.status === 'offline_not_empty') {
                        weight = 0.5; // Discourage Online -> Busy (waste)
                        effectiveDenom = 4.0 + current;
                    }
                } else {
                    // Offline Empty Source Preference
                    if (t.status === 'online') {
                        weight = 1.5; // Still help King?
                    } else if (t.status === 'offline_empty') {
                        weight = 1.0; // Standard
                    } else if (t.status === 'offline_not_empty') {
                        // User Request: "ensure we get some points".
                        // "offline_empty reinforce some of offline_not_empty".
                        // Denom offset 4.0 vs Online E=2.0 (from Survival Phase).
                        // Online Val = 1.5 / 2 = 0.75 factor.
                        // ONE Val = W / 4.
                        // To win: W/4 > 0.75 => W > 3.0.
                        // Set to 3.5 to ensure immediate priority for OE sources.
                        weight = 3.5;
                        effectiveDenom = 4.0 + current;
                    }
                }

                const targetConf = this.getConfidence(t);
                const marginalVal = (weight / effectiveDenom) * targetConf;

                if (marginalVal > maxVal) {
                    maxVal = marginalVal;
                    bestTarget = t;
                }
            });

            if (bestTarget) {
                // Try to Assign
                if (this.assign(source.characterId, (bestTarget as CharacterAssignment).characterId)) {
                    // Success (moves to next iteration effectively)
                } else {
                    // Failed (Capacity?) -> Should we remove this target from potential for this source?
                    // Or simply continue?
                    // If assign fails, we might be stuck in loop if we keep picking same bestTarget.
                    // Realistically, we should sort targets and try sequentially.
                    // Retrying with loop...
                }
            } else {
                // No valid targets for this source?
                // Remove source to prevent infinite loop
                // (Wait, slice source out?)
                // Just break inner?
            }

            // To handle "assign failed", let's rewrite the inner logic to sort candidates.
            // Optimized above was greedy O(N). But fail-case complicates it.
            // Let's do Sort O(M log M). Safe.

            const targetScores = potentialTargets.map(t => {
                // ... same logic ...
                if (source.characterId === t.characterId) return { t, val: -1 };
                const currentAssignments = this.assignmentsMap.get(source.characterId) || [];
                if (currentAssignments.some(a => a.characterId === t.characterId)) return { t, val: -1 };

                const current = this.incomingReinforcementMap.get(t.characterId) || 0;
                const denom = Math.max(0.1, current);
                let weight = 1.0;
                let effectiveDenom = denom;

                if (sourceStatus === 'online') {
                    if (t.status === 'online') weight = 1.5;
                    else if (t.status === 'offline_empty') weight = 1.2;
                    else if (t.status === 'offline_not_empty') { weight = 0.5; effectiveDenom = 4.0 + current; }
                } else {
                    if (t.status === 'online') weight = 1.5;
                    else if (t.status === 'offline_empty') weight = 1.0;
                    else if (t.status === 'offline_not_empty') { weight = 2.0; effectiveDenom = 4.0 + current; }
                }
                const targetConf = this.getConfidence(t);
                return { t, val: (weight / effectiveDenom) * targetConf };
            }).filter(i => i.val > 0).sort((a, b) => b.val - a.val);

            let assigned = false;
            for (const item of targetScores) {
                if (this.assign(source.characterId, item.t.characterId)) {
                    assigned = true;
                    break;
                }
            }

            if (!assigned) {
                // Source cannot assign to anyone? (No marches or All Full).
                // Force remove from active?
                // `getRemainingMarches` check handles marches.
                // If Targets Full -> break?
                // Remove source from this round's activeSources to avoid infinite loop
                activeSources = activeSources.filter(s => s.characterId !== source.characterId);
            }
        }
    }

    private phase4_OfflineNotEmptyCleanup() {
        // Sources: Everyone with marches remaining EXCEPT OfflineNotEmpty (User request Step 172)
        // "offline_not_empty players should not be reinforcing anyone"
        // Targets: OfflineNotEmpty
        // Goal: Ensure we get some points (1 / (4+E)).

        const targets = this.offlineNotEmptyPlayers;
        if (targets.length === 0) return;

        // Source Pool: Online & OfflineEmpty (NOT Farms, NOT OfflineNotEmpty)
        // We use workingCharacters filter to capture anyone valid.
        const sources = this.workingCharacters.filter(s =>
            !this.isFarm(s) &&
            s.status !== 'offline_not_empty' && // BANNED AS SOURCE
            this.getRemainingMarches(s.characterId) > 0
        );

        // Sort targets by least reinforced to balance?
        targets.sort((a, b) => {
            return (this.incomingCountMap.get(a.characterId) || 0) - (this.incomingCountMap.get(b.characterId) || 0);
        });

        // Simple Greedy Fill
        for (const target of targets) {
            for (const source of sources) {
                if (this.getRemainingMarches(source.characterId) <= 0) continue;
                this.assign(source.characterId, target.characterId);
            }
        }
    }

    private finalize(): CharacterAssignment[] {
        return this.workingCharacters.map(c => ({
            ...c,
            // Determine final marches count for display/save?
            // Usually we want to persist the 'capacity' (6).
            // But if we want to show utilized marches, that's different.
            // The original code reset it to original or 6.
            marchesCount: (c.marchesCount === 0) ? 6 : Math.max(1, Math.min(6, c.marchesCount)),
            reinforce: this.assignmentsMap.get(c.characterId) || []
        }));
    }
}
