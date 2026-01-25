import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SwordlandService, SwordlandEvent } from './swordland.service';
import { UserDataService } from '../user-data.service';
import { SwordlandDetailComponent } from './swordland-detail/swordland-detail';

interface SwordlandGroup {
  groupKey: string;
  allianceId: string;
  allianceName: string;
  server: number;
  events: SwordlandEvent[];
}

@Component({
  selector: 'app-swordland-event',
  templateUrl: './swordland-event.html',
  styleUrls: ['./swordland-event.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, SwordlandDetailComponent, RouterLink],
})
export class SwordlandEventComponent {
  private swordlandService = inject(SwordlandService);
  private userDataService = inject(UserDataService);

  events = toSignal(this.swordlandService.getActiveEvents(), { initialValue: [] });
  activeCharacter = this.userDataService.activeCharacter;

  selectedEvent = signal<SwordlandEvent | null>(null);

  groupedEvents = computed(() => {
    const allEvents = this.events();
    const now = new Date().getTime();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    // Filter out events that started more than 2 hours ago
    const rawEvents = allEvents.filter(event => {
      const startTime = event.date.toDate().getTime();
      return now < startTime + TWO_HOURS_MS;
    });

    const groupMap = new Map<string, SwordlandGroup>();

    for (const event of rawEvents) {
      // Group key: combination of server and allianceId
      // We use server first to make sorting easier logically if needed, but the key structure is internal
      const key = `${event.server}_${event.allianceId}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          groupKey: key,
          allianceId: event.allianceId,
          allianceName: event.allianceName || 'Unknown Alliance',
          server: event.server,
          events: []
        });
      }
      groupMap.get(key)!.events.push(event);
    }

    const result: SwordlandGroup[] = Array.from(groupMap.values());

    // Sort by server then alliance name
    result.sort((a, b) => {
      if (a.server !== b.server) {
        return a.server - b.server;
      }
      return a.allianceName.localeCompare(b.allianceName);
    });

    return result;
  });

  isUserServer(server: number): boolean {
    const char = this.activeCharacter();
    // Comparing as string approx (since server can be "123" or 123)
    return !!char && Number(char.server) === Number(server);
  }

  isUserAlliance(allianceName: string): boolean {
    const char = this.activeCharacter();
    return !!char && char.alliance === allianceName;
  }

  selectEvent(event: SwordlandEvent) {
    this.selectedEvent.set(event);
  }

  clearSelection() {
    this.selectedEvent.set(null);
  }
}