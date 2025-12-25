import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlliancesService, Alliance } from '../alliances/alliances.service';
import { VikingsService, VikingsEvent, CharacterAssignmentView } from './vikings.service';
import { UserDataService } from '../user-data.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { RouterLink, ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-vikings-event',
    templateUrl: './vikings-event.html',
    styleUrl: './vikings-event.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterLink]
})
export class VikingsEventComponent {
    private alliancesService = inject(AlliancesService);
    private vikingsService = inject(VikingsService);
    private userDataService = inject(UserDataService);
    private route = inject(ActivatedRoute);

    // Fetch event data by ID from route
    public eventData = toSignal(
        this.route.paramMap.pipe(
            map(params => params.get('id')),
            switchMap(id => {
                if (!id) return of(null);
                return this.vikingsService.getVikingsEventById(id);
            })
        )
    );

    // Signals for state - now derived or static if needed
    // Assuming event has allianceId, we can fetch alliance details if needed, 
    // but simplified MVP might just show event.allianceId from the event object.

    // Expanded player ID tracking
    public expandedPlayerId = signal<string | null>(null);

    // Search and Sort
    public searchQuery = signal<string>('');
    public sortBy = signal<'name' | 'power'>('power');
    public sortOrder = signal<'asc' | 'desc'>('desc');

    public myCharacters = computed(() => {
        const event = this.eventData();
        const userChars = this.userDataService.characters();
        const activeCharId = this.userDataService.activeCharacterId();
        const query = this.searchQuery().toLowerCase();

        if (!event || !event.characters) return [];

        const myCharNames = new Set(userChars.map(u => u.name));
        let myAssignments = event.characters.filter(c => myCharNames.has(c.characterName));

        // Filter
        if (query) {
            myAssignments = myAssignments.filter(c => c.characterName.toLowerCase().includes(query));
        }

        // Sort: Active first, then by criteria
        const activeChar = userChars.find(u => u.id === activeCharId);
        const activeCharName = activeChar?.name;

        // Base Sort
        const sorted = this.sortCharacters(myAssignments);

        // Re-sort to put active char on top (if it exists in the list)
        // Note: The internal sort might have moved it. We pull it to top.
        return sorted.sort((a, b) => {
            if (a.characterName === activeCharName) return -1;
            if (b.characterName === activeCharName) return 1;
            return 0;
        });
    });

    public otherCharacters = computed(() => {
        const event = this.eventData();
        const userChars = this.userDataService.characters();
        const query = this.searchQuery().toLowerCase();

        if (!event || !event.characters) return [];

        const myCharNames = new Set(userChars.map(u => u.name));
        let others = event.characters.filter(c => !myCharNames.has(c.characterName));

        // Filter
        if (query) {
            others = others.filter(c => c.characterName.toLowerCase().includes(query));
        }

        // Sort
        return this.sortCharacters(others);
    });

    private sortCharacters(characters: CharacterAssignmentView[]): CharacterAssignmentView[] {
        const field = this.sortBy();
        const order = this.sortOrder();
        const multiplier = order === 'asc' ? 1 : -1;

        return [...characters].sort((a, b) => { // Create a shallow copy before sorting
            if (field === 'name') {
                return a.characterName.localeCompare(b.characterName) * multiplier;
            } else {
                return ((a.powerLevel || 0) - (b.powerLevel || 0)) * multiplier;
            }
        });
    }

    public setSearch(query: string) {
        this.searchQuery.set(query);
    }

    public setSort(field: 'name' | 'power') {
        // If sorting by same field, toggle order
        if (this.sortBy() === field) {
            this.sortOrder.update(o => o === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortBy.set(field);
            this.sortOrder.set('desc'); // Default to desc for new field (especially power)
        }
    }

    public toggleCharacter(characterId: string) {
        if (this.expandedPlayerId() === characterId) {
            this.expandedPlayerId.set(null);
        } else {
            this.expandedPlayerId.set(characterId);
        }
    }
}
