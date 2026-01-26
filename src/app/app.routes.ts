
import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { BEAR_ROUTES } from './bear.routes';
import { MISC_ROUTES } from './misc.routes';
import { SwordlandEventComponent } from './swordland-event/swordland-event';
import { MysticTrialEventComponent } from './mystic-trial-event/mystic-trial-event';


export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent, title: 'Home' },
    {
        path: 'login',
        loadComponent: () => import('./login/login').then(m => m.LoginComponent),
        title: 'Sign In'
    },
    { path: 'swordland', component: SwordlandEventComponent, title: 'Swordland Event' },
    {
        path: 'swordland/guide',
        loadComponent: () => import('./swordland-event/swordland-guide/swordland-guide').then(m => m.SwordlandGuideComponent),
        title: 'Swordland Event Guide'
    },
    { path: 'mystic-trial', component: MysticTrialEventComponent, title: 'Mystic Trial Event' },
    {
        path: 'castle-event',
        loadComponent: () => import('./castle-event/castle-event').then(m => m.CastleEventComponent),
        title: 'Castle Event'
    },
    {
        path: 'castle-event/:id',
        loadComponent: () => import('./space-detail/space-detail').then(m => m.SpaceDetailComponent),
        title: 'Space Details'
    },
    {
        path: 'manage-characters',
        loadComponent: () => import('./manage-characters/manage-characters').then(m => m.ManageCharactersComponent),
        title: 'Manage Characters'
    },
    // Admin Routes
    {
        path: 'admin',
        loadComponent: () => import('./admin-layout/admin-layout').then(m => m.AdminLayoutComponent),
        children: [
            {
                path: '',
                loadComponent: () => import('./alliances/alliance-admin-list/alliance-admin-list').then(m => m.AllianceAdminListComponent),
                title: 'Admin Dashboard'
            },
            {
                path: 'characters',
                loadComponent: () => import('./admin-characters/admin-characters').then(m => m.AdminCharactersComponent),
                title: 'Admin: Character Approvals'
            },
            {
                path: 'alliances',
                redirectTo: '',
                pathMatch: 'full'
            },
            {
                path: 'alliances/:id/confidence',
                loadComponent: () => import('./alliances/vikings-event-management/vikings-confidence.component').then(m => m.VikingsConfidenceComponent),
                title: 'Manage Vikings Confidence'
            },
            {
                path: 'alliances/:id',
                loadComponent: () => import('./alliances/alliance-management/alliance-management').then(m => m.AllianceManagementComponent)
            },
            {
                path: 'alliances/:allianceId/vikings/:id',
                loadComponent: () => import('./alliances/vikings-event-management/vikings-event-management').then(m => m.VikingsEventManagementComponent),
                title: 'Manage Vikings Event'
            },
            {
                path: 'alliances/:allianceId/vikings/:id/manage',
                loadComponent: () => import('./alliances/vikings-event-management/vikings-event-management').then(m => m.VikingsEventManagementComponent),
                title: 'Manage Vikings Event'
            },
            {
                path: 'alliances/:allianceId/vikings/:id/availability',
                loadComponent: () => import('./alliances/vikings-event-management/vikings-availability/vikings-availability.component').then(m => m.VikingsAvailabilityComponent),
                title: 'Vikings Availability'
            },
            {
                path: 'alliances/:allianceId/vikings/:id/messages',
                loadComponent: () => import('./alliances/vikings-event-management/vikings-message-view/vikings-message-view.component').then(m => m.VikingsMessageViewComponent),
                title: 'Vikings Messaging View'
            },
            {
                path: 'alliances/:allianceId/swordland/:id/manage',
                loadComponent: () => import('./alliances/swordland-event-management/swordland-event-management').then(m => m.SwordlandEventManagementComponent),
                title: 'Manage Swordland Event'
            },
            {
                path: 'svs-prep',
                loadComponent: () => import('./svs-prep-event/admin-svs-prep/admin-svs-prep').then(m => m.AdminSvsPrepComponent),
                title: 'Admin: SvS Preparation'
            },
            {
                path: 'svs-prep/:id',
                loadComponent: () => import('./svs-prep-event/admin-svs-prep-management/admin-svs-prep-management').then(m => m.AdminSvsPrepManagementComponent),
                title: 'Manage SvS Prep Event'
            }
        ]
    },
    // SvS Prep Routes
    {
        path: 'svs-prep',
        loadComponent: () => import('./svs-prep-event/svs-prep/svs-prep').then(m => m.SvsPrepComponent),
        title: 'SvS Preparation'
    },
    // Note: SvS Admin prep routes moved into admin children above

    ...BEAR_ROUTES,
    ...MISC_ROUTES,
];
