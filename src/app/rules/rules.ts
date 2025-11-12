import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Rule {
  text: string;
  help: string;
}

@Component({
  selector: 'app-rules',
  imports: [CommonModule],
  templateUrl: './rules.html',
  styleUrls: ['./rules.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class RulesComponent {
  public rules = input.required<Rule[]>();
  public isContentVisible = signal(true);

  toggleContent(): void {
    this.isContentVisible.update(value => !value);
  }
}
