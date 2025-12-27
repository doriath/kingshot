
import { TestBed } from '@angular/core/testing';
import { VikingsService, CharacterAssignment } from './vikings.service';
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

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('calculateAssignments', () => {

        function createMockCharacter(id: string, marchesCount: number = 0): CharacterAssignment {
            return {
                characterId: id,
                characterName: `User ${id}`,
                powerLevel: 1000,
                marchesCount: marchesCount,
                status: 'online',
                reinforce: []
            };
        }

        it('should assign reinforcements based on marchesCount', () => {
            const chars = [
                createMockCharacter('1', 2),
                createMockCharacter('2', 6),
                createMockCharacter('3', 6),
                createMockCharacter('4', 6),
                createMockCharacter('5', 6),
            ];

            const result = service.calculateAssignments(chars);

            const char1 = result.find(c => c.characterId === '1');
            expect(char1?.reinforce.length).toBe(2);
        });

        it('should default marchesCount 0 to 6', () => {
            // We need enough targets to get 6 assignments
            const chars = [];
            for (let i = 1; i <= 8; i++) {
                chars.push(createMockCharacter(`${i}`, i === 1 ? 0 : 6));
            }

            const result = service.calculateAssignments(chars);
            const char1 = result.find(c => c.characterId === '1');
            expect(char1?.marchesCount).toBe(0); // Input remains 0
            expect(char1?.reinforce.length).toBe(6); // Logic treats 0 as 6
        });

        it('should clamp marchesCount between 1 and 6', () => {
            const chars = [
                createMockCharacter('1', 10), // Too high
                createMockCharacter('2', -5), // Too low, though likely 0
                createMockCharacter('Target1', 6),
                createMockCharacter('Target2', 6),
                createMockCharacter('Target3', 6),
                createMockCharacter('Target4', 6),
                createMockCharacter('Target5', 6),
                createMockCharacter('Target6', 6),
            ];

            const result = service.calculateAssignments(chars);

            const char1 = result.find(c => c.characterId === '1');
            const char2 = result.find(c => c.characterId === '2');

            expect(char1?.reinforce.length).toBe(6);
            expect(char2?.reinforce.length).toBe(1); // -5 should be clamped to 1
        });

        it('should not assign a character to reinforce themselves', () => {
            const chars = [
                createMockCharacter('1', 1),
                createMockCharacter('2', 1)
            ];

            const result = service.calculateAssignments(chars);
            const char1 = result.find(c => c.characterId === '1');

            expect(char1?.reinforce[0].characterId).not.toBe('1');
            expect(char1?.reinforce[0].characterId).toBe('2');
        });

        it('should handle cases with fewer targets than requested matches', () => {
            const chars = [
                createMockCharacter('1', 6),
                createMockCharacter('2', 6)
            ];
            // Char 1 only has Char 2 as target. Requested 6. Should get 1.

            const result = service.calculateAssignments(chars);
            const char1 = result.find(c => c.characterId === '1');

            expect(char1?.reinforce.length).toBe(1);
            expect(char1?.reinforce[0].characterId).toBe('2');
        });

    });
});
