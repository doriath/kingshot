import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, deleteDoc, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Character } from './user-data.service';
import { DocumentData } from '@angular/fire/firestore';

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private firestore = inject(Firestore);

    // Get all pending registrations
    getPendingRegistrations(): Observable<Character[]> {
        const registrationsRef = collection(this.firestore, 'characterRegistrations');
        return collectionData(registrationsRef, { idField: 'id' }).pipe(
            map((chars: DocumentData[]) => chars.map((c: DocumentData) => {
                const char: Character = {
                    ...c as Character,
                    id: Number(c['id']),
                };
                if (c['server']) {
                    char.server = Number(c['server']);
                } else {
                    delete char.server; // Ensure it's removed if ...c included it as null/undefined
                }
                return char;
            }))
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
