import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, addDoc, deleteDoc, setDoc, updateDoc, query, where, DocumentReference } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { Space, Rally, Enemy } from './castle-event.models';

@Injectable({
    providedIn: 'root'
})
export class CastleEventService {
    private firestore = inject(Firestore);

    getSpaces(): Observable<Space[]> {
        const spacesCollection = collection(this.firestore, 'spaces');
        return collectionData(spacesCollection, { idField: 'id' }) as Observable<Space[]>;
    }

    getSpace(id: string): Observable<Space | undefined> {
        const spaceDoc = doc(this.firestore, `spaces/${id}`);
        return docData(spaceDoc, { idField: 'id' }) as Observable<Space | undefined>;
    }

    createSpace(name: string, userId: string): Promise<void> {
        const spacesCollection = collection(this.firestore, 'spaces');
        // We use addDoc to generate an ID, but we want to set the ID in the doc if needed, 
        // or just rely on Firestore ID. Let's use addDoc.
        // But wait, the model has 'id'. collectionData with idField handles reading.
        return addDoc(spacesCollection, {
            name,
            admins: [userId],
            buildings: [] // Initialize with empty or default buildings if we were storing them
        }).then(() => { });
    }

    // Rallies are a subcollection: spaces/{spaceId}/rallies
    getRallies(spaceId: string): Observable<Rally[]> {
        const ralliesCollection = collection(this.firestore, `spaces/${spaceId}/rallies`);
        return collectionData(ralliesCollection, { idField: 'id' }) as Observable<Rally[]>;
    }

    addRally(spaceId: string, rally: Omit<Rally, 'id'>): Promise<void> {
        const ralliesCollection = collection(this.firestore, `spaces/${spaceId}/rallies`);
        return addDoc(ralliesCollection, rally).then(() => { });
    }

    deleteRally(spaceId: string, rallyId: string): Promise<void> {
        const rallyDoc = doc(this.firestore, `spaces/${spaceId}/rallies/${rallyId}`);
        return deleteDoc(rallyDoc);
    }

    // Enemies: spaces/{spaceId}/enemies
    getEnemies(spaceId: string): Observable<Enemy[]> {
        const enemiesCollection = collection(this.firestore, `spaces/${spaceId}/enemies`);
        return collectionData(enemiesCollection, { idField: 'id' }) as Observable<Enemy[]>;
    }

    addEnemy(spaceId: string, enemy: Omit<Enemy, 'id'>): Promise<DocumentReference> {
        const enemiesCollection = collection(this.firestore, `spaces/${spaceId}/enemies`);
        return addDoc(enemiesCollection, enemy);
    }

    updateEnemy(spaceId: string, enemyId: string, data: Partial<Enemy>): Promise<void> {
        const enemyDoc = doc(this.firestore, `spaces/${spaceId}/enemies/${enemyId}`);
        return updateDoc(enemyDoc, data);
    }
}
