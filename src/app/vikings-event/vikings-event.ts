import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlliancesService } from '../alliances/alliances.service';
import { VikingsService, VikingsEvent, CharacterAssignmentView, VikingsRegistration } from './vikings.service';
import { UserDataService } from '../user-data.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-vikings-event',
    templateUrl: './vikings-event.html',
    styleUrl: './vikings-event.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterLink, FormsModule]
})
export class VikingsEventComponent {
    private alliancesService = inject(AlliancesService);
    private vikingsService = inject(VikingsService);
    private userDataService = inject(UserDataService);
    private authService = inject(AuthService);
    private route = inject(ActivatedRoute);

    public user = toSignal(this.authService.user$);

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

    // Fetch user registrations for this event
    public userRegistrations = toSignal(
        toObservable(this.eventData).pipe(
            switchMap(event => {
                const user = this.user();
                if (!event || !user) return of([]);
                return this.vikingsService.getUserRegistrations(event.id!, user.uid);
            })
        ),
        { initialValue: [] }
    );

    // Expanded player ID tracking
    public expandedPlayerId = signal<string | null>(null);

    // Search and Sort
    public searchQuery = signal<string>('');
    public sortBy = signal<'name' | 'power'>('power');
    public sortOrder = signal<'asc' | 'desc'>('desc');

    // Eligible characters for registration
    public eligibleCharacters = computed(() => {
        const event = this.eventData();
        const userChars = this.userDataService.characters();

        if (!event) return [];

        return userChars.filter(char => {
            // Match Server and Alliance (String conversion for safety)
            return String(char.server) === String(event.server) &&
                (char.alliance === event.allianceTag || char.alliance === event.allianceId || char.alliance === `[${event.allianceTag}]`);
        });
    });

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

        // Base Sort
        const sorted = this.sortCharacters(myAssignments);
        const activeChar = userChars.find(u => u.id === activeCharId);
        const activeCharName = activeChar?.name;

        // Re-sort to put active char on top
        return sorted.sort((a, b) => {
            if (activeCharName) {
                if (a.characterName === activeCharName) return -1;
                if (b.characterName === activeCharName) return 1;
            }
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

        return [...characters].sort((a, b) => {
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
        if (this.sortBy() === field) {
            this.sortOrder.update(o => o === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortBy.set(field);
            this.sortOrder.set('desc');
        }
    }

    public toggleCharacter(characterId: string) {
        if (this.expandedPlayerId() === characterId) {
            this.expandedPlayerId.set(null);
        } else {
            this.expandedPlayerId.set(characterId);
        }
    }

    // Registration Methods

    public getRegistration(characterId: string): VikingsRegistration | undefined {
        return this.userRegistrations()?.find(r => r.characterId === characterId);
    }

    public async saveRegistration(characterId: string, status: any, marchesCount: any) {
        const event = this.eventData();
        const user = this.user();
        if (!event || !user) return;

        // Validate status type to satisfy TS
        const validStatus = status as 'online' | 'offline_empty' | 'not_available';

        // Find character to get verification status
        const character = this.userDataService.characters().find(c => c.id === characterId);
        // Cast to any/CharacterUI because UserDataService might infer base Character type depending on how it's typed
        // But runtime objects have .verified
        const isVerified = (character as any)?.verified ?? false;

        const registration: VikingsRegistration = {
            eventId: event.id!,
            characterId: characterId,
            userId: user.uid,
            status: validStatus,
            marchesCount: Number(marchesCount),
            verified: isVerified
        };

        try {
            await this.vikingsService.saveRegistration(registration);
            alert('Registration saved!');
        } catch (err) {
            console.error(err);
            alert('Error saving registration.');
        }
    }
}
