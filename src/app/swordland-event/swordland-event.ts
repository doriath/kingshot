import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SwordlandService, SwordlandEvent } from './swordland.service';
import { UserDataService } from '../user-data.service';
import { SwordlandDetailComponent } from './swordland-detail/swordland-detail';

interface GroupedByAlliance {
  allianceId: string;
  allianceName: string;
  events: SwordlandEvent[];
}

interface GroupedByServer {
  server: number;
  alliances: GroupedByAlliance[];
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
    const rawEvents = this.events();
    const serverMap = new Map<number, Map<string, SwordlandEvent[]>>();

    for (const event of rawEvents) {
      if (!serverMap.has(event.server)) {
        serverMap.set(event.server, new Map());
      }
      const allianceMap = serverMap.get(event.server)!;
      // Grouping by allianceId (assuming we have it)
      if (!allianceMap.has(event.allianceId)) {
        allianceMap.set(event.allianceId, []);
      }
      allianceMap.get(event.allianceId)!.push(event);
    }

    const result: GroupedByServer[] = [];
    const sortedServers = Array.from(serverMap.keys()).sort((a, b) => a - b);

    for (const server of sortedServers) {
      const allianceMap = serverMap.get(server)!;
      const alliances: GroupedByAlliance[] = [];

      for (const [allianceId, events] of allianceMap.entries()) {
        const allianceName = events[0].allianceName || 'Unknown Alliance';
        alliances.push({ allianceId, allianceName, events });
      }

      alliances.sort((a, b) => a.allianceName.localeCompare(b.allianceName));
      result.push({ server, alliances });
    }

    return result;
  });

  isUserServer(server: number): boolean {
    const char = this.activeCharacter();
    // Comparing as string approx (since server can be "123" or 123)
    return !!char && char.server == String(server);
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