import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, orderBy, limit, doc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CharacterAssignment {
    characterId: string;
    characterName: string; // Used for display of the character itself
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

    calculateAssignments(allCharacters: CharacterAssignment[]): CharacterAssignment[] {
        // Simple Random Assignment Logic
        return allCharacters.map(char => {
            // 1. Determine marches count
            let count = char.marchesCount;
            if (count === 0) {
                count = 6;
            } else {
                // Clamp between 1 and 6
                count = Math.max(1, Math.min(6, count));
            }

            // 2. Pick random targets (excluding self)
            const potentialTargets = allCharacters.filter(t => t.characterId !== char.characterId);
            const assignments: { characterId: string; marchType?: string }[] = [];

            // Allow duplicates? Usually reinforcement is unique target per march? 
            // Assuming unique targets for now as it makes more sense for "reinforcing different players".
            // If count > potentialTargets.length, we can only assign to all available.

            const shuffled = [...potentialTargets].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, count);

            assignments.push(...selected.map(t => ({
                characterId: t.characterId
                // marchType: undefined for now
            })));

            return {
                ...char,
                reinforce: assignments
            };
        });
    }

    async updateEventCharacters(eventId: string, characters: CharacterAssignment[]): Promise<void> {
        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        await import('@angular/fire/firestore').then(mod => mod.updateDoc(docRef, { characters }));
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
