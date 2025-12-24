import { Injectable, inject, signal, effect, computed } from '@angular/core';
import { Firestore, collection, doc, setDoc, deleteDoc, query, where, collectionData, updateDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { filter, switchMap, map, combineLatestWith } from 'rxjs/operators';
import { of, Observable, combineLatest, firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { StorageService } from './storage.service';

export interface Character {
    id: string;
    userId: string;
    verificationCode: string;
    name?: string;
    server?: string;
    alliance?: string;
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
    private storageService = inject(StorageService);

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

    private activeCharacterIdSignal = signal<string | null>(this.storageService.getItem('activeCharacterId'));
    public activeCharacterId = this.activeCharacterIdSignal.asReadonly();

    public activeCharacter = computed(() => {
        const id = this.activeCharacterId();
        const chars = this.characters();
        if (!id) return null;
        return chars.find(c => c.id === id) || null;
    });

    constructor() {
        // Auto-select active character if user has only 1 verified character
        effect(() => {
            const chars = this.characters();
            const verifiedChars = chars.filter(c => c.verified);
            const currentActiveId = this.activeCharacterId();

            if (verifiedChars.length === 1 && currentActiveId !== verifiedChars[0].id) {
                this.setActiveCharacter(verifiedChars[0].id);
            } else if (verifiedChars.length > 0 && currentActiveId && !verifiedChars.find(c => c.id === currentActiveId)) {
                // If the currently active character is no longer in the list (e.g. deleted), unset it ??
                // Or maybe just keep it, but it won't resolve.
                // Let's safe guard: if active character is not found in the verified list, try to pick one?
                // For now, let's just leave it, maybe the list hasn't loaded fully yet.
            }
        });
    }

    setActiveCharacter(id: string) {
        this.activeCharacterIdSignal.set(id);
        this.storageService.setItem('activeCharacterId', id);
    }

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

        if (this.activeCharacterId() === character.id) {
            this.activeCharacterIdSignal.set(null);
            this.storageService.setItem('activeCharacterId', null);
        }
    }

    async updateCharacterDetails(characterId: string, data: Partial<Character>) {
        const charRef = doc(this.firestore, `characters/${characterId}`);
        await updateDoc(charRef, data);
    }
}
