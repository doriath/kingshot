import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth.service';
import { UserDataService } from '../user-data.service';

@Component({
  selector: 'app-user-profile',
  imports: [RouterLink],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserProfileComponent {
  private authService = inject(AuthService);
  private userDataService = inject(UserDataService);

  public user = toSignal(this.authService.user$);
  public activeCharacter = this.userDataService.activeCharacter;

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
