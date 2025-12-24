import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, doc, setDoc, deleteDoc, query, where, collectionData } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { filter, switchMap, map, combineLatestWith } from 'rxjs/operators';
import { of, Observable, combineLatest, firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

export interface Character {
    id: string;
    userId: string;
    verificationCode: string;
}

export interface CharacterUI extends Character {
    verified: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class UserDataService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);

    // Observable of the current user's characters (both pending and verified)
    private characters$ = this.authService.user$.pipe(
        switchMap(user => {
            if (!user) {
                return of([]);
            }

            // Query verified characters
            const charactersRef = collection(this.firestore, 'characters');
            const verifiedQuery = query(charactersRef, where('userId', '==', user.uid));
            const verified$ = collectionData(verifiedQuery, { idField: 'id' }) as Observable<Character[]>;

            // Query pending registrations
            const registrationsRef = collection(this.firestore, 'characterRegistrations');
            const registrationsQuery = query(registrationsRef, where('userId', '==', user.uid));
            const registrations$ = collectionData(registrationsQuery, { idField: 'id' }) as Observable<Character[]>;

            return combineLatest([verified$, registrations$]).pipe(
                map(([verified, registrations]) => {
                    // Mark registrations as not verified
                    const pending: CharacterUI[] = registrations.map(r => ({ ...r, verified: false }));
                    // Verified ones should be verified: true
                    const confirmed: CharacterUI[] = verified.map(c => ({ ...c, verified: true }));
                    return [...confirmed, ...pending];
                })
            );
        })
    );

    public characters = toSignal(this.characters$, { initialValue: [] });

    async addCharacter(characterId: string) {
        const user = await firstValueFrom(this.authService.user$.pipe(filter(u => !!u)));
        if (!user) throw new Error('User not logged in');

        const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newRegistration: Character = {
            id: characterId,
            userId: user.uid,
            verificationCode,
        };

        // Add to character-registrations
        const regDocRef = doc(this.firestore, `characterRegistrations/${characterId}`);
        await setDoc(regDocRef, newRegistration);
    }

    async removeCharacter(character: CharacterUI) {
        const user = await firstValueFrom(this.authService.user$.pipe(filter(u => !!u)));
        if (!user) throw new Error('User not logged in');

        if (character.userId !== user.uid) {
            throw new Error('Cannot remove character that does not belong to you');
        }

        const collectionName = character.verified ? 'characters' : 'characterRegistrations';
        const charDocRef = doc(this.firestore, `${collectionName}/${character.id}`);
        await deleteDoc(charDocRef);
    }
}
