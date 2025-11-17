import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface MysticEvent {
  name: string;
  ratio: string;
  days: number[]; // 0 = Sunday, 1 = Monday, etc.
}

@Component({
  selector: 'app-mystic-trial-event',
  templateUrl: './mystic-trial-event.html',
  styleUrls: ['./mystic-trial-event.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class MysticTrialEventComponent {
  private readonly today = new Date();
  private readonly currentDayUTC = this.today.getUTCDay();
  
  protected readonly events = signal<MysticEvent[]>([
    { name: 'Coliseum', ratio: '50/10/40', days: [1, 2] },
    { name: 'Forest of Life', ratio: '50/15/35', days: [3, 4] },
    { name: 'Crystal Cave', ratio: '60/20/20', days: [3, 4] },
    { name: 'Knowledge Nexus', ratio: '50/20/30', days: [5, 6] },
    { name: 'Molten Fort', ratio: '60/15/25', days: [5, 6] },
    { name: 'Radian Spire', ratio: '50/15/35', days: [0] },
  ]);

  protected isActive(event: MysticEvent): boolean {
    return event.days.includes(this.currentDayUTC);
  }
}
