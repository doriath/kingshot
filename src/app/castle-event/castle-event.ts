
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Space } from './castle-event.models';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-castle-event',
  templateUrl: './castle-event.html',
  styleUrls: ['./castle-event.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CommonModule, RouterLink]
})
export class CastleEventComponent {
  public spaces = signal<Space[]>([]);
  public newSpaceName = signal('');

  public createSpace(): void {
    if (this.newSpaceName()) {
      const newSpace: Space = {
        id: crypto.randomUUID(),
        name: this.newSpaceName(),
        admins: [],
        enemies: [],
      };
      this.spaces.update(spaces => [...spaces, newSpace]);
      this.newSpaceName.set('');
    }
  }
}
