import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, orderBy, limit, doc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type VikingsStatus = 'online' | 'offline_empty' | 'offline_not_empty';

export interface CharacterAssignment {
    characterId: string;
    characterName: string;
    mainCharacterId?: string;
    reinforcementCapacity?: number;
    extraMarches?: number;
    powerLevel: number;
    marchesCount: number;
    status: VikingsStatus | 'unknown';
    reinforce: {
        characterId: string;
        marchType?: string;
        scoreValue?: number; // Score for this specific reinforcement
    }[];
    score?: number; // Total score
}

export interface CharacterAssignmentView extends Omit<CharacterAssignment, 'reinforce'> {
    reinforce: {
        characterId: string;
        characterName: string;
        powerLevel?: number;
        marchType?: string;
        scoreValue?: number;
    }[];
    score?: number;
}


export interface VikingsEvent {
    id?: string;
    allianceId: string;
    allianceTag?: string; // Optional for now to support old data if any
    server: number;
    date: any; // Timestamp
    status: 'voting' | 'finalized' | 'past';
    characters: CharacterAssignment[];
}

export interface VikingsEventView extends Omit<VikingsEvent, 'characters'> {
    characters: CharacterAssignmentView[];
}

export interface VikingsRegistration {
    id?: string;
    eventId: string;
    characterId: string;
    userId: string;
    status: VikingsStatus;
    marchesCount: number;
    verified?: boolean; // Snapshot of verification status at time of registration
    updatedAt?: any; // Timestamp
}

@Injectable({
    providedIn: 'root'
})
export class VikingsService {
    private firestore = inject(Firestore);

    getAllVikingsEvents(): Observable<VikingsEvent[]> {
        const eventsCollection = collection(this.firestore, 'vikingsEvents');
        const q = query(eventsCollection);
        return (collectionData(q, { idField: 'id' }) as Observable<VikingsEvent[]>).pipe(
            map(events => events.sort((a, b) => {
                const tA = a.date?.seconds || 0;
                const tB = b.date?.seconds || 0;
                return tA - tB;
            }))
        );
    }

    getVikingsEventById(id: string): Observable<VikingsEventView | null> {
        const eventDoc = doc(this.firestore, `vikingsEvents/${id}`);
        return docData(eventDoc, { idField: 'id' }).pipe(
            map(event => event ? this.transformEventToView(event as VikingsEvent) : null)
        );
    }

    // specific method for backwards compatibility or specific query if needed
    getVikingsEvent(allianceId: string): Observable<VikingsEventView[]> {
        const eventsCollection = collection(this.firestore, 'vikingsEvents');
        const q = query(
            eventsCollection,
            where('allianceId', '==', allianceId)
        );
        return (collectionData(q, { idField: 'id' }) as Observable<VikingsEvent[]>).pipe(
            map(events => events
                .map(event => this.transformEventToView(event))
                .sort((a, b) => {
                    const tA = a.date?.seconds || 0;
                    const tB = b.date?.seconds || 0;
                    return tA - tB;
                })
            )
        );
    }

    // Registrations

    getUserRegistrations(eventId: string, userId: string): Observable<VikingsRegistration[]> {
        const regsCollection = collection(this.firestore, 'vikingsRegistrations');
        const q = query(
            regsCollection,
            where('eventId', '==', eventId),
            where('userId', '==', userId)
        );
        return collectionData(q, { idField: 'id' }) as Observable<VikingsRegistration[]>;
    }

    async saveRegistration(registration: VikingsRegistration): Promise<void> {
        // Use a deterministic ID so we don't create duplicates: eventId_characterId
        const docId = `${registration.eventId}_${registration.characterId}`;
        const regDoc = doc(this.firestore, `vikingsRegistrations/${docId}`);
        // data to save
        const data = {
            ...registration,
            updatedAt: new Date()
        };
        await import('@angular/fire/firestore').then(mod => mod.setDoc(regDoc, data, { merge: true }));
    }

    async createVikingsEvent(alliance: any, date: Date): Promise<void> {
        // Need to import Alliance interface properly if we want strict typing, 
        // but for now relying on the structure being passed.
        // Mapped from AllianceMember to CharacterAssignment
        const characters: CharacterAssignment[] = (alliance.members || []).map((m: any) => ({
            characterId: m.characterId,
            characterName: m.name,
            mainCharacterId: m.mainCharacterId, // Copy from alliance member
            reinforcementCapacity: m.reinforcementCapacity,
            powerLevel: m.power,
            marchesCount: 0, // Default to 0, user will register explicit count
            status: 'unknown',
            reinforce: []
        }));

        const event: VikingsEvent = {
            allianceId: alliance.uuid,
            allianceTag: alliance.tag,
            server: alliance.server,
            date: date,
            status: 'voting',
            characters: characters
        };

        const eventsCollection = collection(this.firestore, 'vikingsEvents');
        await import('@angular/fire/firestore').then(mod => mod.addDoc(eventsCollection, event));
    }

    async deleteVikingsEvent(eventId: string): Promise<void> {
        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        await import('@angular/fire/firestore').then(mod => mod.deleteDoc(docRef));
    }

    async finalizeEvent(eventId: string): Promise<void> {
        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        const firestore = await import('@angular/fire/firestore');
        const snap = await firestore.getDoc(docRef);

        if (!snap.exists()) {
            throw new Error('Event not found');
        }

        const event = snap.data() as VikingsEvent;
        const allCharacters = event.characters || [];

        const updatedCharacters = this.calculateAssignments(allCharacters);

        await firestore.updateDoc(docRef, {
            status: 'finalized',
            characters: updatedCharacters
        });
    }

    async simulateAssignments(eventId: string): Promise<void> {
        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        const firestore = await import('@angular/fire/firestore');
        const snap = await firestore.getDoc(docRef);

        if (!snap.exists()) {
            throw new Error('Event not found');
        }

        const event = snap.data() as VikingsEvent;
        const allCharacters = event.characters || [];

        const updatedCharacters = this.calculateAssignments(allCharacters);

        await firestore.updateDoc(docRef, {
            // status remains unchanged (e.g., 'voting')
            characters: updatedCharacters
        });
    }

    calculateAssignments(allCharacters: CharacterAssignment[]): CharacterAssignment[] {
        // --- Setup and Helper structures ---

        // Clone characters to work with
        const workingCharacters = allCharacters.map(c => ({ ...c }));

        // Map to track assignments: targetId -> list of sourceIds
        const assignmentsMap = new Map<string, { characterId: string; marchType?: string; scoreValue?: number }[]>();

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
            if (c.status === 'unknown' || c.mainCharacterId) {
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
            } else if (c.status === 'offline_not_empty') {
                offlineNotEmptyPlayers.push(c);
            }
            // 'unknown' are ignored or just left out of these lists (but in workingCharacters)
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
        const isUnknown = (c: CharacterAssignment) => c.status === 'unknown';

        const onlineSources = onlinePlayers.filter(c => !isFarm(c));
        const offlineSources = [...offlineEmptyPlayers, ...offlineNotEmptyPlayers].filter(c => !isFarm(c) && !isUnknown(c));

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
        // Sources: Offline Sources (Empty + Not Empty - Farms/NA/Unknown)
        // Targets: Offline Empty + Offline Not Empty
        // Logic: Greedy Least-Reinforced. Tie-breaker: Offline Empty.

        const offlineTargets = [...offlineEmptyPlayers, ...offlineNotEmptyPlayers];
        const availableOfflineSources = offlineSources.filter(s => (marchesRemainingMap.get(s.characterId) || 0) > 0);

        let offlineImprovementMade = true;
        while (offlineImprovementMade) {
            offlineImprovementMade = false;

            // Randomize sources
            availableOfflineSources.sort(() => 0.5 - Math.random());

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
                    return true;
                });

                if (validTargets.length === 0) continue;

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

                const bestTarget = validTargets[0];
                if (assignWithCountUpdate(source.characterId, bestTarget.characterId)) {
                    offlineImprovementMade = true;
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

                const bestTarget = validTargets[0];
                if (assignWithCountUpdate(source.characterId, bestTarget.characterId)) {
                    improvementMade = true;
                }
            }
        }

        // --- PHASE 4: Offline Not Empty Reassignment (Final Cleanup) ---
        // Sources: ALL players with remaining marches (Online, Offline Empty, Offline Not Empty)
        // Targets: Offline Not Empty
        // Logic: Greedy Least-Reinforced.

        const offlineNotEmptyTargets = [...offlineNotEmptyPlayers];

        // Use ALL valid sources that have marches remaining
        // Excluding farms/unknown (already filtered in earlier lists or by check)
        const allRemainingSources = workingCharacters.filter(s =>
            !isFarm(s) && !isUnknown(s) && (marchesRemainingMap.get(s.characterId) || 0) > 0
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

                if (assignWithCountUpdate(source.characterId, validTargets[0].characterId)) {
                    phase4ImprovementMade = true;
                }
            }
        }


        // --- Score Calculation ---
        // Formula Updates:
        // Online: 1.3 / Count
        // Offline Empty: 1.0 / Count
        // Offline Not Empty: 1.0 / (4 + Count)

        // 1. Calculate incoming counts
        const finalIncomingCounts = new Map<string, number>();
        assignmentsMap.forEach((targets, sourceId) => {
            targets.forEach(t => {
                finalIncomingCounts.set(t.characterId, (finalIncomingCounts.get(t.characterId) || 0) + 1);
            });
        });

        // 2. Compute Scores
        const scoresMap = new Map<string, number>();

        // Helper to find target status efficiently
        const charMap = new Map(workingCharacters.map(c => [c.characterId, c]));

        assignmentsMap.forEach((targets, sourceId) => {
            let totalScore = 0;
            targets.forEach(t => {
                const count = finalIncomingCounts.get(t.characterId) || 1;
                const targetChar = charMap.get(t.characterId);
                let value = 0;

                if (targetChar) {
                    if (targetChar.status === 'online') {
                        value = 1.3 / count;
                    } else if (targetChar.status === 'offline_empty') {
                        value = 1.0 / count;
                    } else {
                        // Offline Not Empty
                        value = 1.0 / (4 + count);
                    }
                }

                t.scoreValue = value; // Store on the assignment object
                totalScore += value;
            });
            scoresMap.set(sourceId, totalScore);
        });

        // --- Convert to Output Format ---
        return workingCharacters.map(c => ({
            ...c,
            marchesCount: (c.marchesCount === 0) ? 6 : Math.max(1, Math.min(6, c.marchesCount)),
            score: scoresMap.get(c.characterId) || 0,
            reinforce: assignmentsMap.get(c.characterId) || []
        }));
    }

    async updateEventCharacters(eventId: string, characters: CharacterAssignment[]): Promise<void> {
        // Sanitize data before saving to avoid "undefined" errors and remove View-only fields
        const safeCharacters = characters.map(c => {
            const safeC: any = { ...c };
            // Ensure status/counts are preserved? Yes, they are part of c.

            // Sanitize reinforce array
            if (safeC.reinforce) {
                safeC.reinforce = safeC.reinforce.map((r: any) => {
                    const safeR: any = { characterId: r.characterId };
                    if (r.marchType) {
                        safeR.marchType = r.marchType;
                    }
                    if (r.scoreValue !== undefined) {
                        safeR.scoreValue = r.scoreValue;
                    }
                    return safeR;
                });
            }
            // Preserve new fields
            if (safeC.mainCharacterId !== undefined) safeC.mainCharacterId = safeC.mainCharacterId;
            if (safeC.reinforcementCapacity !== undefined) safeC.reinforcementCapacity = safeC.reinforcementCapacity;
            if (safeC.extraMarches !== undefined) safeC.extraMarches = safeC.extraMarches;

            // Remove any undefined keys to satisfy Firestore
            Object.keys(safeC).forEach(key => (safeC as any)[key] === undefined && delete (safeC as any)[key]);

            return safeC as CharacterAssignment;
        });

        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        await import('@angular/fire/firestore').then(mod => mod.updateDoc(docRef, { characters: safeCharacters }));
    }

    getEventRegistrations(eventId: string): Observable<VikingsRegistration[]> {
        const regsCollection = collection(this.firestore, 'vikingsRegistrations');
        const q = query(regsCollection, where('eventId', '==', eventId));
        return collectionData(q, { idField: 'id' }) as Observable<VikingsRegistration[]>;
    }

    private transformEventToView(event: VikingsEvent): VikingsEventView {
        const characterMap = new Map<string, CharacterAssignment>();
        if (event.characters) {
            event.characters.forEach(c => characterMap.set(c.characterId, c));
        }

        return {
            ...event,
            characters: (event.characters || []).map(c => ({
                ...c,
                reinforce: (c.reinforce || []).map(r => {
                    const target = characterMap.get(r.characterId);
                    return {
                        characterId: r.characterId,
                        marchType: r.marchType,
                        scoreValue: r.scoreValue, // Propagate scoreValue
                        characterName: target?.characterName || 'Unknown',
                        powerLevel: target?.powerLevel
                    };
                })
            }))
        };
    }
}
