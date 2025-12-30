import { ChangeDetectionStrategy, Component, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { UserProfileComponent } from './user-profile/user-profile';
import { SolverService } from './solver.service';
import { AuthService } from './auth.service';
import { UserDataService } from './user-data.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, UserProfileComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('myapp');

  isSideNavOpen = signal(false);

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private solverService = inject(SolverService);
  private authService = inject(AuthService);
  public userData = inject(UserDataService);

  private user = toSignal(this.authService.user$);

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e: NavigationEnd) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  public showRegistrationHint = computed(() => {
    // Check URL first
    const url = this.currentUrl();
    const isTargetPage = url.startsWith('/vikings') || url.startsWith('/swordland');

    if (!isTargetPage) return false;

    const user = this.user();
    // Hint if: Not logged in OR (Logged in AND No characters)
    if (!user) return true;

    const chars = this.userData.characters();
    return chars.length === 0;
  });

  constructor() {
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route.snapshot.title;
      })
    ).subscribe((title) => {
      if (title) {
        this.title.set(title);
      }
    });
  }

  toggleSideNav() {
    this.isSideNavOpen.set(!this.isSideNavOpen());
  }

  // Add the test method
  async testSolver() {
    if (this.solverService.isSolverLoaded()) {
      console.log('Solver is loaded, running test...');
      const data = { message: 'Hello from Angular!' };
      const result = await this.solverService.solve(data);
      console.log('Solver result:', result);
    } else {
      console.error('Solver is not loaded yet.');
    }
  }
}
