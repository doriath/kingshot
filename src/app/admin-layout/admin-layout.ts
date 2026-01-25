import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { UserDataService } from '../user-data.service';
import { AdminBreadcrumbService } from './admin-breadcrumb.service';

@Component({
    selector: 'app-admin-layout',
    templateUrl: './admin-layout.html',
    styleUrl: './admin-layout.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet]
})
export class AdminLayoutComponent {
    private router = inject(Router);
    public userData = inject(UserDataService);
    private breadcrumbService = inject(AdminBreadcrumbService);

    public currentUrl = toSignal(
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            map(e => (e as NavigationEnd).urlAfterRedirects)
        ),
        { initialValue: this.router.url }
    );

    // Breadcrumb logic: simplified for now, splitting URL segments
    public breadcrumbs = computed(() => {
        const url = this.currentUrl();
        const segments = url.split('/').filter(Boolean);
        const labelsMap = this.breadcrumbService.getLabelsMapSignal()();

        let pathAccumulator = '';
        return segments.map((segment, index) => {
            pathAccumulator += `/${segment}`;

            // Check dynamic labels first
            let label = labelsMap.get(segment);

            if (!label) {
                // Fallback to heuristics
                label = segment.charAt(0).toUpperCase() + segment.slice(1);
                // Heuristics for IDs or known segments
                if (segment.length > 20) label = 'Details';
                if (segment === 'admin') label = 'Admin';
                if (segment === 'vikingsEvents') label = 'Vikings Events';
                if (segment === 'swordlandEvents') label = 'Swordland Events';
            }

            return {
                label: decodeURIComponent(label),
                url: pathAccumulator,
                isLast: index === segments.length - 1
            };
        });
    });
}
