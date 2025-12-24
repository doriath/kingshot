import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlliancesService, Alliance } from '../alliances/alliances.service';
import { VikingsService, VikingsEvent, CharacterAssignmentView } from './vikings.service';
import { UserDataService } from '../user-data.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map, tap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
    selector: 'app-vikings-event',
    templateUrl: './vikings-event.html',
    styleUrl: './vikings-event.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule]
})
export class VikingsEventComponent {
    private alliancesService = inject(AlliancesService);
    private vikingsService = inject(VikingsService);
    private userDataService = inject(UserDataService);

    // Signals for state
    public selectedServer = signal<number>(150);
    public selectedAllianceId = signal<string>('SKY150_UUID_PLACEHOLDER'); // Hardcoded for MVP as requested, would be dynamic later

    // Expanded player ID tracking
    public expandedPlayerId = signal<string | null>(null);

    // Fetch alliance details
    public alliance = toSignal(
        toObservable(this.selectedAllianceId).pipe(
            switchMap(id => {
                return this.alliancesService.getAlliance(id);
            })
        )
    );

    // Fetch event data
    public eventData = toSignal(
        toObservable(this.selectedAllianceId).pipe(
            switchMap(id => this.vikingsService.getVikingsEvent(id)),
            map(events => events.length ? events[0] : null)
        )
    );

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
