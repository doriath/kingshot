import { CharacterAssignment } from '../vikings.types';

export interface AssignmentAlgorithm {
    name: string;
    description: string;
    solve(characters: CharacterAssignment[]): CharacterAssignment[];
}
