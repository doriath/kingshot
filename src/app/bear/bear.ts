import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Scs, ScsData, ScsCone } from '../optimization/scs';

interface Formation {
  name: string;
  infantry: number;
  cavalry: number;
  archers: number;
  ratio: string;
}

@Component({
  selector: 'app-bear',
  templateUrl: './bear.html',
  styleUrls: ['./bear.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class BearComponent {
  private scs = inject(Scs);

  troopLevel = signal(10);
  tgLevel = signal(2);
  infantry = signal(100000);
  cavalry = signal(173000);
  archers = signal(140000);
  damageRatio = signal(500);

  computedResult = signal<Formation[] | null>(null);

  async compute(): Promise<void> {
    const data: ScsData = {
      A: [[1, 1, 1]],
      b: [1],
      c: [-1, -1, -1],
    };

    const cone: ScsCone = {
      q: [3],
    };

    try {
      const result = await this.scs.solve(data, cone);
      console.log('Solver result:', result);

      const [infantryRatio, cavalryRatio, archerRatio] = [0,0,0];

      const totalTroops = this.infantry() + this.cavalry() + this.archers();

      const formations: Formation[] = [
        {
          name: 'Optimal Formation',
          infantry: Math.round(infantryRatio * totalTroops),
          cavalry: Math.round(cavalryRatio * totalTroops),
          archers: Math.round(archerRatio * totalTroops),
          ratio: `${(infantryRatio * 100).toFixed(1)}% / ${(cavalryRatio * 100).toFixed(1)}% / ${(archerRatio * 100).toFixed(1)}%`,
        },
      ];

      this.computedResult.set(formations);
    } catch (error) {
      console.error('Solver failed:', error);
    }
  }
}
