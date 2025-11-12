import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { BEAR_ROUTES } from './bear.routes';
import { VIKINGS_ROUTES } from './vikings.routes';
import { SWORDLAND_ROUTES } from './swordland.routes';
import { MISC_ROUTES } from './misc.routes';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent, title: 'Home' },
    ...BEAR_ROUTES,
    ...VIKINGS_ROUTES,
    ...SWORDLAND_ROUTES,
    ...MISC_ROUTES,
];
