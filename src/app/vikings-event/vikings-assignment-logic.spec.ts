
import { calculateAssignments, getAvailableAlgorithms } from './vikings-assignment-logic';
import { CharacterAssignment, VikingsStatus } from './vikings.types';
import { createMockCharacter } from './algorithms/test-helpers';

describe('vikings-assignment-logic integration', () => {

    it('should default to greedy algorithm', () => {
        const c1 = createMockCharacter('C1', 'online', 6);
        const c2 = createMockCharacter('C2', 'offline_empty', 0);

        // Should dispatch to greedy algo (implicitly tested if results match greedy behavior or just runs w/o error)
        const result = calculateAssignments([c1, c2]);
        expect(result.length).toBe(2);
    });

    it('should dispatch to empty algorithm when requested', () => {
        const c1 = createMockCharacter('C1', 'online', 6);
        const c2 = createMockCharacter('C2', 'offline_empty', 0);

        const result = calculateAssignments([c1, c2], 'empty');
        // Empty algo clears assignments
        expect(result[0].reinforce.length).toBe(0);
        expect(result[1].reinforce.length).toBe(0);
    });

    it('should list available algorithms including greedy and empty', () => {
        const algos = getAvailableAlgorithms();
        expect(algos.map(a => a.name)).toContain('greedy');
        expect(algos.map(a => a.name)).toContain('empty');
    });

});
