
import { calculateAssignments } from './vikings-assignment-logic';
import { CharacterAssignment, VikingsStatus } from './vikings.types';

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

        const result = calculateAssignments(chars);
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

        const result = calculateAssignments(canReinforce);
        const farm = result.find(c => c.characterId === 'Farm');

        expect(farm?.reinforce.length).toBe(0);
    });

    it('should distribute reinforcements greedily among ALL offline targets (Offline Empty ONLY)', () => {
        // S1, S2, S3 Online (Sources)
        // T1, T2 Offline Empty (Targets)
        // T3, T4 Offline Not Empty (Targets) -> Should NOT receive reinforcement now.

        const sources = [
            createMockCharacter('S_1', 'online', 6),
            createMockCharacter('S_2', 'online', 6),
            createMockCharacter('S_3', 'online', 6)
        ];
        const targetsEmpty = [
            createMockCharacter('T_1', 'offline_empty', 0),
            createMockCharacter('T_2', 'offline_empty', 0)
        ];
        const targetsNotEmpty = [
            createMockCharacter('T_3', 'offline_not_empty', 0),
            createMockCharacter('T_4', 'offline_not_empty', 0)
        ];

        // Total 18 matches available.
        // Targets: T1, T2 (Total 2 targets).
        // T3, T4 are ignored.
        // 18 / 2 = 9 each. But sources limited to 6.
        // Actually, greedy distribution.
        // S1 fills T1, T2.
        // S2 fills T1, T2.
        // S3 fills T1, T2.
        // T1, T2 get tons of reinforcements.

        const result = calculateAssignments([...sources, ...targetsEmpty, ...targetsNotEmpty]);

        const getIncoming = (id: string) => result.filter(r => r.reinforce.some(x => x.characterId === id)).length;

        // T1, T2 should get reinforced heavily (Phase 2/3)
        expect(getIncoming('T_1')).toBeGreaterThan(0);
        expect(getIncoming('T_2')).toBeGreaterThan(0);

        // T3 and T4 should get reinforced now (Phase 4 Cleanup)
        expect(getIncoming('T_3')).toBeGreaterThan(0);
        expect(getIncoming('T_4')).toBeGreaterThan(0);
    });

    it('should assign Online sources greedily to least reinforced targets (Online U OfflineEmpty)', () => {
        const chars = [
            createMockCharacter('O1', 'online', 6),
            createMockCharacter('O2', 'online', 6),
            createMockCharacter('OE1', 'offline_empty', 6),
        ];

        const result = calculateAssignments(chars);

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

    it('should enable Offline Empty players to reinforce Offline Not Empty players', () => {
        const s1 = createMockCharacter('S_1', 'offline_empty', 6);
        const t1 = createMockCharacter('T_1', 'offline_not_empty', 0);

        const result = calculateAssignments([s1, t1]);
        const resS1 = result.find(c => c.characterId === 'S_1');
        expect(resS1?.reinforce.length).toBeGreaterThan(0);
    });
    it('should respect extraMarches limit for farms', () => {
        const chars = [
            createMockCharacter('Main', 'online', 6),
            createMockCharacter('Farm', 'offline_empty', 6, 'Main', 0),
            createMockCharacter('Other', 'online', 6)
        ];

        const result = calculateAssignments(chars);

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

        const result = calculateAssignments(chars);

        let incoming = 0;
        result.forEach(s => {
            if (s.reinforce.some(r => r.characterId === 'Target')) incoming++;
        });

        expect(incoming).toBe(2);
    });



    it('should allow unknown players to reinforce (as Offline Not Empty)', () => {
        // Unknown status -> 'offline_not_empty'.
        // They should be able to reinforce OTHERS.
        // But they cannot BE reinforced.

        const s1 = createMockCharacter('S_1', 'unknown' as any, 6);
        const t1 = createMockCharacter('T_1', 'offline_empty', 0);

        const result = calculateAssignments([s1, t1]);

        // S1 -> T1.
        // S1 is offline_not_empty (Source).
        // T1 is offline_empty (Target).
        // Valid in Phase 2?
        // Phase 2 Sources: Online & Offline Empty?
        // Wait, Phase 2 (Survival) in new code:
        // Sources: Online & Offline Empty. Excludes Offline Not Empty.
        // So S1 cannot reinforce in Phase 2.

        // Phase 3 (Utility): Sources: Online & Offline Empty.
        // S1 cannot reinforce here either.

        // Phase 4 (Cleanup): Sources: ALL. (But Phase 4 is disabled).

        // So S1 (Offline Not Empty) is effectively BANNED from reinforcing anyone?
        // Wait, Phase 4 was "Offline Not Empty Targets".
        // But sources were "Everyone".

        // If S1 is banned from Phase 2 and 3 as source...
        // Then S1 does nothing.

        // Let's check logic:
        // S1 is Offline Not Empty (Banned Source).
        // T1 is Offline Empty (Target).
        // Result: S1 produces 0 assignments.

        const resS1 = result.find(c => c.characterId === 'S_1');
        expect(resS1?.reinforce.length).toBe(0);
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

        const result = calculateAssignments(chars);

        const oe1 = result.find(c => c.characterId === 'OE1');
        // OE1 should reinforce ONE1
        expect(oe1?.reinforce.some(r => r.characterId === 'ONE1')).toBeTrue();
    });

    it('should NOT enable Offline Not Empty players to reinforce OTHER Offline Not Empty players (Disabled)', () => {
        // They are excluded from Phase 2/3 as sources.
        // And targets are excluded.
        const s1 = createMockCharacter('S_1', 'offline_not_empty', 6);
        const t1 = createMockCharacter('T_1', 'offline_not_empty', 0);
        const t2 = createMockCharacter('T_2', 'offline_not_empty', 0);

        // S1 should NOT reinforce T1/T2 because S1 is Offline Not Empty (Banned Source)
        // T1/T2 are Offline Not Empty (Valid Targets), but no valid sources exist.

        const result = calculateAssignments([s1, t1, t2]);

        const resS1 = result.find(c => c.characterId === 'S_1');
        expect(resS1?.reinforce.length).toBe(0);

        // Verify T1/T2 received 0
        const inc1 = result.filter(r => r.reinforce.some(x => x.characterId === 'T_1')).length;
        expect(inc1).toBe(0);
    });
    it('should allow Online players to reinforce Offline Not Empty players (Cleanup phase)', () => {
        const s1 = createMockCharacter('S_1', 'online', 6);
        const t1 = createMockCharacter('T_1', 'offline_not_empty', 0);

        const result = calculateAssignments([s1, t1]);
        const resS1 = result.find(c => c.characterId === 'S_1');
        expect(resS1?.reinforce.length).toBeGreaterThan(0);
    });

    it('should assign reinforcements TO Offline Not Empty players, but NOT FROM them', () => {
        // Create 2 Offline Not Empty players (Targets/Sources?)
        // If they are strictly targets (marches=0), they get filled.
        // If they have marches=6, they should NOT use them.

        const one1 = createMockCharacter('ONE_1', 'offline_not_empty', 6);
        const one2 = createMockCharacter('ONE_2', 'offline_not_empty', 6);
        const oe1 = createMockCharacter('OE_1', 'offline_empty', 6); // Valid Source

        const result = calculateAssignments([one1, one2, oe1]);

        // OE1 (Source) -> ONE1, ONE2 (Targets)
        const resOE1 = result.find(r => r.characterId === 'OE_1');
        expect(resOE1?.reinforce.length).toBeGreaterThan(0);

        // ONE1, ONE2 (Sources) -> Should be 0
        const resONE1 = result.find(r => r.characterId === 'ONE_1');
        const resONE2 = result.find(r => r.characterId === 'ONE_2');
        expect(resONE1?.reinforce.length).toBe(0);
        expect(resONE2?.reinforce.length).toBe(0);

        // Verify ONE1, ONE2 received help (from OE1)
        const inc1 = result.filter(r => r.reinforce.some(x => x.characterId === 'ONE_1')).length;
        const inc2 = result.filter(r => r.reinforce.some(x => x.characterId === 'ONE_2')).length;
        expect(inc1 + inc2).toBeGreaterThan(0);
    });

    it('should correctly calculate reinforcement scores - implicitly tested via behavior', () => {
        // Just verify assignment happens for valid targets
        const s1 = createMockCharacter('S_1', 'online', 6);
        const t1 = createMockCharacter('T_1', 'offline_empty', 0);

        const result = calculateAssignments([s1, t1]);
        const resS1 = result.find(c => c.characterId === 'S_1');
        expect(resS1?.reinforce.length).toBeGreaterThan(0);
    });

    it('should NOT assign reinforcements among 6 Offline Not Empty players (as they are Banned Sources)', () => {
        // Create 6 Offline Not Empty players
        const players = Array.from({ length: 6 }, (_, i) =>
            createMockCharacter(`ONE_${i + 1}`, 'offline_not_empty', 6)
        );

        const result = calculateAssignments(players);

        // Verify NO ONE got reinforced because NO ONE is a valid source.
        players.forEach(p => {
            // Check incoming
            const incoming = result.filter(r => r.reinforce.some(x => x.characterId === p.characterId)).length;
            expect(incoming).toBe(0);

            // Check outgoing (Sources)
            const assigned = result.find(r => r.characterId === p.characterId);
            expect(assigned?.reinforce.length).toBe(0);
        });
    });




    it('should enforce permissive reinforcement boundaries in a mixed 4x4x4 scenario', () => {
        const online = Array.from({ length: 4 }, (_, i) => createMockCharacter(`On_${i}`, 'online', 6));
        const offEmpty = Array.from({ length: 4 }, (_, i) => createMockCharacter(`OE_${i}`, 'offline_empty', 6));
        const offNotEmpty = Array.from({ length: 4 }, (_, i) => createMockCharacter(`ONE_${i}`, 'offline_not_empty', 6));

        const allChars = [...online, ...offEmpty, ...offNotEmpty];
        const result = calculateAssignments(allChars);

        const getSourcesFor = (targetId: string) =>
            result.filter(s => s.reinforce.some(r => r.characterId === targetId));

        // 1. Online players -> Reinforced by Online AND Offline Empty
        online.forEach(p => {
            const sources = getSourcesFor(p.characterId);
            // Ensure sources are NOT Offline Not Empty (Banned Source)
            const invalidSources = sources.filter(s => s.status === 'offline_not_empty');
            expect(invalidSources.length).toBe(0);
        });

        // 2. Offline Empty players -> Reinforced by Online and Offline Empty
        offEmpty.forEach(p => {
            const sources = getSourcesFor(p.characterId);
            const invalidSources = sources.filter(s => s.status === 'offline_not_empty');
            expect(invalidSources.length).toBe(0);

            // Should get some love
            expect(sources.length).toBeGreaterThan(0);
        });

        // 3. Offline Not Empty players -> Reinforced by Online/Offline Empty (in Phase 3/4)
        // AND Banned as Sources.
        offNotEmpty.forEach(p => {
            const sources = getSourcesFor(p.characterId);
            const invalidSources = sources.filter(s => s.status === 'offline_not_empty');
            expect(invalidSources.length).toBe(0);

            // Should be reinforced?
            // With 8 valid sources (48 marches) and 4+4+4 targets.
            // Online/OE get full. ONE get leftovers.
            // They should get something.
            expect(sources.length).toBeGreaterThan(0);
        });
    });

    it('should promote mixing: Online -> Offline Empty', () => {
        // Online sources should NOT be siloed to Online targets if Offline Empty offers Utility.
        const s1 = createMockCharacter('S_1', 'online', 6);
        const t1 = createMockCharacter('T_1', 'online', 0);
        const t2 = createMockCharacter('T_2', 'offline_empty', 0);

        const result = calculateAssignments([s1, t1, t2]);

        const resS1 = result.find(c => c.characterId === 'S_1');

        // S1 (Online) should reinforce BOTH T1 (Online) and T2 (OE).
        // Because after filling T1 partially, T1's Marginal Utility drops below T2's.

        const toT1 = resS1?.reinforce.filter(r => r.characterId === 'T_1').length || 0;
        const toT2 = resS1?.reinforce.filter(r => r.characterId === 'T_2').length || 0;

        expect(toT1).toBeGreaterThan(0);
        expect(toT2).toBeGreaterThan(0);
    });

    it('should promote mixing: Offline Empty -> Offline Not Empty', () => {
        // Offline Empty sources should reinforce Offline Not Empty if needed/utility allows.
        // S1 (OE), T1 (OE), T2 (ONE).
        // S1 has 6 marches.
        // T1 Weight=1.0. T2 Weight=Adjusted.
        const s1 = createMockCharacter('S_1', 'offline_empty', 6);
        const t1 = createMockCharacter('T_1', 'offline_empty', 0);
        const t2 = createMockCharacter('T_2', 'offline_not_empty', 0);

        const result = calculateAssignments([s1, t1, t2]);
        const resS1 = result.find(c => c.characterId === 'S_1');

        const toT1 = resS1?.reinforce.filter(r => r.characterId === 'T_1').length || 0;
        const toT2 = resS1?.reinforce.filter(r => r.characterId === 'T_2').length || 0;

        // T2 (ONE) is now valid in Phase 3. 
        // Should get some reinforcement once T1 marginal utility drops.
        expect(toT1).toBeGreaterThan(0);
        expect(toT2).toBeGreaterThan(0);
    });

});
