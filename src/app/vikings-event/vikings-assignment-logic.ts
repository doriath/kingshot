import { CharacterAssignment, VikingsStatus } from './vikings.types';
import { getCharacterStatus } from './vikings.helpers';

export interface AssignmentAlgorithm {
    name: string;
    description: string;
    solve(characters: CharacterAssignment[]): CharacterAssignment[];
}

export class GreedyAssignmentAlgorithm implements AssignmentAlgorithm {
    name = 'greedy';
    description = 'Greedy allocation strategy prioritizing high confidence and online players.';

    private workingCharacters: CharacterAssignment[] = [];

    // State
    private assignmentsMap = new Map<string, { characterId: string; marchType?: string }[]>(); // Source -> Targets
    private marchesRemainingMap = new Map<string, number>(); // Source -> Remaining Marches
    private marchesSentMap = new Map<string, number>(); // Source -> Count of Marches Sent (for Round Robin)
    private incomingReinforcementMap = new Map<string, number>(); // Target -> Sum of Confidence of incoming sources
    private incomingCountMap = new Map<string, number>(); // Target -> Count of incoming sources
    private farmsMap = new Map<string, CharacterAssignment[]>(); // OwnerId -> List of Farms

    // Pools
    private onlinePlayers: CharacterAssignment[] = [];
    private offlineEmptyPlayers: CharacterAssignment[] = [];
    private offlineNotEmptyPlayers: CharacterAssignment[] = [];

    // Constants
    private readonly SCORE_ONLINE = 1.5;
    private readonly SCORE_OFFLINE_EMPTY = 1.0;
    private readonly SCORE_OFFLINE_NOT_EMPTY = 1.0;
    private readonly PENALTY_OFFLINE_NOT_EMPTY = 3.0;

    public solve(inputCharacters: CharacterAssignment[]): CharacterAssignment[] {
        // Deep copy input
        this.workingCharacters = inputCharacters.map(c => ({ ...c }));

        this.initialize();
        this.phase1_Farms();
        this.phase_MixedStrategy();
        return this.finalize();
    }

    private initialize() {
        // Reset State
        this.assignmentsMap.clear();
        this.marchesRemainingMap.clear();
        this.marchesSentMap.clear();
        this.incomingReinforcementMap.clear();
        this.incomingCountMap.clear();
        this.farmsMap.clear();
        this.onlinePlayers = [];
        this.offlineEmptyPlayers = [];
        this.offlineNotEmptyPlayers = [];

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

            this.marchesRemainingMap.set(c.characterId, count);
            this.marchesSentMap.set(c.characterId, 0);

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

    private getMarchesSent(id: string): number {
        return this.marchesSentMap.get(id) || 0;
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
        if (!target) return false;

        if (target.maxReinforcementMarches !== undefined) {
            const currentTotal = this.incomingCountMap.get(targetId) || 0;
            if (currentTotal >= target.maxReinforcementMarches) return false;
        } else if (target.reinforcementCapacity !== undefined) {
            const maxCapacity = Math.floor(target.reinforcementCapacity / 150000);
            const currentCount = this.incomingCountMap.get(targetId) || 0;
            if (currentCount >= maxCapacity) return false;
        }

        // Execute Assignment
        current.push({ characterId: targetId });
        this.assignmentsMap.set(sourceId, current);
        this.marchesRemainingMap.set(sourceId, rem - 1);
        this.marchesSentMap.set(sourceId, this.getMarchesSent(sourceId) + 1);

        const source = this.workingCharacters.find(c => c.characterId === sourceId);
        const addedConfidence = source ? this.getConfidence(source) : 0;

        this.incomingReinforcementMap.set(targetId, (this.incomingReinforcementMap.get(targetId) || 0) + addedConfidence);
        this.incomingCountMap.set(targetId, (this.incomingCountMap.get(targetId) || 0) + 1);

        return true;
    }

    // --- Scoring ---

    private calculateScore(target: CharacterAssignment): number {
        const E = this.incomingReinforcementMap.get(target.characterId) || 0;
        const safeE = Math.max(0.001, E);

        const scoreOfflineNotEmpty = this.SCORE_OFFLINE_NOT_EMPTY / (this.PENALTY_OFFLINE_NOT_EMPTY + E);

        let primaryScore = 0;
        if (target.status === 'online') {
            primaryScore = this.SCORE_ONLINE / safeE;
        } else if (target.status === 'offline_empty') {
            primaryScore = this.SCORE_OFFLINE_EMPTY / safeE;
        } else {
            return scoreOfflineNotEmpty;
        }

        const confidence = this.getConfidence(target);
        return primaryScore * confidence + (1 - confidence) * scoreOfflineNotEmpty;
    }


    // --- Phases ---

    private phase1_Farms() {
        for (const [ownerId, farms] of this.farmsMap.entries()) {
            if (this.getRemainingMarches(ownerId) <= 0) continue;
            for (const farm of farms) {
                this.assign(ownerId, farm.characterId);
                if (this.getRemainingMarches(ownerId) <= 0) break;
            }
        }
    }

    private phase_MixedStrategy() {
        // Defined Source Groups
        const onlineSources = this.onlinePlayers.filter(s => !this.isFarm(s));
        const oeSources = this.offlineEmptyPlayers.filter(s => !this.isFarm(s));

        // Defined Target Pools
        // Online Source -> Online | OE
        const onlineTargets = [...this.onlinePlayers, ...this.offlineEmptyPlayers];
        // OE Source -> OE | ONE
        const oeTargets = [...this.offlineEmptyPlayers, ...this.offlineNotEmptyPlayers];

        // --- Step 1: Assign 3 marches for each Online Source first ---
        // Iterate through all Online sources, giving them up to 3 turns
        // We do this round-robin-ish or just block-assign? 
        // "first assign 3 marches of each online player" -> Suggests priority.
        // Let's do 3 separate rounds to ensure distribution? Or just loop 3 times for each?
        // Round robin is fairer.

        for (let i = 0; i < 3; i++) {
            // Sort by confidence logic inside loop or pre-sort?
            // Pre-sort by confidence descending (Highest Conf goes first in round)
            const active = onlineSources.filter(s => this.getRemainingMarches(s.characterId) > 0);
            active.sort((a, b) => this.getConfidence(b) - this.getConfidence(a));

            for (const source of active) {
                this.greedyChoice(source, onlineTargets);
            }
        }

        // --- Step 2: Alternating Rounds ---
        // "then we alternate by assigning 1 march to every offline_empty player, 1 march to every online player, etc"

        let assignmentsMade = true;
        while (assignmentsMade) {
            assignmentsMade = false;

            // Round: Offline Empty
            const activeOE = oeSources.filter(s => this.getRemainingMarches(s.characterId) > 0);
            activeOE.sort((a, b) => this.getConfidence(b) - this.getConfidence(a)); // Higher confidence first?

            for (const source of activeOE) {
                if (this.greedyChoice(source, oeTargets)) {
                    assignmentsMade = true;
                }
            }

            // Round: Online
            const activeOnline = onlineSources.filter(s => this.getRemainingMarches(s.characterId) > 0);
            activeOnline.sort((a, b) => this.getConfidence(b) - this.getConfidence(a));

            for (const source of activeOnline) {
                if (this.greedyChoice(source, onlineTargets)) {
                    assignmentsMade = true;
                }
            }
        }
    }

    private greedyChoice(source: CharacterAssignment, allowedTargets: CharacterAssignment[]): boolean {
        if (this.getRemainingMarches(source.characterId) <= 0) return false;

        let bestTarget: CharacterAssignment | null = null;
        let bestScore = -1;

        // Find Best Target
        // Optimization: Sort candidates by score? Expensive? O(N*T).
        // Check capacity and rules.

        for (const target of allowedTargets) {
            if (target.characterId === source.characterId) continue;

            const currentAssignments = this.assignmentsMap.get(source.characterId) || [];
            if (currentAssignments.some(a => a.characterId === target.characterId)) continue;

            if (target.maxReinforcementMarches !== undefined) {
                const currentTotal = this.incomingCountMap.get(target.characterId) || 0;
                if (currentTotal >= target.maxReinforcementMarches) continue;
            } else if (target.reinforcementCapacity !== undefined) {
                const maxCapacity = Math.floor(target.reinforcementCapacity / 150000);
                const currentCount = this.incomingCountMap.get(target.characterId) || 0;
                if (currentCount >= maxCapacity) continue;
            }

            const score = this.calculateScore(target);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }

        if (bestTarget) {
            return this.assign(source.characterId, bestTarget.characterId);
        }

        return false;
    }

    private finalize(): CharacterAssignment[] {
        return this.workingCharacters.map(c => ({
            ...c,
            marchesCount: (c.marchesCount === 0) ? 6 : Math.max(1, Math.min(6, c.marchesCount)),
            reinforce: this.assignmentsMap.get(c.characterId) || []
        }));
    }
}

// Registry
const ALGORITHMS: { [key: string]: AssignmentAlgorithm } = {
    'greedy': new GreedyAssignmentAlgorithm()
};

export function getAvailableAlgorithms(): AssignmentAlgorithm[] {
    return Object.values(ALGORITHMS);
}

export function calculateAssignments(allCharacters: CharacterAssignment[], algorithmName: string = 'greedy'): CharacterAssignment[] {
    const algo = ALGORITHMS[algorithmName] || ALGORITHMS['greedy'];
    return algo.solve(allCharacters);
}
