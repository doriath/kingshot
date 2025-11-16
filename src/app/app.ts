import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { UserProfileComponent } from './user-profile/user-profile';
import { SolverService } from './solver.service'; // Import the service

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
  private solverService = inject(SolverService); // Inject the service

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
