import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mystic-trial-event',
  imports: [CommonModule],
  templateUrl: './mystic-trial-event.html',
  styleUrl: './mystic-trial-event.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MysticTrialEventComponent {

}
