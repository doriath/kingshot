import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, doc, docData, setDoc, addDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs'; // Removed 'from', not used yet
import { map } from 'rxjs/operators';

export type BoostType = 'construction' | 'research' | 'troops';

// The day of week each boost is active. 
// "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface SvSPrepEvent {
    id?: string;
    server: number;
    // The main battle date (Saturday). 
    // We treat this as the anchor. Boosts happen in the week LEADING up to this date.
    date: any; // Timestamp

    // Configuration for which boost happens on which day
    // e.g. constructionDay: 'monday'
    constructionDay: DayOfWeek;
    researchDay: DayOfWeek;
    troopsDay: DayOfWeek;
}

export interface SvSPrepRegistration {
    id?: string;
    eventId: string;
    userId: string;
    characterId?: string; // Optional if we link by userId, but good to have
    characterName?: string; // For display

    // User preferences
    // We can store a list of requested slots.
    // Each slot could be represented as a start time ISO string or a simplified 'Day-Hour-Minute' token.
    // Let's use a structured approach:
    preferences: {
        boostType: BoostType;
        // Array of 30-min slot start times (in UTC).
        // e.g. ["2024-05-20T13:00:00Z", "2024-05-20T13:30:00Z"]
        // Or maybe just storing the chosen slots as strings is enough 
        // if we validate them against the Event's configured days.
        slots: string[];
    }[];

    updatedAt: any;
}

@Injectable({
    providedIn: 'root'
})
export class SvSPrepService {
    private firestore = inject(Firestore);

    // --- Admin / Event Management ---

    async createEvent(event: SvSPrepEvent): Promise<void> {
        const eventsCollection = collection(this.firestore, 'svsPrepEvents');
        await addDoc(eventsCollection, event);
    }

    getEvents(server?: number): Observable<SvSPrepEvent[]> {
        const eventsCollection = collection(this.firestore, 'svsPrepEvents');
        let q = query(eventsCollection);
        if (server) {
            q = query(eventsCollection, where('server', '==', server));
        }

        // Return sorted by date descending ideally, but client sort is fine for now
        return (collectionData(q, { idField: 'id' }) as Observable<SvSPrepEvent[]>).pipe(
            map(events => events.sort((a, b) => {
                const tA = a.date?.seconds || 0;
                const tB = b.date?.seconds || 0;
                return tB - tA; // Descending
            }))
        );
    }

    getEventById(id: string): Observable<SvSPrepEvent | undefined> {
        const docRef = doc(this.firestore, `svsPrepEvents/${id}`);
        return docData(docRef, { idField: 'id' }) as Observable<SvSPrepEvent | undefined>;
    }

    // --- Registration / User ---

    async saveRegistration(registration: SvSPrepRegistration): Promise<void> {
        // Deterministic ID: eventId_userId
        const docId = `${registration.eventId}_${registration.userId}`;
        const docRef = doc(this.firestore, `svsPrepRegistrations/${docId}`);
        const data = {
            ...registration,
            updatedAt: new Date()
        };
        await setDoc(docRef, data, { merge: true });
    }

    getUserRegistration(eventId: string, userId: string): Observable<SvSPrepRegistration | undefined> {
        const docRef = doc(this.firestore, `svsPrepRegistrations/${eventId}_${userId}`);
        return docData(docRef, { idField: 'id' }) as Observable<SvSPrepRegistration | undefined>;
    }

    getEventRegistrations(eventId: string): Observable<SvSPrepRegistration[]> {
        const regsCollection = collection(this.firestore, 'svsPrepRegistrations');
        const q = query(regsCollection, where('eventId', '==', eventId));
        return collectionData(q, { idField: 'id' }) as Observable<SvSPrepRegistration[]>;
    }
}
