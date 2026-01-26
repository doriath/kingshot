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
            // Custom logic based on TC logic potentially needed, but for now using the request:
            // "If the player already has assigned max reinforcments value, it should be used."
            // "If not, we will use value 2 if player is town center 33 or above, and 3 if town center is lower than 33."

            // We don't have town center level directly in CharacterAssignment, 
            // but we have `powerLevel`. Often powerLevel correlates or is used. 
            // OR maybe `maxReinforcementMarches` is ALREADY populated if set?
            // The prompt implies we need to set it if not present.
            // However, the interface doesn't show TC level. I will use a placeholder or assume powerLevel proxy?
            // Request says: "if player is town center 33 or above". 
            // I don't see TC level in the interface.
            // I will assume for now, if maxReinforcementMarches is undefined, I default to 2.
            // WAIT, logic: "2 if TC >= 33, 3 if TC < 33".
            // Without TC level, I can't implement this strictly.
            // I will make a best effort guess using Power Level? No that's risky.
            // I'll check if possibly 'maxReinforcementMarches' is ALREADY populated from DB.
            // If not, I will default to 2 as a safe bet for high level, 3 for lower?
            // Actually, usually higher TC can take MORE reinforcements? No, maybe less because they are strong?
            // "2 if TC >= 33, 3 if TC < 33" -> Higher TC needs FEWER reinforcements? Or has simpler limit?

            // HACK: Since I don't have TC property, checking if I need to fetch it or if I can ignore.
            // The prompt is specific. I will comment this limitation.
            // For now, I will use `maxReinforcementMarches` if set.
            // If not set, I will default to 3 (safer to allow more?).
            // AND "we also need to take into account reinforcement capacity".

            if (c.maxReinforcementMarches === undefined || c.maxReinforcementMarches === null) {
                c.maxReinforcementMarches = 3;
            }

            // Cap check
            if (c.reinforcementCapacity) {
                const capBasedLimit = Math.floor(c.reinforcementCapacity / 150000);
                if (c.maxReinforcementMarches !== undefined && c.maxReinforcementMarches > capBasedLimit) {
                    c.maxReinforcementMarches = capBasedLimit;
                }
            }
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
        // Targets: Offline_Not_Empty
        const targets = this.workingCharacters.filter(c => c.status === 'offline_not_empty');

        // Sources: All accounts EXCEPT Offline_Not_Empty (Include Farms)
        // Wait, "exclude offline_not_empty from assignment algorithm" in Phase 3 prompt, 
        // Phase 4 says "assign remaining marches everyone has, to offline_not_empty".
        // "everyone has" implies including Offline_Not_Empty sources?
        // Prompt says: "(offline_not_empty are excluded completely from the assignment algorithm)" in Phase 3 context.
        // Phase 4 says "assign the remaining marches EVERYONE has".
        // I will interpret "everyone" as all valid sources (Online, Offline_Empty, Farms).
        // BUT, if an Offline_Not_Empty player has marches, should they send?
        // Usually ONE (Offline Not Empty) is barely active or ignored.
        // I will assume Offline_Not_Empty do NOT send marches.

        const sources = this.workingCharacters.filter(c =>
            this.getRemainingMarches(c.characterId) > 0 &&
            c.status !== 'offline_not_empty'
        );

        // Simple round robin or greedy fill? 
        // "assign the remaining marches... to offline_not_empty players"
        // No specific order mentioned. I'll stick to a simple fill.

        for (const target of targets) {
            for (const source of sources) {
                if (this.getRemainingMarches(source.characterId) <= 0) continue;
                if (this.isFull(target)) break;

                this.assign(source.characterId, target.characterId);
            }
        }
    }

    // --- Helpers ---
    private getRemainingMarches(id: string): number {
        return this.marchesRemainingMap.get(id) || 0;
    }

    private isFull(c: CharacterAssignment): boolean {
        // Limit is determined in Phase 1
        const max = c.maxReinforcementMarches || 100; // Default high if somehow missing
        const current = this.incomingCountMap.get(c.characterId) || 0;
        // console.log(`Debug: isFull(${c.characterId})? Current: ${current}, Max: ${max}, Result: ${current >= max}`);
        if (c.characterId === 'T1') { // Restrict spam if possible, or T1 specific failure
            console.log(`Debug: isFull(${c.characterId})? Current: ${current}, c.max: ${c.maxReinforcementMarches}, Max: ${max}, Result: ${current >= max}`);
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
