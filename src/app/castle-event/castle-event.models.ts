
export interface Space {
    id: string;
    name: string;
    admins: string[];
    enemies: Enemy[];
}

export interface Enemy {
    id: string;
    name: string;
    defeated: boolean;
}
