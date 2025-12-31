import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VikingsService } from '../vikings.service';
import { VikingsEvent } from '../vikings.types';
import { UserDataService } from '../../user-data.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-vikings-list',
    templateUrl: './vikings-list.html',
    styleUrl: './vikings-list.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterLink]
})
export class VikingsListComponent {
    private vikingsService = inject(VikingsService);
    private userDataService = inject(UserDataService);

    private allEvents = toSignal(this.vikingsService.getAllVikingsEvents(), { initialValue: [] });

    public activeEvents = computed(() => {
        return this.allEvents().filter(e => e.status === 'voting' || e.status === 'finalized');
    });

    public groupedEvents = computed(() => {
        const events = this.activeEvents();
        const userChars = this.userDataService.characters();
        const activeCharId = this.userDataService.activeCharacterId();
        const activeChar = userChars.find(c => c.id === activeCharId);

        // Grouping
        const groups: { label: string, events: VikingsEvent[], isUserAlliance: boolean }[] = [];
        const map = new Map<string, VikingsEvent[]>();

        events.forEach(e => {
            const key = `${e.server}_${e.allianceId}`; // Unique key by ID
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(e);
        });

        map.forEach((evts, key) => {
            // Check if this matches user's active char
            let isUserAlliance = false;

            // Provide a better label if possible
            // All events in this group have same server/allianceId.
            // We can use the tag from the first event if available.
            const firstEvent = evts[0];
            const displayLabel = firstEvent.allianceTag
                ? `Server #${firstEvent.server} - [${firstEvent.allianceTag}]`
                : `Server #${firstEvent.server} - Alliance ${firstEvent.allianceId}`;

            if (activeChar) {
                // If event.server == activeChar.server AND event.allianceId == activeChar.alliance
                // The event object has server (number) and allianceId (string)
                // The activeChar has server (string usually in input?) and alliance (string)
                // Let's try flexible matching
                if (String(firstEvent.server) === String(activeChar.server) &&
                    firstEvent.allianceId === activeChar.alliance) {
                    isUserAlliance = true;
                }
            }

            groups.push({ label: displayLabel, events: evts, isUserAlliance });
        });

        // Sort groups: User alliance first, then others
        return groups.sort((a, b) => {
            if (a.isUserAlliance && !b.isUserAlliance) return -1;
            if (!a.isUserAlliance && b.isUserAlliance) return 1;
            return a.label.localeCompare(b.label);
        });
    });
}
