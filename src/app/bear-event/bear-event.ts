import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Scs, MarchConfig, Troops } from '../optimization/scs';

interface Formation {
  name: string;
  infantry: number;
  cavalry: number;
  archers: number;
  ratio: string;
}

@Component({
  selector: 'app-bear-event',
  templateUrl: './bear-event.html',
  styleUrls: ['./bear-event.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class BearEventComponent {
  private scs = inject(Scs);

  rules = [
    {
      text: 'No sniping',
      help: 'Sniping is attacking a rally that is already in progress. This is discouraged to ensure everyone gets a fair chance to participate.',
      showHelp: signal(false)
    },
    {
      text: 'Max Infantry = Cavalry / 10',
      help: 'To maximize damage, the number of infantry units should be at most 10% of your cavalry units.',
      showHelp: signal(false)
    },
    {
      text: 'Max join 90k',
      help: 'To ensure smaller players can also participate, the maximum number of troops you can send to a rally is 90,000.',
      showHelp: signal(false)
    },
    {
      text: 'Everyone creates a rally',
      help: 'Everyone should start their own rally. This ensures that we have enough rallies for everyone to join.',
      showHelp: signal(false)
    }
  ];

  // Form properties
  infantry: number = 100000;
  cavalry: number = 100000;
  archers: number = 100000;
  hasAmadeus: boolean = false;
  numMarches: number = 1;
  damageRatio: number = 1.0;

  computedResult = signal<Formation[] | null>(null);

  toggleHelp(rule: any) {
    rule.showHelp.set(!rule.showHelp());
  }

  async generateFormations(): Promise<void> {
    const marchConfigs: MarchConfig[] = [];

    if (this.numMarches > 0) {
        marchConfigs.push({
            name: 'Rally Lead',
            maxTroops: 120000, 
            parallel: 1,
            used: 5, 
            dmg: this.damageRatio,
        });
    }

    const joiningMarches = this.numMarches - 1;
    if (joiningMarches > 0) {
        if (this.hasAmadeus) {
            marchConfigs.push({
                name: 'Join with Amadeus',
                maxTroops: 90000,
                parallel: 1,
                used: 5,
                dmg: this.damageRatio * 1.1, // Assuming Amadeus gives a damage boost
            });
            if (joiningMarches > 1) {
                marchConfigs.push({
                    name: `Join others`,
                    maxTroops: 90000,
                    parallel: joiningMarches - 1,
                    used: 5 * (joiningMarches - 1),
                    dmg: this.damageRatio,
                });
            }
        } else {
             marchConfigs.push({
                name: `Join`,
                maxTroops: 90000,
                parallel: joiningMarches,
                used: 5 * joiningMarches,
                dmg: this.damageRatio,
            });
        }
    }


    try {
        const troops: Troops = {
            infCount: this.infantry,
            cavCount: this.cavalry,
            arcCount: this.archers,
        };

        const result = await this.scs.optimizeBear(troops, marchConfigs);

        const formations: Formation[] = result.map((m, i) => {
            return {
              name: marchConfigs[i].name,
              infantry: Math.floor(m.troops[0]),
              cavalry: Math.floor(m.troops[1]),
              archers: Math.floor(m.troops[2]),
              ratio: `${((m.troops[0] / m.maxTroops) * 100).toFixed(1)}% / ${((m.troops[1] / m.maxTroops) * 100).toFixed(1)}% / ${((m.troops[2] / m.maxTroops) * 100).toFixed(1)}%`,
            };
        });

        this.computedResult.set(formations);
    } catch (error) {
        console.error('Solver failed:', error);
        window.alert("Solver failed");
    }
  }
}
