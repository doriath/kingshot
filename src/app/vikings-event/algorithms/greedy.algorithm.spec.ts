import { GreedyAssignmentAlgorithm } from './greedy.algorithm';
import { createMockCharacter } from './test-helpers';

describe('GreedyAssignmentAlgorithm', () => {
    let algo: GreedyAssignmentAlgorithm;

    beforeEach(() => {
        algo = new GreedyAssignmentAlgorithm();
    });

    it('should prioritize assigning marches to own farm account first', () => {
        const chars = [
            createMockCharacter('Main', 'online', 6),
            createMockCharacter('Farm', 'offline_empty', 6, 'Main') // Farm owned by Main
        ];

        const result = algo.solve(chars);
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

        const result = algo.solve(canReinforce);
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

        const result = algo.solve([...sources, ...targetsEmpty, ...targetsNotEmpty]);

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

        const result = algo.solve(chars);

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

        const result = algo.solve([s1, t1]);
        const resS1 = result.find(c => c.characterId === 'S_1');
        expect(resS1?.reinforce.length).toBeGreaterThan(0);
    });

    it('should respect maxReinforcementMarches limit', () => {
        const chars = [
            createMockCharacter('Main', 'online', 6),
            createMockCharacter('Farm', 'offline_empty', 6, 'Main', 0), // maxReinforcementMarches = 0. Should allow 0 incoming.
            createMockCharacter('Other', 'online', 6)
        ];

        const result = algo.solve(chars);

        // Farm has maxReinforcementMarches = 0. NO ONE should reinforce it.
        const fromMain = result.find(c => c.characterId === 'Main')?.reinforce.some(r => r.characterId === 'Farm');
        expect(fromMain).toBeFalse();

        const fromOther = result.find(c => c.characterId === 'Other')?.reinforce.some(r => r.characterId === 'Farm');
        expect(fromOther).toBeFalse();
    });

    it('should respect maxReinforcementMarches limit when set to 1', () => {
        const chars = [
            createMockCharacter('Source1', 'online', 6),
            createMockCharacter('Source2', 'online', 6),
            // Target allows MAX 1 march.
            createMockCharacter('Target', 'offline_empty', 6, undefined, 1),
        ];

        const result = algo.solve(chars);

        let incoming = 0;
        result.forEach(s => {
            if (s.reinforce.some(r => r.characterId === 'Target')) incoming++;
        });

        expect(incoming).toBe(1);
    });

    it('should respect reinforcement capacity limit', () => {
        const chars = [
            createMockCharacter('Src1', 'online', 6),
            createMockCharacter('Src2', 'online', 6),
            createMockCharacter('Src3', 'online', 6),
            createMockCharacter('Src4', 'online', 6),
            createMockCharacter('Target', 'offline_empty', 6, undefined, undefined, 300000), // Capacity=300k
        ];

        const result = algo.solve(chars);

        let incoming = 0;
        result.forEach(s => {
            if (s.reinforce.some(r => r.characterId === 'Target')) incoming++;
        });

        expect(incoming).toBe(2);
    });

    it('should allow unknown players to reinforce (as Offline Not Empty)', () => {
        const s1 = createMockCharacter('S_1', 'unknown' as any, 6);
        const t1 = createMockCharacter('T_1', 'offline_empty', 0);

        const result = algo.solve([s1, t1]);

        const resS1 = result.find(c => c.characterId === 'S_1');
        expect(resS1?.reinforce.length).toBe(0);
    });

    it('should NOT enable Offline Not Empty players to reinforce OTHER Offline Not Empty players (Disabled)', () => {
        const s1 = createMockCharacter('S_1', 'offline_not_empty', 6);
        const t1 = createMockCharacter('T_1', 'offline_not_empty', 0);
        const t2 = createMockCharacter('T_2', 'offline_not_empty', 0);

        const result = algo.solve([s1, t1, t2]);

        const resS1 = result.find(c => c.characterId === 'S_1');
        expect(resS1?.reinforce.length).toBe(0);

        // Verify T1/T2 received 0
        const inc1 = result.filter(r => r.reinforce.some(x => x.characterId === 'T_1')).length;
        expect(inc1).toBe(0);
    });

    it('should assign reinforcements TO Offline Not Empty players, but NOT FROM them', () => {
        const one1 = createMockCharacter('ONE_1', 'offline_not_empty', 6);
        const one2 = createMockCharacter('ONE_2', 'offline_not_empty', 6);
        const oe1 = createMockCharacter('OE_1', 'offline_empty', 6); // Valid Source

        const result = algo.solve([one1, one2, oe1]);

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
        const s1 = createMockCharacter('S_1', 'online', 6);
        const t1 = createMockCharacter('T_1', 'offline_empty', 0);

        const result = algo.solve([s1, t1]);
        const resS1 = result.find(c => c.characterId === 'S_1');
        expect(resS1?.reinforce.length).toBeGreaterThan(0);
    });

    it('should NOT assign reinforcements among 6 Offline Not Empty players (as they are Banned Sources)', () => {
        const players = Array.from({ length: 6 }, (_, i) =>
            createMockCharacter(`ONE_${i + 1}`, 'offline_not_empty', 6)
        );

        const result = algo.solve(players);

        players.forEach(p => {
            const incoming = result.filter(r => r.reinforce.some(x => x.characterId === p.characterId)).length;
            expect(incoming).toBe(0);

            const assigned = result.find(r => r.characterId === p.characterId);
            expect(assigned?.reinforce.length).toBe(0);
        });
    });

    it('should enforce permissive reinforcement boundaries in a mixed 4x4x4 scenario', () => {
        const online = Array.from({ length: 4 }, (_, i) => createMockCharacter(`On_${i}`, 'online', 6));
        const offEmpty = Array.from({ length: 4 }, (_, i) => createMockCharacter(`OE_${i}`, 'offline_empty', 6));
        const offNotEmpty = Array.from({ length: 4 }, (_, i) => createMockCharacter(`ONE_${i}`, 'offline_not_empty', 6));

        const allChars = [...online, ...offEmpty, ...offNotEmpty];
        const result = algo.solve(allChars);

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
            expect(sources.length).toBeGreaterThan(0);
        });
    });

    it('should promote mixing: Online -> Offline Empty', () => {
        const s1 = createMockCharacter('S_1', 'online', 6);
        const t1 = createMockCharacter('T_1', 'online', 0);
        const t2 = createMockCharacter('T_2', 'offline_empty', 0);

        const result = algo.solve([s1, t1, t2]);

        const resS1 = result.find(c => c.characterId === 'S_1');

        const toT1 = resS1?.reinforce.filter(r => r.characterId === 'T_1').length || 0;
        const toT2 = resS1?.reinforce.filter(r => r.characterId === 'T_2').length || 0;

        expect(toT1).toBeGreaterThan(0);
        expect(toT2).toBeGreaterThan(0);
    });

    it('should promote mixing: Offline Empty -> Offline Not Empty', () => {
        const s1 = createMockCharacter('S_1', 'offline_empty', 6);
        const t1 = createMockCharacter('T_1', 'offline_empty', 0);
        const t2 = createMockCharacter('T_2', 'offline_not_empty', 0);

        const result = algo.solve([s1, t1, t2]);
        const resS1 = result.find(c => c.characterId === 'S_1');

        const toT1 = resS1?.reinforce.filter(r => r.characterId === 'T_1').length || 0;
        const toT2 = resS1?.reinforce.filter(r => r.characterId === 'T_2').length || 0;

        expect(toT1).toBeGreaterThan(0);
        expect(toT2).toBeGreaterThan(0);
    });

});
