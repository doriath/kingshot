import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, orderBy, limit, doc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CharacterAssignment {
    characterId: string;
    characterName: string; // Used for display of the character itself
    mainCharacterId?: string; // If set, this is a farm account
    reinforcementCapacity?: number; // Capacity for reinforcements
    extraMarches?: number; // Extra marches to reinforce this character (if farm)
    powerLevel: number;
    marchesCount: number;
    status: 'online' | 'offline_empty' | 'not_available' | 'unknown';
    reinforce: {
        characterId: string;
        marchType?: string;
    }[];
}

export interface CharacterAssignmentView extends Omit<CharacterAssignment, 'reinforce'> {
    reinforce: {
        characterId: string;
        characterName: string;
        powerLevel?: number;
        marchType?: string;
    }[];
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
    status: 'online' | 'offline_empty' | 'not_available';
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
        // 0. Setup and Helper structures
        const REINFORCE_SIZE = 2; // Parameter for future

        // Clone and initialize helpers
        const assignmentsMap = new Map<string, { characterId: string; marchType?: string }[]>();
        const marchesRemainingMap = new Map<string, number>();

        // Separating lists
        const onlineChars: CharacterAssignment[] = [];
        const offlineEmptyChars: CharacterAssignment[] = [];
        const notAvailableChars: CharacterAssignment[] = [];

        allCharacters.forEach(c => {
            assignmentsMap.set(c.characterId, []);

            // Clamp marches count
            let count = c.marchesCount;
            if (count === 0) count = 6;
            count = Math.max(1, Math.min(6, count));
            marchesRemainingMap.set(c.characterId, count);

            if (c.status === 'online') {
                onlineChars.push(c);
            } else if (c.status === 'offline_empty') {
                offlineEmptyChars.push(c);
            } else {
                notAvailableChars.push(c); // Includes 'not_available' and 'unknown' treated as such
            }
        });

        // Helper to assign MARCH
        const assign = (sourceId: string, targetId: string) => {
            const currentAssignments = assignmentsMap.get(sourceId) || [];
            if (sourceId === targetId) return false; // meaningful self-check
            // Check if already assigned
            if (currentAssignments.find(a => a.characterId === targetId)) return false;

            currentAssignments.push({ characterId: targetId });
            assignmentsMap.set(sourceId, currentAssignments);

            const currentRem = marchesRemainingMap.get(sourceId) || 0;
            marchesRemainingMap.set(sourceId, currentRem - 1);
            return true;
        };

        // Helper to get available sources from a list
        const getAvailableSources = (list: CharacterAssignment[]) => {
            return list.filter(c => (marchesRemainingMap.get(c.characterId) || 0) > 0);
        };

        // --- PHASE 1: Online -> Online (Reinforce Size = 2) ---
        // We want every online player to be reinforced by 2 OTHER online players.
        // We iterate targets, and pick sources.

        // Randomize lists to avoid deterministic bias
        const shuffledOnline = [...onlineChars].sort(() => 0.5 - Math.random());

        for (const target of shuffledOnline) {
            let reinforcementsNeeded = REINFORCE_SIZE;

            // In case validation/re-run, check if already reinforced? 
            // Currently we start fresh so existing reinforcements are 0.
            // We need to count how many online players have reinforced THIS target.
            // But simpler: just loop and try to assign.

            // We need to find sources.
            // To ensure max points, we should try to use all online players as sources evenly?
            // Or simply greedily satisfy needs.

            let attempts = 0;
            while (reinforcementsNeeded > 0 && attempts < shuffledOnline.length * 2) {
                attempts++;
                // Pick a source that is NOT the target and has marches
                const potentialSources = getAvailableSources(shuffledOnline)
                    .filter(s => s.characterId !== target.characterId);

                // Filter out those who already assigned to this target? `assign` helper handles it but better to filter early for performance?
                // `assign` handles duplicate check.

                if (potentialSources.length === 0) break;

                // Heuristic: Pick source with MOST marches remaining to balance? 
                // Or random. Let's pick random to distribute load.
                const source = potentialSources[Math.floor(Math.random() * potentialSources.length)];

                if (assign(source.characterId, target.characterId)) {
                    reinforcementsNeeded--;
                }
            }
        }

        // --- PHASE 2: Remaining Online -> Offline Empty ---
        const offlineTargets = [...offlineEmptyChars].sort(() => 0.5 - Math.random());
        if (offlineTargets.length > 0) {
            let targetIdx = 0;
            const remainingOnlineSources = getAvailableSources(onlineChars);

            for (const source of remainingOnlineSources) {
                while ((marchesRemainingMap.get(source.characterId) || 0) > 0) {
                    // Try to assign to next offline target
                    // Loop through targets to find valid one (not self - impossible here as groups disjoint, not duplicate)
                    let forcedBreak = 0;
                    while (true) {
                        const target = offlineTargets[targetIdx];
                        // Increment idx for next time (round robin)
                        targetIdx = (targetIdx + 1) % offlineTargets.length;

                        if (assign(source.characterId, target.characterId)) {
                            break;
                        }

                        forcedBreak++;
                        if (forcedBreak > offlineTargets.length) break; // Should not happen given disjoint sets
                    }
                    if (forcedBreak > offlineTargets.length) break;
                }
            }
        }

        // --- PHASE 3: Offline Empty (First 3) -> Offline Empty ---
        // For each offline empty source, reserve up to 3 marches for other offline empty.

        for (const source of offlineEmptyChars) {
            let marchesForOffline = 3;
            const currentTotal = marchesRemainingMap.get(source.characterId) || 0;
            // If has less than 3, all go to offline.
            // If has more, top 3 go to offline.

            const marchesToAssign = Math.min(marchesForOffline, currentTotal);

            if (offlineTargets.length > 1) { // Need at least another offline player
                // Filter out self and shuffle to ensure random distribution validation
                const validTargets = offlineTargets.filter(t => t.characterId !== source.characterId);
                const localShuffled = [...validTargets].sort(() => 0.5 - Math.random());

                let assignedCount = 0;
                for (const target of localShuffled) {
                    if (assignedCount >= marchesToAssign) break;

                    if (assign(source.characterId, target.characterId)) {
                        assignedCount++;
                    }
                }
            }
        }

        // --- PHASE 4: Offline Empty (Remaining) -> Not Available ---
        const notAvailableTargets = [...notAvailableChars].sort(() => 0.5 - Math.random());

        if (notAvailableTargets.length > 0) {
            const remainingOfflineSources = getAvailableSources(offlineEmptyChars);
            let targetIdx = 0;
            for (const source of remainingOfflineSources) {
                while ((marchesRemainingMap.get(source.characterId) || 0) > 0) {
                    let forcedBreak = 0;
                    while (true) {
                        const target = notAvailableTargets[targetIdx];
                        targetIdx = (targetIdx + 1) % notAvailableTargets.length;
                        if (assign(source.characterId, target.characterId)) break;
                        forcedBreak++;
                        if (forcedBreak > notAvailableTargets.length) break;
                    }
                    if (forcedBreak > notAvailableTargets.length) break;
                }
            }
        }

        // --- PHASE 5: Not Available -> Not Available ---
        // Assign all marches of NA sources to NA targets
        if (notAvailableTargets.length > 1) { // Need targets
            const naSources = getAvailableSources(notAvailableChars);
            let targetIdx = 0;
            for (const source of naSources) {
                while ((marchesRemainingMap.get(source.characterId) || 0) > 0) {
                    let forcedBreak = 0;
                    while (true) {
                        const target = notAvailableTargets[targetIdx];
                        targetIdx = (targetIdx + 1) % notAvailableTargets.length;
                        if (assign(source.characterId, target.characterId)) break;
                        forcedBreak++;
                        if (forcedBreak > notAvailableTargets.length) break;
                    }
                    if (forcedBreak > notAvailableTargets.length) break;
                }
            }
        }

        // Reconstruct result
        return allCharacters.map(c => ({
            ...c,
            marchesCount: (c.marchesCount === 0) ? 6 : Math.max(1, Math.min(6, c.marchesCount)), // Update original count logic to matches what we used? Or strictly keep input? 
            // The previous logic normalized marchesCount in the output return. Let's do that too for consistency.
            // Though my map logic used clamped values.
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
                        characterName: target?.characterName || 'Unknown',
                        powerLevel: target?.powerLevel
                    };
                })
            }))
        };
    }
}
