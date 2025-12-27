import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, deleteDoc, collectionData } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs'; // Fix import: map is in rxjs usually, or operators
import { map as rxjsMap } from 'rxjs/operators'; // wait, angular fire usually works with rxjs.
import { Character } from './user-data.service';

// Actually, "map" operator is piped.
// Standard import: import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private firestore = inject(Firestore);

    // Get all pending registrations
    getPendingRegistrations(): Observable<Character[]> {
        const registrationsRef = collection(this.firestore, 'characterRegistrations');
        return collectionData(registrationsRef, { idField: 'id' }).pipe(
            rxjsMap((chars: any[]) => chars.map((c: any) => ({
                ...c,
                id: Number(c['id']),
                server: c['server'] ? Number(c['server']) : undefined
            } as Character)))
        );
    }

    // Approve a character: Move from registrations to characters
    async approveCharacter(registration: Character) {
        // 1. Create in characters collection (verified: true)
        const charDocRef = doc(this.firestore, `characters/${registration.id}`);
        const verifiedCharacter: Character = {
            ...registration,
        };
        await setDoc(charDocRef, verifiedCharacter);

        // 2. Delete from registrations
        const regDocRef = doc(this.firestore, `characterRegistrations/${registration.id}`);
        await deleteDoc(regDocRef);
    }

    // Reject a character: Delete from registrations
    async rejectCharacter(registration: Character) {
        const regDocRef = doc(this.firestore, `characterRegistrations/${registration.id}`);
        await deleteDoc(regDocRef);
    }
}
