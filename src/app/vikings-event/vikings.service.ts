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
        // 1. Build map of Incoming Reinforcers (Confidence Levels) per Target
        const incomingConfidence = new Map<string, { id: string; conf: number }[]>();

        if (event.characters) {
            event.characters.forEach(source => {
                const sourceConf = source.confidenceLevel !== undefined ? source.confidenceLevel : 0.5;
                if (source.reinforce) {
                    source.reinforce.forEach(target => {
                        const list = incomingConfidence.get(target.characterId) || [];
                        list.push({ id: source.characterId, conf: sourceConf });
                        incomingConfidence.set(target.characterId, list);
                    });
                }
            });
        }

        // 2. Map characters and compute scores
        const viewCharacters: CharacterAssignmentView[] = (event.characters || []).map(c => {
            // Re-calculate scores for outgoing reinforcements
            const viewReinforce = (c.reinforce || []).map(r => {
                const target = characterMap.get(r.characterId);
                let scoreValue = 0;

                if (target) {
                    const targetStatus = getCharacterStatus(target);
                    // Determine numerator based on target status
                    let numerator = 0;
                    if (targetStatus === 'online') {
                        numerator = 1.3;
                    } else if (targetStatus === 'offline_empty') {
                        numerator = 1.0;
                    } else {
                        // Offline Not Empty (Legacy or busy)
                        // Formula was 1.0 / (4 + count). 
                        // Probabilistic equivalent: E[1 / (4 + 1 + others)]
                        // Let's stick to standard numerator logic for simplicity or handle it separately.
                        // For offline_not_empty, base count is 4. So we treat it as if 4 people are already there.
                        numerator = 1.0;
                    }

                    // Get list of all OTHER reinforcers' probabilities
                    const allIncoming = incomingConfidence.get(target.characterId) || [];
                    const otherProbs = allIncoming
                        .filter(itm => itm.id !== c.characterId)
                        .map(itm => itm.conf);

                    if (targetStatus === 'offline_not_empty') {
                        // Special case: Offline Not Empty has base "4" marches
                        scoreValue = this.calculateExpectedScore(otherProbs, numerator, 4);
                    } else {
                        scoreValue = this.calculateExpectedScore(otherProbs, numerator, 0);
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

    /**
     * Calculates E[numerator / (1 + baseOffset + K)] where K is number of other successes.
     */
    private calculateExpectedScore(probs: number[], numerator: number, baseOffset: number): number {
        // dp[i] = probability that exactly i people show up
        // Initialize: dp[0] = 1 (0 people show up)
        let dp = new Array(probs.length + 1).fill(0);
        dp[0] = 1.0;

        for (const p of probs) {
            for (let i = dp.length - 1; i >= 1; i--) {
                dp[i] = dp[i] * (1 - p) + dp[i - 1] * p;
            }
            dp[0] = dp[0] * (1 - p);
        }

        let expectedValue = 0;
        // Verify sum of probs is ~1? (Optional check)

        for (let k = 0; k < dp.length; k++) {
            const probK = dp[k];
            // If k others show up, total count is (1 + baseOffset + k)  [1 is ME]
            const count = 1 + baseOffset + k;
            expectedValue += probK * (numerator / count);
        }

        return expectedValue;
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
        // Sort: Most recent first (index 0 is newest)
        const recentEvents = pastEvents
            .filter(e => e.status === 'finished')
            .sort((a, b) => b.date.seconds - a.date.seconds)
            .slice(0, 5);

        if (recentEvents.length === 0) {
            // Bayesian prior (1, 1) means 1 success, 1 failure => 0.5
            return 0.5;
        }

        let totalWeight = 0;
        let weightedScore = 0;

        // Decay Factor
        const lambda = 0.9;

        // Bayesian Prior (Uniform)
        const alpha = 1.0; // Pseudo-count for Success
        const beta = 1.0;  // Pseudo-count for Failure

        recentEvents.forEach((event, index) => {
            const char = event.characters?.find(c => c.characterId === memberId);
            if (!char) return;

            const declared = getCharacterStatus(char);

            // Skip irrelevant statuses
            if (declared !== 'online' && declared !== 'offline_empty') return;

            const actual = (char.actualStatus && char.actualStatus !== 'unknown') ? char.actualStatus : declared;

            // SCORING: 1.0 (Match) vs 0.0 (Mismatch)
            const eventScore = (declared === actual) ? 1.0 : 0.0;

            // Weight decreases for older events: 1, 0.9, 0.81...
            const weight = Math.pow(lambda, index);

            weightedScore += (eventScore * weight);
            totalWeight += weight;
        });

        // If no relevant participation found (despite events existing), treat as new.
        if (totalWeight === 0) return 0.5;

        // Formula: (WeightedScore + Alpha) / (TotalWeight + Alpha + Beta)
        return (weightedScore + alpha) / (totalWeight + alpha + beta);
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
