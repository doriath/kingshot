import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, collection, collectionData, query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Alliance {
    uuid: string;
    tag: string; // 3 upper case letters
    name: string; // full name
    server: number;
    admins: string[]; // list of user ids
    members?: AllianceMember[];
}

export interface AllianceMember {
    characterId: string;
    name: string;
    power: number;
    mainCharacterId?: string;
    reinforcementCapacity?: number;
}

@Injectable({
    providedIn: 'root'
})
export class AlliancesService {
    private firestore = inject(Firestore);

    getAlliance(uuid: string): Observable<Alliance | undefined> {
        const allianceDoc = doc(this.firestore, `alliances/${uuid}`);
        return docData(allianceDoc) as Observable<Alliance | undefined>;
    }

    getAlliancesByServer(server: number): Observable<Alliance[]> {
        const alliancesCollection = collection(this.firestore, 'alliances');
        const q = query(alliancesCollection, where('server', '==', server));
        return collectionData(q, { idField: 'uuid' }) as Observable<Alliance[]>;
    }

    getUserAdminAlliances(userId: string): Observable<Alliance[]> {
        const alliancesCollection = collection(this.firestore, 'alliances');
        const q = query(alliancesCollection, where('admins', 'array-contains', userId));
        return collectionData(q, { idField: 'uuid' }) as Observable<Alliance[]>;
    }

    getAllianceMembers(allianceId: string): Observable<AllianceMember[]> {
        // Return stream of members from the alliance document
        return this.getAlliance(allianceId).pipe(
            map(alliance => alliance?.members || [])
        );
    }

    async addAllianceMember(allianceId: string, member: AllianceMember): Promise<void> {
        const allianceRef = doc(this.firestore, `alliances/${allianceId}`);
        // Use runTransaction to safely upsert the member
        await import('@angular/fire/firestore').then(mod => mod.runTransaction(this.firestore, async (transaction) => {
            const snapshot = await transaction.get(allianceRef);
            if (!snapshot.exists()) {
                throw new Error("Alliance does not exist!");
            }
            const data = snapshot.data() as Alliance;
            let members = data.members || [];

            // Remove existing member with same ID to update it, or just push if new
            members = members.filter(m => m.characterId !== member.characterId);
            members.push(member);

            transaction.update(allianceRef, { members });
        }));
    }

    async removeAllianceMember(allianceId: string, memberId: string): Promise<void> {
        const allianceRef = doc(this.firestore, `alliances/${allianceId}`);
        await import('@angular/fire/firestore').then(mod => mod.runTransaction(this.firestore, async (transaction) => {
            const snapshot = await transaction.get(allianceRef);
            if (!snapshot.exists()) return;

            const data = snapshot.data() as Alliance;
            let members = data.members || [];

            // Filter out the member
            members = members.filter(m => m.characterId !== memberId);

            transaction.update(allianceRef, { members });
        }));
    }
}
