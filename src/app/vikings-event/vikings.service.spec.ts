import { TestBed } from '@angular/core/testing';
import { VikingsService } from './vikings.service';
import { CharacterAssignment, CharacterAssignmentView, VikingsStatus } from './vikings.types';
import { Firestore } from '@angular/fire/firestore';

describe('VikingsService', () => {
    let service: VikingsService;
    let firestoreMock: any;

    beforeEach(() => {
        firestoreMock = {};
        TestBed.configureTestingModule({
            providers: [
                VikingsService,
                { provide: Firestore, useValue: firestoreMock }
            ]
        });
        service = TestBed.inject(VikingsService);
    });

    // calculateAssignments tests moved to vikings-assignment-logic.spec.ts

    describe('generateAssignmentClipboardText', () => {
        it('should format clipboard text correctly with (Player, Power)', () => {
            const character: CharacterAssignmentView = {
                characterId: '1',
                characterName: 'Thor',
                powerLevel: 1000,
                status: 'online',
                reinforce: [
                    { characterId: '2', characterName: 'Odin', powerLevel: 2000, scoreValue: 1 }
                ]
            } as any; // Cast as any because CharacterAssignmentView has extra fields but minimal is enough

            const text = service.generateAssignmentClipboardText(character);
            const lines = text.split('\n');

            expect(lines[0]).toBe('Player Thor reinforces (Player, Power):');
            expect(lines[1]).toContain('1. Odin: 2,000');
        });

        it('should handle no assignments', () => {
            const character: CharacterAssignmentView = {
                characterId: '1',
                characterName: 'Loki',
                powerLevel: 1000,
                status: 'online',
                reinforce: []
            } as any;

            const text = service.generateAssignmentClipboardText(character);
            expect(text).toContain('No assignments.');
        });
    });
});
