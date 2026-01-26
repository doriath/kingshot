import { CharacterAssignment } from './vikings.types';
export type { AssignmentAlgorithm } from './algorithms/assignment-algorithm.interface';
import { AssignmentAlgorithm } from './algorithms/assignment-algorithm.interface';
import { GreedyAssignmentAlgorithm } from './algorithms/greedy.algorithm';
import { EmptyAssignmentAlgorithm } from './algorithms/empty.algorithm';

// Registry
const ALGORITHMS: { [key: string]: AssignmentAlgorithm } = {
    'greedy': new GreedyAssignmentAlgorithm(),
    'empty': new EmptyAssignmentAlgorithm()
};

export function getAvailableAlgorithms(): AssignmentAlgorithm[] {
    return Object.values(ALGORITHMS);
}

export function calculateAssignments(allCharacters: CharacterAssignment[], algorithmName: string = 'greedy'): CharacterAssignment[] {
    const algo = ALGORITHMS[algorithmName] || ALGORITHMS['greedy'];
    return algo.solve(allCharacters);
}
