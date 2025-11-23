
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Space } from './castle-event.models';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CastleEventService } from './castle-event.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, user } from '@angular/fire/auth';

@Component({
  selector: 'app-castle-event',
  templateUrl: './castle-event.html',
  styleUrls: ['./castle-event.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CommonModule, RouterLink]
})
export class CastleEventComponent {
  private castleService = inject(CastleEventService);
  private auth = inject(Auth);
  private user$ = user(this.auth);
  public currentUser = toSignal(this.user$);

  public spaces = toSignal(this.castleService.getSpaces(), { initialValue: [] });
  public newSpaceName = signal('');

  public createSpace(): void {
    if (this.newSpaceName()) {
      const user = this.auth.currentUser;
      if (user) {
        this.castleService.createSpace(this.newSpaceName(), user.uid);
        this.newSpaceName.set('');
      } else {
        // Handle unauthenticated case - maybe prompt login or just alert
        console.error("User must be logged in to create a space");
        // For demo purposes, maybe we allow anonymous or just fail
      }
    }
  }
}
