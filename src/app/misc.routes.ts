import { Routes } from '@angular/router';
import { HeroGearComponent } from './hero-gear/hero-gear';

export const MISC_ROUTES: Routes = [
    {
        path: 'tools/hero-gear',
        component: HeroGearComponent,
        title: 'Hero Gear',
    },
];
