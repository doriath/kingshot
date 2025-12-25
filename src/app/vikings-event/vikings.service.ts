import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, orderBy, limit, doc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CharacterAssignment {
    characterId: string;
    characterName: string; // Used for display of the character itself
    powerLevel: number;
    marchesCount: number;
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

@Injectable({
    providedIn: 'root'
})
export class VikingsService {
    private firestore = inject(Firestore);

    getAllVikingsEvents(): Observable<VikingsEvent[]> {
        const eventsCollection = collection(this.firestore, 'vikingsEvents');
        const q = query(eventsCollection, orderBy('date', 'desc'));
        return collectionData(q, { idField: 'id' }) as Observable<VikingsEvent[]>;
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
            where('allianceId', '==', allianceId),
            orderBy('date', 'desc'),
            limit(1)
        );
        return (collectionData(q, { idField: 'id' }) as Observable<VikingsEvent[]>).pipe(
            map(events => events.map(event => this.transformEventToView(event)))
        );
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
