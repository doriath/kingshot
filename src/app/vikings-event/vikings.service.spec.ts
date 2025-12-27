
import { TestBed } from '@angular/core/testing';
import { VikingsService, CharacterAssignment } from './vikings.service';
import { Firestore } from '@angular/fire/firestore';

describe('VikingsService', () => {
    let service: VikingsService;
    let firestoreMock: any;

    beforeEach(() => {
        firestoreMock = {};
        TestBed.configureTestingModule({
            providers: [
                VikingsService,
                { provide: Firestore, useValue: firestoreMock }
            ]
        });
        service = TestBed.inject(VikingsService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('calculateAssignments', () => {

        function createMockCharacter(id: string, status: 'online' | 'offline_empty' | 'not_available', marchesCount: number = 6): CharacterAssignment {
            return {
                characterId: id,
                characterName: `User ${id}`,
                powerLevel: 1000,
                marchesCount: marchesCount,
                status: status,
                reinforce: []
            };
        }

        it('should prioritize online players reinforcing other online players exactly 2 times', () => {
            const onlineChars = [
                createMockCharacter('1', 'online'),
                createMockCharacter('2', 'online'),
                createMockCharacter('3', 'online'),
                createMockCharacter('4', 'online'),
            ];

            const result = service.calculateAssignments(onlineChars);

            // Each online player should be reinforced by 2 people
            // (Note: we check incoming reinforcements by looking at all outgoing assignments)
            const incomingCounts = new Map<string, number>();
            result.forEach(source => {
                source.reinforce.forEach(target => {
                    if (target.characterId) { // Check purely for existence of target ID
                        incomingCounts.set(target.characterId, (incomingCounts.get(target.characterId) || 0) + 1);
                    }
                });
            });

            // Expect each online player to receive exactly 2 reinforcements
            onlineChars.forEach(c => {
                expect(incomingCounts.get(c.characterId)).toBe(2);
            });
        });

        it('should distribute remaining marches of online players to offline_empty players', () => {
            // 3 Online players (needed 2 reinforcements each => 3 * 2 = 6 marches used for online-online)
            // Total marches capacity = 3 * 6 = 18.
            // Remaining marches = 18 - 6 = 12.
            // 2 Offline Empty players.
            // 12 remaining marches should be distributed among offline players.
            const chars = [
                createMockCharacter('O1', 'online'),
                createMockCharacter('O2', 'online'),
                createMockCharacter('O3', 'online'),
                createMockCharacter('E1', 'offline_empty'),
                createMockCharacter('E2', 'offline_empty'),
                createMockCharacter('E3', 'offline_empty'),
                createMockCharacter('E4', 'offline_empty'),
            ];

            const result = service.calculateAssignments(chars);

            // Check online targets received 2
            const incomingOnline = new Map<string, number>();
            result.forEach(s => {
                // Count how many online sources reinforced online targets
                if (s.status === 'online') {
                    s.reinforce.forEach(r => {
                        const target = chars.find(c => c.characterId === r.characterId);
                        if (target?.status === 'online') {
                            incomingOnline.set(r.characterId, (incomingOnline.get(r.characterId) || 0) + 1);
                        }
                    });
                }
            });

            ['O1', 'O2', 'O3'].forEach(id => {
                expect(incomingOnline.get(id)).toBe(2);
            });


            // Check remaining marches went to offline_empty
            let reinforcementsToOfflineEmpty = 0;
            result.filter(c => c.status === 'online').forEach(c => {
                c.reinforce.forEach(r => {
                    const target = chars.find(t => t.characterId === r.characterId);
                    if (target?.status === 'offline_empty') {
                        reinforcementsToOfflineEmpty++;
                    }
                });
            });

            // Total online marches (18) - Online-to-Online (6) = 12
            expect(reinforcementsToOfflineEmpty).toBe(12);
        });

        it('should use first 3 marches of offline_empty players to reinforce other offline_empty players', () => {
            const chars = [
                createMockCharacter('E1', 'offline_empty', 6), // 6 marches
                createMockCharacter('E2', 'offline_empty', 6),
                createMockCharacter('E3', 'offline_empty', 6),
                createMockCharacter('E4', 'offline_empty', 6),
            ];

            const result = service.calculateAssignments(chars);

            // Each offline_empty has 6 marches. First 3 MUST go to offline_empty.
            // Remaining 3 go to not_available (but there are none here, so they might loop back or cover remaining offline_empty if logic allows, 
            // BUT strict rule says: "The remaining marches should be spread across not-available players". 
            // If no not available players? We should probably just verify they stick to offline_empty or are unused/handled gracefully.
            // For this test, let's add some not_available to be clear.

            // Let's refine the test to be strict:
            const mixedChars = [
                createMockCharacter('E1', 'offline_empty', 6),
                createMockCharacter('E2', 'offline_empty', 6),
                createMockCharacter('NA1', 'not_available'),
            ];

            const resultMixed = service.calculateAssignments(mixedChars);

            const e1 = resultMixed.find(c => c.characterId === 'E1');
            const e2 = resultMixed.find(c => c.characterId === 'E2');

            // Count targets of type offline_empty
            const e1_offlineTargets = e1?.reinforce.filter(r => r.characterId.startsWith('E')).length;
            const e2_offlineTargets = e2?.reinforce.filter(r => r.characterId.startsWith('E')).length;

            // Should be at least 3, assuming enough targets exist.
            // Here E1 can reinforce E2 (1 target). It cannot reinforce itself.
            // So it's limited by available targets.
            // Let's add more offline empty to ensure we can hit 3.

            const richChars = [
                createMockCharacter('E1', 'offline_empty', 6),
                createMockCharacter('E2', 'offline_empty', 6),
                createMockCharacter('E3', 'offline_empty', 6),
                createMockCharacter('E4', 'offline_empty', 6),
                createMockCharacter('NA1', 'not_available'),
            ];

            const resultRich = service.calculateAssignments(richChars);
            const rE1 = resultRich.find(c => c.characterId === 'E1');

            // First 3 marches -> offline_empty. Remaining 3 -> not_available.

            // Check marches to offline empty
            const toOfflineCount = rE1?.reinforce.filter(r => {
                const target = richChars.find(t => t.characterId === r.characterId);
                return target?.status === 'offline_empty';
            }).length;

            // Check marches to not available
            const toNaCount = rE1?.reinforce.filter(r => {
                const target = richChars.find(t => t.characterId === r.characterId);
                return target?.status === 'not_available';
            }).length;

            expect(toOfflineCount).toBe(3);
            // Since there is only 1 NA target, it might receive 1 or multiple depending on logic.
            // Assuming we "spread across not-available players". Unique targets? or fill?
            // "Spread" usually implies distribution. 
            // If we have 3 marches left and 1 target, does he send 3 to the same? or just 1?
            // The prompt says "distribute the remaining marches". 
            // Let's assume for now he sends what he can. If specific requirement says unique, we'll check.
            // Assuming logic allows multi-reinforcement or just unique. 
            // Typically in these games unique is better.
            // If unique, we expect 1.
            // We'll verify at least logic attempts to fulfill "Remaining -> NA".
            expect(toNaCount).toBeGreaterThanOrEqual(1);
        });

        it('should distribute not_available players to reinforce other not_available players', () => {
            const chars = [
                createMockCharacter('NA1', 'not_available'),
                createMockCharacter('NA2', 'not_available'),
                createMockCharacter('NA3', 'not_available'),
            ];

            const result = service.calculateAssignments(chars);

            const na1 = result.find(c => c.characterId === 'NA1');
            // All reinforcements should be to NA players
            const allNa = na1?.reinforce.every(r => r.characterId.startsWith('NA'));

            expect(allNa).toBeTrue();
        });

        it('should handle clamp and defaults correctly', () => {
            const chars = [
                createMockCharacter('1', 'online', 0), // Should default to 6
                createMockCharacter('2', 'online', 10), // Should clamp to 6
                createMockCharacter('3', 'online', -5), // Should clamp to 1
                // Add targets
                createMockCharacter('T1', 'offline_empty'),
                createMockCharacter('T2', 'offline_empty'),
                createMockCharacter('T3', 'offline_empty'),
                createMockCharacter('T4', 'offline_empty'),
                createMockCharacter('T5', 'offline_empty'),
                createMockCharacter('T6', 'offline_empty'),
            ];

            const result = service.calculateAssignments(chars);
            const c1 = result.find(c => c.characterId === '1');
            const c2 = result.find(c => c.characterId === '2');
            const c3 = result.find(c => c.characterId === '3');

            expect(c1?.reinforce.length).toBe(6);
            expect(c2?.reinforce.length).toBe(6);
            expect(c3?.reinforce.length).toBe(1);
        });

    });
});
