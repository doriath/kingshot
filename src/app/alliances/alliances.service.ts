import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, collection, collectionData, query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Alliance {
    uuid: string;
    tag: string; // 3 upper case letters
    name: string; // full name
    server: number;
    admins: string[]; // list of user ids
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
}
