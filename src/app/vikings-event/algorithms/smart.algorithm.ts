import { CharacterAssignment } from '../vikings.types';
import { getCharacterStatus, getMemberConfidence } from '../vikings.helpers';
import { AssignmentAlgorithm } from './assignment-algorithm.interface';

export class SmartAssignmentAlgorithm implements AssignmentAlgorithm {
    name = 'smart';
    description = 'Smart allocation strategy prioritizing active players and farm utilization.';

    private workingCharacters: CharacterAssignment[] = [];
    private farmsMap = new Map<string, CharacterAssignment[]>();

    private assignmentsMap = new Map<string, { characterId: string; marchType?: string }[]>();
    private marchesRemainingMap = new Map<string, number>();
    private incomingCountMap = new Map<string, number>();
    private reinforcementLimitsMap = new Map<string, number>();

    private readonly SCORE_ONLINE = 1.3;
    private readonly SCORE_OFFLINE_EMPTY = 1.0;

    public solve(inputCharacters: CharacterAssignment[]): CharacterAssignment[] {
        // Deep copy
        this.workingCharacters = inputCharacters.map(c => ({
            ...c,
            reinforce: []
        }));

        this.initialize();
        this.phase1_ComputeLimits();
        this.phase2_Farms();
        this.phase3_PrioritizedAssignment();
        this.phase4_RemainingAssignment();

        return this.finalize();
    }

    private initialize() {
        this.assignmentsMap.clear();
        this.marchesRemainingMap.clear();
        this.incomingCountMap.clear();
        this.reinforcementLimitsMap.clear();
        this.farmsMap.clear();

        this.workingCharacters.forEach(c => {
            // Normalize status
            c.status = getCharacterStatus(c);
            this.assignmentsMap.set(c.characterId, []);

            // Marches
            // Assuming marchesCount is available, logic might need to ensure defaults
            // Logic says "compute amount of marches... If player already has assigned max reinforcements value..."
            // Wait, "amount of marches the player should be reinforced WITH" is Phase 1.
            // "Marches Count" is what they HAVE to send.
            let count = c.marchesCount;
            if (count === 0) count = 6;
            count = Math.max(1, Math.min(10, count)); // Allow more than 6? Default is usually 6.

            this.marchesRemainingMap.set(c.characterId, count);
            this.incomingCountMap.set(c.characterId, 0);

            // Farms
            if (c.mainCharacterId) {
                const ownerId = c.mainCharacterId;
                const farms = this.farmsMap.get(ownerId) || [];
                farms.push(c);
                this.farmsMap.set(ownerId, farms);
            }
        });
    }

    // --- Phase 1: Compute Reinforcement Limits ---
    private phase1_ComputeLimits() {
        this.workingCharacters.forEach(c => {
            let limit = c.maxReinforcementMarches;
            // Custom logic based on TC logic potentially needed, but for now using the request:
            // "If the player already has assigned max reinforcments value, it should be used."
            // "If not, we will use value 2 if player is town center 33 or above, and 3 if town center is lower than 33."

            if (limit === undefined || limit === null) {
                // TC Level Logic: 2 if >= 33, else 3
                if (c.townCenterLevel && c.townCenterLevel >= 33) {
                    limit = 2;
                } else {
                    limit = 3;
                }
            }

            // Cap check
            if (c.reinforcementCapacity) {
                const capBasedLimit = Math.floor(c.reinforcementCapacity / 150000);
                if (limit !== undefined && limit > capBasedLimit) {
                    limit = capBasedLimit;
                }
            }

            this.reinforcementLimitsMap.set(c.characterId, limit ?? 100);
        });
    }

    // --- Phase 2: Main -> Farm Assignment ---
    private phase2_Farms() {
        for (const [ownerId, farms] of this.farmsMap.entries()) {
            if (this.getRemainingMarches(ownerId) <= 0) continue;

            // "we assign main accounts to their farm accounts"
            // Does this mean Main reinforces Farm? Yes.
            for (const farm of farms) {
                if (this.getRemainingMarches(ownerId) <= 0) break;
                this.assign(ownerId, farm.characterId);
            }
        }
    }

    // --- Phase 3: Prioritized Assignment ---
    private phase3_PrioritizedAssignment() {
        // Targets: Online and Offline_Empty
        // Farms are INCLUDED in targets if they match status (though usually farms are offline_not_empty?)
        // If farm is Online/Offline_Empty, it is a target.
        const potentialTargets = this.workingCharacters.filter(c =>
            c.status === 'online' || c.status === 'offline_empty'
        );

        // Score: (Online ? 1.3 : 1.0) * Confidence
        const scoredTargets = potentialTargets.map(c => {
            const multiplier = c.status === 'online' ? this.SCORE_ONLINE : this.SCORE_OFFLINE_EMPTY;
            const confidence = getMemberConfidence(c);
            const score = multiplier * confidence;
            return { c, score };
        });

        // Sort Targets: Score Descending
        scoredTargets.sort((a, b) => b.score - a.score);

        // Sources: Online and Offline_Empty ONLY. Exclude Farms.
        const sources = this.workingCharacters.filter(c =>
            (c.status === 'online' || c.status === 'offline_empty') &&
            !c.mainCharacterId // Not a farm
        );

        // Iterate Targets
        for (const { c: target } of scoredTargets) {
            // Loop Sources -> Assign until Target full
            if (this.isFull(target)) continue;

            for (const source of sources) {
                if (this.isFull(target)) break;
                if (this.getRemainingMarches(source.characterId) > 0) {
                    this.assign(source.characterId, target.characterId);
                }
            }
        }
    }

    // --- Phase 4: Remaining Assignment ---
    private phase4_RemainingAssignment() {
        const targets = this.workingCharacters.filter(c => c.status === 'offline_not_empty');
        const sources = this.workingCharacters.filter(c =>
            this.getRemainingMarches(c.characterId) > 0 &&
            c.status !== 'offline_not_empty'
        );

        const filledOrSkippedTargets = new Set<string>();

        while (sources.length > 0 && targets.length > 0) {
            // Find target with minimum assigned reinforcements that is not full and not skipped
            let minAssigned = Infinity;
            let bestTarget: CharacterAssignment | null = null;

            // We need to re-check valid targets every iteration because they might become full
            let availableTargets = false;

            for (const target of targets) {
                if (filledOrSkippedTargets.has(target.characterId)) continue;
                if (this.isFull(target)) {
                    filledOrSkippedTargets.add(target.characterId);
                    continue;
                }

                availableTargets = true;

                const current = this.incomingCountMap.get(target.characterId) || 0;
                if (current < minAssigned) {
                    minAssigned = current;
                    bestTarget = target;
                }
            }

            if (!bestTarget || !availableTargets) break;

            // Find a source that can assign to this target
            let assigned = false;
            // Iterate sources to find one that hasn't assigned to this target yet
            // We iterate all sources because the first one might already be assigned
            for (let i = 0; i < sources.length; i++) {
                const source = sources[i];
                if (this.assign(source.characterId, bestTarget.characterId)) {
                    assigned = true;
                    // If source empty, remove from list
                    if (this.getRemainingMarches(source.characterId) <= 0) {
                        sources.splice(i, 1);
                    }
                    break;
                }
            }

            if (!assigned) {
                // No source could assign to this target (e.g. all available sources already assigned to it)
                // Skip this target for future iterations
                filledOrSkippedTargets.add(bestTarget.characterId);
            }
        }
    }

    // --- Helpers ---
    private getRemainingMarches(id: string): number {
        return this.marchesRemainingMap.get(id) || 0;
    }

    private isFull(c: CharacterAssignment): boolean {
        // Limit is determined in Phase 1
        const max = this.reinforcementLimitsMap.get(c.characterId) ?? 100; // Use map
        const current = this.incomingCountMap.get(c.characterId) || 0;
        // console.log(`Debug: isFull(${c.characterId})? Current: ${current}, Max: ${max}, Result: ${current >= max}`);
        if (c.characterId === 'T1') { // Restrict spam if possible, or T1 specific failure
            console.log(`Debug: isFull(${c.characterId})? Current: ${current}, Max: ${max}, Result: ${current >= max}`);
        }
        return current >= max;
    }

    private assign(sourceId: string, targetId: string): boolean {
        if (sourceId === targetId) return false;

        // Check already assigned
        const current = this.assignmentsMap.get(sourceId) || [];
        if (current.find(a => a.characterId === targetId)) return false;

        const target = this.workingCharacters.find(t => t.characterId === targetId);
        if (!target) return false;

        if (this.isFull(target)) return false;

        // Execute Assignment
        current.push({ characterId: targetId });
        this.assignmentsMap.set(sourceId, current);
        this.marchesRemainingMap.set(sourceId, this.getRemainingMarches(sourceId) - 1);
        this.incomingCountMap.set(targetId, (this.incomingCountMap.get(targetId) || 0) + 1);

        return true;
    }

    private finalize(): CharacterAssignment[] {
        return this.workingCharacters.map(c => ({
            ...c,
            reinforce: this.assignmentsMap.get(c.characterId) || []
        }));
    }
}
