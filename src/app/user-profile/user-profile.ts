import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-user-profile',
  template: `
    <div class="user-profile">
      @if (user()) {
        <button (click)="toggleDropdown()">
          <img [src]="user()?.photoURL" alt="User Avatar" class="avatar">
        </button>
        @if (isDropdownOpen) {
          <div class="dropdown-menu">
            <a (click)="signOut()">Sign Out</a>
          </div>
        }
      } @else {
        <button (click)="toggleDropdown()">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
        </button>
        @if (isDropdownOpen) {
          <div class="dropdown-menu">
            <a (click)="signInWithGoogle()">Sign In with Google</a>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .user-profile {
      position: relative;
    }
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
    }
    .dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      background-color: #333;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 8px;
      min-width: 150px;
      z-index: 1000;
    }
    .dropdown-menu a {
      color: #fff;
      text-decoration: none;
      display: block;
      padding: 8px 12px;
      cursor: pointer;
    }
    .dropdown-menu a:hover {
      background-color: #555;
    }
  `],
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
