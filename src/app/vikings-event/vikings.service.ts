import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, doc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CharacterAssignment, CharacterAssignmentView, VikingsEvent, VikingsEventView, VikingsRegistration, VikingsStatus } from './vikings.types';
import { calculateAssignments } from './vikings-assignment-logic';
import { getCharacterStatus, getMemberConfidence } from './vikings.helpers';


@Injectable({
    providedIn: 'root'
})
export class VikingsService {
    private firestore = inject(Firestore);

    getAllVikingsEvents(): Observable<VikingsEvent[]> {
        const eventsCollection = collection(this.firestore, 'vikingsEvents');
        const q = query(eventsCollection);
        return (collectionData(q, { idField: 'id' }) as Observable<VikingsEvent[]>).pipe(
            map(events => events.sort((a, b) => {
                const tA = a.date?.seconds || 0;
                const tB = b.date?.seconds || 0;
                return tA - tB;
            }))
        );
    }

    getVikingsEventById(id: string): Observable<VikingsEventView | null> {
        const eventDoc = doc(this.firestore, `vikingsEvents/${id}`);
        return docData(eventDoc, { idField: 'id' }).pipe(
            map(event => event ? this.transformEventToView(event as VikingsEvent) : null)
        );
    }

    // specific method for backwards compatibility or specific query if needed
    getVikingsEvent(allianceId: string): Observable<VikingsEventView[]> {
        const eventsCollection = collection(this.firestore, 'vikingsEvents');
        const q = query(
            eventsCollection,
            where('allianceId', '==', allianceId)
        );
        return (collectionData(q, { idField: 'id' }) as Observable<VikingsEvent[]>).pipe(
            map(events => events
                .map(event => this.transformEventToView(event))
                .sort((a, b) => {
                    const tA = a.date?.seconds || 0;
                    const tB = b.date?.seconds || 0;
                    return tA - tB;
                })
            )
        );
    }

    // Registrations

    getUserRegistrations(eventId: string, userId: string): Observable<VikingsRegistration[]> {
        const regsCollection = collection(this.firestore, 'vikingsRegistrations');
        const q = query(
            regsCollection,
            where('eventId', '==', eventId),
            where('userId', '==', userId)
        );
        return collectionData(q, { idField: 'id' }) as Observable<VikingsRegistration[]>;
    }

    async saveRegistration(registration: VikingsRegistration): Promise<void> {
        // Use a deterministic ID so we don't create duplicates: eventId_characterId
        const docId = `${registration.eventId}_${registration.characterId}`;
        const regDoc = doc(this.firestore, `vikingsRegistrations/${docId}`);
        // data to save
        const data = {
            ...registration,
            updatedAt: new Date()
        };
        await import('@angular/fire/firestore').then(mod => mod.setDoc(regDoc, data, { merge: true }));
    }

    async createVikingsEvent(alliance: any, date: Date): Promise<void> {
        // Need to import Alliance interface properly if we want strict typing, 
        // but for now relying on the structure being passed.
        // Mapped from AllianceMember to CharacterAssignment
        const characters: CharacterAssignment[] = (alliance.members || [])
            .filter((m: any) => !m.quit)
            .map((m: any) => ({
                characterId: m.characterId,
                characterName: m.name,
                mainCharacterId: m.mainCharacterId, // Copy from alliance member
                reinforcementCapacity: m.reinforcementCapacity,
                powerLevel: m.power,
                marchesCount: 0, // Default to 0, user will register explicit count
                status: 'unknown',
                confidenceLevel: getMemberConfidence(m),
                reinforce: []
            }));

        const event: VikingsEvent = {
            allianceId: alliance.uuid,
            allianceTag: alliance.tag,
            server: alliance.server,
            date: date,
            status: 'voting',
            characters: characters
        };

        const eventsCollection = collection(this.firestore, 'vikingsEvents');
        await import('@angular/fire/firestore').then(mod => mod.addDoc(eventsCollection, event));
    }

    async deleteVikingsEvent(eventId: string): Promise<void> {
        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        await import('@angular/fire/firestore').then(mod => mod.deleteDoc(docRef));
    }

    async updateVikingsEvent(eventId: string, data: Partial<VikingsEvent>): Promise<void> {
        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        await import('@angular/fire/firestore').then(mod => mod.updateDoc(docRef, data));
    }

    async finalizeEvent(eventId: string): Promise<void> {
        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        const firestore = await import('@angular/fire/firestore');
        const snap = await firestore.getDoc(docRef);

        if (!snap.exists()) {
            throw new Error('Event not found');
        }

        const event = snap.data() as VikingsEvent;
        const allCharacters = event.characters || [];

        const updatedCharacters = this.calculateAssignments(allCharacters);

        await firestore.updateDoc(docRef, {
            status: 'finalized',
            characters: updatedCharacters
        });
    }

    async simulateAssignments(eventId: string): Promise<void> {
        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        const firestore = await import('@angular/fire/firestore');
        const snap = await firestore.getDoc(docRef);

        if (!snap.exists()) {
            throw new Error('Event not found');
        }

        const event = snap.data() as VikingsEvent;
        const allCharacters = event.characters || [];

        const updatedCharacters = this.calculateAssignments(allCharacters);

        await firestore.updateDoc(docRef, {
            // status remains unchanged (e.g., 'voting')
            characters: updatedCharacters
        });
    }

    calculateAssignments(allCharacters: CharacterAssignment[]): CharacterAssignment[] {
        return calculateAssignments(allCharacters);
    }

    async updateEventCharacters(eventId: string, characters: CharacterAssignment[]): Promise<void> {
        // Sanitize data before saving to avoid "undefined" errors and remove View-only fields
        const safeCharacters = characters.map(c => {
            const safeC: any = { ...c };
            // Ensure status/counts are preserved? Yes, they are part of c.

            // Sanitize reinforce array
            if (safeC.reinforce) {
                safeC.reinforce = safeC.reinforce.map((r: any) => {
                    const safeR: any = { characterId: r.characterId };
                    if (r.marchType) {
                        safeR.marchType = r.marchType;
                    }
                    // Remove scoreValue if present (it shouldn't be in DB model anymore)
                    if (r.scoreValue !== undefined) {
                        delete safeR.scoreValue;
                    }
                    return safeR;
                });
            }
            // Preserve new fields
            if (safeC.mainCharacterId !== undefined) safeC.mainCharacterId = safeC.mainCharacterId;
            if (safeC.reinforcementCapacity !== undefined) safeC.reinforcementCapacity = safeC.reinforcementCapacity;
            if (safeC.extraMarches !== undefined) safeC.extraMarches = safeC.extraMarches;
            if (safeC.actualStatus !== undefined) safeC.actualStatus = safeC.actualStatus;

            // Remove any undefined keys to satisfy Firestore
            Object.keys(safeC).forEach(key => (safeC as any)[key] === undefined && delete (safeC as any)[key]);

            return safeC as CharacterAssignment;
        });

        const docRef = doc(this.firestore, `vikingsEvents/${eventId}`);
        await import('@angular/fire/firestore').then(mod => mod.updateDoc(docRef, { characters: safeCharacters }));
    }

    getEventRegistrations(eventId: string): Observable<VikingsRegistration[]> {
        const regsCollection = collection(this.firestore, 'vikingsRegistrations');
        const q = query(regsCollection, where('eventId', '==', eventId));
        return collectionData(q, { idField: 'id' }) as Observable<VikingsRegistration[]>;
    }

    public transformEventToView(event: VikingsEvent): VikingsEventView {
        const characterMap = new Map<string, CharacterAssignment>();
        if (event.characters) {
            event.characters.forEach(c => characterMap.set(c.characterId, c));
        }

        // --- DYNAMIC SCORE CALCULATION ---
        // 1. Calculate incoming counts
        const incomingCounts = new Map<string, number>();
        if (event.characters) {
            event.characters.forEach(source => {
                source.reinforce.forEach(target => {
                    incomingCounts.set(target.characterId, (incomingCounts.get(target.characterId) || 0) + 1);
                });
            });
        }

        // 2. Map characters and compute scores
        const viewCharacters: CharacterAssignmentView[] = (event.characters || []).map(c => {
            // Re-calculate scores for outgoing reinforcements
            const viewReinforce = (c.reinforce || []).map(r => {
                const target = characterMap.get(r.characterId);
                let scoreValue = 0;

                if (target) {
                    const count = incomingCounts.get(target.characterId) || 1; // Avoid div/0 if logical inconsistency
                    const targetStatus = getCharacterStatus(target);
                    if (targetStatus === 'online') {
                        scoreValue = 1.3 / count;
                    } else if (targetStatus === 'offline_empty') {
                        scoreValue = 1.0 / count;
                    } else {
                        // Offline Not Empty
                        scoreValue = 1.0 / (4 + count);
                    }
                }

                return {
                    characterId: r.characterId,
                    marchType: r.marchType,
                    scoreValue: scoreValue,
                    characterName: target?.characterName || 'Unknown',
                    powerLevel: target?.powerLevel
                };
            });

            // Sum up total score
            const totalScore = viewReinforce.reduce((sum, r) => sum + (r.scoreValue || 0), 0);

            return {
                ...c,
                reinforce: viewReinforce,
                score: totalScore
            };
        });

        return {
            ...event,
            characters: viewCharacters
        };
    }

    public generateAssignmentClipboardText(character: CharacterAssignmentView): string {
        const lines = [`Player ${character.characterName} reinforces (Player, Power):`];

        if (!character.reinforce || character.reinforce.length === 0) {
            lines.push('No assignments.');
        } else {
            character.reinforce.forEach((target, index) => {
                let line = `${index + 1}. ${target.characterName}`;
                if (target.powerLevel != null) {
                    line += `: ${target.powerLevel.toLocaleString()}`;
                }
                lines.push(line);
            });
        }

        return lines.join('\n');
    }

    calculateMemberConfidence(memberId: string, pastEvents: VikingsEvent[]): number {
        // Consider last 5 events
        const recentEvents = pastEvents
            .filter(e => e.status === 'finished')
            .sort((a, b) => b.date.seconds - a.date.seconds)
            .slice(0, 5);

        if (recentEvents.length === 0) {
            return 1.0; // Default
        }

        let totalScore = 0;
        let count = 0;

        for (const event of recentEvents) {
            const char = event.characters?.find(c => c.characterId === memberId);
            if (!char) continue;

            // Only count if we have data on what they did (actualStatus)
            // If they didn't even register (unknown status), generally ignore or treat as neutral?
            // "if player says they will be online..." implies we look at declared status.

            const declared = getCharacterStatus(char);
            // If declared unknown/offline_not_empty (meaning they didn't sign up or said busy), 
            // maybe we skip this event for confidence scoring?
            // Or if they said BUSY and were BUSY, that's reliable?
            // Re-read req: "if player says they will be online... if player says they will be offline not empty..."
            // It seems we care about reliability of prediction.

            // Let's check `actualStatus`. 
            // If actualStatus is missing, we can't score.
            if (!char.actualStatus || char.actualStatus === 'unknown') continue;

            const actual = char.actualStatus;

            // SCORING:
            // Match: 2.0 (High confidence)
            // Mismatch: 1.0 (Low confidence)

            // Special case: "if player says online, but then offline not empty => low confidence"
            // "if player says online, and actually online => high confidence"

            let eventScore = 1.0;

            if (declared === actual) {
                eventScore = 2.0;
            } else {
                // Mismatch
                // declared=online, actual=offline => 1.0
                // declared=offline, actual=online => Maybe also 1.0? Unreliable.
                eventScore = 1.0;
            }

            totalScore += eventScore;
            count++;
        }

        if (count === 0) return 1.0;

        return totalScore / count;
    }

    async updateAllianceMemberConfidence(allianceId: string, updates: { characterId: string; confidenceLevel: number }[]): Promise<void> {
        const allianceRef = doc(this.firestore, `alliances/${allianceId}`);
        await import('@angular/fire/firestore').then(mod => mod.runTransaction(this.firestore, async (transaction) => {
            const snapshot = await transaction.get(allianceRef);
            if (!snapshot.exists()) return;

            const data = snapshot.data();
            const members = (data['members'] || []) as any[];
            let changed = false;

            updates.forEach(u => {
                const member = members.find(m => m.characterId === u.characterId);
                if (member) {
                    member.confidenceLevel = u.confidenceLevel;
                    changed = true;
                }
            });

            if (changed) {
                transaction.update(allianceRef, { members });
            }
        }));
    }
}
