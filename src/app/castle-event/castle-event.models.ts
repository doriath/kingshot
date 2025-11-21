
export interface Space {
    id: string;
    name: string;
    admins: string[];
    buildings?: Building[]; // Optional as it might be hardcoded/implied in UI but good for data model
}

export interface Enemy {
    id: string;
    name: string;
    defaultTravelTime?: number; // ms
}

export type BuildingType = 'castle' | 'turret_1' | 'turret_2' | 'turret_3' | 'turret_4';

export interface Building {
    id: BuildingType;
    name: string;
}

export interface Rally {
    id: string;
    buildingId: BuildingType;
    enemyId: string;
    startTime: number; // Timestamp
    travelTime: number; // ms
    // Computed properties not stored in DB
    enemyName?: string;
}
