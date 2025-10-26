import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-my-research',
  templateUrl: './my-research.html',
  styleUrls: ['./my-research.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyResearchComponent {}