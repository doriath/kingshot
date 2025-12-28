import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, doc, docData, setDoc, addDoc, deleteDoc, updateDoc } from '@angular/fire/firestore';
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
    admins?: string[]; // List of user IDs who can manage this event
    assignments?: {
        [boostType: string]: { // 'construction' | 'research' | 'troops'
            [slotTime: string]: string // characterId - Only 1 per slot
        }
    };
}

export interface SvSPrepRegistration {
    id?: string;
    eventId: string;
    userId: string;
    characterId: string; // Required for key
    characterName?: string; // For display
    characterVerified?: boolean; // Whether the character is verified
    isManual?: boolean; // If true, created manually by admin
    backpackImages?: string[]; // URLs of uploaded backpack screenshots

    // User preferences
    preferences: {
        boostType: BoostType;
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

    async updateEvent(id: string, data: Partial<SvSPrepEvent>): Promise<void> {
        const docRef = doc(this.firestore, `svsPrepEvents/${id}`);
        await updateDoc(docRef, data);
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
        // Deterministic ID: eventId_characterId
        if (!registration.characterId) throw new Error('Character ID required');
        const docId = `${registration.eventId}_${registration.characterId}`;
        const docRef = doc(this.firestore, `svsPrepRegistrations/${docId}`);
        const data = {
            ...registration,
            updatedAt: new Date()
        };
        await setDoc(docRef, data, { merge: true });
    }

    async deleteRegistration(eventId: string, characterId: string): Promise<void> {
        const docId = `${eventId}_${characterId}`;
        const docRef = doc(this.firestore, `svsPrepRegistrations/${docId}`);
        await deleteDoc(docRef);
    }

    // New plural method
    getUserRegistrations(eventId: string, userId: string): Observable<SvSPrepRegistration[]> {
        const regsCollection = collection(this.firestore, 'svsPrepRegistrations');
        const q = query(
            regsCollection,
            where('eventId', '==', eventId),
            where('userId', '==', userId)
        );
        return collectionData(q, { idField: 'id' }) as Observable<SvSPrepRegistration[]>;
    }

    // Kept for compatibility if needed, using generic ID assumption might break if we change key
    // But getUserRegistration(eventId, userId) is now ambiguous if a user has multiple characters. 
    // We should probably deprecate or update it to fetch ONE registration or return null.
    // Let's assume for now we use the plural method primarily.
    getUserRegistration(eventId: string, userId: string): Observable<SvSPrepRegistration | undefined> {
        // This old method assumed 1 reg per user. With multi-char, this ID schema eventId_userId is invalid.
        // We will return undefined or the first found via query if we wanted to support old logic, 
        // but better to switch consumers to getUserRegistrations.
        // For partial backward compat during migration (if any), we leave it or better:
        return new Observable(obs => obs.next(undefined));
    }

    getEventRegistrations(eventId: string): Observable<SvSPrepRegistration[]> {
        const regsCollection = collection(this.firestore, 'svsPrepRegistrations');
        const q = query(regsCollection, where('eventId', '==', eventId));
        return collectionData(q, { idField: 'id' }) as Observable<SvSPrepRegistration[]>;
    }
}
