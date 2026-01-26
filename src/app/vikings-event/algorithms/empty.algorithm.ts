import { CharacterAssignment } from '../vikings.types';
import { AssignmentAlgorithm } from './assignment-algorithm.interface';

export class EmptyAssignmentAlgorithm implements AssignmentAlgorithm {
    name = 'empty';
    description = 'Clears all assignments (no reinforcements).';

    solve(characters: CharacterAssignment[]): CharacterAssignment[] {
        // Return characters having no outgoing reinforcements
        // We still normalize marchesCount just to be consistent, though primarily we just want to clear 'reinforce'
        return characters.map(c => {
            let count = c.marchesCount;
            if (count === 0) count = 6;
            count = Math.max(1, Math.min(6, count));

            return {
                ...c,
                marchesCount: count,
                reinforce: []
            };
        });
    }
}
