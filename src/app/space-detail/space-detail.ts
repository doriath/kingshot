
import { ChangeDetectionStrategy, Component, OnInit, input, signal } from '@angular/core';
import { Space, Enemy } from '../castle-event/castle-event.models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-space-detail',
  templateUrl: './space-detail.html',
  styleUrls: ['./space-detail.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule]
})
export class SpaceDetailComponent implements OnInit {
  public space = signal<Space | undefined>(undefined);
  public id = input.required<string>();
  public newEnemyName = signal('');
  public newAdminName = signal('');

  ngOnInit(): void {
    // In a real application, you would fetch the space data from a service
    // based on the route parameter.
    // For now, we'll create a dummy space
    this.space.set({
      id: this.id(),
      name: `Space ${this.id()}`,
      admins: [],
      enemies: []
    });
  }

  public addEnemy(): void {
    if (this.newEnemyName()) {
      const newEnemy: Enemy = {
        id: crypto.randomUUID(),
        name: this.newEnemyName(),
        defeated: false,
      };
      this.space.update(space => {
        if (space) {
          space.enemies.push(newEnemy);
        }
        return space;
      });
      this.newEnemyName.set('');
    }
  }

  public addAdmin(): void {
    if (this.newAdminName()) {
      this.space.update(space => {
        if (space) {
          space.admins.push(this.newAdminName());
        }
        return space;
      });
      this.newAdminName.set('');
    }
  }

  public toggleEnemyDefeated(enemyId: string): void {
    this.space.update(space => {
      if (space) {
        const enemy = space.enemies.find(e => e.id === enemyId);
        if (enemy) {
          enemy.defeated = !enemy.defeated;
        }
      }
      return space;
    });
  }
}
