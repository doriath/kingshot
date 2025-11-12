import { Routes } from '@angular/router';
import { HeroGearComponent } from './hero-gear/hero-gear';

export const MISC_ROUTES: Routes = [
    {
        path: 'hero-gear',
        component: HeroGearComponent,
        title: 'Hero Gear',
    },
];
