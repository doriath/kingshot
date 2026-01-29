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
        // Deep copy - Preserve existing assignments
        this.workingCharacters = inputCharacters.map(c => ({
            ...c,
            reinforce: c.reinforce ? [...c.reinforce] : []
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

        // 1. Setup base maps & farms
        this.workingCharacters.forEach(c => {
            // Normalize status
            c.status = getCharacterStatus(c);

            // Ensure incoming count is initialized
            this.incomingCountMap.set(c.characterId, 0);

            // Farms
            if (c.mainCharacterId) {
                const ownerId = c.mainCharacterId;
                const farms = this.farmsMap.get(ownerId) || [];
                farms.push(c);
                this.farmsMap.set(ownerId, farms);
            }
        });

        // 2. Process existing assignments
        this.workingCharacters.forEach(c => {
            const existing = c.reinforce || [];

            // Populate assignments map
            // We strip extraneous props like scoreValue/name if they exist, keeping core logic props
            const cleanAssignments = existing.map(r => ({ characterId: r.characterId, marchType: r.marchType }));
            this.assignmentsMap.set(c.characterId, cleanAssignments);

            // Calculate Marches Remaining
            let totalMarches = c.marchesCount;
            if (totalMarches === 0) totalMarches = 6;
            totalMarches = Math.max(1, Math.min(10, totalMarches));

            const remaining = totalMarches - cleanAssignments.length;
            this.marchesRemainingMap.set(c.characterId, remaining);

            // Update Incoming Counts
            cleanAssignments.forEach(r => {
                const current = this.incomingCountMap.get(r.characterId) || 0;
                this.incomingCountMap.set(r.characterId, current + 1);
            });
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
                if (c.townCenterLevel && c.townCenterLevel >= 34) {
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
        // 1. Identification of valid participants
        // Targets: Online and Offline_Empty
        // Sources: Online and Offline_Empty (excluding farms)

        const allParticipants = this.workingCharacters.filter(c =>
            c.status === 'online' || c.status === 'offline_empty'
        );

        // 2. Compute Scores
        // Base Score = (StatusMultiplier * Confidence)
        // Reinforcement Value = Base Score / Limit

        const scoresMap = new Map<string, { baseScore: number; reinforcementValue: number }>();

        allParticipants.forEach(c => {
            const multiplier = c.status === 'online' ? this.SCORE_ONLINE : this.SCORE_OFFLINE_EMPTY;
            const confidence = getMemberConfidence(c);
            const baseScore = multiplier * confidence;
            const limit = this.reinforcementLimitsMap.get(c.characterId) ?? 100; // default safe
            // Avoid division by zero, though limit should be >= 1
            const safeLimit = limit <= 0 ? 1 : limit;
            const reinforcementValue = baseScore / safeLimit;

            scoresMap.set(c.characterId, { baseScore, reinforcementValue });
        });

        // 3. Define Sources and Sort them
        const sources = allParticipants.filter(c => !c.mainCharacterId); // Exclude farms
        // Sort sources by Base Score (Desc)
        sources.sort((a, b) => {
            const sA = scoresMap.get(a.characterId)?.baseScore || 0;
            const sB = scoresMap.get(b.characterId)?.baseScore || 0;
            return sB - sA;
        });

        const targets = allParticipants; // Both sources and others can be targets

        // 4. Round Robin Assignment Loop
        let assignmentsMade = true;

        while (assignmentsMade) {
            assignmentsMade = false;

            for (const source of sources) {
                if (this.getRemainingMarches(source.characterId) <= 0) continue;

                const sourceScore = scoresMap.get(source.characterId)?.baseScore || 0;

                // Find valid candidates
                // - Status valid (already filtered in targets)
                // - Not full
                // - Not already assigned by this source
                // - Not self
                const validCandidates = targets.filter(t => {
                    if (t.characterId === source.characterId) return false;
                    if (this.isFull(t)) return false;
                    if (this.isAssigned(source.characterId, t.characterId)) return false;
                    return true;
                });

                if (validCandidates.length === 0) continue;

                // Split into Allowed (Score <= Source) and Others
                const allowedTargets = validCandidates.filter(t => {
                    const tScore = scoresMap.get(t.characterId)?.baseScore || 0;
                    return tScore <= sourceScore;
                });

                let bestTarget: CharacterAssignment | null = null;

                if (allowedTargets.length > 0) {
                    // Primary Selection: Max Reinforcement Value
                    bestTarget = allowedTargets.reduce((prev, curr) => {
                        const prevVal = scoresMap.get(prev.characterId)?.reinforcementValue || 0;
                        const currVal = scoresMap.get(curr.characterId)?.reinforcementValue || 0;
                        return (currVal > prevVal) ? curr : prev;
                    });
                } else {
                    // Fallback Selection: Min Reinforcement Value from ALL valid candidates
                    // "If allowedTargets is empty ... choose player with lowest reinforcementValue from all targets" (meaning validCandidates)
                    bestTarget = validCandidates.reduce((prev, curr) => {
                        const prevVal = scoresMap.get(prev.characterId)?.reinforcementValue || 0;
                        const currVal = scoresMap.get(curr.characterId)?.reinforcementValue || 0;
                        return (currVal < prevVal) ? curr : prev;
                    });
                }

                if (bestTarget) {
                    if (this.assign(source.characterId, bestTarget.characterId)) {
                        assignmentsMade = true;
                    }
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
                // In Phase 4, we allow multiple marches from same source to fill targets uniformly
                if (this.assign(source.characterId, bestTarget.characterId, true)) {
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
        return current >= max;
    }

    private assign(sourceId: string, targetId: string, allowMultiple = false): boolean {
        if (sourceId === targetId) return false;

        // Check already assigned if not allowing multiple
        if (!allowMultiple && this.isAssigned(sourceId, targetId)) return false;

        const target = this.workingCharacters.find(t => t.characterId === targetId);
        if (!target) return false;

        if (this.isFull(target)) return false;

        // Execute Assignment
        const current = this.assignmentsMap.get(sourceId) || [];
        current.push({ characterId: targetId });
        this.assignmentsMap.set(sourceId, current);
        this.marchesRemainingMap.set(sourceId, this.getRemainingMarches(sourceId) - 1);
        this.incomingCountMap.set(targetId, (this.incomingCountMap.get(targetId) || 0) + 1);

        return true;
    }

    private isAssigned(sourceId: string, targetId: string): boolean {
        const current = this.assignmentsMap.get(sourceId) || [];
        return !!current.find(a => a.characterId === targetId);
    }

    private finalize(): CharacterAssignment[] {
        return this.workingCharacters.map(c => ({
            ...c,
            reinforce: this.assignmentsMap.get(c.characterId) || []
        }));
    }
}
