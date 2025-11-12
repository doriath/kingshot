import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Scs, MarchConfig, Troops } from '../optimization/scs';
import { create, all } from 'mathjs';

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
  cavalry = signal(100000);
  archers = signal(100000);

  marches = signal<MarchConfig[]>([
    {
      name: 'Rally Lead',
      maxTroops: 120000,
      parallel: 1,
      used: 5,
      dmg: 1.0,
    },
    {
      name: 'Join with hero x 3',
      maxTroops: 120000,
      parallel: 3,
      used: 30,
      dmg: 1.0,
    },
    {
      name: 'Join without hero',
      maxTroops: 90000,
      parallel: 1,
      used: 5,
      dmg: 1.0,
    },
  ]);

  computedResult = signal<Formation[] | null>(null);
  copiedIdentifier = signal<string | null>(null);

  addMarch() {
    if (this.marches().length < 7) {
      this.marches.update((marches) => [
        ...marches,
        {
          name: `March ${marches.length + 1}`,
          maxTroops: 100000,
          parallel: 1,
          used: 1,
          dmg: 1.0,
        },
      ]);
    }
  }

  removeMarch(index: number) {
    this.marches.update((marches) => {
      const newMarches = [...marches];
      newMarches.splice(index, 1);
      return newMarches;
    });
  }

  updateMarch(index: number, field: keyof MarchConfig, value: any) {
    this.marches.update((marches) => {
      const newMarches = [...marches];
      const marchToUpdate = { ...newMarches[index] };
      const currentValue = marchToUpdate[field];

      if (typeof currentValue === 'number') {
        (marchToUpdate as any)[field] = value.includes('.')
          ? parseFloat(value)
          : parseInt(value, 10);
      } else {
        (marchToUpdate as any)[field] = value;
      }

      newMarches[index] = marchToUpdate;
      return newMarches;
    });
  }

  async compute(): Promise<void> {
    try {
      const marchesConfig = this.marches();
      let config: Troops = {
        infCount: this.infantry(),
        cavCount: this.cavalry(),
        arcCount: this.archers(),
      };
      const result = await this.scs.optimizeBear(config, marchesConfig);
      // console.log('Solver result:', result);

      const formations: Formation[] = result.map((m, i) => {
        return {
          name: marchesConfig[i].name,
          infantry: Math.floor(m.troops[0]),
          cavalry: Math.floor(m.troops[1]),
          archers: Math.floor(m.troops[2]),
          ratio: `${((m.troops[0] / m.maxTroops) * 100).toFixed(1)}% / ${((
            m.troops[1] / m.maxTroops) *
            100
          ).toFixed(1)}% / ${((m.troops[2] / m.maxTroops) * 100).toFixed(1)}%`,
        };
      });

      this.computedResult.set(formations);
    } catch (error) {
      console.error('Solver failed:', error);
      window.alert("Solver failed");
    }
  }

  copyNumber(value: number, formationName: string, troopType: string): void {
    const identifier = `${formationName}-${troopType}`;
    navigator.clipboard
      .writeText(value.toString())
      .then(() => {
        this.copiedIdentifier.set(identifier);
        setTimeout(() => {
          this.copiedIdentifier.set(null);
        }, 2000);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  }
}
