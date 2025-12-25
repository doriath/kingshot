
import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { BEAR_ROUTES } from './bear.routes';
import { MISC_ROUTES } from './misc.routes';
import { SwordlandEventComponent } from './swordland-event/swordland-event';
import { MysticTrialEventComponent } from './mystic-trial-event/mystic-trial-event';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent, title: 'Home' },
    { path: 'swordland', component: SwordlandEventComponent, title: 'Swordland Event' },
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
    {
        path: 'admin/characters',
        loadComponent: () => import('./admin-characters/admin-characters').then(m => m.AdminCharactersComponent),
        title: 'Admin: Character Approvals'
    },
    {
        path: 'vikings',
        loadComponent: () => import('./vikings-event/vikings-list/vikings-list').then(m => m.VikingsListComponent),
        title: 'Vikings Events List'
    },
    {
        path: 'vikings/:id',
        loadComponent: () => import('./vikings-event/vikings-event').then(m => m.VikingsEventComponent),
        title: 'Vikings Event Details'
    },
    {
        path: 'vikings/guide',
        loadComponent: () => import('./vikings-event/vikings-guide/vikings-guide').then(m => m.VikingsGuideComponent),
        title: 'Vikings Event Guide'
    },
    ...BEAR_ROUTES,
    ...MISC_ROUTES,
];
