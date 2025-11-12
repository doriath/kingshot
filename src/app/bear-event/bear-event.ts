import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { March, formations } from './formation.helpers';
import { RulesComponent } from '../rules/rules';

@Component({
  selector: 'app-bear-event',
  imports: [CommonModule, FormsModule, RulesComponent],
  templateUrl: './bear-event.html',
  styleUrls: ['./bear-event.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class BearEventComponent {
  // Define the rules for the event.
  public readonly rules = [
    { text: 'No Sniping! Join first rally first.', help: 'This ensures everyone can join good rallies and it maximizes the total damage of everyone in the alliance.' },
    { text: 'Max 90k troops per join.', help: 'By limiting the join size, we ensure more people can join rallies.' },
    { text: 'Max 3% infantry', help: 'Infantry has the lowest damage, so use minimal amount of infantry troops to best utilize the space.' },
    { text: 'Everyone starts a rally.', help: 'Ensures we can utilize the waves' },
    { text: 'Join with Chenko/Amane/Yeonwoo/Amadeus.', help: 'Ensures maximum damage' },
  ];

  // Form state signals
  public infantry = signal(300_000);
  public cavalry = signal(200_000);
  public archers = signal(300_000);
  public hasAmadeus = signal(false);
  public numMarches = signal(5);
  public damageRatio = signal(1);

  public computedResult = signal<March[] | undefined>(undefined);

  // Method to generate the formations.
  public generateFormations(): void {
    const result = formations(
      this.infantry(),
      this.cavalry(),
      this.archers(),
      this.hasAmadeus(),
      this.numMarches(),
      this.damageRatio()
    );
    this.computedResult.set(result);
  }
}
