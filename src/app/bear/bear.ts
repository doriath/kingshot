import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Scs, MarchConfig, ScsConfig } from '../optimization/scs';
import { create, all } from 'mathjs';
import { concatMap } from 'rxjs';

const math = create(all);

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
    try {
      let marchesConfig: MarchConfig[] = [{
        max_troops: 130000,
        parallel: 1,
        used: 1,
        dmg: 1.0,
      }, {
        max_troops: 90000,
        parallel: 1,
        used: 1,
        dmg: 1.0,
      }];
      let config: ScsConfig = {
        infCount: this.infantry(),
        cavCount: this.cavalry(),
        arcCount: this.archers(),
        infDmg: 43.7,
        cavDmg: 131.18300,
        arcDmg: 211.71040,
      };
      const result = await this.scs.solve(config, marchesConfig);
      console.log('Solver result:', result);

      const formations: Formation[] = result.map((m) => {
        return {
          name: 'Optimal Formation',
          infantry: m.troops[0],
          cavalry: m.troops[1],
          archers: m.troops[2],
          ratio: `${(m.troops[0] / m.max_troops * 100).toFixed(1)}% / ${(m.troops[1] / m.max_troops * 100).toFixed(1)}% / ${(m.troops[2] / m.max_troops * 100).toFixed(1)}%`,
        };
      });

      this.computedResult.set(formations);
    } catch (error) {
      console.error('Solver failed:', error);
    }
  }
}
