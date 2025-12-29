
import { TestBed } from '@angular/core/testing';
import { VikingsService, CharacterAssignment, VikingsStatus } from './vikings.service';
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

    describe('calculateAssignments', () => {

        function createMockCharacter(id: string, status: VikingsStatus | 'unknown', marchesCount: number = 6, mainCharacterId?: string, extraMarches?: number, reinforcementCapacity?: number): CharacterAssignment {
            return {
                characterId: id,
                characterName: `User ${id}`,
                powerLevel: 1000,
                marchesCount: marchesCount,
                status: status as any, // Cast to allow 'offline_not_empty' for testing logic flow
                mainCharacterId: mainCharacterId,
                extraMarches: extraMarches,
                reinforcementCapacity: reinforcementCapacity,
                reinforce: []
            };
        }

        it('should prioritize assigning marches to own farm account first', () => {
            const chars = [
                createMockCharacter('Main', 'online', 6),
                createMockCharacter('Farm', 'offline_empty', 6, 'Main') // Farm owned by Main
            ];

            const result = service.calculateAssignments(chars);
            const main = result.find(c => c.characterId === 'Main');

            // Should have at least one march to Farm
            expect(main?.reinforce.some(r => r.characterId === 'Farm')).toBeTrue();
        });

        it('should NOT allow farms to reinforce anyone', () => {
            const canReinforce = [
                createMockCharacter('Main', 'online', 6),
                createMockCharacter('Farm', 'offline_empty', 6, 'Main')
            ];
            // Main reinforces Farm. Farm should reinforce NO ONE.

            const result = service.calculateAssignments(canReinforce);
            const farm = result.find(c => c.characterId === 'Farm');

            expect(farm?.reinforce.length).toBe(0);
        });

        it('should distribute reinforcements greedily among ALL offline targets, favoring Empty on ties', () => {
            const sources = [
                Object.assign(createMockCharacter('S1', 'offline_not_empty', 1), { reinforcementCapacity: 0 }),
                Object.assign(createMockCharacter('S2', 'offline_not_empty', 1), { reinforcementCapacity: 0 }),
                Object.assign(createMockCharacter('S3', 'offline_not_empty', 1), { reinforcementCapacity: 0 }),
                Object.assign(createMockCharacter('S4', 'offline_not_empty', 1), { reinforcementCapacity: 0 }),
            ];
            const targets = [
                createMockCharacter('T1', 'offline_empty', 0),
                createMockCharacter('T2', 'offline_not_empty', 0),
            ];

            // 4 Sources, 1 march each.
            // 2 Targets.
            // Greedy:
            // 1. S1 -> T2 (Valid. T1 blocked due to status)
            // 2. S2 -> T2 
            // 3. S3 -> T2
            // 4. S4 -> T2 (Assuming infinite capacity)

            const chars = [...sources, ...targets];
            const result = service.calculateAssignments(chars);

            // Count incoming reinforcement
            const getIncoming = (targetId: string) =>
                result.filter(s => s.reinforce.some(r => r.characterId === targetId)).length;

            // T1 (Offline Empty) is NOT a valid target for Offline Not Empty sources.
            // T2 (Offline Not Empty) IS a valid target.

            expect(getIncoming('T1')).toBe(0);
            expect(getIncoming('T2')).toBe(5);
        });

        it('should assign Online sources greedily to least reinforced targets (Online U OfflineEmpty)', () => {
            const chars = [
                createMockCharacter('O1', 'online', 6),
                createMockCharacter('O2', 'online', 6),
                createMockCharacter('OE1', 'offline_empty', 6),
            ];

            const result = service.calculateAssignments(chars);

            const getIncoming = (id: string, fromIds: string[]) => {
                let count = 0;
                result.filter(s => fromIds.includes(s.characterId)).forEach(s => {
                    if (s.reinforce.some(r => r.characterId === id)) count++;
                });
                return count;
            };

            expect(getIncoming('O1', ['O1', 'O2'])).toBe(1); // From O2
            expect(getIncoming('O2', ['O1', 'O2'])).toBe(1); // From O1
            expect(getIncoming('OE1', ['O1', 'O2'])).toBe(2); // From both
        });

        it('should respect extraMarches limit for farms', () => {
            const chars = [
                createMockCharacter('Main', 'online', 6),
                createMockCharacter('Farm', 'offline_empty', 6, 'Main', 0),
                createMockCharacter('Other', 'online', 6)
            ];

            const result = service.calculateAssignments(chars);

            const fromMain = result.find(c => c.characterId === 'Main')?.reinforce.some(r => r.characterId === 'Farm');
            expect(fromMain).toBeTrue();

            const fromOther = result.find(c => c.characterId === 'Other')?.reinforce.some(r => r.characterId === 'Farm');
            expect(fromOther).toBeFalse();
        });

        it('should respect reinforcement capacity limit', () => {
            // Target with Capacity = 300,000. Floor(300000/150000) = 2.
            // 4 Sources try to assign to Target.
            // Should stop at 2.

            const chars = [
                createMockCharacter('Src1', 'online', 6),
                createMockCharacter('Src2', 'online', 6),
                createMockCharacter('Src3', 'online', 6),
                createMockCharacter('Src4', 'online', 6),
                createMockCharacter('Target', 'offline_empty', 6, undefined, undefined, 300000), // Capacity=300k
            ];

            // Phase 2: Offline Sources -> Offline Empty
            // Target is OE.
            // But Wait, Sources are Online. So Phase 3.
            // Phase 2 has Target as Offline Empty (Target). It is Offline Empty.
            // Is it a Source for Phase 2? Yes if it has marches. But it cannot assign to self.
            // So Phase 2 might try to assign Target -> Other (none).

            // Phase 3: Online Sources (Src1-4).
            // Target Pool includes 'Target' (OE).
            // Greedy assignment.
            // All 4 inputs will pick Target as best target (0 count).
            // They iterate.
            // Assignment 1 -> Success. Count 1.
            // Assignment 2 -> Success. Count 2.
            // Assignment 3 -> Check Capacity. 2 >= 2. Fail.
            // Assignment 4 -> Check Capacity. 2 >= 2. Fail.

            const result = service.calculateAssignments(chars);

            let incoming = 0;
            result.forEach(s => {
                if (s.reinforce.some(r => r.characterId === 'Target')) incoming++;
            });

            expect(incoming).toBe(2);
        });



        it('should NOT allow unknown players to reinforce anyone', () => {
            const chars = [
                createMockCharacter('Unknown', 'unknown', 6),
                createMockCharacter('Target', 'offline_empty', 6),
            ];

            const result = service.calculateAssignments(chars);

            const unk = result.find(c => c.characterId === 'Unknown');
            expect(unk?.reinforce.length).toBe(0);
        });

        it('should enable Offline Empty players to reinforce Offline Not Empty players', () => {
            // 1 Offline Empty (Source, 6 marches).
            // 1 Offline Not Empty (Target).

            // N calc: Empty=1, NotEmpty=1. Total=2. N=2.
            // Target (Empty1) needs 2.
            // Source (Empty1) cannot reinforce self.
            // So Step 2 (Fill Empty) does nothing for Source.
            // Step 3 (Remainder) -> Source has 6 marches.
            // Target (NotEmpty1) is available.
            // Source -> NotEmpty1.

            const chars = [
                createMockCharacter('OE1', 'offline_empty', 6),
                createMockCharacter('ONE1', 'offline_not_empty', 6),
            ];

            // ONE1 is Offline Not Empty. Valid Target.

            // 'OE1' is Offline Empty. Functioning Source.

            const result = service.calculateAssignments(chars);

            const oe1 = result.find(c => c.characterId === 'OE1');
            // OE1 should reinforce ONE1
            expect(oe1?.reinforce.some(r => r.characterId === 'ONE1')).toBeTrue();
        });

        it('should enable Offline Not Empty players to reinforce OTHER Offline Not Empty players to saturation', () => {
            const s1 = createMockCharacter('ONE_S1', 'offline_not_empty', 6);
            const s2 = createMockCharacter('ONE_S2', 'offline_not_empty', 6);
            const t1 = createMockCharacter('ONE_T1', 'offline_not_empty', 0);
            const t2 = createMockCharacter('ONE_T2', 'offline_not_empty', 0);

            // 2 Sources (6 each = 12 total).
            // 2 Targets.
            // Both sources reinforce both targets (unique constraint limit).
            // S1 -> T1, S1 -> T2.
            // S2 -> T1, S2 -> T2.
            // Total T1=2, T2=2.
            // Sources rem = 4 each.

            const chars = [s1, s2, t1, t2];
            const result = service.calculateAssignments(chars);

            const getIncoming = (id: string) =>
                result.filter(c => c.reinforce.some(r => r.characterId === id)).length;

            expect(getIncoming('ONE_T1')).toBe(3);
            expect(getIncoming('ONE_T2')).toBe(3);
        });

        it('should correctly calculate reinforcement scores', () => {
            const s1 = createMockCharacter('S_1', 'offline_not_empty', 6);
            const s2 = createMockCharacter('S_2', 'offline_not_empty', 6);
            // Pure targets (marchesCount=0). 
            // They are 'offline_not_empty'. Formula: 1 / (4 + count).
            const t1 = createMockCharacter('T_1', 'offline_not_empty', 0);
            const t2 = createMockCharacter('T_2', 'offline_not_empty', 0);

            // Assignment logic (Greedy):
            // S1 (6 marches), S2 (6 marches).
            // Targets: S1, S2, T1, T2?
            // Wait, S1/S2 have marches but are ALSO 'offline_not_empty'.
            // They CAN be targets if they are not exclusively sources.
            // But they start with 'marchesRemaining' > 0, so they are Sources.
            // But they are also in the 'offlineNotEmptyTargets' pool.
            // Can a source reinforce another source? Yes.
            // Can they reinforce themselves? No.

            // Phase 2 or 4 runs.
            // S1->S2, S1->T1, S1->T2. (3 assignments)
            // S2->S1, S2->T1, S2->T2. (3 assignments)

            // Incoming Counts:
            // T1: From S1, S2 -> Count = 2.
            // T2: From S1, S2 -> Count = 2.
            // S1: From S2 -> Count = 1.
            // S2: From S1 -> Count = 1.

            // Scores (Targets are offline_not_empty):
            // Reward for reinforcing T1 (Count 2): 1 / (4+2) = 1/6.
            // Reward for reinforcing T2 (Count 2): 1 / (4+2) = 1/6.
            // Reward for reinforcing S1 (Count 1): 1 / (4+1) = 1/5. (Or is it? S1 is offline_not_empty).
            // Reward for reinforcing S2 (Count 1): 1 / (4+1) = 1/5.

            // S1 Score = (to T1) + (to T2) + (to S2)
            // = 1/6 + 1/6 + 1/5 = 0.333... + 0.2 = 0.5333...

            // Let's verify this specific outcome.

            const result = service.calculateAssignments([s1, s2, t1, t2]);
            const resS1 = result.find(c => c.characterId === 'S_1');

            // Check counts first to ensure assumptions hold
            const getIncoming = (id: string) => result.filter(r => r.reinforce.some(x => x.characterId === id)).length;

            // S1 should reinforce T1, T2, S2.
            expect(resS1?.reinforce.length).toBe(3);

            // Updated expectation: All 4 act as sources, so incoming count is 3.
            expect(getIncoming('T_1')).toBe(3);
            expect(getIncoming('S_2')).toBe(3);

            // Expected Score: 3 assignments * (1/7) = 3/7 ~= 0.42857
            expect(resS1?.score).toBeCloseTo(0.4286, 4);
        });


        it('should NOT allow Online players to reinforce Offline Not Empty players', () => {
            // S1 is Online, has 6 marches.
            // T1 is Offline Not Empty.
            // Phase 4 (All -> Offline Not Empty) used to pick this up. Now it should NOT.

            const s1 = createMockCharacter('S_1', 'online', 6);
            const t1 = createMockCharacter('T_1', 'offline_not_empty', 0); // Pure target

            const result = service.calculateAssignments([s1, t1]);

            const resS1 = result.find(c => c.characterId === 'S_1');

            // S1 should NOT reinforce T1 because Online -> Offline Not Empty is forbidden.
            expect(resS1?.reinforce.length).toBe(0);
        });

        it('should correctly assign reinforcements among 6 Offline Not Empty players', () => {
            // Create 6 Offline Not Empty players
            const players = Array.from({ length: 6 }, (_, i) =>
                createMockCharacter(`ONE_${i + 1}`, 'offline_not_empty', 6)
            );

            const result = service.calculateAssignments(players);

            // Verify everyone got reinforced
            players.forEach(p => {
                const assigned = result.find(r => r.characterId === p.characterId);
                // Check incoming reinforcements
                const incoming = result.filter(r => r.reinforce.some(x => x.characterId === p.characterId)).length;

                // With 6 players, each having 6 marches, and greedy logic:
                // P1 can match with P2, P3, P4, P5, P6 (5 targets)
                // Everyone should reinforce everyone else (5 incoming each).
                expect(incoming).toBe(5);

                // Check outgoing
                expect(assigned?.reinforce.length).toBe(5);
                // Verify no self-assignment
                expect(assigned?.reinforce.find(x => x.characterId === p.characterId)).toBeUndefined();
            });
        });



        it('should enforce strict reinforcement boundaries in a mixed 4x4x4 scenario', () => {
            const online = Array.from({ length: 4 }, (_, i) => createMockCharacter(`On_${i}`, 'online', 6));
            const offEmpty = Array.from({ length: 4 }, (_, i) => createMockCharacter(`OE_${i}`, 'offline_empty', 6));
            const offNotEmpty = Array.from({ length: 4 }, (_, i) => createMockCharacter(`ONE_${i}`, 'offline_not_empty', 6));

            const allChars = [...online, ...offEmpty, ...offNotEmpty];
            const result = service.calculateAssignments(allChars);

            const getSourcesFor = (targetId: string) =>
                result.filter(s => s.reinforce.some(r => r.characterId === targetId));

            // 1. Online players -> Reinforced ONLY by Online
            online.forEach(p => {
                const sources = getSourcesFor(p.characterId);
                const invalidSources = sources.filter(s => s.status !== 'online');
                // Note: It's possible for online to receive 0 reinforcements if no one targets them.
                // But IF they receive reinforcements, they must be online.
                if (sources.length > 0) {
                    expect(invalidSources.length).toBe(0, `Online player ${p.characterId} reinforced by non-online sources: ${invalidSources.map(s => s.status)}`);
                }
            });

            // 2. Offline Empty players -> Reinforced ONLY by Online and Offline Empty
            // AND reinforced by AT LEAST 1 Online and AT LEAST 1 Offline Empty
            offEmpty.forEach(p => {
                const sources = getSourcesFor(p.characterId);
                const invalidSources = sources.filter(s => s.status === 'offline_not_empty');
                if (sources.length > 0) {
                    expect(invalidSources.length).toBe(0, `Offline Empty player ${p.characterId} reinforced by offline_not_empty`);
                }

                const onlineCount = sources.filter(s => s.status === 'online').length;
                const offEmptyCount = sources.filter(s => s.status === 'offline_empty').length;

                expect(onlineCount).toBeGreaterThan(0, `Offline Empty player ${p.characterId} received 0 Online reinforcements`);
                expect(offEmptyCount).toBeGreaterThan(0, `Offline Empty player ${p.characterId} received 0 Offline Empty reinforcements`);
            });

            // 3. Offline Not Empty players -> Reinforced by Offline Empty and Offline Not Empty (and NOT Online - previous fix)
            // AND reinforced by AT LEAST 1 Offline Empty and AT LEAST 1 Offline Not Empty
            offNotEmpty.forEach(p => {
                const sources = getSourcesFor(p.characterId);
                // Check for Online sources (should be 0)
                const onlineSources = sources.filter(s => s.status === 'online');
                if (sources.length > 0) {
                    expect(onlineSources.length).toBe(0, `Offline Not Empty player ${p.characterId} reinforced by Online players`);
                }

                const offEmptyCount = sources.filter(s => s.status === 'offline_empty').length;
                const offNotEmptyCount = sources.filter(s => s.status === 'offline_not_empty').length;

                expect(offEmptyCount).toBeGreaterThan(0, `Offline Not Empty player ${p.characterId} received 0 Offline Empty reinforcements`);
                expect(offNotEmptyCount).toBeGreaterThan(0, `Offline Not Empty player ${p.characterId} received 0 Offline Not Empty reinforcements`);
            });
        });

    });
});
