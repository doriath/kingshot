import { EmptyAssignmentAlgorithm } from './empty.algorithm';
import { createMockCharacter } from './test-helpers';

describe('EmptyAssignmentAlgorithm', () => {
    let algo: EmptyAssignmentAlgorithm;

    beforeEach(() => {
        algo = new EmptyAssignmentAlgorithm();
    });

    it('should clear all assignments when using the "empty" algorithm', () => {
        const s1 = createMockCharacter('S_1', 'online', 6);
        const t1 = createMockCharacter('T_1', 'offline_empty', 0);

        const result = algo.solve([s1, t1]);

        const resS1 = result.find(c => c.characterId === 'S_1');
        const resT1 = result.find(c => c.characterId === 'T_1');

        expect(resS1?.reinforce.length).toBe(0);
        expect(resT1?.reinforce.length).toBe(0);

        // Verify marches normalization still happened
        expect(resS1?.marchesCount).toBe(6);
        expect(resT1?.marchesCount).toBe(6); // 0 normalized to 6
    });

});
