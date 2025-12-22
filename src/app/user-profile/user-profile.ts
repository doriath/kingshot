import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-user-profile',
  imports: [RouterLink],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserProfileComponent {
  private authService = inject(AuthService);
  public user = toSignal(this.authService.user$);

  isDropdownOpen = false;

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  signInWithGoogle() {
    this.authService.signInWithGoogle();
    this.isDropdownOpen = false;
  }

  signOut() {
    this.authService.signOut();
    this.isDropdownOpen = false;
  }
}
