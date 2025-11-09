import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Scs, MarchConfig, ScsConfig } from '../optimization/scs';
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
  infantry = signal(310000);
  cavalry = signal(290000);
  archers = signal(210000);

  infDmg = computed(() => {
    // for now we will ignore troop level, and assume 10
    // const dmg = [40.0506,	41.6628,	43.7000,	45.9054,	48.1965,	50.6572];
    // return dmg[this.tgLevel()];
    return 43.7;
  });

  cavDmg = computed(() => {
    // const dmg = [40.0506,	41.6628,	43.7000,	45.9054,	48.1965,	50.6572];
    // return dmg[this.tgLevel()];
    return 131.1830;
  });

  arcDmg = computed(() => {
    return 211.7104;
  });

  marches = signal<MarchConfig[]>([
    {
      name: 'Rally Lead',
      max_troops: 130000,
      parallel: 1,
      used: 5,
      dmg: 1.0,
    },
    {
      name: 'Join with hero',
      max_troops: 130000,
      parallel: 3,
      used: 30,
      dmg: 1.0,
    },
    {
      name: 'Join without hero',
      max_troops: 90000,
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
          max_troops: 100000,
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
      let config: ScsConfig = {
        infCount: this.infantry(),
        cavCount: this.cavalry(),
        arcCount: this.archers(),
        infDmg: this.infDmg(),
        cavDmg: this.cavDmg(),
        arcDmg: this.arcDmg(),
      };
      const result = await this.scs.solve(config, marchesConfig);
      //console.log('Solver result:', result);

      const formations: Formation[] = result.map((m, i) => {
        return {
          name: marchesConfig[i].name,
          infantry: Math.floor(m.troops[0]),
          cavalry: Math.floor(m.troops[1]),
          archers: Math.floor(m.troops[2]),
          ratio: `${((m.troops[0] / m.max_troops) * 100).toFixed(1)}% / ${((
            m.troops[1] / m.max_troops) *
            100
          ).toFixed(1)}% / ${((m.troops[2] / m.max_troops) * 100).toFixed(1)}%`,
        };
      });

      this.computedResult.set(formations);
    } catch (error) {
      //console.error('Solver failed:', error);
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
