
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
    ...BEAR_ROUTES,
    ...MISC_ROUTES,
];
