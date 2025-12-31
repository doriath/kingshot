import { CharacterAssignment, VikingsStatus } from './vikings.types';

/**
 * Determines the standardized status of a character.
 * Handles 'unknown', 'not_available', null, undefined, and other legacy values.
 * 
 * Logic:
 * - 'online' -> 'online'
 * - 'offline_empty' -> 'offline_empty'
 * - Any other value -> 'offline_not_empty' (Default fallback, assumes player has troops/power but is offline)
 */
export function getCharacterStatus(character: { status?: string | null }): VikingsStatus {
    const s = character?.status;
    if (s === 'online') return 'online';
    if (s === 'offline_empty') return 'offline_empty';

    // Default fallback
    return 'offline_not_empty';
}

/**
 * Returns the confidence level of a member.
 * Defaults to 1.0 (Low/Standard) if not set.
 * Range: 1.0 to 2.0
 */
export function getMemberConfidence(member: { confidenceLevel?: number }): number {
    return member.confidenceLevel ?? 1.0;
}

