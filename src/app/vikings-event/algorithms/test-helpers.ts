import { CharacterAssignment, VikingsStatus } from '../vikings.types';

export function createMockCharacter(id: string, status: VikingsStatus | 'unknown', marchesCount: number = 6, mainCharacterId?: string, extraMarches?: number, reinforcementCapacity?: number): CharacterAssignment {
    return {
        characterId: id,
        characterName: `User ${id}`,
        powerLevel: 1000,
        marchesCount: marchesCount,
        status: status as any, // Cast to allow 'offline_not_empty' for testing logic flow
        mainCharacterId: mainCharacterId,
        maxReinforcementMarches: extraMarches, // Reuse parameter for convenience, treating it as maxReinforcementMarches
        reinforcementCapacity: reinforcementCapacity,
        reinforce: []
    };
}
