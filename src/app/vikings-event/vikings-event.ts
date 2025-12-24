import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlliancesService, Alliance } from '../alliances/alliances.service';
import { VikingsService, VikingsEvent, CharacterAssignmentView } from './vikings.service';
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

    // Signals for state
    public selectedServer = signal<number>(150);
    public selectedAllianceId = signal<string>('SKY150_UUID_PLACEHOLDER'); // Hardcoded for MVP as requested, would be dynamic later

    // Expanded player ID tracking
    public expandedPlayerId = signal<string | null>(null);

    // Fetch alliance details
    public alliance = toSignal(
        toObservable(this.selectedAllianceId).pipe(
            switchMap(id => {
                // For now, since we don't have real IDs and might not have the doc, 
                // we will simulate fetching or fetch if it exists. 
                // If the user hasn't populated DB yet, this might return undefined.
                // For the MVP with hardcoded SKY#150, we can also just mock the object if needed, 
                // but let's try to fetch.
                // If the UUID is a placeholder, this returns undefined.
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

    public toggleCharacter(characterId: string) {
        if (this.expandedPlayerId() === characterId) {
            this.expandedPlayerId.set(null);
        } else {
            this.expandedPlayerId.set(characterId);
        }
    }
}
