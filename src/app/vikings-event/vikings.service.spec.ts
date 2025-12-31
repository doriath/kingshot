import { TestBed } from '@angular/core/testing';
import { VikingsService } from './vikings.service';
import { CharacterAssignment, VikingsStatus } from './vikings.types';
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
});
