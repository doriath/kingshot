import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, deleteDoc, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Character } from './user-data.service';

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private firestore = inject(Firestore);

    // Get all pending registrations
    getPendingRegistrations(): Observable<Character[]> {
        const registrationsRef = collection(this.firestore, 'character-registrations');
        return collectionData(registrationsRef, { idField: 'id' }) as Observable<Character[]>;
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
        const regDocRef = doc(this.firestore, `character-registrations/${registration.id}`);
        await deleteDoc(regDocRef);
    }

    // Reject a character: Delete from registrations
    async rejectCharacter(registration: Character) {
        const regDocRef = doc(this.firestore, `character-registrations/${registration.id}`);
        await deleteDoc(regDocRef);
    }
}
