export type VikingsStatus = 'online' | 'offline_empty' | 'offline_not_empty';

export interface CharacterAssignment {
    characterId: string;
    characterName: string;
    mainCharacterId?: string;
    reinforcementCapacity?: number;
    maxReinforcementMarches?: number;
    powerLevel: number;
    townCenterLevel?: number;
    marchesCount: number;
    status: VikingsStatus | 'unknown';
    actualStatus?: VikingsStatus | 'unknown';
    confidenceLevel?: number;
    reinforce: {
        characterId: string;
        marchType?: string;
    }[];
}

export interface CharacterAssignmentView extends Omit<CharacterAssignment, 'reinforce'> {
    reinforce: {
        characterId: string;
        characterName: string;
        powerLevel?: number;
        marchType?: string;
        scoreValue?: number;
        status?: VikingsStatus | 'unknown';
    }[];
    score?: number;
}


export interface VikingsEvent {
    id?: string;
    allianceId: string;
    allianceTag?: string; // Optional for now to support old data if any
    server: number;
    date: any; // Timestamp
    status: 'voting' | 'finalized' | 'finished' | 'past';
    characters: CharacterAssignment[];
}

export interface VikingsEventView extends Omit<VikingsEvent, 'characters'> {
    characters: CharacterAssignmentView[];
}

export interface VikingsRegistration {
    id?: string;
    eventId: string;
    characterId: string;
    userId: string;
    status: VikingsStatus;
    marchesCount: number;
    verified?: boolean; // Snapshot of verification status at time of registration
    updatedAt?: any; // Timestamp
}
