import { CharacterAssignment } from './vikings.types';
import { getCharacterStatus } from './vikings.helpers';

export function calculateAssignments(allCharacters: CharacterAssignment[]): CharacterAssignment[] {
    return new VikingsAssignmentSolver(allCharacters).solve();
}

class VikingsAssignmentSolver {
    private workingCharacters: CharacterAssignment[];

    // State Maps
    private assignmentsMap = new Map<string, { characterId: string; marchType?: string }[]>();
    private marchesRemainingMap = new Map<string, number>();
    private targetReinforcementCountMap = new Map<string, number>();
    private farmsMap = new Map<string, CharacterAssignment[]>(); // ownerId -> list of farms

    // Categorized Players
    private onlinePlayers: CharacterAssignment[] = [];
    private offlineEmptyPlayers: CharacterAssignment[] = [];
    private offlineNotEmptyPlayers: CharacterAssignment[] = [];

    constructor(inputCharacters: CharacterAssignment[]) {
        // Clone characters to work with
        this.workingCharacters = inputCharacters.map(c => ({ ...c }));
    }

    public solve(): CharacterAssignment[] {
        this.initialize();
        this.phase1_FarmPriorities();
        this.phase2_OfflineSources();
        this.phase3_OnlineSources();
        this.phase4_OfflineNotEmptyCleanup();
        return this.finalize();
    }

    private initialize() {
        this.workingCharacters.forEach(c => {
            this.assignmentsMap.set(c.characterId, []);
            this.targetReinforcementCountMap.set(c.characterId, 0);

            // Clamp marches count (1 to 6)
            let count = c.marchesCount;
            if (count === 0) count = 6;
            count = Math.max(1, Math.min(6, count));

            // EXPLICITLY FORCE 0 for Passive accounts (Farms)
            // 'offline_not_empty' are NOW valid sources (Phase 4), so we do NOT force them to 0.
            if (this.isFarm(c)) {
                count = 0;
            }

            this.marchesRemainingMap.set(c.characterId, count);

            // Identify Farms
            if (c.mainCharacterId) {
                const ownerId = c.mainCharacterId;
                const farms = this.farmsMap.get(ownerId) || [];
                farms.push(c);
                this.farmsMap.set(ownerId, farms);
            }

            // Categorize by Status
            const normalizedStatus = getCharacterStatus(c);
            c.status = normalizedStatus; // Update the character status to the normalized one

            if (normalizedStatus === 'online') {
                this.onlinePlayers.push(c);
            } else if (normalizedStatus === 'offline_empty') {
                this.offlineEmptyPlayers.push(c);
            } else {
                this.offlineNotEmptyPlayers.push(c);
            }
        });
    }

    // --- Helpers ---

    private isFarm(c: CharacterAssignment): boolean {
        return !!c.mainCharacterId;
    }

    private assign(sourceId: string, targetId: string): boolean {
        if (sourceId === targetId) return false;

        const currentAssignments = this.assignmentsMap.get(sourceId) || [];
        // Check if already assigned
        if (currentAssignments.find(a => a.characterId === targetId)) return false;

        // Check if source has marches
        const currentRem = this.marchesRemainingMap.get(sourceId) || 0;
        if (currentRem <= 0) return false;

        currentAssignments.push({ characterId: targetId });
        this.assignmentsMap.set(sourceId, currentAssignments);
        this.marchesRemainingMap.set(sourceId, currentRem - 1);
        return true;
    }

    private tryAssign(sourceId: string, targetId: string): boolean {
        // Check Capacity Limit
        const target = this.workingCharacters.find(c => c.characterId === targetId);
        if (target && target.reinforcementCapacity !== undefined) {
            const maxCapacity = Math.floor(target.reinforcementCapacity / 150000);
            const currentCount = this.targetReinforcementCountMap.get(targetId) || 0;
            if (currentCount >= maxCapacity) {
                return false;
            }
        }

        if (this.assign(sourceId, targetId)) {
            this.targetReinforcementCountMap.set(targetId, (this.targetReinforcementCountMap.get(targetId) || 0) + 1);
            return true;
        }
        return false;
    }

    private isValidData(c: CharacterAssignment): boolean {
        // Helper if we need generic validation
        return true;
    }

    // --- Constraint Checks ---

    private meetsFarmConstraints(target: CharacterAssignment): boolean {
        // Farm Constraint: owner assignment + others < extraMarches check?
        // Logic from original: 
        // if (total - (isOwnerAssigned ? 1 : 0) >= t.extraMarches) return false;

        if (target.mainCharacterId && target.extraMarches !== undefined && target.extraMarches >= 0) {
            const isOwnerAssigned = this.assignmentsMap.get(target.mainCharacterId)?.find(a => a.characterId === target.characterId);
            const total = this.targetReinforcementCountMap.get(target.characterId) || 0;
            const othersCount = total - (isOwnerAssigned ? 1 : 0);
            if (othersCount >= target.extraMarches) return false;
        }
        return true;
    }

    // --- PHASES ---

    private phase1_FarmPriorities() {
        // Iterate all players. If they have farms, assign to farms first.
        // Farms DO NOT reinforce anyone. 
        const onlineSources = this.onlinePlayers.filter(c => !this.isFarm(c));
        const offlineSources = [...this.offlineEmptyPlayers].filter(c => !this.isFarm(c));
        const allSources = [...onlineSources, ...offlineSources];

        for (const source of allSources) {
            const myFarms = this.farmsMap.get(source.characterId);
            if (myFarms && myFarms.length > 0) {
                for (const farm of myFarms) {
                    while ((this.marchesRemainingMap.get(source.characterId) || 0) > 0) {
                        if (!this.tryAssign(source.characterId, farm.characterId)) {
                            break;
                        }
                        break; // Move to next farm after one assignment? Logic implies one march per target.
                    }
                }
            }
        }
    }

    private phase2_OfflineSources() {
        // Sources: Offline Sources (Empty - Farms/NA/Unknown)
        // Targets: Offline Empty + Offline Not Empty

        const offlineSources = [...this.offlineEmptyPlayers].filter(c => !this.isFarm(c));
        const offlineTargets = [...this.offlineEmptyPlayers, ...this.offlineNotEmptyPlayers];

        const availableOfflineSources = offlineSources.filter(s => (this.marchesRemainingMap.get(s.characterId) || 0) > 0);
        let improvementMade = true;

        // Randomize
        availableOfflineSources.sort(() => 0.5 - Math.random());

        while (improvementMade) {
            improvementMade = false;

            for (const source of availableOfflineSources) {
                if ((this.marchesRemainingMap.get(source.characterId) || 0) <= 0) continue;

                // Find valid targets
                const validTargets = offlineTargets.filter(t => {
                    if (t.characterId === source.characterId) return false;
                    if (this.assignmentsMap.get(source.characterId)?.find(a => a.characterId === t.characterId)) return false;
                    if (!this.meetsFarmConstraints(t)) return false;

                    // RESTRICTION: Offline Not Empty sources (and Unknown/Fallback) can ONLY target Offline Not Empty
                    if (source.status === 'offline_not_empty' && t.status === 'offline_empty') {
                        return false;
                    }
                    return true;
                });

                if (validTargets.length === 0) continue;

                // Sort targets
                validTargets.sort((a, b) => {
                    const countA = this.targetReinforcementCountMap.get(a.characterId) || 0;
                    const countB = this.targetReinforcementCountMap.get(b.characterId) || 0;
                    if (countA !== countB) return countA - countB;

                    // Tie-Breaker: Prioritize Offline Empty
                    const isAEmpty = a.status === 'offline_empty';
                    const isBEmpty = b.status === 'offline_empty';
                    if (isAEmpty && !isBEmpty) return -1;
                    if (!isAEmpty && isBEmpty) return 1;
                    return 0;
                });

                // Try assigning
                for (const target of validTargets) {
                    if (this.tryAssign(source.characterId, target.characterId)) {
                        improvementMade = true;
                        break;
                    }
                }
            }
        }
    }

    private phase3_OnlineSources() {
        // Sources: Online Sources
        // Targets Pool: Online Players + Offline Empty Players

        const onlineSources = this.onlinePlayers.filter(c => !this.isFarm(c));
        const onlineAndOfflineEmptyTargets = [...this.onlinePlayers, ...this.offlineEmptyPlayers];
        const availableOnlineSources = onlineSources.filter(s => (this.marchesRemainingMap.get(s.characterId) || 0) > 0);

        let improvementMade = true;
        while (improvementMade) {
            improvementMade = false;
            availableOnlineSources.sort(() => 0.5 - Math.random());

            for (const source of availableOnlineSources) {
                if ((this.marchesRemainingMap.get(source.characterId) || 0) <= 0) continue;

                // Determine if source is High Confidence
                const sourceConfidence = source.confidenceLevel ?? 0.5;
                const isSourceHighConfidence = sourceConfidence >= 0.8;

                const validTargets = onlineAndOfflineEmptyTargets.filter(t => {
                    if (t.characterId === source.characterId) return false;
                    if (this.assignmentsMap.get(source.characterId)?.find(a => a.characterId === t.characterId)) return false;
                    if (!this.meetsFarmConstraints(t)) return false;
                    return true;
                });

                if (validTargets.length === 0) continue;

                validTargets.sort((a, b) => {
                    const countA = this.targetReinforcementCountMap.get(a.characterId) || 0;
                    const countB = this.targetReinforcementCountMap.get(b.characterId) || 0;
                    if (countA !== countB) return countA - countB;

                    // NEW: Confidence Priority
                    // If source is high confidence, we want to prioritize high confidence targets.
                    if (isSourceHighConfidence) {
                        const confA = a.confidenceLevel ?? 0.5;
                        const confB = b.confidenceLevel ?? 0.5;
                        const isAHigh = confA >= 0.8;
                        const isBHigh = confB >= 0.8;

                        if (isAHigh && !isBHigh) return -1;
                        if (!isAHigh && isBHigh) return 1;
                    }

                    // Tie-Breaker: Prioritize Online
                    const isAOnline = a.status === 'online';
                    const isBOnline = b.status === 'online';
                    if (isAOnline && !isBOnline) return -1;
                    if (!isAOnline && isBOnline) return 1;
                    return 0;
                });

                for (const target of validTargets) {
                    if (this.tryAssign(source.characterId, target.characterId)) {
                        improvementMade = true;
                        break;
                    }
                }
            }
        }
    }

    private phase4_OfflineNotEmptyCleanup() {
        // Sources: ALL players with remaining marches (Online, Offline Empty, Offline Not Empty)
        // Targets: Offline Not Empty

        const offlineNotEmptyTargets = [...this.offlineNotEmptyPlayers];

        // CHANGE: Online players are strictly forbidden from reinforcing Offline Not Empty.
        const allRemainingSources = this.workingCharacters.filter(s =>
            !this.isFarm(s) && s.status !== 'online' && (this.marchesRemainingMap.get(s.characterId) || 0) > 0
        );

        let improvementMade = true;
        while (improvementMade) {
            improvementMade = false;
            allRemainingSources.sort(() => 0.5 - Math.random());

            for (const source of allRemainingSources) {
                if ((this.marchesRemainingMap.get(source.characterId) || 0) <= 0) continue;

                const validTargets = offlineNotEmptyTargets.filter(t => {
                    if (t.characterId === source.characterId) return false;
                    if (this.assignmentsMap.get(source.characterId)?.find(a => a.characterId === t.characterId)) return false;
                    if (!this.meetsFarmConstraints(t)) return false;
                    return true;
                });

                if (validTargets.length === 0) continue;

                validTargets.sort((a, b) => {
                    const countA = this.targetReinforcementCountMap.get(a.characterId) || 0;
                    const countB = this.targetReinforcementCountMap.get(b.characterId) || 0;
                    return countA - countB;
                });

                for (const target of validTargets) {
                    if (this.tryAssign(source.characterId, target.characterId)) {
                        improvementMade = true;
                        break;
                    }
                }
            }
        }
    }

    private finalize(): CharacterAssignment[] {
        return this.workingCharacters.map(c => ({
            ...c,
            // Restore original marches count or logic max? Logic says max(1, min(6)).
            // But we modified it for matching.
            marchesCount: (c.marchesCount === 0) ? 6 : Math.max(1, Math.min(6, c.marchesCount)),
            reinforce: this.assignmentsMap.get(c.characterId) || []
        }));
    }
}
