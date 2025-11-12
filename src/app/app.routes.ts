import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { BEAR_ROUTES } from './bear.routes';
import { MISC_ROUTES } from './misc.routes';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent, title: 'Home' },
    ...BEAR_ROUTES,
    ...MISC_ROUTES,
];
