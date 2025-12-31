import { CharacterAssignment } from './vikings.types';

export function calculateAssignments(allCharacters: CharacterAssignment[]): CharacterAssignment[] {
    // --- Setup and Helper structures ---

    // Clone characters to work with
    const workingCharacters = allCharacters.map(c => ({ ...c }));
    // console.log('Starting calculateAssignments with', workingCharacters.length, 'characters');

    // Map to track assignments: targetId -> list of sourceIds
    const assignmentsMap = new Map<string, { characterId: string; marchType?: string }[]>();

    // Map to track remaining marches for each source: sourceId -> count
    const marchesRemainingMap = new Map<string, number>();

    // Separating lists
    const onlinePlayers: CharacterAssignment[] = [];
    const offlineEmptyPlayers: CharacterAssignment[] = [];
    const offlineNotEmptyPlayers: CharacterAssignment[] = [];
    // Farms are identified by having a mainCharacterId. They are PASSIVE (do not reinforce).
    // However, we need to know who owns them to prioritize.

    // Helper to find owner
    const farmsMap = new Map<string, CharacterAssignment[]>(); // ownerId -> list of farms

    workingCharacters.forEach(c => {
        assignmentsMap.set(c.characterId, []);

        // Clamp marches count (1 to 6)
        let count = c.marchesCount;
        if (count === 0) count = 6;
        count = Math.max(1, Math.min(6, count));

        // EXPLICITLY FORCE 0 for Passive accounts (Farms, Unknown)
        // 'offline_not_empty' are NOW valid sources (Phase 4), so we do NOT force them to 0.
        if (c.mainCharacterId) {
            count = 0;
        }

        marchesRemainingMap.set(c.characterId, count);

        // Identify Farms
        if (c.mainCharacterId) {
            const ownerId = c.mainCharacterId;
            const farms = farmsMap.get(ownerId) || [];
            farms.push(c);
            farmsMap.set(ownerId, farms);
        }

        // Categorize by Status
        if (c.status === 'online') {
            onlinePlayers.push(c);
        } else if (c.status === 'offline_empty') {
            offlineEmptyPlayers.push(c);
        } else {
            c.status = 'offline_not_empty';
            offlineNotEmptyPlayers.push(c);
        }
    });

    // Helper to assign MARCH
    const assign = (sourceId: string, targetId: string): boolean => {
        if (sourceId === targetId) return false;

        const currentAssignments = assignmentsMap.get(sourceId) || [];
        // Check if already assigned
        if (currentAssignments.find(a => a.characterId === targetId)) return false;

        // Check if source has marches
        const currentRem = marchesRemainingMap.get(sourceId) || 0;
        if (currentRem <= 0) return false; // Should be checked by caller but safety check

        currentAssignments.push({ characterId: targetId });
        assignmentsMap.set(sourceId, currentAssignments);
        marchesRemainingMap.set(sourceId, currentRem - 1);
        return true;
    };

    // Optimized helper for greedy search
    // We need a map of Target -> Count to avoid O(N^2) in the greedy loop
    const targetReinforcementCountMap = new Map<string, number>();
    workingCharacters.forEach(c => targetReinforcementCountMap.set(c.characterId, 0));

    const assignWithCountUpdate = (sourceId: string, targetId: string): boolean => {
        // Check Capacity Limit
        const target = workingCharacters.find(c => c.characterId === targetId);
        if (target && target.reinforcementCapacity !== undefined) {
            const maxCapacity = Math.floor(target.reinforcementCapacity / 150000);
            const currentCount = targetReinforcementCountMap.get(targetId) || 0;
            if (currentCount >= maxCapacity) {
                return false;
            }
        }

        if (assign(sourceId, targetId)) {
            targetReinforcementCountMap.set(targetId, (targetReinforcementCountMap.get(targetId) || 0) + 1);
            return true;
        }
        return false;
    };


    // --- PHASE 1: Farm Priorities ---
    // Iterate all players. If they have farms, assign to farms first.

    // Define Source Pools
    // Rule: Farms DO NOT reinforce anyone. 
    // So we filter pools to exclude anyone who IS a farm (has mainCharacterId).
    const isFarm = (c: CharacterAssignment) => !!c.mainCharacterId;

    const onlineSources = onlinePlayers.filter(c => !isFarm(c));
    const offlineSources = [...offlineEmptyPlayers].filter(c => !isFarm(c));

    const allSources = [...onlineSources, ...offlineSources];

    for (const source of allSources) {
        const myFarms = farmsMap.get(source.characterId);
        if (myFarms && myFarms.length > 0) {
            for (const farm of myFarms) {
                // Constraint: Respect farm capacity & extraMarches.
                // Owner dumps as much as possible until farm is full or logic limits.
                // Assuming we fill it up to capacity if we can.

                while ((marchesRemainingMap.get(source.characterId) || 0) > 0) {
                    if (!assignWithCountUpdate(source.characterId, farm.characterId)) {
                        break; // Already assigned or error
                    }
                    // Only 1 march per farm per source logic?
                    // If distinct reinforcement slots are allowed, we could send multiple?
                    // Existing logic assumes one march per source-target pair.
                    // "assign" returns false if already assigned.
                    break;
                }
            }
        }
    }


    // --- PHASE 2: Offline Sources Assignment ---
    // Sources: Offline Sources (Empty - Farms/NA/Unknown)
    // Targets: Offline Empty + Offline Not Empty
    // Logic: Greedy Least-Reinforced. Tie-breaker: Offline Empty.

    const offlineTargets = [...offlineEmptyPlayers, ...offlineNotEmptyPlayers];
    const availableOfflineSources = offlineSources.filter(s => (marchesRemainingMap.get(s.characterId) || 0) > 0);

    let offlineImprovementMade = true;

    // Randomize sources
    availableOfflineSources.sort(() => 0.5 - Math.random());

    while (offlineImprovementMade) {
        offlineImprovementMade = false;

        for (const source of availableOfflineSources) {
            if ((marchesRemainingMap.get(source.characterId) || 0) <= 0) continue;

            // Find best target
            const validTargets = offlineTargets.filter(t => {
                if (t.characterId === source.characterId) return false;
                if (assignmentsMap.get(source.characterId)?.find(a => a.characterId === t.characterId)) return false;

                // Farm Constraint
                if (t.mainCharacterId) {
                    if (t.extraMarches !== undefined && t.extraMarches >= 0) {
                        const isOwnerAssigned = assignmentsMap.get(t.mainCharacterId)?.find(a => a.characterId === t.characterId);
                        const total = targetReinforcementCountMap.get(t.characterId) || 0;
                        const othersCount = total - (isOwnerAssigned ? 1 : 0);
                        if (othersCount >= t.extraMarches) return false;
                    }
                }

                // RESTRICTION: Offline Not Empty sources (and Unknown/Fallback) can ONLY target Offline Not Empty
                if (source.status === 'offline_not_empty' && t.status === 'offline_empty') {
                    return false;
                }

                return true;
            });

            if (validTargets.length === 0) {
                // console.log(`[Phase 2] No valid targets for ${source.characterId}`);
                continue;
            }

            // Sort by Count ASC, then Offline Empty Priority
            validTargets.sort((a, b) => {
                const countA = targetReinforcementCountMap.get(a.characterId) || 0;
                const countB = targetReinforcementCountMap.get(b.characterId) || 0;
                if (countA !== countB) return countA - countB;

                // Tie-Breaker: Prioritize Offline Empty
                const isAEmpty = a.status === 'offline_empty';
                const isBEmpty = b.status === 'offline_empty';
                if (isAEmpty && !isBEmpty) return -1;
                if (!isAEmpty && isBEmpty) return 1;
                return 0; // Random/Stable
            });

            // if (source.status === 'unknown') {
            //    console.log(`[Phase 2] Unknown source ${source.characterId} sees ${validTargets.length} targets. First: ${validTargets[0].characterId} (${validTargets[0].status})`);
            // }

            // Iterate through candidates until one works
            for (const target of validTargets) {
                if (assignWithCountUpdate(source.characterId, target.characterId)) {
                    offlineImprovementMade = true;
                    // if (source.status === 'unknown') console.log(`[Phase 2] Assigned Unknown ${source.characterId} -> ${target.characterId}`);
                    break; // Move to next source
                }
            }
        }
    }


    // --- PHASE 3: Online Sources Assignment ---
    // Sources: Online Sources
    // Targets Pool: Online Players + Offline Empty Players

    const onlineAndOfflineEmptyTargets = [...onlinePlayers, ...offlineEmptyPlayers];
    const availableOnlineSources = onlineSources.filter(s => (marchesRemainingMap.get(s.characterId) || 0) > 0);

    // Logic: Greedy Least-Reinforced
    let improvementMade = true;
    while (improvementMade) {
        improvementMade = false;

        // Randomize sources order per round
        availableOnlineSources.sort(() => 0.5 - Math.random());

        for (const source of availableOnlineSources) {
            if ((marchesRemainingMap.get(source.characterId) || 0) <= 0) continue;

            // 1. Identify target in pool with LOWEST reinforcement count
            const validTargets = onlineAndOfflineEmptyTargets.filter(t => {
                if (t.characterId === source.characterId) return false;
                if (assignmentsMap.get(source.characterId)?.find(a => a.characterId === t.characterId)) return false;

                // Farm Constraint Check
                if (t.mainCharacterId) {
                    if (t.extraMarches !== undefined && t.extraMarches >= 0) {
                        const isOwnerAssigned = assignmentsMap.get(t.mainCharacterId)?.find(a => a.characterId === t.characterId);
                        const total = targetReinforcementCountMap.get(t.characterId) || 0;
                        const othersCount = total - (isOwnerAssigned ? 1 : 0);
                        if (othersCount >= t.extraMarches) return false;
                    }
                }
                return true;
            });

            if (validTargets.length === 0) continue;

            // Sort by Count ASC, then Online Priority
            validTargets.sort((a, b) => {
                const countA = targetReinforcementCountMap.get(a.characterId) || 0;
                const countB = targetReinforcementCountMap.get(b.characterId) || 0;
                if (countA !== countB) return countA - countB;

                // Tie-Breaker: Prioritize Online
                const isAOnline = a.status === 'online';
                const isBOnline = b.status === 'online';
                if (isAOnline && !isBOnline) return -1;
                if (!isAOnline && isBOnline) return 1;
                return 0;
            });

            for (const target of validTargets) {
                if (assignWithCountUpdate(source.characterId, target.characterId)) {
                    improvementMade = true;
                    break;
                }
            }
        }
    }

    // --- PHASE 4: Offline Not Empty Reassignment (Final Cleanup) ---
    // Sources: ALL players with remaining marches (Online, Offline Empty, Offline Not Empty)
    // Targets: Offline Not Empty
    // Logic: Greedy Least-Reinforced.

    const offlineNotEmptyTargets = [...offlineNotEmptyPlayers];

    // Use ALL valid sources that have marches remaining EXCEPT online players
    // Excluding farms/unknown (already filtered in earlier lists or by check)
    // CHANGE: Online players are strictly forbidden from reinforcing Offline Not Empty.
    const allRemainingSources = workingCharacters.filter(s =>
        !isFarm(s) && s.status !== 'online' && (marchesRemainingMap.get(s.characterId) || 0) > 0
    );

    let phase4ImprovementMade = true;
    while (phase4ImprovementMade) {
        phase4ImprovementMade = false;

        allRemainingSources.sort(() => 0.5 - Math.random());

        for (const source of allRemainingSources) {
            if ((marchesRemainingMap.get(source.characterId) || 0) <= 0) continue;

            const validTargets = offlineNotEmptyTargets.filter(t => {
                if (t.characterId === source.characterId) return false;
                if (assignmentsMap.get(source.characterId)?.find(a => a.characterId === t.characterId)) return false;

                // Farm Constraint
                if (t.mainCharacterId) {
                    if (t.extraMarches !== undefined && t.extraMarches >= 0) {
                        const isOwnerAssigned = assignmentsMap.get(t.mainCharacterId)?.find(a => a.characterId === t.characterId);
                        const total = targetReinforcementCountMap.get(t.characterId) || 0;
                        const othersCount = total - (isOwnerAssigned ? 1 : 0);
                        if (othersCount >= t.extraMarches) return false;
                    }
                }
                return true;
            });

            if (validTargets.length === 0) continue;

            // Sort by Count ASC
            validTargets.sort((a, b) => {
                const countA = targetReinforcementCountMap.get(a.characterId) || 0;
                const countB = targetReinforcementCountMap.get(b.characterId) || 0;
                return countA - countB;
            });

            // Sort by Count ASC
            validTargets.sort((a, b) => {
                const countA = targetReinforcementCountMap.get(a.characterId) || 0;
                const countB = targetReinforcementCountMap.get(b.characterId) || 0;
                return countA - countB;
            });

            for (const target of validTargets) {
                if (assignWithCountUpdate(source.characterId, target.characterId)) {
                    // console.log(`Phase 4 Assigned ${source.characterId} to ${target.characterId}`);
                    phase4ImprovementMade = true;
                    break;
                }
            }
        }
    }

    // --- Convert to Output Format (Scores REMOVED) ---
    return workingCharacters.map(c => ({
        ...c,
        marchesCount: (c.marchesCount === 0) ? 6 : Math.max(1, Math.min(6, c.marchesCount)),
        // score: scoresMap.get(c.characterId) || 0, // removed
        reinforce: assignmentsMap.get(c.characterId) || []
    }));
}
