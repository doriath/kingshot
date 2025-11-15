import { ChangeDetectionStrategy, Component, signal, inject, OnInit, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { RulesComponent } from '../rules/rules';
import { Scs, MarchConfig, Troops } from '../optimization/scs';
import { StorageService } from '../storage.service';

export interface March {
  name: string;
  infantry: number;
  cavalry: number;
  archers: number;
}

@Component({
  selector: 'app-bear-event',
  imports: [CommonModule, FormsModule, RulesComponent],
  templateUrl: './bear-event.html',
  styleUrls: ['./bear-event.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class BearEventComponent implements OnInit {
  private scs = inject(Scs);
  private storageService = inject(StorageService);

  public readonly rules = [
    { text: 'No Sniping! Join first rally first.', help: 'This ensures everyone can join good rallies and it maximizes the total damage of everyone in the alliance.' },
    { text: 'Max 90k troops per join.', help: 'By limiting the join size, we ensure more people can join rallies.' },
    { text: 'Max 3% infantry', help: 'Infantry has the lowest damage, so use minimal amount of infantry troops to best utilize the space.' },
    { text: 'Stop after reaching 1.2B', help: 'This allows others in the alliance to also reach 1.2B and get high rewards.' },
    { text: 'Join with Chenko/Amane/Yeonwoo/Amadeus/Margot.', help: 'Ensures maximum damage' },
    { text: 'Everyone starts a rally.', help: 'Ensures we can utilize the waves' },
  ];

  public infantry = signal(300_000);
  public cavalry = signal(200_000);
  public archers = signal(300_000);
  public hasAmadeus = signal(false);
  public hasMargot = signal(false);
  public numMarches = signal(5);
  public damageRatio = signal(1);
  public joinCapacity = signal(90000);

  public computedResult = signal<March[] | undefined>(undefined);

  constructor() {
    effect(() => {
      this.storageService.setItem('bear-event-settings', {
        infantry: this.infantry(),
        cavalry: this.cavalry(),
        archers: this.archers(),
        hasAmadeus: this.hasAmadeus(),
        hasMargot: this.hasMargot(),
        numMarches: this.numMarches(),
        damageRatio: this.damageRatio(),
        joinCapacity: this.joinCapacity(),
      });
    });
  }

  ngOnInit(): void {
    const settings = this.storageService.getItem<any>('bear-event-settings');
    if (settings) {
      this.infantry.set(settings.infantry || 300_000);
      this.cavalry.set(settings.cavalry || 200_000);
      this.archers.set(settings.archers || 300_000);
      this.hasAmadeus.set(settings.hasAmadeus || false);
      this.hasMargot.set(settings.hasMargot || false);
      this.numMarches.set(settings.numMarches || 5);
      this.damageRatio.set(settings.damageRatio || 1);
      this.joinCapacity.set(settings.joinCapacity || 90000);
    }
  }

  public async generateFormations(): Promise<void> {
    const troops: Troops = {
      infCount: this.infantry(),
      cavCount: this.cavalry(),
      arcCount: this.archers(),
    };

    let joinWithHero = Math.min(this.numMarches(), (this.hasAmadeus() ? 1 : 0) + (this.hasMargot() ? 1 : 0) + 3);
    let joinWithoutHero = Math.min(5, this.numMarches()) - joinWithHero;
    let maxTroops = Math.min(90000, this.joinCapacity());

    const marchConfigs: MarchConfig[] = [
      { name: 'Rally Lead', maxTroops: maxTroops, parallel: 1, used: 5, dmg: this.damageRatio() },
      { name: 'Join with hero x ' + joinWithHero, maxTroops: maxTroops, parallel: joinWithHero, used: joinWithHero * 5 * 3, dmg: 1.0 },
    ];

    if (joinWithoutHero > 0) {
      marchConfigs.push(
        { name: 'Join no hero x ' + joinWithoutHero, maxTroops: maxTroops, parallel: joinWithoutHero, used: joinWithoutHero * 5 * 3, dmg: 1.0 },
      );
    }

    try {
      const results = await this.scs.optimizeBear(troops, marchConfigs);
      const finalResult: March[] = results.map((result, i) => ({
        name: marchConfigs[i].name,
        infantry: Math.round(result.troops[0]),
        cavalry: Math.round(result.troops[1]),
        archers: Math.round(result.troops[2]),
      }));
      this.computedResult.set(finalResult);
    } catch (e) {
      console.error(e);
      alert('Failed to optimize formations. Check console for details.');
    }
  }
}
