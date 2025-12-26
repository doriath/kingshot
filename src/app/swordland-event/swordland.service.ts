import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, query, where, addDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SwordlandParticipant {
    characterId: string;
    characterName: string;
    role: 'attacker' | 'defender' | 'unassigned';
    squadScore: number;
}

export interface SwordlandEvent {
    id?: string;
    allianceId: string;
    allianceName: string;
    server: number;
    legion: 1 | 2;
    date: any; // Timestamp
    participants: SwordlandParticipant[];
}

@Injectable({
    providedIn: 'root'
})
export class SwordlandService {
    private firestore = inject(Firestore);

    getActiveEvents(): Observable<SwordlandEvent[]> {
        const eventsCollection = collection(this.firestore, 'swordlandEvents');
        const q = query(eventsCollection);
        return (collectionData(q, { idField: 'id' }) as Observable<SwordlandEvent[]>).pipe(
            map(events => events.sort((a, b) => {
                const tA = a.date?.seconds || 0;
                const tB = b.date?.seconds || 0;
                return tA - tB;
            }))
        );
    }

    getEventById(id: string): Observable<SwordlandEvent | undefined> {
        const eventDoc = doc(this.firestore, `swordlandEvents/${id}`);
        return docData(eventDoc, { idField: 'id' }) as Observable<SwordlandEvent>;
    }

    getEventsByAlliance(allianceId: string): Observable<SwordlandEvent[]> {
        const eventsCollection = collection(this.firestore, 'swordlandEvents');
        const q = query(eventsCollection, where('allianceId', '==', allianceId));
        return (collectionData(q, { idField: 'id' }) as Observable<SwordlandEvent[]>).pipe(
            map(events => events.sort((a, b) => {
                const tA = a.date?.seconds || 0;
                const tB = b.date?.seconds || 0;
                return tA - tB;
            }))
        );
    }

    async createEvent(event: SwordlandEvent): Promise<string> {
        const eventsCollection = collection(this.firestore, 'swordlandEvents');
        const docRef = await addDoc(eventsCollection, event);
        return docRef.id;
    }

    async updateEventParticipants(eventId: string, participants: SwordlandParticipant[]): Promise<void> {
        const eventDoc = doc(this.firestore, `swordlandEvents/${eventId}`);
        await updateDoc(eventDoc, { participants });
    }

    async deleteEvent(eventId: string): Promise<void> {
        const eventDoc = doc(this.firestore, `swordlandEvents/${eventId}`);
        await deleteDoc(eventDoc);
    }
}
